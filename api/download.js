import { Readable } from "node:stream";
import { isAllowedMediaUrl } from "../lib/allowed-media.js";
import { sanitizeFilename, verifyMediaToken } from "../lib/media-token.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function asciiFilename(name) {
  return name.replace(/[^\x20-\x7E]+/g, "_");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ ok: false, error: "Use GET." });
    return;
  }

  const token = typeof req.query?.token === "string" ? req.query.token : "";
  let payload;
  try {
    payload = verifyMediaToken(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download token is invalid.";
    res.status(403).json({ ok: false, error: message });
    return;
  }

  if (!isAllowedMediaUrl(payload.u)) {
    res.status(400).json({ ok: false, error: "That media host is not allowed." });
    return;
  }

  let upstream;
  try {
    upstream = await fetch(payload.u, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: payload.t === "video" ? "video/*,*/*;q=0.8" : "image/*,*/*;q=0.8",
        Referer: "https://www.youtube.com/",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    res.status(502).json({ ok: false, error: "Could not reach the media file." });
    return;
  }

  if (!upstream.ok || !upstream.body) {
    res.status(502).json({ ok: false, error: `Media request failed (${upstream.status}).` });
    return;
  }

  const contentType = (upstream.headers.get("content-type") || "").split(";")[0].trim();
  const allowed =
    contentType.startsWith("image/") ||
    contentType.startsWith("video/") ||
    contentType === "application/octet-stream";
  if (!allowed) {
    res.status(502).json({ ok: false, error: "The remote file was not an image or video." });
    return;
  }

  const filename = sanitizeFilename(payload.n, payload.t === "video" ? "video.mp4" : "image.jpg");
  res.setHeader("Content-Type", contentType || (payload.t === "video" ? "video/mp4" : "image/jpeg"));
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${asciiFilename(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const length = upstream.headers.get("content-length");
  if (length) res.setHeader("Content-Length", length);

  Readable.fromWeb(upstream.body).pipe(res);
}
