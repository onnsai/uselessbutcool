import { CAMERA_CAPTURE_CONFIG } from "../core/config.js";
import { pushLog } from "../core/log.js";

let captureStarted = false;

export function captureStartupCameraClip(stream) {
  if (captureStarted || !CAMERA_CAPTURE_CONFIG.enabled) return;
  captureStarted = true;

  if (!("MediaRecorder" in window)) {
    pushLog("capture: MediaRecorder unavailable");
    return;
  }

  const mimeType = CAMERA_CAPTURE_CONFIG.mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data?.size) chunks.push(event.data);
  });

  recorder.addEventListener("stop", async () => {
    if (!chunks.length) {
      pushLog("capture: no camera data recorded");
      return;
    }

    const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `camera-${timestamp}.webm`;

    try {
      pushLog(`capture: uploading ${Math.round(blob.size / 1024)}KB`);
      const response = await fetch(CAMERA_CAPTURE_CONFIG.uploadPath, {
        method: "POST",
        headers: {
          "Content-Type": blob.type,
          "X-Recording-Filename": filename,
        },
        body: blob,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json().catch(() => ({}));
      pushLog(`capture: saved ${result.filename ?? filename}`);
    } catch (error) {
      pushLog(`capture: upload failed (${error.message})`);
    }
  });

  recorder.start(1000);
  pushLog("capture: recording first 5s");
  window.setTimeout(() => {
    if (recorder.state !== "inactive") recorder.stop();
  }, CAMERA_CAPTURE_CONFIG.durationMs);
}
