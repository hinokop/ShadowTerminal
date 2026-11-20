"""Local file bridge with narrow TXT export and a native nmap runner.

No generic OS commands or file serving: the only program the bridge starts is the installed nmap,
with the arguments as given (no shell). Its options are not restricted (decision by Shadow).
"""
import argparse
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
from contextlib import ExitStack, contextmanager
import re
import secrets
import shutil
import signal
import codecs
import locale
import stat
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DATABASE = "pgcl-eu3.arch07"
ARCHIVE_ENDPOINT = "relay-07.pgcl-eu3.inv"  # Display only. Never resolved or contacted.
TOKEN_HEADER = "X-Shadow-Token"
MAX_DOWNLOAD = 20 * 1024 * 1024
MAX_TEXT = 64 * 1024
MAX_EXPORT_REQUEST = 2 * MAX_TEXT + 1024
EXPORT_IDS = {"pin": re.compile(r"PIN-[0-9]{3,15}"), "zone": re.compile(r"ZO-[0-9]{3,15}"), "sichtung": re.compile(r"[POL]-[0-9]{4,15}-SI-[0-9]{3,15}")}
PROJECT = Path(__file__).resolve().parent
DEVICE = re.compile(r"^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)", re.I)


class Refused(ValueError):
    pass


def clean_name(name):
    return (
        isinstance(name, str)
        and 0 < len(name) <= 255
        and name not in (".", "..")
        and not name.endswith((".", " "))
        and not DEVICE.match(name)
        and all(ord(c) >= 32 and c not in '\\/:<>|"?*\x7f' for c in name)
    )


def resolve_inside(root, parts):
    """Check each path component before opening, including Windows junctions."""
    if not isinstance(parts, list) or len(parts) > 24:
        raise Refused
    path = root
    for i, name in enumerate([None] + parts):
        if i:
            if not clean_name(name):
                raise Refused
            path = path / name
        meta = path.lstat()
        if stat.S_ISLNK(meta.st_mode) or getattr(meta, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise Refused
        if i < len(parts) and not stat.S_ISDIR(meta.st_mode):
            raise FileNotFoundError
    return path, meta


def read_inside(root, parts, path, limit):
    # On Unix, resolve relative to directory descriptors without following links.
    if hasattr(os, "O_NOFOLLOW") and os.open in os.supports_dir_fd:
        with ExitStack() as stack:
            dflags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
            fd = os.open(root, dflags)
            stack.callback(os.close, fd)
            for name in parts[:-1]:
                fd = os.open(name, dflags, dir_fd=fd)
                stack.callback(os.close, fd)
            fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
            with os.fdopen(fd, "rb") as stream:
                meta = os.fstat(stream.fileno())
                if not stat.S_ISREG(meta.st_mode) or meta.st_nlink != 1:
                    raise Refused
                return stream.read(limit + 1)
    # On Windows, also verify the opened handle before consuming any bytes.
    if os.name != "nt":
        raise Refused
    import ctypes
    from ctypes import wintypes
    import msvcrt
    realpath = ctypes.WinDLL("kernel32", use_last_error=True).GetFinalPathNameByHandleW
    realpath.argtypes = [wintypes.HANDLE, wintypes.LPWSTR, wintypes.DWORD, wintypes.DWORD]
    realpath.restype = wintypes.DWORD
    with path.open("rb") as stream:
        buf = ctypes.create_unicode_buffer(32768)
        n = realpath(msvcrt.get_osfhandle(stream.fileno()), buf, len(buf), 0)
        if not 0 < n < len(buf):
            raise Refused
        prefix = chr(92) * 2 + "?" + chr(92)
        name = buf.value
        if name.startswith(prefix + "UNC" + chr(92)):
            name = chr(92) * 2 + name[8:]
        elif name.startswith(prefix):
            name = name[4:]
        actual = Path(name)
        meta = os.fstat(stream.fileno())
        if not actual.is_absolute() or root not in actual.parents or not stat.S_ISREG(meta.st_mode) or meta.st_nlink != 1:
            raise Refused
        return stream.read(limit + 1)


@contextmanager
def export_directory_windows(path):
    """Keep a normal directory open without sharing modification or deletion."""
    import ctypes
    from ctypes import wintypes
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    opening = kernel.CreateFileW
    opening.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID,
                        wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
    opening.restype = wintypes.HANDLE
    info = kernel.GetFileInformationByHandleEx
    info.argtypes = [wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD]
    info.restype = wintypes.BOOL
    close = kernel.CloseHandle
    close.argtypes = [wintypes.HANDLE]
    close.restype = wintypes.BOOL
    # FILE_READ_ATTRIBUTES, FILE_SHARE_READ, OPEN_EXISTING, BACKUP_SEMANTICS | OPEN_REPARSE_POINT
    handle = opening(str(path), 0x80, 1, None, 3, 0x02200000, None)
    if handle in (None, ctypes.c_void_p(-1).value):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        attrs = (wintypes.DWORD * 2)()  # FILE_ATTRIBUTE_TAG_INFO
        if not info(handle, 9, ctypes.byref(attrs), ctypes.sizeof(attrs)):
            raise ctypes.WinError(ctypes.get_last_error())
        if not attrs[0] & stat.FILE_ATTRIBUTE_DIRECTORY or attrs[0] & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise Refused
        yield
    finally:
        close(handle)


VERSION_NAME = re.compile(r"-v([2-9]|[1-9][0-9])")
MAX_VERSIONEN = 99


class _ExportPosix:
    """Schreibt relativ zu Verzeichnisdeskriptoren, ohne Links zu folgen."""
    def __init__(self, base_fd, folder):
        flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
        self.dir = os.open(folder, flags, dir_fd=base_fd)

    def close(self):
        os.close(self.dir)

    def read(self, name):
        """None: nicht vorhanden. False: vorhanden, aber keine einzelne normale Datei. Sonst die Bytes."""
        try:
            fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_NONBLOCK", 0), dir_fd=self.dir)
        except FileNotFoundError:
            return None
        except OSError:
            return False
        with os.fdopen(fd, "rb") as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > MAX_TEXT:
                return False
            return stream.read(MAX_TEXT + 1)

    def create(self, name, data):
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=self.dir)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(data)
        except OSError:
            os.unlink(name, dir_fd=self.dir)
            raise

    def replace(self, name, data):
        temp = ".ft-" + secrets.token_hex(8)
        self.create(temp, data)
        try:
            os.replace(temp, name, src_dir_fd=self.dir, dst_dir_fd=self.dir)
        except OSError:
            os.unlink(temp, dir_fd=self.dir)
            raise


