# Management Interface

The **Vrui Management Interface** is a browser-based dashboard for managing and monitoring systems running the [Vrui](https://vrui-vr.github.io/) software stack. It replaces manual console commands with a dynamic web UI for remote control of multiple VR devices and systems over a network.

## What It Does

- **Add and manage multiple VR systems** by IP address and port
- **Monitor device status** in real time — battery levels, tracking, and connection state for headsets and controllers
- **Control VR services** remotely — start/stop servers, load environments
- **Interact with hardware** — ping haptic devices for identification, power off devices
- **Send commands** via a live console with per-system filtering
- **Persist configuration** across sessions using browser localStorage

## Quick Start

> [!NOTE]
> The Vrui application must be installed and built (`Make.sh`) before the interface can communicate with any system.

1. Open `index.html` in any modern browser
2. A default **Local Host** system (`127.0.0.1:8080`) is created automatically
3. Click the **+** button on any system card to add more systems
4. The interface begins polling each system for status every 3 seconds

No build tools, package managers, or servers are required — the interface is pure HTML, CSS, and vanilla JavaScript.

## Tech Stack

| Layer   | Technology                                        |
|---------|---------------------------------------------------|
| Markup  | HTML5                                             |
| Styling | CSS3 (custom properties, animations, dark mode)   |
| Logic   | Vanilla ES6 JavaScript                            |
| HTTP    | Fetch API with AbortController timeouts           |
| Storage | Browser localStorage                              |
| Font    | Google Fonts (Inter)                               |

## Project Structure

```
management_interface/
├── index.html             # Entry point — full page layout
├── css/
│   └── main.css           # All styling: theming, layout, components
├── js/
│   └── main.js            # All application logic: state, API, rendering
├── images/
│   └── vruilogo.jpg       # Sidebar logo
└── docs/                  # This documentation
```

This is a **single-page application** with no build step. The entire frontend lives in three files.

## Next Steps

<div class="grid cards" markdown>

-   :material-rocket-launch: **[Getting Started](getting-started.md)**

    ---

    Prerequisites, setup, and first connection

-   :material-monitor-dashboard: **[UI Guide](ui-guide.md)**

    ---

    Walkthrough of every section of the interface

-   :material-sitemap: **[Architecture](architecture.md)**

    ---

    How the frontend communicates with the Vrui backend

-   :material-api: **[API Reference](api-reference.md)**

    ---

    CGI endpoints, commands, and data formats

-   :material-puzzle: **[Extending](extending.md)**

    ---

    How to add new features and commands

</div>
