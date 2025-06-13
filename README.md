# VRUI Management Interface
A lightweight browser-based interface for managing the VRUI VR system. The goal for this project is to connect more easily the users of VRUI with the application itself without the use of console commands.

## Project Overview:

The interface is written in HTML/CSS/JS and communicates with the VRUI system via http POST requests

This current testing version of the app allows you to:

- Add and connnect to different computers via IP / Port

- Communicate with the *VR Server Launcher* as well as the *VR Device Server* itself

- Get updated information on the VR headsets and controllers connected to each computer

- Turn off controllers / headsets (when possible) as well as ping the devices for haptic feedback / identification

- View and filter command output and statuses from connected devices

- Send manual commands via a text prompt

## Project Structure:
```
MANAGEMENT_INTERFACE/
├── css/
│   └── main.css           → Full styling for the UI
├── js/
│   └── main.js            → Frontend interactivity and fetch logic
├── images/
│   └── vruilogo.jpg       → Main logo
├── index.html             → Main entry point (UI)
└── README.md              → This file
```
