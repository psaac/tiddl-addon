from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import re
import shutil
import subprocess
from urllib.parse import urlparse

ANSI_ESCAPE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')


def strip_ansi(text: str) -> str:
    return ANSI_ESCAPE.sub('', text)


HOST = os.getenv("BACKEND_HOST", "127.0.0.1")
PORT = int(os.getenv("BACKEND_PORT", "8765"))


def run_user_script(payload: dict) -> dict:
    media_url = str(payload.get("mediaUrl", "")).strip()
    if not media_url:
        return {"ok": False, "error": "Missing mediaUrl."}

    parsed_url = urlparse(media_url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        return {"ok": False, "error": "Invalid mediaUrl."}

    tiddl_path = shutil.which("tiddl")
    if not tiddl_path:
        return {"ok": False, "error": "The 'tiddl' command is not available in PATH."}

    command = [tiddl_path, "download", "-q", "max", "url", media_url]

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError as error:
        return {"ok": False, "error": f"Failed to start tiddl: {error}"}

    stdout = completed.stdout.strip()
    stderr = completed.stderr.strip()

    # Check if the error is authentication-related
    if "Not logged in." in stderr or "Not logged in." in stdout:
        # Try to get the login URL
        try:
            login_proc = subprocess.Popen(
                [tiddl_path, "auth", "login", "--no-browser"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )

            auth_url = None
            # Read lines until we find the URL, then let the process run in background
            for line in login_proc.stdout:
                url_match = re.search(r"https?://\S+", line)
                if url_match:
                    auth_url = url_match.group(0).rstrip("'")
                    break

            return {
                "ok": False,
                "error": "Authentication required",
                "authUrl": auth_url,
            }
        except OSError:
            return {
                "ok": False,
                "error": "Not logged in. Please run 'tiddl auth login' in terminal.",
            }

    if completed.returncode != 0:
        return {
            "ok": False,
            "error": stderr or stdout or f"tiddl exited with code {completed.returncode}.",
        }

    return {
        "ok": True,
        "message": stdout or "Download started successfully.",
        "mediaUrl": media_url,
    }


class RequestHandler(BaseHTTPRequestHandler):
    def _write_json(self, status_code: int, data: dict) -> None:
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "moz-extension://*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def _send_sse(self, data: dict) -> None:
        line = f"data: {json.dumps(data)}\n\n"
        self.wfile.write(line.encode("utf-8"))
        self.wfile.flush()

    def _handle_stream(self, payload: dict) -> None:
        media_url = str(payload.get("mediaUrl", "")).strip()

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "moz-extension://*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

        if not media_url:
            self._send_sse({"type": "error", "error": "Missing mediaUrl."})
            return

        parsed_url = urlparse(media_url)
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            self._send_sse({"type": "error", "error": "Invalid mediaUrl."})
            return

        tiddl_path = shutil.which("tiddl")
        if not tiddl_path:
            self._send_sse({"type": "error", "error": "The 'tiddl' command is not available in PATH."})
            return

        try:
            proc = subprocess.Popen(
                [tiddl_path, "download", "-q", "max", "url", media_url],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
        except OSError as error:
            self._send_sse({"type": "error", "error": f"Failed to start tiddl: {error}"})
            return

        for raw_line in proc.stdout:
            line = strip_ansi(raw_line).strip()
            if not line:
                continue

            if "Not logged in." in line:
                proc.terminate()
                try:
                    login_proc = subprocess.Popen(
                        [tiddl_path, "auth", "login", "--no-browser"],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                    )
                    auth_url = None
                    for login_line in login_proc.stdout:
                        url_match = re.search(r"https?://\S+", login_line)
                        if url_match:
                            auth_url = url_match.group(0).rstrip("'")
                            break
                    self._send_sse({"type": "auth_required", "authUrl": auth_url})
                except OSError:
                    self._send_sse({"type": "error", "error": "Not logged in."})
                return

            self._send_sse({"type": "progress", "text": line})

        proc.wait()
        if proc.returncode == 0:
            self._send_sse({"type": "done", "ok": True})
        else:
            self._send_sse({"type": "done", "ok": False, "error": f"tiddl exited with code {proc.returncode}."})

    def do_OPTIONS(self) -> None:
        self._write_json(204, {})

    def do_POST(self) -> None:
        if self.path not in ("/run-script", "/run-script-stream"):
            self._write_json(404, {"ok": False, "error": "Not found."})
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)

        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._write_json(400, {"ok": False, "error": "Invalid JSON payload."})
            return

        if self.path == "/run-script-stream":
            self._handle_stream(payload)
        else:
            result = run_user_script(payload)
            self._write_json(200, result)

    def log_message(self, format: str, *args) -> None:
        return


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), RequestHandler)
    print(f"Python backend listening on http://{HOST}:{PORT}")
    server.serve_forever()

if __name__ == "__main__":
    main()
