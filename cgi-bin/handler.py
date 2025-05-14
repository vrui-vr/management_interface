#!/usr/bin/env python3

import cgi
import json
import html
import os

print("Content-Type: application/json\n" if 'vr_status' in os.environ.get("QUERY_STRING", "") else "Content-Type: text/plain\n")

form = cgi.FieldStorage()

# Check if we're returning VR battery status
if 'vr_status' in os.environ.get("QUERY_STRING", ""):
    # In the future this would query real battery data
    battery_data = {
        "headset": 87,
        "left": 64,
        "right": 72
    }
    print(json.dumps(battery_data))
else:
    # Existing message handler
    msg = form.getfirst("message", "").strip()

    if msg == "status":
        print("✔ Server is running.")
    elif msg == "restart":
        print("🔄 Restarting service... Done.")
    elif msg == "update":
        print("⬆️ System updated successfully.")
    else:
        print(f"❓ Unknown command: '{html.escape(msg)}'")
