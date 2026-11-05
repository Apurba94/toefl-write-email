"""Desktop launcher for one app of the GRE and TOEFL Study Suite.

It serves the app's pages to this computer only (127.0.0.1), saves progress as JSON files in the user's folder,
and opens the app in its own Microsoft Edge window. Every app in the suite shares the same data folder, so the
Error Log and Score Tracker apps can see results from the others.

    python launcher.py               open the app
    python launcher.py --no-window   only serve, and print the address
    python launcher.py --selftest    start, check the pages and saving, then exit
"""
import http.server
import json
import mimetypes
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
import webbrowser

KEY = re.compile(r"^[A-Za-z0-9_.-]{1,80}$")
MAX_BODY = 8 * 1024 * 1024
TYPES = {".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
         ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8"}


def resource_root():
    """The folder with the web files: next to this file, or inside the packed program."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, "web")


def data_dir():
    root = os.environ.get("STUDY_SUITE_DATA") or os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), "GRE and TOEFL Study Suite")
    os.makedirs(os.path.join(root, "data"), exist_ok=True)
    return root


class Store:
    """One JSON file per key. Writes go to a temporary file first, so a crash never leaves half a file."""

    def __init__(self, folder):
        self.folder = os.path.join(folder, "data")
        self.lock = threading.Lock()

    def all(self):
        out = {}
        for name in os.listdir(self.folder):
            if name.endswith(".json") and KEY.match(name[:-5]):
                try:
                    with open(os.path.join(self.folder, name), encoding="utf-8") as f:
                        out[name[:-5]] = json.load(f)
                except (OSError, ValueError):
                    continue   # a damaged file is skipped, not fatal
        return out

    def put(self, key, value):
        if not KEY.match(key):
            raise ValueError("bad key")
        path = os.path.join(self.folder, key + ".json")
        with self.lock:
            fd, tmp = tempfile.mkstemp(dir=self.folder, suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    json.dump(value, f, ensure_ascii=False)
                os.replace(tmp, path)
            except BaseException:
                if os.path.exists(tmp):
                    os.remove(tmp)
                raise

    def delete(self, key):
        if KEY.match(key):
            try:
                os.remove(os.path.join(self.folder, key + ".json"))
            except FileNotFoundError:
                pass


def make_handler(root, store, token, app_name, port_box, last_ping):
    class Handler(http.server.BaseHTTPRequestHandler):
        server_version = "StudySuite"
        sys_version = ""

        def log_message(self, *args):
            pass

        def host_ok(self):
            host = (self.headers.get("Host") or "").lower()
            return host in ("127.0.0.1:%d" % port_box[0], "localhost:%d" % port_box[0])

        def send(self, code, body=b"", ctype="text/plain; charset=utf-8", extra=None):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def api_ok(self):
            # A web page elsewhere cannot read or change your data: it would need this run's secret token.
            return self.host_ok() and secrets.compare_digest(self.headers.get("X-SK-Token", ""), token)

        def do_GET(self):
            if not self.host_ok():
                return self.send(403, b"Forbidden")
            path = self.path.split("?", 1)[0].split("#", 1)[0]
            if path == "/api/ping":
                if not self.api_ok():
                    return self.send(403, b"Forbidden")
                last_ping[0] = time.time()
                return self.send(200, json.dumps({"app": app_name}).encode(), "application/json")
            if path == "/api/store":
                if not self.api_ok():
                    return self.send(403, b"Forbidden")
                return self.send(200, json.dumps(store.all(), ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")
            if path == "/":
                return self.send(302, b"", extra={"Location": "/apps/%s/" % app_name})
            if path.endswith("/"):
                path += "index.html"
            rel = os.path.normpath(urllib.request.url2pathname(path.lstrip("/")))
            full = os.path.join(root, rel)
            if rel.startswith("..") or os.path.isabs(rel) or not os.path.realpath(full).startswith(os.path.realpath(root) + os.sep) or not os.path.isfile(full):
                return self.send(404, b"Not found")
            with open(full, "rb") as f:
                data = f.read()
            ext = os.path.splitext(full)[1].lower()
            self.send(200, data, TYPES.get(ext) or mimetypes.guess_type(full)[0] or "application/octet-stream")

        do_HEAD = do_GET

        def do_PUT(self):
            # Read the body before any answer: replying while the client is still sending makes Windows reset the
            # connection, and the page would see a network error instead of the real reason.
            try:
                n = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                n = -1
            if n < 0 or n > MAX_BODY:
                self.close_connection = True
                return self.send(413, b"Too large")
            body = self.rfile.read(n)
            if not self.api_ok():
                return self.send(403, b"Forbidden")
            m = re.match(r"^/api/store/([A-Za-z0-9_.-]{1,80})$", self.path)
            if not m:
                return self.send(404, b"Not found")
            if "json" not in (self.headers.get("Content-Type") or ""):
                return self.send(415, b"Send JSON")
            try:
                value = json.loads(body.decode("utf-8"))
            except ValueError:
                return self.send(400, b"Not JSON")
            if value is None:
                store.delete(m.group(1))
            else:
                store.put(m.group(1), value)
            self.send(204)

        def do_POST(self):
            self.send(405, b"Use PUT")

    return Handler


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False


def find_edge():
    for base in (os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles"), os.environ.get("LOCALAPPDATA")):
        if base:
            p = os.path.join(base, "Microsoft", "Edge", "Application", "msedge.exe")
            if os.path.exists(p):
                return p
    return shutil.which("msedge")


def start(app_name, port=0):
    folder = data_dir()
    token = secrets.token_urlsafe(24)
    port_box = [0]
    last_ping = [time.time()]
    handler = make_handler(resource_root(), Store(folder), token, app_name, port_box, last_ping)
    try:
        srv = Server(("127.0.0.1", port), handler)
    except OSError:
        srv = Server(("127.0.0.1", 0), handler)
    port_box[0] = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = "http://127.0.0.1:%d/apps/%s/?t=%s" % (port_box[0], app_name, token)
    return srv, url, token, folder, last_ping


def selftest(app_name):
    os.environ.setdefault("STUDY_SUITE_DATA", tempfile.mkdtemp(prefix="study-suite-test-"))
    srv, url, token, folder, _ = start(app_name)
    base = "http://127.0.0.1:%d" % srv.server_address[1]

    def get(path, headers=None):
        req = urllib.request.Request(base + path, headers=headers or {})
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read()

    def code(path, method="GET", headers=None, body=None):
        req = urllib.request.Request(base + path, data=body, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status
        except urllib.error.HTTPError as e:
            return e.code

    page = get("/apps/%s/" % app_name)[1].decode("utf-8")
    assert "sk-core.js" in page and "app.js" in page, "the app page is incomplete"
    for f in ("/kit/sk-core.js", "/kit/sk-ui.js", "/kit/studykit.css", "/apps/%s/app.js" % app_name):
        assert get(f)[0] == 200, f
    assert code("/api/store") == 403, "saving must need the token"
    assert code("/../launcher.py") in (403, 404), "files outside the app must not be served"
    t = {"X-SK-Token": token, "Content-Type": "application/json"}
    assert code("/api/store/selftest.value", "PUT", t, json.dumps({"ok": [1, 2, 3]}).encode()) == 204
    assert json.loads(get("/api/store", t)[1])["selftest.value"] == {"ok": [1, 2, 3]}
    assert code("/api/store/bad%20key", "PUT", t, b"{}") == 404
    assert code("/api/store/..%2Fescape", "PUT", t, b"{}") == 404
    assert code("/api/store/x", "PUT", {"X-SK-Token": token, "Content-Type": "application/json", "Host": "evil.example"}, b"{}") == 403
    srv.shutdown()
    print("selftest passed:", app_name)
    return 0


def run(app_name, title, port):
    if "--selftest" in sys.argv:
        return selftest(app_name)
    srv, url, token, folder, last_ping = start(app_name, port)
    if "--no-window" in sys.argv:
        print(url, flush=True)
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            return 0
    edge = find_edge()
    if edge:
        profile = os.path.join(folder, "window", app_name)
        proc = subprocess.Popen([edge, "--app=" + url, "--user-data-dir=" + profile, "--no-first-run", "--no-default-browser-check",
                                 "--disable-features=Translate", "--window-size=1200,860"])
        opened = time.time()
        proc.wait()
        # Edge sometimes hands the window to a process it already had; then wait for the app to stop asking.
        if time.time() - opened < 5:
            wait_for_silence(last_ping)
    else:
        webbrowser.open(url)
        wait_for_silence(last_ping)
    srv.shutdown()
    return 0


def wait_for_silence(last_ping, limit=600):
    """Keep serving while the page still checks in; a hidden window checks in less often, so allow ten minutes."""
    time.sleep(30)
    while time.time() - last_ping[0] < limit:
        time.sleep(5)
