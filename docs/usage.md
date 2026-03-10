# Usage Guide

## System Cards

Each configured system gets a color-coded card.

![System Card Connected](../images/system-card-connected.png)

**What each card shows:**

- System name and connection status indicator
- Server status badges with start/stop controls
- Connected devices with battery levels and tracking status

**Card actions:**

| Action | How |
|--------|-----|
| Select system | Click the card |
| Edit, rename, recolor, or remove | Click the edit icon |
| Start/stop servers | Use the server controls on the card |

![Edit System Menu](../images/edit-system-menu.png)

> [!NOTE]
> The default Local Host system cannot be removed.

## Device Controls

![Device Controls](../images/device-controls.png)

- **Haptic ping** — send a vibration to physically identify a device
- **Power off** — shut down the device (if supported by hardware)

## Sidebar

The sidebar shows connection info for the currently selected system. When a system's launcher reports available VR environments, a **dropdown** appears to load them remotely.

![Sidebar](../images/sidebar.png)

## Console

![Console](../images/console.png)

A live log of all events, color-coded by system and severity.

- **Filter** — toggle visibility per system
- **Command input** — send commands to the selected system (press Enter or click Send)
- **Arrow keys** — browse command history
- Type `reset` to clear all systems and restore defaults

## Mini Monitor

Click the monitor icon to pop out a detachable window mirroring the system cards — useful for a secondary display.

![Mini Monitor](../images/mini-monitor.png)

## Default Ports

| Port | Service | Purpose |
|------|---------|---------|
| 8080 | VRServerLauncher | Server lifecycle and environments |
| 8081 | VRDeviceServer | Device monitoring and control |
| 8082 | VRCompositingServer | Compositing status |

> [!TIP]
> Each system can have independently configured ports via its edit menu.