class _ExportWindows:
    """Schreibt in ein Verzeichnis, dessen Handle Änderungen und Löschen des Ordners selbst sperrt."""
    def __init__(self, path):
        self.path = path

    def close(self):
        pass

    def read(self, name):
        target = self.path / name
        try:
            info = os.lstat(target)
        except FileNotFoundError:
            return None
        if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_TEXT or getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            return False
        try:
            with target.open("rb") as stream:
                return stream.read(MAX_TEXT + 1)
        except OSError:
            return False

    def create(self, name, data):
        target = self.path / name
        stream = target.open("xb")
        try:
            with stream:
                stream.write(data)
        except OSError:
            target.unlink(missing_ok=True)
            raise

    def replace(self, name, data):
        temp = ".ft-" + secrets.token_hex(8)
        self.create(temp, data)
        try:
            os.replace(self.path / temp, self.path / name)
        except OSError:
            (self.path / temp).unlink(missing_ok=True)
            raise


def _sha(data):
    return hashlib.sha256(data).hexdigest()


def export_decide(target, base, data, last):
    """Entscheidet beim Export, ob neu angelegt, unverändert gelassen, ersetzt oder als neue Version gespeichert wird.
    Ersetzt wird nur die vom Terminal zuletzt geschriebene Datei, und nur wenn ihr Inhalt noch der gemerkten Prüfsumme entspricht."""
    new_sha = _sha(data)
    stem = base[:-4]
    candidate = base
    if last is not None and re.fullmatch(re.escape(stem) + r"(?:-v[0-9]{1,2})?\.txt", last["name"]) and (
            last["name"] == base or VERSION_NAME.fullmatch(last["name"][len(stem):-4])):
        candidate = last["name"]
    for _ in range(4):
        existing = target.read(candidate)
        if existing is None:
            try:
                target.create(candidate, data)
                return candidate, new_sha, "neu"
            except FileExistsError:
                continue
        if existing is not False and _sha(existing) == new_sha:
            return candidate, new_sha, "unveraendert"
        if existing is not False and last is not None and last["name"] == candidate and _sha(existing) == last["sha"]:
            target.replace(candidate, data)
            return candidate, new_sha, "ersetzt"
        for number in range(2, MAX_VERSIONEN + 1):
            name = stem + "-v" + str(number) + ".txt"
            existing = target.read(name)
            if existing is not False and existing is not None and _sha(existing) == new_sha:
                return name, new_sha, "unveraendert"
            if existing is None:
                try:
                    target.create(name, data)
                    return name, new_sha, "version"
                except FileExistsError:
                    continue
        raise Refused
    raise Refused


