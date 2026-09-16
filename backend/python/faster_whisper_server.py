"""
faster_whisper_server.py

A tiny local HTTP server that wraps faster-whisper so the Node backend can
POST an audio segment and get transcribed text back. Runs entirely on your
machine — no API key, no cost.

Setup:
    pip install faster-whisper flask

Run:
    python3 faster_whisper_server.py
    (listens on http://localhost:9000)

Model size can be changed via the WHISPER_MODEL env var, e.g.:
    WHISPER_MODEL=small python3 faster_whisper_server.py
Options: tiny, base, small, medium, large-v3 (bigger = more accurate, slower)
"""

import os
import tempfile

from flask import Flask, request, jsonify
from faster_whisper import WhisperModel

MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")  # "cuda" if you have a GPU
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")

print(f"Loading faster-whisper model '{MODEL_SIZE}' on {DEVICE} ({COMPUTE_TYPE})...")
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
print("Model loaded. Ready for requests.")

app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "model": MODEL_SIZE})


@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "No 'audio' file in request"}), 400

    audio_file = request.files["audio"]

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        segments, _info = model.transcribe(tmp_path, beam_size=5, vad_filter=True)
        text = " ".join(segment.text.strip() for segment in segments).strip()
        return jsonify({"text": text})
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


if __name__ == "__main__":
    # Detach from controlling terminal when possible so parent exits don't
    # interrupt the model server (esp. under nodemon / npm scripts).
    try:
        import os

        if hasattr(os, "setpgrp"):
            os.setpgrp()
    except Exception:
        pass
    app.run(host="0.0.0.0", port=9000, threaded=True)
