#!/usr/bin/env python3
import cgi
import json
import html
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

print("Content-Type: application/json\n" if 'vr_status=1' in os.environ.get("QUERY_STRING", "") else "Content-Type: text/plain\n")
form = cgi.FieldStorage()

if 'vr_status=1' in os.environ.get("QUERY_STRING", ""):
    # Just return all system states
    devices = []
    for name, state in DEVICE_STATE.items():
        devices.append({"name": name, **state})
    print(json.dumps(devices))

else:
    command = form.getfirst("command", "").strip()
    target = form.getfirst("target", "").strip()

    if target in DEVICE_STATE:
        state = DEVICE_STATE[target]

        if command == "power":
            state["connected"] = True
            state["headset"] = 90
        elif command == "connect":
            state["left"] = 80
            state["right"] = 85
        elif command == "run":
            pass  # Simulate running something

        print(f"✔ Command '{command}' applied to '{target}'")
    else:
        print(f"❌ Target '{target}' not found")
