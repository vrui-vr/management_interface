# Developer Reference

## Architecture

The interface is **frontend-only** — the browser talks directly to the Vrui C++ backend via HTTP POST to CGI endpoints. No frontend server is involved.

```
Browser (index.html + main.js)
    │
    ├── HTTP POST ──► VRServerLauncher.cgi  :8080
    ├── HTTP POST ──► VRDeviceServer.cgi    :8081
    └── HTTP POST ──► VRCompositingServer   :8082
```

The interface polls every system on a **3-second interval**. Requests time out after 5 seconds — unreachable systems get grayed out and retried next cycle.

All system data lives in `allSystems[]` in `main.js` and is persisted to `localStorage`.

### File Layout

| File | What It Does |
|------|-------------|
| `index.html` | Page structure and layout |
| `js/main.js` | All logic — state, API calls, rendering, events |
| `css/main.css` | All styling — layout, theming, animations, dark mode |

No build process or framework.

---

## API Reference

All communication uses **HTTP POST** with URL-encoded form data. Responses are **JSON**.

### Launcher Commands (port 8080)

| Command | Description |
|---------|-------------|
| `isAlive` | Check if the launcher is reachable |
| `getServerStatus` | Get running servers (names, ports, PIDs) |
| `startServers` | Start all VR servers |
| `stopServers` | Stop all VR servers |
| `getEnvironments` | List available VR environments |

### Device Server Commands (port 8081)

| Command | Parameters | Description |
|---------|-----------|-------------|
| `getServerStatus` | — | Get all device info (battery, tracking, connection) |
| `hapticTick` | `deviceName`, `featureIndex` | Send a vibration pulse to a device |
| `powerOff` | `deviceName`, `featureIndex` | Power off a device |

### Compositing Server Commands (port 8082)

| Command | Description |
|---------|-------------|
| `getServerStatus` | Get compositing server status |

### Request Example

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

1. Create a function in `main.js`:

```javascript
async function myNewCommand(system) {
  const endpoint = getServerLauncherEndpoint(system);
  try {
    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ command: "myCommand" })
    });
    const data = await response.json();
    autoUpdateConsole(system, "myCommand", `Result: ${data.status}`);
    updateSystemUI(system);
  } catch (err) {
    autoUpdateConsole(system, "myCommand", `Failed: ${err.message}`, "error");
  }
}
```

2. Add a button or menu item in `renderSystems()` (per-system) or `index.html` (global)

### Adding to Polling

Add your call inside the polling chain after `getDeviceServerStatus()`:

```
checkLauncherAlive(system)
  └── if alive:
        ├── getLauncherStatus(system)
        ├── getDeviceServerStatus(system)
        └── yourNewCheck(system)
```

### Adding UI Elements

- **Sidebar**: add HTML to the sidebar section in `index.html`
- **Main area**: add to `div.main` in `index.html`, or inside `renderSystems()` for per-system elements
- **Styling**: use existing CSS variables (`var(--card-bg)`, `var(--border-color)`) for automatic theme support

### Modal Dialogs

Use the built-in `showFormModal()`:

```javascript
showFormModal({
  title: "My Dialog",
  submitLabel: "Save",
  colorClass: system.colorClass,
  fields: [
    { label: "Name", id: "name", type: "text", value: "" },
  ],
  onSubmit: (values) => { /* values.name */ }
});
```
