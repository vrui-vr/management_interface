# The superfluous connection to VRDeviceServer / VRCompositingServer

Branch: `fix/superfluous-server-connection`

This documents Oliver's "connection C", why it existed, how it was removed, and what was
measured. It also records what is *still* a Vrui-side problem, so the two do not get
conflated.

---

## What Oliver observed

> * Connection A from VRServerLauncher to query status, closes immediately
> * Connection B from front-end for SSE, stays open
> * Connection C from front-end, not SSE, stays open
>
> Upon shutdown, only the SSE connection B gets closed by the front-end, and the remaining
> extra connection C blocks the port. However, two minutes after starting the server, C
> closes itself. Connection C is only opened when the interface actively starts the servers.

All three of those details were reproduced and each one is explained below.

## What connection C actually was

`startAndCheckServers()` used to do its own two-phase verification after the launcher
reported the servers started:

```js
// Phase 1: confirm tracking driver (device server, index 0)
fetchWithTimeout(getDeviceServerEndpoint(system), {...}, 5000)      // <-- no `system`
// Phase 2: confirm compositor (index 1)
fetchWithTimeout(getCompositingServerEndpoint(system), {...}, 5000) // <-- no `system`
```

The helper's signature is:

```js
function fetchWithTimeout(resource, options = {}, timeout = 5000, system = null) {
  const controller = new AbortController();
  if (system) {                     // only tracked when `system` is passed
    system.pendingControllers.add(controller);
  }
  ...
}
```

The fourth argument is what registers the request's `AbortController` in
`system.pendingControllers`, and `abortSystemFetches()` only iterates that set. **Both
verification calls omitted it**, so they were invisible to the cleanup code — which is
exactly why Oliver saw a connection that "doesn't get shut down by `abortSystemFetches()`
or `closeServerSSEs()`".

Once such a request completes, the browser keeps its TCP connection in the HTTP keep-alive
pool, idle but `ESTABLISHED`. Nothing in the page ever touched it again.

This maps onto Oliver's observations exactly:

| Observation | Explanation |
|---|---|
| C is not SSE | It is a plain `POST getServerStatus` to `VRDeviceServer.cgi` / `VRCompositingServer.cgi` |
| C only appears when the interface actively starts the servers | Phase 1/2 only ran inside `startAndCheckServers()`. When the page loads against already-running servers, status goes through `pingServerStatus()`, which *does* pass `system` and is therefore tracked |
| C is not closed by the cleanup functions | It was never registered in `pendingControllers` |
| C closes itself about two minutes later | The browser's idle keep-alive timeout eventually reaps the pooled socket (Firefox's default is 115 s) |

### Why it was superfluous

`revealUI()` calls `getLauncherStatus()`, which already loops over the launcher's server
list and calls `pingServerStatus(system, index, endpoint)` for each running server.
`pingServerStatus` does everything Phase 1/2 did — records `protocolVersion`, loads device
data via `updateSystemWithJsonData()`, and subscribes to SSE — but through a *tracked*
fetch. The two phases were duplicating work that was about to happen anyway.

## The fix

1. **Removed the Phase 1/2 verification block** from `startAndCheckServers()`. After the
   launcher confirms the servers started, it now hands straight off to `revealUI()`, which
   goes through the normal `getLauncherStatus()` → `pingServerStatus()` path. That is the
   same path the page uses when it finds the servers already running — the path Oliver
   confirmed does not leak.

2. **Deleted two dead functions**, `getDeviceServerStatus()` and
   `getCompositingServerStatus()`. Both were unreferenced, both made *untracked* requests to
   8081/8082, and one was already marked `DEPRECATED, use pingServerStatus instead`. They
   were latent copies of the same bug.

3. **Tracked the remaining live requests to 8081**: `uploadEnvironment()`, `hapticTick()`
   and `powerOff()` now pass `system` to `fetchWithTimeout`. The latter two were previously
   raw `fetch()` calls with no `AbortController` and no timeout at all, so they could never
   be cancelled and could hang indefinitely.

4. **Cleared `connected` when the device server stops answering.** `pingServerStatus` sets
   `system.connected = true` when the device server replies but never cleared it on failure.
   That was masked before, because Phase 1 would abort startup outright; with Phase 1 gone,
   a system whose tracking driver had died still read as connected. The failure path is now
   symmetric with the success path.

Two further problems turned up while testing launcher handling. Both pre-date this branch —
they are in `develop` and in `restart_system_improvements` — but they are squarely part of
"what happens when VRServerLauncher goes away", so they are fixed here:

5. **The interface never reconnected to a launcher that came back.** The status loop began
   with `if (!system.launcherAlive) return;`, so once the launcher was marked dead the system
   was skipped forever and only a page reload recovered it. It now re-checks the launcher on
   each tick. `getServerStatus` is in `POLLING_COMMANDS`, so the console entry updates in
   place instead of accumulating one error per attempt.

6. **A dead launcher was not even detected** if its servers had been running. The loop only
   re-polled the launcher when a server reported `isRunning === false`, but `isRunning` comes
   from the launcher and goes stale the instant it dies. So the loop pinged the two dead
   servers forever, `launcherAlive` stayed `true`, and the fix above could never engage. The
   condition now also re-polls the launcher when a server cannot actually be reached
   (`status` is `offline` or `error`).

