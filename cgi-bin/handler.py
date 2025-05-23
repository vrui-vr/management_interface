#!/usr/bin/env python3

import json, os, cgi, warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)
print("Content-Type: application/json")
print("Access-Control-Allow-Origin: http://127.0.0.1:8000")
print()

# Ensure request method is POST
if os.environ.get("REQUEST_METHOD", "") != "POST":
    print(json.dumps({
        "status": "error",
        "message": "❌ Only POST requests are allowed."
    }))
    exit()

# Parse form data
form = cgi.FieldStorage()
command = form.getfirst("command", "").strip()

# Only respond to 'getServerStatus'
if command != "getServerStatus":
    print(json.dumps({
        "status": "error",
        "message": "❌ Invalid or missing command. Only 'getServerStatus' is supported."
    }))
    exit()

# Load and return teststate.json
try:
    base_dir = os.path.dirname(__file__) if "__file__" in globals() else os.getcwd()
    test_file = os.path.join(base_dir, "teststate.json")

    with open(test_file, "r") as f:
        data = json.load(f)

    print(json.dumps({
        "status": "success",
        "data": data
    }))
except Exception as e:
    print(json.dumps({
        "status": "error",
        "message": f"Failed to load test state: {str(e)}"
    }))
