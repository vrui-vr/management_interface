#!/usr/bin/env python3
"""
Mock Vrui server stack for testing the management interface's connection handling.

Faithfully reproduces the parts that matter for the port-reuse bug:
  * VRServerLauncher on 8080 (always up)
  * VRDeviceServer on 8081 and VRCompositingServer on 8082, started/stopped by the launcher
  * Listening sockets bind WITHOUT SO_REUSEADDR, exactly like Comm::ListeningTCPSocket
  * HTTP/1.1 keep-alive, so idle pooled client connections stay ESTABLISHED
  * Events.cgi SSE endpoints on all three ports

Every TCP connection is logged with the port it landed on and whether it is an SSE
stream or a plain command connection, so a test can count them the way Oliver did
when reading VRDeviceDaemon's logs.

Debug endpoints (on the launcher, 8080):
  GET /debug/connections  -> live connection table + history
  GET /debug/reset        -> clear the connection history
"""
import json
import threading
import time
import socket
import itertools
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

LAUNCHER_PORT = 8080
DEVICE_PORT = 8081
COMPOSITING_PORT = 8082

PROTOCOL_VERSION = 1
VRUI_VERSION = "15.0-001"

_conn_ids = itertools.count(1)
_lock = threading.Lock()

# Failure-injection mode, set via /debug/mode?m=...
#   normal             - everything works
#   start_fails        - startServers binds nothing and reports both servers stopped
#   device_unreachable - device port is never bound, but the launcher still claims
#                        VRDeviceServer is running (a server that died after launch)
MODE = "normal"

# live[conn_id] = {...}; history keeps closed ones too
live = {}
history = []


def conn_open(port, cid, peer):
    with _lock:
        rec = {"id": cid, "port": port, "peer": f"{peer[0]}:{peer[1]}",
               "kind": "unknown", "opened": time.time(), "closed": None}
        live[cid] = rec
        history.append(rec)


def conn_mark(cid, kind):
    with _lock:
        if cid in live:
            live[cid]["kind"] = kind


def conn_close(cid):
    with _lock:
        rec = live.pop(cid, None)
        if rec:
            rec["closed"] = time.time()


def snapshot():
    with _lock:
        def summarize(recs):
            out = {}
            for r in recs:
                out.setdefault(str(r["port"]), []).append(
                    {"id": r["id"], "kind": r["kind"], "peer": r["peer"]})
            return out
        return {
            "live": summarize(live.values()),
            "live_count_by_port": {p: len(v) for p, v in summarize(live.values()).items()},
            "total_ever": len(history),
        }


def cors(handler):
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # ---- connection lifecycle ----
    def setup(self):
        super().setup()
        self.cid = next(_conn_ids)
        conn_open(self.server.server_address[1], self.cid, self.client_address)

    def finish(self):
        conn_close(self.cid)
        try:
            super().finish()
        except Exception:
            pass

    def log_message(self, *args):
        pass  # keep stderr quiet

    # ---- helpers ----
    def _json(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        cors(self)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", "0")
        cors(self)
        self.end_headers()

    # ---- SSE ----
    def _sse(self):
        conn_mark(self.cid, "SSE")
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        cors(self)
        self.end_headers()
        try:
            while not self.server.stopping:
                self.wfile.write(b"event: stillAlive\ndata: {}\n\n")
                self.wfile.flush()
                time.sleep(1.0)
        except Exception:
            pass

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/debug/connections":
            conn_mark(self.cid, "debug")
            return self._json(snapshot())
        if path == "/debug/reset":
            conn_mark(self.cid, "debug")
            with _lock:
                history.clear()
            return self._json({"ok": True})
        if path == "/debug/mode":
            conn_mark(self.cid, "debug")
            global MODE
            q = parse_qs(urlparse(self.path).query)
            MODE = q.get("m", ["normal"])[0]
            return self._json({"ok": True, "mode": MODE})
        if path == "/Events.cgi":
            return self._sse()
        self._json({"status": "Failure", "message": "not found"}, 404)

    def do_POST(self):
        conn_mark(self.cid, "command")
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length).decode() if length else ""
        params = {k: v[0] for k, v in parse_qs(raw).items()}
        command = params.get("command", "")
        port = self.server.server_address[1]

        if port == LAUNCHER_PORT:
            return self._launcher(command)
        if port == DEVICE_PORT:
            return self._device(command)
        return self._compositing(command)

    # ---- launcher ----
    def _launcher(self, command):
        if command == "isAlive":
            return self._json({"status": "Success", "protocolVersion": PROTOCOL_VERSION})
        if command == "startServers":
            ok, msg = STACK.start_servers()
            return self._json({"status": "Success" if ok else "Failure",
                               "message": msg,
                               "protocolVersion": PROTOCOL_VERSION,
                               "vruiVersion": VRUI_VERSION,
                               "servers": STACK.server_list()})
        if command == "stopServers":
            STACK.stop_servers()
            return self._json({"status": "Success", "message": "stopped",
                               "protocolVersion": PROTOCOL_VERSION,
                               "vruiVersion": VRUI_VERSION,
                               "servers": STACK.server_list()})
        if command == "getEnvironments":
            return self._json({"status": "Success", "protocolVersion": PROTOCOL_VERSION,
                               "environments": ["Cave.cfg", "Desktop.cfg"]})
        # getServerStatus
        return self._json({"status": "Success",
                           "protocolVersion": PROTOCOL_VERSION,
                           "vruiVersion": VRUI_VERSION,
                           "servers": STACK.server_list()})

    def _device(self, command):
        return self._json({"status": "Success",
                           "protocolVersion": PROTOCOL_VERSION,
                           "devices": [
                               {"name": "HMD", "isConnected": True, "isTracked": True,
                                "hasBattery": False, "canPowerOff": False},
                               {"name": "Controller1", "isConnected": True, "isTracked": True,
                                "hasBattery": True, "batteryLevel": 87, "isCharging": False,
                                "canPowerOff": True, "powerFeatureIndex": 0,
                                "hapticFeatures": [{"index": 0}]},
                           ]})

    def _compositing(self, command):
        return self._json({"status": "Success", "protocolVersion": PROTOCOL_VERSION})


