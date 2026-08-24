const POST_ID_RE = /^[\w-]{10,80}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

export class PostUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = "PostUrlError";
  }
}

function hostnameOf(host) {
  return host.replace(/\.$/, "").toLowerCase();
}

function isYoutubeHost(host) {
  const h = hostnameOf(host);
  if (YOUTUBE_HOSTS.has(h)) return true;
  return h.endsWith(".youtube.com");
}

export function parseCommunityPostUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new PostUrlError("Paste a YouTube Community Post URL.");
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new PostUrlError("That does not look like a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PostUrlError("Only http and https YouTube post URLs are supported.");
  }

  if (!isYoutubeHost(url.hostname)) {
    throw new PostUrlError("Only YouTube Community Post URLs are accepted.");
  }

  const path = url.pathname.replace(/\/+$/, "");
  const postFromPath = path.match(/\/post\/([^/?#]+)/i);
  const postFromQuery =
    url.searchParams.get("lb") ||
    url.searchParams.get("postId") ||
    url.searchParams.get("post_id");

  const rawId = decodeURIComponent(postFromPath?.[1] || postFromQuery || "");
  if (!rawId || !POST_ID_RE.test(rawId)) {
    throw new PostUrlError(
      "This is not a Community Post URL. Use a link like youtube.com/post/Ugkx…",
    );
  }

  if (/\/watch|\/shorts|\/live|\/embed|\/playlist/i.test(path) && !postFromPath) {
    throw new PostUrlError("Video, Shorts, and playlist links are not Community Posts.");
  }

  return {
    postId: rawId,
    canonicalUrl: `https://www.youtube.com/post/${rawId}`,
  };
}
