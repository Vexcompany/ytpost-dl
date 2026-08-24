const ALLOWED_HOST_EXACT = new Set([
  "i.ytimg.com",
  "i1.ytimg.com",
  "i2.ytimg.com",
  "i3.ytimg.com",
  "i4.ytimg.com",
  "i9.ytimg.com",
  "yt3.ggpht.com",
  "yt3.googleusercontent.com",
  "lh3.googleusercontent.com",
]);

const ALLOWED_HOST_SUFFIX = [".ggpht.com", ".googleusercontent.com", ".googlevideo.com"];

export function isAllowedMediaUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (ALLOWED_HOST_EXACT.has(host)) return true;
  return ALLOWED_HOST_SUFFIX.some((suffix) => host.endsWith(suffix));
}

export function normalizeMediaUrl(raw) {
  const withProtocol = raw.startsWith("//") ? `https:${raw}` : raw;
  const url = new URL(withProtocol);
  url.hash = "";
  return url.toString();
}

export function upgradeStillUrl(raw) {
  const url = new URL(normalizeMediaUrl(raw));
  const host = url.hostname.toLowerCase();
  const isGgpht = host.endsWith(".ggpht.com") || host.endsWith(".googleusercontent.com");
  if (!isGgpht) {
    url.search = "";
    return url.toString();
  }
  const eq = url.pathname.indexOf("=");
  if (eq !== -1) {
    url.pathname = `${url.pathname.slice(0, eq)}=s0`;
  }
  url.search = "";
  return url.toString();
}

export function previewStillUrl(raw, size = 640) {
  const url = new URL(normalizeMediaUrl(raw));
  const host = url.hostname.toLowerCase();
  const isGgpht = host.endsWith(".ggpht.com") || host.endsWith(".googleusercontent.com");
  if (!isGgpht) return url.toString();
  const eq = url.pathname.indexOf("=");
  if (eq !== -1) {
    url.pathname = `${url.pathname.slice(0, eq)}=s${size}`;
  }
  url.search = "";
  return url.toString();
}

export function mediaIdentityKey(raw) {
  try {
    const url = new URL(normalizeMediaUrl(raw));
    const eq = url.pathname.indexOf("=");
    const path = eq === -1 ? url.pathname : url.pathname.slice(0, eq);
    return `${url.hostname}${path}`;
  } catch {
    return raw;
  }
}
