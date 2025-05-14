# VRUI Management Interface
A lightweight browser-based interface for managing the VRUI VR system. The goal for this project is to connect more easily the users of VRUI with the application itself without the use of console commands.

## Project Overview:
This current testing version of the app allows you to:

Add VR rigs (e.g., Rig A, Rig B, etc.)

Turn systems on/off

Connect/disconnect headsets and controllers

Run a VR program

View and filter logs per device

Send manual commands via a text prompt

The interface is written in HTML/CSS/JS and communicates with a Python CGI backend using a persistent state.json file.

The Backend is currently just a placeholder that would be replaced in the future with an actual micro-server capable of communicating with the main VRUI system.

## Project Structure:
```
MANAGEMENT_INTERFACE/
├── cgi-bin/
│   └── handler.py         → CGI backend for device logic
├── css/
│   └── main.css           → Full styling for the UI
├── js/
│   └── main.js            → Frontend interactivity and fetch logic
├── images/
│   └── vruilogo.jpg       → Main logo
├── state.json             → Persistent state of all devices
├── index.html             → Main entry point (UI)
└── README.md              → This file
```

## How to Run the Project:
Open a terminal in the project root.

Start the CGI server with:

python3 -m http.server --cgi 8000

Visit the app in your browser:

Windows:
start http://localhost:8000

Mac:
open http://localhost:8000

Linux:
xdg-open http://localhost:8000

The UI will automatically query device data and render controls.

Main Features:
Visual device cards with battery and connection state

Command buttons (power on, connect, disconnect, shutdown, run)

Console output with live log entries

Dropdown to switch between systems

Console filter to show/hide logs per device

Manual command entry (e.g., "reset")

Device highlighting, auto-refreshing, and offline state handling

Built-In Commands:
These commands are processed by handler.py on the backend:

power → Powers on the system and connects headset

connect → Connects left and right controllers

disconnect → Disconnects headset and controllers

shutdown → Fully powers down system and disconnects devices

run → Runs the VR program (only if headset is connected)

reset → Resets all device state (manual command)