Requests to the **launcher** (8080) are deliberately left untracked: the launcher stays up
across a restart, so a pooled connection to it blocks nothing, and `stopServers` /
`startServers` must be allowed to finish rather than be aborted underneath us.

## How it was tested

Vrui was not rebuilt for this. Instead `tools/mock_vrui.py` (run it with `python3
tools/mock_vrui.py`) stands in for the three servers and reproduces the parts that matter:

* binds its listening sockets **without `SO_REUSEADDR`**, like `Comm::ListeningTCPSocket`
* speaks HTTP/1.1 with keep-alive, so idle pooled connections stay open
* serves `Events.cgi` SSE on all three ports
* logs every TCP connection with the port it landed on and whether it is SSE or a plain
  command connection, so connections can be counted the way Oliver counted them
* `/debug/connections`, `/debug/reset`, and `/debug/mode?m=…` for failure injection

The old code (`develop`) and the fixed code were served side by side and driven through the
identical sequence.

### Connection counts

Actively starting the servers, then stopping them:

| | 8081 after start | 8082 after start | 8081 after stop | 8082 after stop |
|---|---|---|---|---|
| `develop` (before) | 1 × SSE | 1 × SSE **+ 1 × command** | 0 | **1 × command — leaked** |
| this branch (after) | 1 × SSE | 1 × SSE | 0 | 0 |

The leaked `command` connection on 8082 survived both `abortSystemFetches()` and
`closeServerSSEs()`, reproducing Oliver's report. After the fix nothing remains on either
port once the servers are stopped.

### Restart cycles

Five consecutive restarts, measuring after each. Connections stayed at exactly one SSE per
port and the total number of connections ever opened rose by exactly two per cycle, so
nothing accumulates:

```
cycle1: 8081=[SSE] 8082=[SSE] connected=true statuses=[online,online] totalEver=16
cycle2: 8081=[SSE] 8082=[SSE] connected=true statuses=[online,online] totalEver=18
cycle3: 8081=[SSE] 8082=[SSE] connected=true statuses=[online,online] totalEver=20
cycle4: 8081=[SSE] 8082=[SSE] connected=true statuses=[online,online] totalEver=22
cycle5: 8081=[SSE] 8082=[SSE] connected=true statuses=[online,online] totalEver=24
```

### Failure handling

| Injected failure | Result |
|---|---|
| `startServers` fails | `onFail` callback fires, `connected=false`, `startupPhase` cleared (no stuck spinner), `isConnecting=false`, error shown in console |
| Launcher claims the device server is running but nothing is listening on 8081 | Device server marked `offline`, no SSE opened to it, compositor still `online`, `connected=false`, no stuck spinner |
| Whole launcher killed | `launcherAlive=false`, `connected=false`, every SSE closed, no leaked `pendingControllers`, one console entry rather than one per retry |
| Launcher killed, then restarted | Recovers on its own **without a page reload**: `launcherAlive=true`, both servers `online`, both SSEs reopened, device data reloaded, still exactly one SSE per port |

The second case is the one Phase 1 used to catch explicitly. It is still caught, now through
`pingServerStatus`'s error path, and the UI shows which of the two servers is actually down
instead of a generic startup failure.

The last two cases both failed before the fixes in points 5 and 6 above: killing the
launcher while its servers were up left `launcherAlive` stuck at `true` indefinitely, and
even once it did go false the interface never reconnected.

## Still a Vrui-side problem

Removing connection C removes the front-end's contribution, but it does not make the port
reuse safe on its own. Two things were verified on Linux with small C programs
(`~/porttest/`):

```
TIME_WAIT remnants:      SO_REUSEADDR=0 -> bind: Address already in use   |  =1 -> OK
still-ESTABLISHED conn:  SO_REUSEADDR=0 -> bind: Address already in use   |  =1 -> OK
```

So *any* lingering socket on the port — a connection the front-end has not closed yet, a
connection from the launcher's own health checks, or a `TIME_WAIT` remnant of a connection
the server itself closed — blocks the rebind for as long as it lasts. `Comm::ListeningTCPSocket`
still binds without `SO_REUSEADDR`, and `VRServerLauncher.cpp:1032` still carries a
`usleep(1000000)` commented *"wait for a bit to let the server launcher's HTTP socket close
down"*, which is a 1-second sleep against a 60-second timer.

The three-line `setsockopt(SO_REUSEADDR)` change is still the actual fix; see the separate
brief. Note that `SO_REUSEADDR` is not the dangerous option — it does not permit two live
listeners on one port. `SO_REUSEPORT` is the risky one and is not being proposed.

## Known issue left alone

`sendConsoleCommand()` (`js/main.js`, marked `TODO: CURRENTLY NOT VERY USEFUL`) references a
bare `system` identifier that does not exist in its scope, so any non-`reset` console command
throws `ReferenceError: system is not defined` before the request is even built. It is
therefore not a live connection leak, and fixing it means deciding what the console should
actually do, which is a product decision rather than part of this fix. Flagging it rather
than half-fixing it.
