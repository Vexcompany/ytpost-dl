import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 30 * 60 * 1000;

function secret() {
  return process.env.YTPOST_SECRET || "ytpost-dl-media-token-v1";
}

function b64url(value) {
  const buf = typeof value === "string" ? Buffer.from(value) : value;
  return buf.toString("base64url");
}

function sign(encoded) {
  return createHmac("sha256", secret()).update(encoded).digest("base64url");
}

export function issueMediaToken(payload) {
  const body = { ...payload, e: Date.now() + TOKEN_TTL_MS };
  const encoded = b64url(JSON.stringify(body));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyMediaToken(token) {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Download token is invalid.");
  }
  const [encoded, given] = parts;
  const expected = sign(encoded);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Download token is invalid.");
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new Error("Download token is invalid.");
  }
  if (!payload?.p || !payload?.u || !payload?.n || !payload?.e) {
    throw new Error("Download token is invalid.");
  }
  if (Date.now() > payload.e) {
    throw new Error("Download token expired. Extract the post again.");
  }
  return payload;
}

export function sanitizeFilename(name, fallback = "media.bin") {
  const cleaned = name
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
}
