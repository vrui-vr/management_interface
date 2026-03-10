# Getting Started

## Prerequisites

- The **Vrui application** must be installed and built via `Make.sh`
- A **modern web browser** (Chrome, Firefox, Edge, etc.)
- One or more **Vrui systems** accessible on the network

## Running the Interface

Open `index.html` in any browser. That's it — no build tools, no install step.

```bash
# From the management_interface directory
xdg-open index.html      # Linux
```

## First Connection

On first load, the interface creates a default **Local Host** system pointing to `127.0.0.1:8080`. If the Vrui launcher is running locally, the system card will turn from gray to its assigned color within a few seconds.

### System States

Each system card shows one of three visual states:

| State         | Meaning                              | Appearance   |
|---------------|--------------------------------------|--------------|
| **Connected**     | Launcher alive and servers running   | Full color   |
| **Disconnected**  | Launcher alive, servers stopped      | Faded/muted  |
| **Unreachable**   | Cannot contact launcher              | Grayed out   |

## Adding a System

1. Click the **+** button in the system section
2. Enter a **name** for the system (e.g., "Lab Rig 2")
3. Enter the **IP address** (e.g., `192.168.1.50`)
4. Configure **ports** (defaults: launcher `8080`, device server `8081`, compositing `8082`)
5. The new system card appears and begins polling immediately

## Persistence

All system configurations are stored in the browser's `localStorage`. Your systems, names, ports, and theme preference survive page reloads and browser restarts. To reset everything, type `reset` in the console command input.

## Default Ports

| Port | Service                | Purpose                        |
|------|------------------------|--------------------------------|
| 8080 | VRServerLauncher.cgi   | Server lifecycle, environments |
| 8081 | VRDeviceServer.cgi     | Device monitoring and control  |
| 8082 | VRCompositingServer.cgi| Compositing server status      |

> [!TIP]
> Each system can have independently configured ports. If your Vrui installation uses non-default ports, edit them via the system card's context menu.
