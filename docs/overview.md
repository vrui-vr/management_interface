# Management Interface

The **Vrui Management Interface** is a browser-based dashboard for managing VR systems running the [Vrui](https://vrui-vr.github.io/) software stack.

![Dashboard Overview](../images/dashboard-overview.png)

## What You Can Do

- **Manage multiple VR systems** from one screen
- **Monitor devices** in real time — battery, tracking, and connection status
- **Control VR servers** — start, stop, and load environments remotely
- **Interact with hardware** — ping devices with haptic feedback, power them off
- **Send commands** via a live console

## Quick Start

> [!NOTE]
> Vrui must be installed and built (`Make.sh`) before the interface can talk to any system.

1. Launch the interface using the **desktop shortcut**, or open `index.html` directly in any browser
2. A default **Local Host** system is created automatically
3. Add more systems with the **+** button
4. The interface polls each system every 3 seconds

No build tools or servers required.

## System States

Each system card shows one of three states:

| State | What It Means |
|-------|---------------|
| **Connected** | Launcher alive and servers running (full color) |
| **Disconnected** | Launcher alive but servers stopped (muted) |
| **Unreachable** | Can't contact launcher (grayed out) |

## Adding a System

![Add System Dialog](../images/add-system-dialog.png)

1. Click the **+** button
2. Enter a **name** and **IP address**
3. Adjust **ports** if needed (defaults: `8080`, `8081`, `8082`)

All configurations are saved automatically and persist across sessions. Type `reset` in the console to start fresh.

## Next Steps

- **[Usage Guide](usage.md)** — How to use the interface
- **[Developer Reference](developer.md)** — Architecture, API, and extending
