import { issueMediaToken, sanitizeFilename } from "./media-token.js";
import { parseCommunityPostUrl, PostUrlError } from "./post-url.js";
import { extractCommunityPost, parseYouTubePayload, ExtractError } from "./extract.js";
import { previewStillUrl } from "./allowed-media.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CLIENT_VERSION = "2.20260820.08.00";

const YT_HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
  Cookie:
    "CONSENT=YES+; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjQwNTE0LjA3X3AxGgJlbiACGgYIgJn3sAY",
};

function clientHeaders(extra = {}) {
  return {
    ...YT_HEADERS,
    "X-YouTube-Client-Name": "1",
    "X-YouTube-Client-Version": CLIENT_VERSION,
    ...extra,
  };
}

async function fetchText(url, headers) {
  const response = await fetch(url, {
    method: "GET",
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.text();
  return {
    body,
    contentType: response.headers.get("content-type") || "",
    status: response.status,
  };
}

function extensionFor(kind, url) {
  const lower = url.toLowerCase();
  if (kind === "video") {
    if (lower.includes(".webm")) return "webm";
    if (lower.includes(".m3u8")) return "m3u8";
    return "mp4";
  }
  if (lower.includes(".png")) return "png";
  if (lower.includes(".webp")) return "webp";
  if (lower.includes(".gif")) return "gif";
  return "jpg";
}

export { ExtractError };

export async function previewCommunityPost(inputUrl) {
  let parsed;
  try {
    parsed = parseCommunityPostUrl(inputUrl);
  } catch (error) {
    if (error instanceof PostUrlError) throw new ExtractError(error.message);
    throw error;
  }

  const pbjUrl = `${parsed.canonicalUrl}?pbj=1&hl=en`;
  let payload = null;
  let lastError = null;

  try {
    const pbj = await fetchText(pbjUrl, clientHeaders({ Accept: "application/json, text/plain, */*" }));
    if (pbj.status >= 400) {
      lastError = `YouTube returned HTTP ${pbj.status}.`;
    } else {
      payload = parseYouTubePayload(pbj.body, pbj.contentType);
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : "YouTube JSON request failed.";
  }

  if (!payload) {
    const html = await fetchText(parsed.canonicalUrl, clientHeaders());
    if (html.status === 404) {
      throw new ExtractError("This Community Post was not found.");
    }
    if (html.status >= 400) {
      throw new ExtractError(lastError || `YouTube returned HTTP ${html.status}.`);
    }
    payload = parseYouTubePayload(html.body, html.contentType);
  }

  const extracted = extractCommunityPost(payload, parsed.postId);
  const authorSlug = sanitizeFilename(extracted.author, "post");
  const media = [
    ...extracted.images.map((image, index) => {
      const filename = sanitizeFilename(
        `${authorSlug}_${parsed.postId}_${index + 1}.${extensionFor("image", image.sourceUrl)}`,
        `image-${index + 1}.jpg`,
      );
      return {
        id: `image-${index + 1}`,
        type: "image",
        previewUrl: previewStillUrl(image.sourceUrl, 640),
        width: image.width,
        height: image.height,
        filename,
        token: issueMediaToken({
          p: parsed.postId,
          u: image.sourceUrl,
          n: filename,
          t: "image",
        }),
      };
    }),
    ...extracted.videos.map((video, index) => {
      const filename = sanitizeFilename(
        `${authorSlug}_${parsed.postId}_video-${index + 1}.${extensionFor("video", video.sourceUrl)}`,
        `video-${index + 1}.mp4`,
      );
      return {
        id: `video-${index + 1}`,
        type: "video",
        previewUrl: video.sourceUrl,
        filename,
        token: issueMediaToken({
          p: parsed.postId,
          u: video.sourceUrl,
          n: filename,
          t: "video",
        }),
      };
    }),
  ];

  return {
    ok: true,
    postId: parsed.postId,
    canonicalUrl: parsed.canonicalUrl,
    author: extracted.author,
    authorUrl: extracted.authorUrl,
    authorAvatar: extracted.authorAvatar,
    publishedText: extracted.publishedText,
    text: extracted.text,
    likeCount: extracted.likeCount,
    media,
    notices: extracted.notices,
  };
}
