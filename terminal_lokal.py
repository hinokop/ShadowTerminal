"""Read-only local file bridge. No OS commands or generic HTTP file serving."""
import argparse
import base64
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import stat
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DATABASE = "pgcl-eu3.arch07"
ARCHIVE_ENDPOINT = "relay-07.pgcl-eu3.invalid"  # Display only. Never resolved or contacted.
TOKEN_HEADER = "X-Shadow-Token"
MAX_DOWNLOAD = 20 * 1024 * 1024
MAX_TEXT = 64 * 1024
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
        from contextlib import ExitStack
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


def terminal_file_op(root, request):
    if not isinstance(request, dict):
        raise Refused
    op, parts = request.get("op"), request.get("parts")
    if op not in ("cd", "ls", "cat", "head", "tail", "wget"):
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
    if not stat.S_ISREG(meta.st_mode) or meta.st_nlink != 1:
        raise Refused
    limit = MAX_DOWNLOAD if op == "wget" else MAX_TEXT
    if meta.st_size > limit:
        return {"error": "Datei zu groß"}
    data = read_inside(root, parts, path, limit)
    if len(data) > limit:
        return {"error": "Datei zu groß"}
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


def make_server(root, token):
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
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 8192 or self.headers.get_content_type() != "application/json":
                    raise Refused
                self.connection.settimeout(5)
                result = terminal_file_op(root, json.loads(self.rfile.read(size).decode("utf-8")))
            except (Refused, PermissionError, ValueError):
                result = {"error": "Permission denied"}
            except (FileNotFoundError, NotADirectoryError):
                result = {"error": "Datei oder Ordner nicht gefunden"}
            except OSError:
                result = {"error": "Datei nicht lesbar"}
            self.reply(200, result, cors=True)

    return ThreadingHTTPServer(("127.0.0.1", 0), Handler)


def startup_sequence(pause=time.sleep, output=print):
    for percent, delay in ((0, 0), (20, 0.6), (50, 0.8), (80, 0.8), (100, 0.7)):
        if delay:
            pause(delay)
        balken = ("=" * (percent // 5)).ljust(20, ".")
        output(f"\r[{balken}] {percent:>3}%", end="\n" if percent == 100 else "", flush=True)


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
        if opt.serve_only:
            print(fragment, flush=True)
            server.serve_forever()
            return
        if os.name != "nt":
            raise SystemExit("Nutze --serve-only außerhalb von Windows.")
        env = {**os.environ, "SHADOW_TERMINAL_FRAGMENT": fragment}
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            startup_sequence()
            result = subprocess.run(["cmd.exe", "/d", "/c", "START_3D.bat"], cwd=PROJECT, env=env, check=False)
            if result.returncode:
                raise SystemExit(result.returncode)
            print(f"connected to: {DATABASE}", flush=True)
            input()
        except (EOFError, KeyboardInterrupt):
            pass
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
