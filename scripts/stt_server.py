#!/usr/bin/env python3
"""
Local speech-to-text service for Job OS (Parakeet on Apple Silicon via MLX).

Loads the model once and answers POST /transcribe with {"text": ...}. The
request body is raw audio in any format ffmpeg reads (browser webm/ogg, m4a,
wav). Listens on 127.0.0.1 only; audio never leaves the machine.

Run: .venv-stt/bin/python scripts/stt_server.py  (npm run jobos starts it)
"""

import json
import os
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer

from parakeet_mlx import from_pretrained

MODEL_ID = os.getenv("JOBOS_STT_MODEL", "mlx-community/parakeet-tdt-0.6b-v3")
PORT = int(os.getenv("JOBOS_STT_PORT", "8765"))
MAX_BYTES = 50 * 1024 * 1024  # about an hour of compressed speech

# MLX binds its compute stream to the thread that loaded the model, so the
# server is single-threaded: requests queue, which suits one user.
model = from_pretrained(MODEL_ID)


def transcribe(audio: bytes) -> str:
    with tempfile.TemporaryDirectory() as tmp:
        src, wav = os.path.join(tmp, "in"), os.path.join(tmp, "in.wav")
        with open(src, "wb") as f:
            f.write(audio)
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-ar", "16000", "-ac", "1", wav],
            check=True,
        )
        return model.transcribe(wav).text.strip()


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True, "model": MODEL_ID})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/transcribe":
            return self._json(404, {"error": "not found"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BYTES:
            return self._json(413 if length > MAX_BYTES else 400, {"error": "bad audio size"})
        try:
            self._json(200, {"text": transcribe(self.rfile.read(length))})
        except subprocess.CalledProcessError:
            self._json(422, {"error": "could not decode audio"})

    def log_message(self, format, *args):  # keep request lines out of logs
        pass


if __name__ == "__main__":
    print(f"[stt] {MODEL_ID} ready on http://127.0.0.1:{PORT}", flush=True)
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
