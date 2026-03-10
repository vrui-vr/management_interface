# API Reference

The frontend communicates with the Vrui C++ backend through three CGI endpoints. All requests use HTTP POST with URL-encoded form data. All responses are JSON.

## Request Format

Every request follows the same pattern:

```javascript
const response = await fetchWithTimeout(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ command: "commandName", ...params })
}, 5000);
const data = await response.json();
```

## Endpoint Builders

Three helper functions construct endpoint URLs from a system object:

| Function | URL Pattern |
|----------|-------------|
| `getServerLauncherEndpoint(system)` | `http://{ip}:{serverLauncherPort}/VRServerLauncher.cgi` |
| `getDeviceServerEndpoint(system)` | `http://{ip}:{deviceServerPort}/VRDeviceServer.cgi` |
| `getCompositingServerEndpoint(system)` | `http://{ip}:{compositingServerPort}/VRCompositingServer.cgi` |

## VRServerLauncher.cgi

**Default port:** 8080

Manages the VR server lifecycle and environments.

### `isAlive`

Check if the launcher process is reachable.

| Parameter | Value |
|-----------|-------|
| `command` | `isAlive` |

**Used by:** `checkLauncherAlive()` — called every polling cycle to determine if a system is online.

---

### `getServerStatus`

Get information about running VR servers.

| Parameter | Value |
|-----------|-------|
| `command` | `getServerStatus` |

**Response:** JSON object containing server names, ports, and PIDs.

**Used by:** `getLauncherStatus()` — updates `system.servers` and `system.connected`.

---

### `startServers`

Start all VR servers on the system.

| Parameter | Value |
|-----------|-------|
| `command` | `startServers` |

**Used by:** `startLauncherServers()` — triggered by the start button on a system card.

---

### `stopServers`

Stop all running VR servers.

| Parameter | Value |
|-----------|-------|
| `command` | `stopServers` |

**Used by:** `stopLauncherServers()` — triggered by the stop button on a system card.

---

### `getEnvironments`

List available VR environments that can be loaded.

| Parameter | Value |
|-----------|-------|
| `command` | `getEnvironments` |

**Response:** JSON array of environment file paths.

**Used by:** `getEnvironments()` — populates the environment selector dropdown.

---

## VRDeviceServer.cgi

**Default port:** 8081

Monitors and controls connected VR devices (headsets, controllers).

### `getServerStatus`

Get device information including battery, tracking, and connection state.

| Parameter | Value |
|-----------|-------|
| `command` | `getServerStatus` |

**Response:** JSON object with device data (names, battery percentages, tracking status, connection status, supported features).

**Used by:** `getDeviceServerStatus()` — called every polling cycle for online systems. Response is processed by `updateSystemWithJsonData()`.

---

### `hapticTick`

Send a haptic vibration pulse to a specific device for physical identification.

| Parameter | Value |
|-----------|-------|
| `command` | `hapticTick` |
| `deviceName` | Name of the target device |
| `featureIndex` | Index of the haptic feature |

**Used by:** `sendHapticTick()` — triggered by the ping button next to each device.

---

### `powerOff`

Power off a connected device.

| Parameter | Value |
|-----------|-------|
| `command` | `powerOff` |
| `deviceName` | Name of the target device |
| `featureIndex` | Index of the power feature |

**Used by:** `sendPowerOff()` — triggered by the power button next to each device.

---

## VRCompositingServer.cgi

**Default port:** 8082

Provides compositing server status.

### `getServerStatus`

Get the compositing server's current status.

| Parameter | Value |
|-----------|-------|
| `command` | `getServerStatus` |

**Used by:** `getCompositingServerStatus()`.

> [!NOTE]
> The compositing server status is also available through the launcher's `getServerStatus` response. Direct queries to this endpoint are used less frequently.

## Timeout Handling

All requests use a 5-second timeout via `fetchWithTimeout()`. If a request times out:

1. The `AbortController` cancels the in-flight fetch
2. The system is marked as unreachable (`launcherAlive = false`)
3. The system card grays out
4. A timeout message is logged to the console

The next polling cycle (3 seconds later) will retry the connection automatically.
