from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import shutil
import subprocess
from urllib.parse import urlparse


HOST = "127.0.0.1"
PORT = 8765


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

    def do_OPTIONS(self) -> None:
        self._write_json(204, {})

    def do_POST(self) -> None:
        if self.path != "/run-script":
            self._write_json(404, {"ok": False, "error": "Not found."})
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)

        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._write_json(400, {"ok": False, "error": "Invalid JSON payload."})
            return

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
