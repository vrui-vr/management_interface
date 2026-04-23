# Developer Reference

## Architecture

The interface is **frontend-only** — the browser talks directly to the Vrui C++ backend via HTTP POST to CGI endpoints and optional Server-Sent Events (SSE) streams. No frontend server is involved.

```
Browser (index.html + main.js)
    │
    ├── HTTP POST ──► VRServerLauncher.cgi  :8080   (launcher control + environments)
    ├── SSE       ──► VRServerLauncher/Events.cgi   (push: server start/stop events)
    │
    ├── HTTP POST ──► VRDeviceServer.cgi    :8081   (device status, haptic, power)
    └── SSE       ──► VRDeviceServer/Events.cgi     (push: device state changes)
```

All system state lives in `allSystems[]` in `main.js` and is persisted to `localStorage`.

### File Layout

| File | What It Does |
|------|-------------|
| `index.html` | Page structure and layout |
| `js/main.js` | All logic — state, API calls, rendering, events |
| `css/main.css` | All styling — layout, theming, animations, dark mode |

No build process or framework.

---

## Protocol Versioning

Every Vrui server reports a `protocolVersion` integer in its `getServerStatus` response. The interface reads this on first connect and adjusts its communication strategy accordingly.

### Launcher Protocol

| Version | Transport | How It Works |
|---------|-----------|-------------|
| **v0** | HTTP polling | Interface polls `getServerStatus` every 3 seconds to check server state |
| **v1** | SSE + polling | Launcher pushes `serverStatusUpdated` / `serverStatusChanged` events; polling continues as fallback |

On first connect the interface logs the detected version and mode in the console, e.g.:
```
Vrui 14.1-001 — launcher protocol v1 (SSE)
```

### Device Server Protocol

| Version | Transport | How It Works |
|---------|-----------|-------------|
| **v0** | HTTP polling | Interface polls `getServerStatus` every 3 seconds for device state |
| **v1** | SSE + polling | Device server pushes `deviceStateChanged` events in real time; polling is skipped while SSE is healthy |

On connect the interface logs the transport in use, e.g.:
```
VRDeviceServer online — protocol v1 (SSE)
```

### SSE Watchdog

When SSE is active, the interface monitors the stream for silence. If no event is received for **60 seconds** it logs a warning and sends a manual ping to verify the connection. If the ping fails the stream is closed, the server is marked offline, and the next polling cycle attempts to reconnect.

### Compositing Server Protocol

The compositing server currently uses HTTP polling only (`v0`). Its protocol version is displayed in the sidebar but does not change transport behavior.

---

## API Reference

All communication uses **HTTP POST** with URL-encoded form data (`application/x-www-form-urlencoded`). Responses are **JSON**.

### Launcher Commands (`VRServerLauncher.cgi`)

| Command | Description | Response fields |
|---------|-------------|----------------|
| `getServerStatus` | Get server list with running state | `servers[]`, `protocolVersion`, `vruiVersion` |
| `startServers` | Start all VR servers | `servers[]`, `status` |
| `stopServers` | Stop all VR servers | `servers[]`, `status` |
| `getEnvironments` | List available VR environments | `environments[]` |

Each item in `servers[]` contains:
```json
{
  "name": "VRDeviceServer",
  "isRunning": true,
  "pid": 12345,
  "httpPort": 8081,
  "logFileName": "/tmp/VRDeviceServer.log"
}
```

> [!NOTE]
> The `httpPort` field is the server's actual HTTP port. The interface reads this from launcher responses and uses it to build device/compositing endpoints dynamically, so you don't need to pre-configure those ports on the frontend.

### Launcher SSE Stream (`VRServerLauncher/Events.cgi`)

The launcher pushes events when server state changes:

| Event name | Trigger |
|------------|---------|
| `serverStatusUpdated` | Servers started or a server process exited |
| `serverStatusChanged` | Servers stopped via `stopServers` |

Both events carry the same payload as `getServerStatus` (`servers[]` array).

### Device Server Commands (`VRDeviceServer.cgi`)

| Command | Parameters | Description |
|---------|-----------|-------------|
| `getServerStatus` | — | All device info — battery, tracking, connection, features |
| `hapticTick` | `hapticFeatureIndex`, `duration`, `frequency`, `amplitude` | Send vibration pulse |
| `powerOff` | `powerFeatureIndex` | Power off a device |
| `uploadEnvironment` | `environmentFilePath` | Load a VR environment by file path |

### Device Server SSE Stream (`VRDeviceServer/Events.cgi`)

| Event name | Trigger |
|------------|---------|
| `deviceStateChanged` | Any device connects, disconnects, or changes tracking/battery state |

### Compositing Server Commands (`VRCompositingServer.cgi`)

| Command | Description |
|---------|-------------|
| `getServerStatus` | Get compositing server status and protocol version |

---

## Request Example

```javascript
const response = await fetchWithTimeout(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ command: "startServers" })
}, 5000);
const data = await response.json();
```

---

## Extending

### Adding a New Command

1. Create a function in `main.js` targeting the appropriate endpoint helper:

```javascript
function myNewCommand(system) {
  const endpoint = getServerLauncherEndpoint(system); // or getDeviceServerEndpoint
  fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "myCommand" })
  }, 5000)
    .then(r => r.json())
    .then(data => {
      autoUpdateConsole(system, "myCommand", data.message || "Done.");
      updateSystemUI(system);
    })
    .catch(err => {
      autoUpdateConsole(system, "myCommand", `Failed: ${err.message}`, "error");
    });
}
```

2. Wire it to a button in `renderSystems()` (per-system) or in `index.html` (global).

### Adding to the Polling Loop

The main polling interval runs every 3 seconds. Add your check inside the `setInterval` callback in `main.js` after the existing `pingServerStatus` calls:

```javascript
setInterval(() => {
  allSystems.forEach(system => {
    if (!system.launcherAlive) return;
    // existing checks ...
    myNewCheck(system); // ← add here
  });
}, getServerStatusInterval);
```

### Styling Guidelines

Use existing CSS custom properties for automatic light/dark mode support:

| Variable | Use for |
|----------|---------|
| `--sys-color` | Current system's accent color (set per-card and per-sidebar by JS) |
| `--bg-white` | Card / panel backgrounds |
| `--border-light` | Subtle borders |
| `--text-dark` | Primary text |
| `--text-muted` | Secondary / label text |
| `--status-error` | Error states |

### Modal Dialogs

Use the built-in `showFormModal()` for any user-input dialogs:

```javascript
showFormModal({
  title: "My Dialog",
  submitLabel: "Save",
  colorClass: system.colorClass,
  fields: [
    { key: "name", label: "Name", type: "text", default: "" },
  ],
  onSubmit: ({ name }) => { /* apply values */ }
});
```

For color-only pickers, open a native color input directly instead:

```javascript
const picker = document.createElement('input');
picker.type = 'color';
picker.value = getSysColor(system);
picker.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
document.body.appendChild(picker);
picker.addEventListener('change', () => {
  picker.remove();
  // apply picker.value
});
picker.click();
```