def terminal_export_txt(root, request):
    keys = set(request)
    if not {"op", "folder", "kind", "id", "text"} <= keys or not keys <= {"op", "folder", "kind", "id", "text", "last"}:
        raise Refused
    folder, kind, ident, text = (request[k] for k in ("folder", "kind", "id", "text"))
    if folder not in ("dokumente", "ops") or kind not in ("pin", "zone", "sichtung"):
        raise Refused
    if not isinstance(ident, str) or not EXPORT_IDS[kind].fullmatch(ident) or not isinstance(text, str):
        raise Refused
    if any((ord(c) < 32 and c not in "\r\n\t") or c == "\x7f" for c in text):
        raise Refused
    data = text.encode("utf-8")
    if not data:
        raise Refused
    if len(data) > MAX_TEXT:
        return {"error": "TXT-Export zu groß (maximal 64 KiB)"}
    last = request.get("last")
    if last is not None:
        if not isinstance(last, dict) or set(last) != {"name", "sha"} or not isinstance(last["name"], str) or not isinstance(last["sha"], str) \
                or not re.fullmatch(r"[0-9a-f]{64}", last["sha"]) or len(last["name"]) > 64:
            raise Refused
    base = {"pin": "lageblatt-", "zone": "zone-", "sichtung": "sichtung-"}[kind] + ident + ".txt"
    try:
        if os.name == "nt":
            with export_directory_windows(root), export_directory_windows(root / folder):
                name, sha, mode = export_decide(_ExportWindows(root / folder), base, data, last)
        elif hasattr(os, "O_NOFOLLOW") and os.open in os.supports_dir_fd:
            with ExitStack() as stack:
                flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
                top = os.open(root, flags)
                stack.callback(os.close, top)
                target = _ExportPosix(top, folder)
                stack.callback(target.close)
                name, sha, mode = export_decide(target, base, data, last)
        else:
            raise Refused
    except PermissionError:
        return {"error": "Datei ist geöffnet oder schreibgeschützt. Sie wurde nicht ersetzt."}
    return {"name": name, "folder": folder, "bytes": len(data), "sha256": sha, "mode": mode}


def terminal_file_op(root, request):
    if not isinstance(request, dict):
        raise Refused
    op, parts = request.get("op"), request.get("parts")
    if op == "export-txt":
        return terminal_export_txt(root, request)
    if op not in ("cd", "ls", "cat", "head", "tail", "wget", "send"):
        raise Refused
    path, meta = resolve_inside(root, parts)
    if op in ("ls", "cd"):
        if not stat.S_ISDIR(meta.st_mode):
            raise NotADirectoryError
        if op == "cd":
            return {"ok": True}
        hidden = request.get("hidden") is True
        entries = []
        for child in path.iterdir():
            if not clean_name(child.name) or (not hidden and child.name.startswith(".")):
                continue
            try:
                _, info = resolve_inside(root, parts + [child.name])
            except (OSError, Refused):
                continue
            if stat.S_ISDIR(info.st_mode) or stat.S_ISREG(info.st_mode):
                entries.append({"name": child.name, "dir": stat.S_ISDIR(info.st_mode), "bytes": info.st_size, "mtime": info.st_mtime})
                if len(entries) >= 500:
                    break
        entries.sort(key=lambda e: (not e["dir"], e["name"].casefold()))
        return {"entries": entries}
    if op == "send" and stat.S_ISDIR(meta.st_mode):
        return {"notfile": True}  # profanity: "Uploading '%s' failed: Not a file!"
    if not stat.S_ISREG(meta.st_mode) or meta.st_nlink != 1:
        raise Refused
    limit = MAX_DOWNLOAD if op in ("wget", "send") else MAX_TEXT
    if meta.st_size > limit:
        return {"error": "Datei zu groß"}
    data = read_inside(root, parts, path, limit)
    if len(data) > limit:
        return {"error": "Datei zu groß"}
    if op == "send":
        return {"name": path.name, "bytes": len(data)}
    if op == "wget":
        return {"name": path.name, "data": base64.b64encode(data).decode("ascii"), "endpoint": ARCHIVE_ENDPOINT}
    try:
        text = data.decode("utf-8-sig")
    except UnicodeError:
        return {"error": "Keine UTF-8-Textdatei"}
    if any(ord(c) < 32 and c not in "\r\n\t" for c in text):
        return {"error": "Keine Textdatei"}
    if op == "head":
        text = "\n".join(text.splitlines()[:10])
    if op == "tail":
        text = "\n".join(text.splitlines()[-10:])
    return {"text": text}


