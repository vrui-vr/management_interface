#!/usr/bin/env python3
import cgi
import json
import os

# Mock server-side device state
DEVICE_STATE = {
    "Workstation A": {
        "connected": True, "headset": 87, "left": 65, "right": 73
    },
    "Rig B (offline)": {
        "connected": False, "headset": 0, "left": 0, "right": 0
    }
}

print("Content-Type: application/json\n")

# Fetch the form data from the POST request
form = cgi.FieldStorage()

# Get query string vr_status=1 to fetch all devices
if 'vr_status=1' in os.environ.get("QUERY_STRING", ""):
    # Just return all system states
    devices = []
    for name, state in DEVICE_STATE.items():
        devices.append({"name": name, **state})
    print(json.dumps(devices))

else:
    # Handle command to update a specific device state
    command = form.getfirst("command", "").strip()
    target = form.getfirst("target", "").strip()

    if target in DEVICE_STATE:
        state = DEVICE_STATE[target]

        # Handle specific commands
        if command == "power":
            state["connected"] = True
            state["headset"] = 90  # Set to a higher value to simulate power-on
        elif command == "connect":
            state["left"] = 80
            state["right"] = 85
        elif command == "run":
            pass  # Simulate running something

        # Return a success message
        response = {
            "status": "success",
            "message": f"✔ Command '{command}' applied to '{target}'",
            "deviceState": state
        }
    else:
        # Return an error if the target device doesn't exist
        response = {
            "status": "error",
            "message": f"❌ Target '{target}' not found"
        }

    # Send the response back to the client
    print(json.dumps(response))
