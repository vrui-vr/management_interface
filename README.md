# VRui Management Interface
A lightweight browser-based dashboard for managing systems running the VRui (Virtual Reality User Interface) software stack. This tool is designed to simplify remote control and monitoring of multiple VR devices and systems over a network — replacing manual console commands with a dynamic, user-friendly web interface.

## Project Overview:

The frontend is built using HTML, CSS, and vanilla JavaScript, and communicates with remote VRui systems via HTTP POST requests to the backend (coded in C++ within the main VRui application)

This current testing version of the app allows you to:

- Add, rename, edit, or remove systems via IP address and custom port entries

- Connect to and manage multiple VR systems in parallel

- Launch VR services remotely (compositor, tracker, etc.)

- Monitor device states (headset + controller battery, connection, tracking)

- Ping haptic devices and power off hardware (if supported)

- Send custom text commands

- Display and filter a live event console by system

- Automatically detect timeouts and reflect online/offline status

## Key Features

### System Management:
- Add new systems via prompts for name, IP address, and port

- Persist configuration in ```localStorage``` for seamless reloads

- Rename or update IP/ports using contextual pop-up menus

- Remove systems (with protection for "Local Host")

Live Device Monitoring

- Contact the VR device server to get real-time status of:

- - Headsets

- - Connected controllers

- Visualize battery level (with colored bars), connection status, and tracking status

### Device Interaction

- Power off connected devices with supported features

- Ping any haptic-enabled device to verify identification

- Dynamically edit devices via their on-screen labels

### Status Queries & Command Execution

- Contact the VR Server Launcher to verify server processes (and start them if needed)

- Send manual commands via text input

- Use UI buttons for standard control operations

### Configuration & Storage

- All systems and settings are stored in localStorage

- Auto-persistence across page reloads

## Project Structure:
```
MANAGEMENT_INTERFACE/
├── css/
│   └── main.css           → Full styling for the UI
├── js/
│   └── main.js            → Frontend interactivity and fetch logic
├── images/
│   └── VRuilogo.jpg       → Main logo
├── index.html             → Main entry point (UI)
└── README.md              → This file
```

## How to Run:

After setting up main VRui application and running ```Make.sh```, all you need to do is run/open the html file in any modern browser
