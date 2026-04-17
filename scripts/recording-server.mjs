import { createWriteStream, promises as fs } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const port = Number(process.env.PORT ?? 8010);
const recordingDir = process.env.RECORDING_DIR ?? "/srv/uselessbutcool/recordings";
const maxBytes = Number(process.env.MAX_RECORDING_BYTES ?? 50 * 1024 * 1024);

const safeFilename = (value) => {
  const fallback = `camera-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
  return (value || fallback).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
};

await fs.mkdir(recordingDir, { recursive: true });

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.method !== "POST" || request.url !== "/camera") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
    return;
  }

  const length = Number(request.headers["content-length"] ?? 0);
  if (length > maxBytes) {
    response.writeHead(413, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "recording too large" }));
    return;
  }

  const filename = safeFilename(request.headers["x-recording-filename"]);
  const targetPath = path.join(recordingDir, filename);

  try {
    await pipeline(request, createWriteStream(targetPath, { flags: "wx" }));
    response.writeHead(201, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, filename, path: targetPath }));
    console.log(`[recording] saved ${targetPath}`);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: error.message }));
    console.error(`[recording] failed: ${error.message}`);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[recording] listening on http://127.0.0.1:${port}`);
  console.log(`[recording] saving to ${recordingDir}`);
});