class Server(ThreadingHTTPServer):
    daemon_threads = True
    # Vrui's Comm::ListeningTCPSocket does NOT set SO_REUSEADDR -- reproduce that.
    allow_reuse_address = False

    def __init__(self, port):
        self.stopping = False
        super().__init__(("0.0.0.0", port), Handler)


class Stack:
    def __init__(self):
        self.device = None
        self.compositing = None
        self.lock = threading.Lock()

    def _serve(self, srv):
        try:
            srv.serve_forever(poll_interval=0.2)
        except Exception:
            pass

    def _bind(self, port):
        """Bind like Vrui does. Returns (server, None) or (None, errmsg)."""
        try:
            srv = Server(port)
        except OSError as e:
            return None, f"bind {port} failed: {e}"
        threading.Thread(target=self._serve, args=(srv,), daemon=True).start()
        return srv, None

    def start_servers(self):
        with self.lock:
            if MODE == "start_fails":
                return False, "servers failed to start (injected)"
            msgs = []
            if MODE != "device_unreachable" and self.device is None:
                srv, err = self._bind(DEVICE_PORT)
                if err:
                    return False, err
                self.device = srv
                msgs.append("device started")
            if self.compositing is None:
                srv, err = self._bind(COMPOSITING_PORT)
                if err:
                    return False, err
                self.compositing = srv
                msgs.append("compositing started")
            return True, "; ".join(msgs) or "already running"

    def stop_servers(self):
        with self.lock:
            for attr in ("device", "compositing"):
                srv = getattr(self, attr)
                if srv is not None:
                    srv.stopping = True
                    srv.shutdown()
                    srv.server_close()   # closes the LISTENING socket only
                    setattr(self, attr, None)

    def server_list(self):
        # In device_unreachable mode the launcher believes the device server is up even
        # though nothing is listening on its port -- a server that died after launch.
        device_running = self.device is not None or MODE == "device_unreachable"
        return [
            {"name": "VRDeviceServer", "isRunning": device_running,
             "pid": 1001 if device_running else 0, "httpPort": DEVICE_PORT},
            {"name": "VRCompositingServer", "isRunning": self.compositing is not None,
             "pid": 1002 if self.compositing else 0, "httpPort": COMPOSITING_PORT},
        ]


STACK = Stack()

if __name__ == "__main__":
    launcher = Server(LAUNCHER_PORT)
    STACK.start_servers()
    print(f"mock launcher on {LAUNCHER_PORT}, device {DEVICE_PORT}, compositing {COMPOSITING_PORT}", flush=True)
    launcher.serve_forever()
