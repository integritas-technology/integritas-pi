#!/usr/bin/env python3
import argparse
import json
import os
import re
import shutil
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


def json_response(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def command_candidates(mode):
    configured = os.environ.get("CAMERA_PHOTO_COMMAND" if mode == "photo" else "CAMERA_VIDEO_COMMAND", "")
    fallbacks = ["rpicam-still", "libcamera-still"] if mode == "photo" else ["rpicam-vid", "libcamera-vid"]
    result = []
    for command in [configured] + fallbacks:
        if command and command not in result:
            result.append(command)
    return result


def resolve_command(mode):
    for command in command_candidates(mode):
        if shutil.which(command):
            return command
    return None


def list_cameras(command):
    try:
        result = subprocess.run([command, "--list-cameras"], capture_output=True, text=True, timeout=8, check=False)
    except Exception as exc:
        return {"detected": False, "output": "", "reason": f"Could not list cameras with {command}: {exc}"}

    output = (result.stdout + result.stderr).strip()
    if re.search(r"no cameras available", output, re.IGNORECASE):
        return {"detected": False, "output": output, "reason": f"No cameras were detected by {command}. Verify camera ribbon, host OS camera support, and /boot/config.txt."}
    if not output:
        return {"detected": False, "output": output, "reason": f"{command} did not report any cameras."}
    return {"detected": True, "output": output, "reason": None}


class CameraHelper:
    def __init__(self, capture_dir, container_capture_dir, token, max_duration_seconds):
        self.capture_dir = Path(capture_dir).resolve()
        self.container_capture_dir = container_capture_dir.rstrip("/") or "/data/captures"
        self.token = token
        self.max_duration_ms = max(1, int(max_duration_seconds)) * 1000
        self.capture_dir.mkdir(parents=True, exist_ok=True)

    def capabilities(self):
        photo_command = resolve_command("photo")
        video_command = resolve_command("video")
        if not photo_command:
            return {"available": False, "reason": f"Camera photo command was not found. Tried: {', '.join(command_candidates('photo'))}"}
        if not video_command:
            return {"available": False, "reason": f"Camera video command was not found. Tried: {', '.join(command_candidates('video'))}", "photoCommand": photo_command}
        camera_list = list_cameras(photo_command)
        if not camera_list["detected"]:
            return {"available": False, "reason": camera_list["reason"], "photoCommand": photo_command, "videoCommand": video_command, "cameras": camera_list["output"]}
        return {"available": True, "reason": None, "photoCommand": photo_command, "videoCommand": video_command, "cameras": camera_list["output"]}

    def capture(self, payload):
        mode = "video" if payload.get("mode") == "video" else "photo"
        command = resolve_command(mode)
        if not command:
            raise ValueError(f"Camera {mode} command was not found. Tried: {', '.join(command_candidates(mode))}")

        width = parse_int(payload.get("width", 1280), "width", 160, 7680)
        height = parse_int(payload.get("height", 720), "height", 120, 4320)
        duration_ms = parse_int(payload.get("durationMs", 5000 if mode == "video" else 1000), "durationMs", 100, self.max_duration_ms)
        fps = parse_int(payload.get("fps", 30), "fps", 1, 120)
        source_name = safe_name(str(payload.get("sourceName", "camera")))
        captured_at = time.strftime("%Y-%m-%dT%H-%M-%SZ", time.gmtime())
        extension = "h264" if mode == "video" else "jpg"
        file_name = f"{source_name}-{captured_at}.{extension}"
        output_path = (self.capture_dir / file_name).resolve()

        if self.capture_dir not in output_path.parents:
            raise ValueError("Output path escaped capture directory")

        args = [command, "-n", "-o", str(output_path), "--width", str(width), "--height", str(height), "--timeout", str(duration_ms)]
        if mode == "video":
            args.extend(["--framerate", str(fps)])

        result = subprocess.run(args, capture_output=True, text=True, timeout=(duration_ms / 1000) + 15, check=False)
        if result.returncode != 0:
            detail = (result.stderr or result.stdout).strip()
            raise RuntimeError(f"Camera command exited with {result.returncode}{': ' + detail if detail else ''}")

        stat = output_path.stat()
        return {
            "source": "pi-camera-helper",
            "mode": mode,
            "fileName": file_name,
            "path": f"{self.container_capture_dir}/{file_name}",
            "mediaType": "video/h264" if mode == "video" else "image/jpeg",
            "sizeBytes": stat.st_size,
            "capturedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "width": width,
            "height": height,
            "durationMs": duration_ms if mode == "video" else 0,
            "fps": fps if mode == "video" else None,
            "command": command,
        }


def parse_int(value, name, minimum, maximum):
    try:
        parsed = int(value)
    except Exception:
        raise ValueError(f"{name} must be an integer")
    if parsed < minimum or parsed > maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return parsed


def safe_name(value):
    name = re.sub(r"[^a-zA-Z0-9_-]+", "-", value.strip().lower()).strip("-")
    return name or "camera"


class Handler(BaseHTTPRequestHandler):
    helper = None

    def log_message(self, format, *args):
        return

    def authenticated(self):
        expected = self.helper.token
        if not expected:
            return True
        header = self.headers.get("Authorization", "")
        return header == f"Bearer {expected}"

    def do_GET(self):
        route = urlparse(self.path).path
        if route == "/health":
            return json_response(self, 200, {"ok": True})
        if route == "/capabilities":
            if not self.authenticated():
                return json_response(self, 401, {"error": "Unauthorized"})
            return json_response(self, 200, self.helper.capabilities())
        return json_response(self, 404, {"error": "Not found"})

    def do_POST(self):
        route = urlparse(self.path).path
        if route != "/capture":
            return json_response(self, 404, {"error": "Not found"})
        if not self.authenticated():
            return json_response(self, 401, {"error": "Unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 8192:
                return json_response(self, 413, {"error": "Request body too large"})
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            return json_response(self, 200, self.helper.capture(payload))
        except Exception as exc:
            return json_response(self, 400, {"error": str(exc)})


def main():
    parser = argparse.ArgumentParser(description="Integritas Pi camera helper")
    parser.add_argument("--host", default=os.environ.get("CAMERA_HELPER_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("CAMERA_HELPER_PORT", "38180")))
    parser.add_argument("--capture-dir", default=os.environ.get("CAMERA_CAPTURE_DIR", "/opt/integritas-pi/data/captures"))
    parser.add_argument("--container-capture-dir", default=os.environ.get("CAMERA_CONTAINER_CAPTURE_DIR", "/data/captures"))
    parser.add_argument("--token", default=os.environ.get("CAMERA_HELPER_TOKEN", ""))
    parser.add_argument("--max-duration-seconds", type=int, default=int(os.environ.get("CAMERA_MAX_DURATION_SECONDS", "30")))
    args = parser.parse_args()

    Handler.helper = CameraHelper(args.capture_dir, args.container_capture_dir, args.token, args.max_duration_seconds)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