NMAP_MAX_ARGS = 256
NMAP_MAX_JOBS = 4
NMAP_POLL = 1.0  # seconds a read waits for new output
NMAP_IDLE = 30.0  # seconds without a read before a job is stopped (page closed or reloaded)


def find_nmap():
    exe = shutil.which("nmap")
    if exe:
        return exe
    if os.name == "nt":
        for base in (os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles")):
            candidate = Path(base) / "Nmap" / "nmap.exe" if base else None
            if candidate and candidate.is_file():
                return str(candidate)
    return None


class NmapJob:
    """One nmap process. stdout and stderr share one pipe, so their order is kept as nmap wrote it."""

    def __init__(self, exe, args):
        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        # argv[0] "nmap" wie aus einer Shell (Meldungen wie "nmap: unrecognized option"), gestartet wird exe.
        self.proc = subprocess.Popen(
            ["nmap", *args], executable=exe, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            shell=False, creationflags=flags,
        )
        self.text = []
        self.code = None
        self.seen = time.monotonic()
        self.cond = threading.Condition()
        threading.Thread(target=self._pump, daemon=True).start()

    def _pump(self):
        decoder = codecs.getincrementaldecoder(locale.getpreferredencoding(False) or "utf-8")(errors="replace")
        stream = self.proc.stdout
        while True:
            chunk = stream.read1(65536)
            text = decoder.decode(chunk, final=not chunk).replace("\r\n", "\n")
            with self.cond:
                if text:
                    self.text.append(text)
                if not chunk:
                    self.code = self.proc.wait()
                self.cond.notify_all()
            if not chunk:
                return

    def read(self, start):
        with self.cond:
            self.seen = time.monotonic()
            if start >= len(self.text) and self.code is None:
                self.cond.wait(NMAP_POLL)
            done = self.code is not None
            return {"out": "".join(self.text[start:]), "next": len(self.text), "done": done,
                    "code": self.code if done else None}

    def stop(self):
        """Ctrl+C: SIGINT where it exists (nmap ends on it), TerminateProcess on Windows."""
        if self.proc.poll() is not None:
            return
        try:
            if os.name == "nt":
                self.proc.terminate()
            else:
                self.proc.send_signal(signal.SIGINT)
                try:
                    self.proc.wait(2)
                except subprocess.TimeoutExpired:
                    self.proc.kill()
        except OSError:
            pass


class NmapJobs:
    def __init__(self):
        self.lock = threading.Lock()
        self.jobs = {}
        threading.Thread(target=self._watch, daemon=True).start()

    def _watch(self):
        while True:
            time.sleep(5)
            with self.lock:
                for key, job in list(self.jobs.items()):
                    if time.monotonic() - job.seen > NMAP_IDLE:
                        job.stop()
                        del self.jobs[key]

    def stop_all(self):
        with self.lock:
            for job in self.jobs.values():
                job.stop()
            self.jobs.clear()

    def op(self, request):
        op = request.get("op")
        if op == "nmap-start":
            args = request.get("args")
            if (not isinstance(args, list) or len(args) > NMAP_MAX_ARGS
                    or not all(isinstance(a, str) and len(a) <= 4096 and "\x00" not in a for a in args)):
                raise Refused
            exe = find_nmap()
            if not exe:
                return {"missing": True}
            with self.lock:
                if len(self.jobs) >= NMAP_MAX_JOBS:
                    return {"error": "nmap: too many running scans"}
                try:
                    job = NmapJob(exe, args)
                except OSError as e:
                    return {"error": f"nmap: {e.strerror or 'cannot execute'}"}
                key = secrets.token_hex(8)
                self.jobs[key] = job
            return {"job": key}
        key = request.get("job")
        with self.lock:
            job = self.jobs.get(key) if isinstance(key, str) else None
        if job is None:
            return {"error": "nmap: no such scan"}
        if op == "nmap-stop":
            job.stop()
            with self.lock:
                self.jobs.pop(key, None)
            return {"ok": True}
        if op == "nmap-read":
            start = request.get("from")
            if not isinstance(start, int) or isinstance(start, bool) or start < 0:
                raise Refused
            result = job.read(start)
            if result["done"]:
                with self.lock:
                    self.jobs.pop(key, None)
            return result
        raise Refused


def make_server(root, token, output=print):
    session_lock = threading.Lock()
    disconnected = threading.Event()
    nmap = NmapJobs()

    def finish_session():
        with session_lock:
            if not disconnected.is_set():
                nmap.stop_all()
                output(f"successfully disconnected from {ARCHIVE_ENDPOINT}:443", flush=True)
                disconnected.set()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def guard(self):
            return (
                self.path == "/db"
                and self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}"
                and self.headers.get("Origin") == "null"
            )

        def reply(self, status, data=None, cors=False):
            raw = b"" if data is None else json.dumps(data, ensure_ascii=True).encode("utf-8")
            self.send_response(status)
            if cors:
                self.send_header("Access-Control-Allow-Origin", "null")
                self.send_header("Access-Control-Allow-Methods", "POST")
                self.send_header("Access-Control-Allow-Headers", f"Content-Type, {TOKEN_HEADER}")
                if self.headers.get("Access-Control-Request-Private-Network") == "true":
                    self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_OPTIONS(self):
            self.reply(204 if self.guard() else 403, cors=self.guard())

        def do_POST(self):
            if not self.guard():
                self.reply(403)
                return
            key = self.headers.get(TOKEN_HEADER, "")
            if not hmac.compare_digest(key.encode("utf-8"), token.encode("ascii")):
                self.reply(403, {"error": "Permission denied"}, cors=True)
                return
            request = None
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= MAX_EXPORT_REQUEST or self.headers.get_content_type() != "application/json":
                    raise Refused
                self.connection.settimeout(5)
                request = json.loads(self.rfile.read(size).decode("utf-8"))
                if size > 8192 and (not isinstance(request, dict) or request.get("op") != "export-txt"):
                    raise Refused
                if request == {"op": "disconnect"}:
                    try:
                        self.reply(200, {"ok": True}, cors=True)
                    finally:
                        finish_session()
                    return
                if disconnected.is_set():
                    result = {"error": "Lokale Sitzung getrennt"}
                elif isinstance(request, dict) and str(request.get("op", "")).startswith("nmap-"):
                    result = nmap.op(request)
                else:
                    result = terminal_file_op(root, request)
            except (Refused, PermissionError, ValueError):
                result = {"error": "Permission denied"}
            except (FileNotFoundError, NotADirectoryError):
                result = {"error": "Datei oder Ordner nicht gefunden"}
            except OSError:
                result = {"error": "TXT-Datei konnte nicht geschrieben werden" if isinstance(request, dict) and request.get("op") == "export-txt" else "Datei nicht lesbar"}
            self.reply(200, result, cors=True)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    server.disconnected = disconnected
    server.nmap = nmap
    return server


