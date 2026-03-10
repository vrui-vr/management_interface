# Architecture

## Overview

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

The interface is a **frontend-only** application. There is no frontend server — the browser communicates directly with the Vrui C++ backend via HTTP POST requests to CGI endpoints. Responses are JSON.

## State Management

### Global Variables

All application state lives in a few top-level variables in `main.js`:

```javascript
let allSystems = [];             // Array of all system objects
const activeSystems = new Set(); // Names of systems currently online
let currentSystem = "";          // Name of the selected system
let getStatusUpdates = true;     // Global polling toggle
const filterState = new Set();   // Console filter: which systems to show
```

### System Object

Each entry in `allSystems` has this shape:

```javascript
{
  name: "Local Host",
  ip: "127.0.0.1",
  serverLauncherPort: "8080",
  deviceServerPort: "8081",
  compositingServerPort: "8082",
  connected: false,             // launcher alive AND servers running
  launcherAlive: false,         // launcher responds to isAlive
  servers: [],                  // server info from launcher
  devices: {},                  // device data from device server
  colorClass: "rig-0",         // visual color (rig-0 through rig-5)
  colorOverride: ""            // optional custom color
}
```

### Persistence

Systems are serialized to `localStorage` under the key `"savedSystems"`. On page load, `normalizeSystems()` restores them and fills in any missing fields with defaults.

The dark mode preference is stored separately in localStorage.

## Polling Loop

The interface polls every system on a 3-second interval (`getServerStatusInterval`):

```
setInterval (every 3s)
  └── for each system in allSystems:
        ├── checkLauncherAlive(system)
        │     └── POST isAlive → VRServerLauncher.cgi
        │           ├── alive → getLauncherStatus(system)
        │           │             ├── POST getServerStatus
        │           │             └── update system.servers, system.connected
        │           └── alive → getDeviceServerStatus(system)
        │                         ├── POST getServerStatus → VRDeviceServer.cgi
        │                         └── update system.devices (battery, tracking, etc.)
        └── updateSystemUI(system)
```

When `getStatusUpdates` is toggled off, polling pauses. After a system first connects, there is a `pingResumeDelayAfterConnect` (5 second) delay before polling resumes to allow servers to stabilize.

## Rendering Pipeline

The UI updates through three main paths:

| Function | Scope | When Used |
|----------|-------|-----------|
| `renderSystems(systems)` | Full rebuild of all system cards | System added/removed, initial load |
| `updateSystemUI(system)` | Single card refresh | Status poll results |
| `updateInterface()` | Sidebar, buttons, dropdowns | System selection change, connection state change |

### Optimizations

- **Change detection**: Cards are only rebuilt when data actually changes
- **Battery fast path**: Battery percentage updates skip the full card rebuild
- **Selective DOM updates**: Only modified elements are touched
- **AbortController**: Stale requests are canceled on timeout (5s default)

## Request Handling

All HTTP calls go through `fetchWithTimeout()`:

```javascript
function fetchWithTimeout(resource, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(resource, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}
```

This ensures that unreachable systems don't block the polling loop — requests time out after 5 seconds and the system is marked as unreachable.

## File Organization

The entire application is split across three files:

| File | Lines | Responsibility |
|------|-------|----------------|
| `index.html` | ~178 | Page structure, element IDs, inline SVG icons |
| `js/main.js` | ~2,900 | All logic: state, API calls, rendering, event handlers |
| `css/main.css` | ~3,000 | All styling: layout, theming, animations, dark mode |

There is no build process, bundler, or framework. The browser loads these files directly.
