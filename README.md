# Vrui Management Interface

A browser-based dashboard for managing systems running the [Vrui](https://Vrui-vr.github.io/) (Virtual Reality User Interface) software stack. This interface replaces manual console commands with a dynamic web UI for remote control and monitoring of multiple VR devices and systems over a network.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [UI Layout](#ui-layout)
- [Backend Communication](#backend-communication)
- [State Management](#state-management)
- [Key Modules & Functions](#key-modules--functions)
- [Configuration](#configuration)
- [Extending the Interface](#extending-the-interface)

---

## Getting Started

### Prerequisites

- The Vrui application must be installed and built (`Make.sh`)
- A modern web browser (Chrome, Firefox, Edge, etc.)
- One or more Vrui systems accessible on the network

### Running

Open `index.html` in any modern browser. No build tools, package managers, or servers are required — the interface is pure HTML, CSS, and vanilla JavaScript.

On first load, a default **Local Host** system (`127.0.0.1:8080`) is created. Additional systems can be added through the UI.

### Tech Stack

| Layer    | Technology                |
|----------|---------------------------|
| Markup   | HTML5                     |
| Styling  | CSS3 (variables, animations, dark mode) |
| Logic    | Vanilla ES6 JavaScript    |
| HTTP     | Fetch API with AbortController timeouts |
| Storage  | Browser localStorage      |
| Font     | Google Fonts (Inter)      |

---

## Project Structure

```
management_interface/
├── index.html             # Entry point — defines the full page layout
├── css/
│   └── main.css           # All styling (~3,000 lines): theming, layout, components
├── js/
│   └── main.js            # All application logic (~2,900 lines): state, API, rendering
├── images/
│   └── vruilogo.jpg       # Sidebar logo
└── README.md
```

This is a **single-page application** with no build step. The entire frontend lives in three files.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     Browser (Frontend)                   │
│                                                          │
│  index.html ──► main.js ──► Fetch API ──► HTTP POST ────┤──►  Vrui Backend (C++)
│                   │                                      │
│                   ├── State (allSystems[], localStorage)  │     ┌─────────────────────┐
│                   ├── Rendering (DOM manipulation)        │     │ VRServerLauncher.cgi │ :8080
│                   └── Polling (setInterval @ 3s)          │     │ VRDeviceServer.cgi   │ :8081
│                                                          │     │ VRCompositingServer   │ :8082
└──────────────────────────────────────────────────────────┘     └─────────────────────┘
```

The frontend communicates with the **Vrui C++ backend** via HTTP POST requests with URL-encoded form data. Responses come back as JSON. There is no frontend build process or server — the browser talks directly to the Vrui CGI endpoints.

---

## UI Layout

The interface has two main regions:

### Sidebar (`div.sidebar`)
- **Header**: Logo (links to Vrui docs), app title, dark mode toggle
- **Active system display**: Shows the currently selected system name and connection info
- **Environment selector**: Dropdown to load VR environments (hidden until environments are fetched from the launcher)

### Main Area (`div.main`)

#### System Cards (`div.system-section`)
Each system you add gets a card showing:
- **System name** (click to select, right-click or edit icon for options)
- **Connection indicator**: colored dot showing online/offline/unreachable
- **Server status**: badges for each server (compositor, tracker, etc.) with start/stop controls
- **Device list**: headsets and controllers with:
  - Battery level (color-coded bar: green > yellow > red)
  - Connection status
  - Tracking status
  - Haptic ping button (vibrate a device to identify it)
  - Power off button

Cards use one of six color classes (`rig-0` through `rig-5`) for visual distinction.

**Three visual states per system:**
| State | Meaning | Appearance |
|-------|---------|------------|
| Connected | Launcher alive + servers running | Full color |
| Disconnected | Launcher alive, servers stopped | Faded/muted |
| Unreachable | Cannot contact launcher | Grayed out |

#### Console (`div.console-section`)
- **Live message log**: timestamped, color-coded by system and severity (normal/warning/error)
- **Filter**: toggle checkboxes per system to show/hide their messages
- **Command input**: type commands and send them to the active system
- **Special command**: typing `reset` clears all systems and resets to defaults

#### Mini Monitor
A detachable popup window (via the monitor icon button) that mirrors system cards for a secondary display.

---

## Backend Communication

All API calls go through `fetchWithTimeout()`, which wraps the Fetch API with an AbortController (default 5-second timeout).

### Endpoints

Each system has three configurable ports, each serving a CGI endpoint:

| Endpoint | Default Port | Purpose |
|----------|-------------|---------|
| `VRServerLauncher.cgi` | 8080 | Manage VR server lifecycle and environments |
| `VRDeviceServer.cgi` | 8081 | Monitor and control VR devices |
| `VRCompositingServer.cgi` | 8082 | Compositing server status |

### Commands by Endpoint

**VRServerLauncher.cgi:**
| Command | Description |
|---------|-------------|
| `isAlive` | Check if the launcher is reachable |
| `getServerStatus` | Get running server info (names, ports, PIDs) |
| `startServers` | Start all VR servers |
| `stopServers` | Stop all VR servers |
| `getEnvironments` | List available VR environments |

**VRDeviceServer.cgi:**
| Command | Description |
|---------|-------------|
| `getServerStatus` | Get device info (battery, tracking, connection) |
| `hapticTick` | Send haptic pulse to a device for identification |
| `powerOff` | Power off a device |

### Request Format

```javascript
// All requests are POST with URL-encoded form data
const response = await fetchWithTimeout(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ command: "getServerStatus" })
}, 5000);
const data = await response.json();
```

URL builders for each endpoint:
- `getServerLauncherEndpoint(system)` → `http://{ip}:{serverLauncherPort}/VRServerLauncher.cgi`
- `getDeviceServerEndpoint(system)` → `http://{ip}:{deviceServerPort}/VRDeviceServer.cgi`
- `getCompositingServerEndpoint(system)` → `http://{ip}:{compositingServerPort}/VRCompositingServer.cgi`

---

## State Management

### Global Variables

```javascript
let allSystems = [];           // Array of all system objects
const activeSystems = new Set(); // Names of systems currently online
let currentSystem = "";         // Name of the selected system
let getStatusUpdates = true;    // Global polling toggle
const filterState = new Set();  // Console filter: which systems to show
```

### System Object Shape

Each entry in `allSystems` looks like:

```javascript
{
  name: "Local Host",
  ip: "127.0.0.1",
  serverLauncherPort: "8080",
  deviceServerPort: "8081",
  compositingServerPort: "8082",
  connected: false,             // true when launcher alive AND servers running
  launcherAlive: false,         // true when launcher responds to isAlive
  servers: [],                  // array of server info from launcher
  devices: {},                  // device data from device server
  colorClass: "rig-0",         // visual color class (rig-0 through rig-5)
  colorOverride: ""            // optional custom color
}
```

### Persistence

Systems are saved to `localStorage` under the key `"savedSystems"` as a JSON array. On page load, saved systems are restored via `normalizeSystems()`, which fills in any missing fields with defaults. The theme preference (`"dark"` or `"light"`) is also stored in localStorage.

---

## Key Modules & Functions

### System Management
| Function | Description |
|----------|-------------|
| `addSystem()` | Opens a modal to create a new system (name, IP, ports) |
| `removeSystem(name)` | Deletes a system (Local Host is protected) |
| `renameSystem(system)` | Inline rename via edit menu |
| `showEditConnectionModal(system)` | Modal to change IP/port settings |
| `changeSystem(name)` | Switch the active/selected system |

### Status Polling
| Function | Description |
|----------|-------------|
| `checkLauncherAlive(system)` | Ping the launcher's `isAlive` endpoint |
| `getLauncherStatus(system)` | Fetch server list and status from launcher |
| `getDeviceServerStatus(system)` | Fetch device battery/tracking/connection data |
| `pingServerStatus(system, i, endpoint)` | Verify a specific server is responding |

Polling runs on a `setInterval` loop at `getServerStatusInterval` (3 seconds). Each cycle calls `checkLauncherAlive` for every system — if alive, it chains into `getLauncherStatus` and `getDeviceServerStatus`.

### Device Control
| Function | Description |
|----------|-------------|
| `sendHapticTick(system, device, feature)` | Vibrate a device for identification |
| `sendPowerOff(system, device, feature)` | Power off a device |
| `startLauncherServers(system)` | Start VR servers via the launcher |
| `stopLauncherServers(system)` | Stop VR servers via the launcher |
| `uploadEnvironment(system, path)` | Load a VR environment |

### Rendering
| Function | Description |
|----------|-------------|
| `renderSystems(systems)` | Build/rebuild all system cards in the DOM |
| `updateSystemUI(system)` | Refresh a single system's card |
| `updateInterface()` | Full UI refresh (sidebar, buttons, dropdowns) |
| `createBattery(...)` | Generate a battery indicator widget |
| `autoUpdateConsole(system, cmd, msg)` | Append a message to the console log |

### UI Utilities
| Function | Description |
|----------|-------------|
| `showFormModal({...})` | Reusable modal dialog for forms |
| `showEditMenu(e, system, field)` | Context menu for inline editing |
| `initDarkModeToggle()` | Set up light/dark theme switching |
| `openMiniMonitor()` | Launch detachable monitor popup |
| `applyConsoleFilter()` | Show/hide console messages by system |

---

## Configuration

### Runtime Constants (top of main.js)

```javascript
const getServerStatusInterval = 3000;       // ms between status polls
const pingResumeDelayAfterConnect = 5000;   // ms delay after connect before resuming polls
let getStatusUpdates = true;                // toggle automatic polling
let showEmptyEnvironmentDropdown = false;   // show env dropdown when no environments exist
```

### CSS Theming (main.css)

The UI uses CSS custom properties (`:root` variables) for colors and spacing. Dark mode is activated via `[data-theme="dark"]` on the `<html>` element. Six system color classes (`rig-0` through `rig-5`) provide distinct visual identities for each system card.

---

## Extending the Interface

### Adding a new system action

1. Add a function in `main.js` that calls the appropriate CGI endpoint using `fetchWithTimeout()`
2. Handle the JSON response and update the system object
3. Call `updateSystemUI(system)` or `renderSystems(allSystems)` to refresh the display
4. Log results via `autoUpdateConsole(system, commandName, message)`

### Adding a new UI element

1. Add HTML markup in `index.html` (sidebar for controls, main area for displays)
2. Style it in `main.css` — use existing CSS variables for theme consistency
3. Wire up event handlers in `main.js`

### Adding a new backend command

1. Identify which CGI endpoint handles the command
2. Use the existing pattern:
```javascript
async function myNewCommand(system) {
  const endpoint = getServerLauncherEndpoint(system); // or device/compositing
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ command: "myCommand", ...params })
  });
  const data = await response.json();
  // Process response...
}
```
