#!/usr/bin/env python3
import json, os, time, warnings, cgi
warnings.filterwarnings("ignore", category=DeprecationWarning)

print("Content-Type: application/json\n")

STATE_FILE = os.path.join(os.path.dirname(__file__), "state.json")
DECAY_INTERVAL = 1       # seconds per decay step
DECAY_AMOUNT   = 1       # percent per step

DEFAULT_STATE = {
    "devices": {
        "Workstation A": {
            "connected": False,
            "headset": 100,
            "left": 100,
            "right": 100,
            "headset_connected": False,
            "left_connected": False,
            "right_connected": False
        },
        "Rig B (offline)": {
            "connected": False,
            "headset": 0,
            "left": 0,
            "right": 0,
            "headset_connected": False,
            "left_connected": False,
            "right_connected": False
        }
    },
    "last_update": time.time()
}


def reset_state():
    with open(STATE_FILE, "w") as f:
        json.dump(DEFAULT_STATE, f)
    return DEFAULT_STATE

# Parse request
form = cgi.FieldStorage()
command = form.getfirst("command", "").strip().lower()
target = form.getfirst("target", "").strip()

# Load or create state
if os.path.exists(STATE_FILE):
    try:
        with open(STATE_FILE, "r") as f:
            saved = json.load(f)
        DEVICE_STATE = saved.get("devices", {})
        last_update = saved.get("last_update", time.time())
    except:
        DEVICE_STATE = DEFAULT_STATE["devices"]
        last_update = DEFAULT_STATE["last_update"]
else:
    DEVICE_STATE = DEFAULT_STATE["devices"]
    last_update = DEFAULT_STATE["last_update"]

# Handle reset
if command == "reset":
    new_state = reset_state()
    print(json.dumps({
        "status": "success",
        "message": "System state has been reset.",
        "devices": [
            {"name": name, **info}
            for name, info in new_state["devices"].items()
        ]
    }))
    exit()

# Handle add device
if command == "add":
    if not target:
        print(json.dumps({
            "status": "error",
            "message": "⚠️ No device name provided.",
            "devices": [
                {"name": name, **info}
                for name, info in DEVICE_STATE.items()
            ]
        }))
        exit()

    if target in DEVICE_STATE:
        print(json.dumps({
            "status": "error",
            "message": f"⚠️ Device '{target}' already exists.",
            "devices": [
                {"name": name, **info}
                for name, info in DEVICE_STATE.items()
            ]
        }))
        exit()

    DEVICE_STATE[target] = {
    "connected": False,
    "headset": 0,
    "left": 0,
    "right": 0,
    "headset_connected": False,
    "left_connected": False,
    "right_connected": False
}

    with open(STATE_FILE, "w") as f:
        json.dump({"devices": DEVICE_STATE, "last_update": last_update}, f)

    print(json.dumps({
        "status": "success",
        "message": f"✅ Added device '{target}'",
        "devices": [
            {"name": name, **info}
            for name, info in DEVICE_STATE.items()
        ]
    }))
    exit()

# Apply decay
now = time.time()
elapsed = now - last_update
steps = int(elapsed // DECAY_INTERVAL)
if steps > 0:
    for state in DEVICE_STATE.values():
        for key in ("headset", "left", "right"):
            state[key] = max(0, state[key] - DECAY_AMOUNT * steps)
    last_update += steps * DECAY_INTERVAL
    with open(STATE_FILE, "w") as f:
        json.dump({"devices": DEVICE_STATE, "last_update": last_update}, f)

# If it's a GET for status (vr_status=1)
if "vr_status=1" in os.environ.get("QUERY_STRING", ""):
    # Return device list directly
    print(json.dumps([
        {"name": name, **info}
        for name, info in DEVICE_STATE.items()
    ]))
    exit()

# For commands like power/connect/run
if command and target in DEVICE_STATE:
    state = DEVICE_STATE[target]
    messages = []

    if command == "power":
        state["connected"] = True
        state["headset_connected"] = True
        messages.append("🔋 Headset powered on and connected.")

    elif command == "connect":
        state["left_connected"] = True
        state["right_connected"] = True
        messages.append("🎮 Left controller connected.")
        messages.append("🎮 Right controller connected.")

    elif command == "disconnect":
        state["headset_connected"] = False
        state["left_connected"] = False
        state["right_connected"] = False
        messages.append("🔌 All devices disconnected.")

    elif command == "run":
        if not state.get("headset_connected"):
            messages.append("⚠️ Cannot run program — headset is not connected.")
        else:
            state["headset"] = min(100, state["headset"] + 5)
            messages.append("▶️ Program launched on headset.")

    # Save updated state
    with open(STATE_FILE, "w") as f:
        json.dump({"devices": DEVICE_STATE, "last_update": last_update}, f)

    print(json.dumps({
        "status": "success",
        "message": "\n".join(messages),
        "deviceState": state
    }))
    exit()

# If target is missing or unknown
if command and target == "":
    print(json.dumps({
        "status": "error",
        "message": f"❌ Target not specified for command: '{command}'"
    }))
    exit()

if command:
    print(json.dumps({
        "status": "error",
        "message": f"❌ Target '{target}' not found"
    }))
    exit()
