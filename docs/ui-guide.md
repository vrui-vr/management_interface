# UI Guide

The management interface is a single-page application with two main regions: the **sidebar** and the **main area**.

## Sidebar

### Header

The sidebar header contains:

- **Vrui logo** — links to the [Vrui documentation site](https://vrui-vr.github.io/)
- **Title** — "Vrui Interface"
- **Documentation link** — opens the Vrui GitHub Pages site
- **Theme toggle** — switches between light and dark mode (preference saved to localStorage)

### Active System Display

Below the header, the currently selected system is shown with its **name** and **connection info** (IP and ports). This updates when you click a different system card.

### Environment Selector

When the active system's launcher reports available VR environments, a dropdown appears here. Select an environment to load it on the remote system.

> [!NOTE]
> The environment selector is hidden by default and only appears when the launcher returns a non-empty environment list.

## Main Area

### System Cards

The system section displays a card for each configured system. Cards are color-coded using one of six color classes (`rig-0` through `rig-5`) for quick visual identification.

#### Card Contents

Each card displays:

- **System name** — click to select, use the edit icon for options (rename, edit connection, change color, remove)
- **Connection indicator** — colored dot showing the system's current state
- **Server status badges** — one badge per running server (name, port, PID), with start/stop controls
- **Device list** — all connected VR devices (headsets and controllers)

#### Device Information

For each device, the card shows:

- **Battery level** — a color-coded bar (green → yellow → red as charge decreases)
- **Connection status** — whether the device is currently connected
- **Tracking status** — whether positional tracking is active
- **Haptic ping button** — sends a vibration pulse to physically identify the device
- **Power off button** — powers down the device (if hardware supports it)

#### Card Interactions

| Action | How |
|--------|-----|
| Select system | Click the card |
| Rename | Edit menu → Rename |
| Edit connection | Edit menu → Edit Connection |
| Change color | Edit menu → Change Color |
| Remove | Edit menu → Remove (Local Host is protected) |
| Start servers | Click the start button on a disconnected system |
| Stop servers | Click the stop button on a connected system |

### Console

The console section provides a live log of all events and commands.

#### Messages

Each message includes:

- **Timestamp** — when the event occurred
- **System name** — color-coded to match the system card
- **Severity** — normal (default), warning (yellow), or error (red)
- **Content** — the event description or command result

#### Filtering

Click the **Filter** button to show checkboxes for each system. Uncheck a system to hide its messages from the console. Filter state is maintained during the session.

#### Command Input

Type a command in the input field and press **Send** or hit Enter. Commands are sent to the currently selected system.

**Special commands:**

| Command | Effect |
|---------|--------|
| `reset` | Clears all systems and resets to defaults |

Command history is available via the **up/down arrow keys**.

### Mini Monitor

Click the monitor icon (top-right of the system section) to open a **detachable popup window** that mirrors the system cards. This is useful for placing system status on a secondary display while working in another application.

## Dark Mode

Toggle dark mode via the sun/moon button in the sidebar header. The preference is saved to localStorage and applied on future visits. The entire UI — cards, console, sidebar, modals — adapts to the selected theme.