def wait_for_disconnect(server, pause=time.sleep):
    server.disconnected.wait()
    # Give the console user time to read the last line before the launcher exits.
    pause(1.5)


def startup_sequence(pause=time.sleep, output=print):
    for percent, delay in ((0, 0), (20, 0.6), (50, 0.8), (80, 0.8), (100, 0.7)):
        if delay:
            pause(delay)
        balken = ("=" * (percent // 5)).ljust(20, ".")
        output(f"\rtrying to connect to: {ARCHIVE_ENDPOINT}:443  [{balken}] {percent:>3}%", end="\n" if percent == 100 else "", flush=True)


def preferred_window(monitors):
    """Return logical desktop coordinates for a window on a non-primary monitor."""
    secondary = [m for m in monitors if not m[1] and m[2][2] > m[2][0] and m[2][3] > m[2][1]]
    if len(monitors) < 2 or not secondary:
        return {}
    name, _, (left, top, right, bottom) = min(
        secondary, key=lambda m: (m[0].upper() != r"\\.\DISPLAY2", m[0])
    )
    width, height = min(1440, right - left), min(900, bottom - top)
    return {
        "SHADOW_TERMINAL_WINDOW_POSITION": f"{left + (right - left - width) // 2},{top + (bottom - top - height) // 2}",
        "SHADOW_TERMINAL_WINDOW_SIZE": f"{width},{height}",
    }


def windows_monitors():
    import ctypes
    from ctypes import wintypes
    # Leave this launcher DPI-unaware so coordinates from Win32 are virtualized.
    user = ctypes.WinDLL("user32", use_last_error=True)

    class MonitorInfo(ctypes.Structure):
        _fields_ = [
            ("size", wintypes.DWORD), ("monitor", wintypes.RECT), ("work", wintypes.RECT),
            ("flags", wintypes.DWORD), ("name", wintypes.WCHAR * 32),
        ]

    callback_type = ctypes.WINFUNCTYPE(
        wintypes.BOOL, wintypes.HANDLE, wintypes.HDC, ctypes.POINTER(wintypes.RECT), wintypes.LPARAM
    )
    user.GetMonitorInfoW.argtypes = [wintypes.HANDLE, ctypes.POINTER(MonitorInfo)]
    user.GetMonitorInfoW.restype = wintypes.BOOL
    user.EnumDisplayMonitors.argtypes = [wintypes.HDC, ctypes.POINTER(wintypes.RECT), callback_type, wintypes.LPARAM]
    user.EnumDisplayMonitors.restype = wintypes.BOOL
    found = []

    @callback_type
    def collect(monitor, _hdc, _rect, _param):
        info = MonitorInfo()
        info.size = ctypes.sizeof(info)
        if user.GetMonitorInfoW(monitor, ctypes.byref(info)):
            w = info.work
            found.append((info.name, bool(info.flags & 1), (w.left, w.top, w.right, w.bottom)))
        return True

    return found if user.EnumDisplayMonitors(None, None, collect, 0) else []


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--serve-only", action="store_true", help="Run the local bridge without starting Edge")
    opt = parser.parse_args()
    root = PROJECT / DATABASE
    try:
        resolve_inside(root, [])
    except (OSError, Refused):
        raise SystemExit(f"Datenbankordner fehlt oder ist nicht lesbar: {DATABASE}")
    token = secrets.token_urlsafe(32)
    with make_server(root, token) as server:
        fragment = f"#db={server.server_port}.{token}"
        if not opt.serve_only and os.name != "nt":
            raise SystemExit("Nutze --serve-only außerhalb von Windows.")
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            if opt.serve_only:
                print(fragment, flush=True)
            else:
                env = {**os.environ, "SHADOW_TERMINAL_FRAGMENT": fragment}
                for key in ("SHADOW_TERMINAL_WINDOW_POSITION", "SHADOW_TERMINAL_WINDOW_SIZE"):
                    env.pop(key, None)
                try:
                    env.update(preferred_window(windows_monitors()))
                except OSError:
                    pass  # Monitor discovery is optional. Keep the normal Edge start.
                startup_sequence()
                result = subprocess.run(["cmd.exe", "/d", "/c", "START_3D.bat"], cwd=PROJECT, env=env, check=False)
                if result.returncode:
                    raise SystemExit(result.returncode)
                if not server.disconnected.is_set():
                    print(f"connected to: {DATABASE}", flush=True)
            wait_for_disconnect(server)
        except KeyboardInterrupt:
            pass
        finally:
            server.nmap.stop_all()
            server.shutdown()
            thread.join()


if __name__ == "__main__":
    main()
