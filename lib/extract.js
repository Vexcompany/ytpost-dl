import {
  isAllowedMediaUrl,
  mediaIdentityKey,
  normalizeMediaUrl,
  previewStillUrl,
  upgradeStillUrl,
} from "./allowed-media.js";

export class ExtractError extends Error {
  constructor(message) {
    super(message);
    this.name = "ExtractError";
  }
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asObject(value) {
  return isObject(value) ? value : null;
}

function walkObjects(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkObjects(item, visit);
    return;
  }
  if (!isObject(value)) return;
  visit(value);
  for (const nested of Object.values(value)) walkObjects(nested, visit);
}

function runsText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  const obj = asObject(value);
  if (!obj) return "";
  if (typeof obj.simpleText === "string") return obj.simpleText;
  if (typeof obj.content === "string") return obj.content;
  if (Array.isArray(obj.runs)) {
    return obj.runs
      .map((run) => {
        const item = asObject(run);
        return item && typeof item.text === "string" ? item.text : "";
      })
      .join("");
  }
  const accessibility = asObject(obj.accessibility);
  const accData = asObject(accessibility?.accessibilityData);
  if (typeof accData?.label === "string") return accData.label;
  return "";
}

function firstUrl(value) {
  const obj = asObject(value);
  if (!obj) return undefined;
  const command = asObject(obj.navigationEndpoint) || obj;
  const browse = asObject(command.browseEndpoint);
  if (typeof browse?.canonicalBaseUrl === "string") return browse.canonicalBaseUrl;
  const web = asObject(asObject(command.commandMetadata)?.webCommandMetadata);
  if (typeof web?.url === "string") return web.url;
  if (typeof obj.url === "string") return obj.url;
  return undefined;
}

function absoluteYoutubeUrl(pathOrUrl) {
  if (!pathOrUrl) return undefined;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  if (pathOrUrl.startsWith("/")) return `https://www.youtube.com${pathOrUrl}`;
  return undefined;
}

function bestThumbnail(thumbnails) {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return null;
  let best = null;
  for (const item of thumbnails) {
    const thumb = asObject(item);
    if (!thumb || typeof thumb.url !== "string") continue;
    const width = typeof thumb.width === "number" ? thumb.width : 0;
    const height = typeof thumb.height === "number" ? thumb.height : 0;
    if (!best || width * height >= best.width * best.height) {
      best = { url: thumb.url, width, height };
    }
  }
  if (!best) return null;
  return {
    url: best.url,
    width: best.width || undefined,
    height: best.height || undefined,
  };
}

function collectImageFromRenderer(renderer, out) {
  const obj = asObject(renderer);
  if (!obj) return;
  const image = asObject(obj.image) || obj;
  const best = bestThumbnail(image.thumbnails);
  if (!best) return;
  try {
    const normalized = normalizeMediaUrl(best.url);
    if (!isAllowedMediaUrl(normalized)) return;
    out.push({
      sourceUrl: normalized,
      width: best.width,
      height: best.height,
    });
  } catch {
    // ignore malformed media URLs
  }
}

function collectPollImages(poll, out) {
  const obj = asObject(poll);
  if (!obj || !Array.isArray(obj.choices)) return;
  for (const choice of obj.choices) {
    const item = asObject(choice);
    if (!item) continue;
    if (item.image) collectImageFromRenderer({ image: item.image }, out);
    if (item.backstageImageRenderer) collectImageFromRenderer(item.backstageImageRenderer, out);
  }
}

function findDirectVideoUrl(root) {
  let found;
  walkObjects(root, (obj) => {
    if (found) return;
    const url = obj.url;
    if (typeof url !== "string") return;
    let normalized;
    try {
      normalized = normalizeMediaUrl(url);
    } catch {
      return;
    }
    if (!isAllowedMediaUrl(normalized)) return;
    const isVideoHost = normalized.includes("googlevideo.com");
    const isFile = /\.(mp4|webm|m3u8)(?:$|\?)/i.test(normalized);
    if (isVideoHost || isFile) found = normalized;
  });
  return found;
}

function extractVideoRenderer(renderer, videos, notices) {
  const obj = asObject(renderer);
  if (!obj) return;
  const videoId = typeof obj.videoId === "string" ? obj.videoId : undefined;
  const direct = findDirectVideoUrl(obj);
  if (direct) {
    videos.push({ sourceUrl: direct, videoId });
    return;
  }
  if (videoId) {
    notices.push(
      `This post also shares YouTube video ${videoId}, which is not a direct media file and cannot be saved here.`,
    );
  }
}

function extractAttachment(attachment, images, videos, notices) {
  const obj = asObject(attachment);
  if (!obj) return;

  if (obj.backstageImageRenderer) {
    collectImageFromRenderer(obj.backstageImageRenderer, images);
  }
  if (obj.postMultiImageRenderer) {
    const multi = asObject(obj.postMultiImageRenderer);
    if (Array.isArray(multi?.images)) {
      for (const image of multi.images) extractAttachment(image, images, videos, notices);
    }
  }
  if (obj.pollRenderer) collectPollImages(obj.pollRenderer, images);
  if (obj.quizRenderer) collectPollImages(obj.quizRenderer, images);
  if (obj.image) collectImageFromRenderer(obj, images);

  if (obj.videoRenderer) extractVideoRenderer(obj.videoRenderer, videos, notices);
  if (obj.compactVideoRenderer) extractVideoRenderer(obj.compactVideoRenderer, videos, notices);
  if (obj.reelItemRenderer) extractVideoRenderer(obj.reelItemRenderer, videos, notices);
  if (obj.backstageVideoRenderer) extractVideoRenderer(obj.backstageVideoRenderer, videos, notices);
}

function findPostNode(root, postId) {
  let found = null;
  walkObjects(root, (obj) => {
    if (found) return;
    const backstage = asObject(obj.backstagePostRenderer);
    if (backstage && backstage.postId === postId) {
      found = backstage;
      return;
    }
    const shared = asObject(obj.sharedPostRenderer);
    if (shared && shared.postId === postId) {
      found = shared;
    }
  });
  return found;
}

function attachmentOf(post) {
  if (post.backstageAttachment) return post.backstageAttachment;
  const original = asObject(post.originalPost);
  const originalPost = asObject(original?.backstagePostRenderer) || original;
  return originalPost?.backstageAttachment;
}

function collectAlerts(root) {
  const alerts = [];
  walkObjects(root, (obj) => {
    if (obj.alertRenderer) {
      const text = runsText(asObject(obj.alertRenderer)?.text);
      if (text) alerts.push(text);
    }
    if (obj.alertWithButtonRenderer) {
      const text = runsText(asObject(obj.alertWithButtonRenderer)?.text);
      if (text) alerts.push(text);
    }
  });
  return alerts;
}

function isMembersOnly(alerts, post) {
  const blob = `${alerts.join(" ")} ${JSON.stringify(post ?? {})}`;
  return /members(?:hip)? only|available to members|join this channel/i.test(blob);
}

function largestAvatar(thumbnails) {
  const best = bestThumbnail(thumbnails);
  if (!best) return undefined;
  try {
    const normalized = normalizeMediaUrl(best.url);
    if (!isAllowedMediaUrl(normalized)) return undefined;
    return previewStillUrl(normalized, 88);
  } catch {
    return undefined;
  }
}

function dedupeImages(images) {
  const seen = new Set();
  const out = [];
  for (const image of images) {
    const key = mediaIdentityKey(image.sourceUrl);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...image,
      sourceUrl: upgradeStillUrl(image.sourceUrl),
    });
  }
  return out;
}

export function extractJsonObject(source, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(start, i + 1));
    }
  }
  throw new ExtractError("Could not parse YouTube page data.");
}

export function extractYtInitialData(html) {
  const patterns = [
    /var ytInitialData\s*=\s*/,
    /window\["ytInitialData"\]\s*=\s*/,
    /ytInitialData\s*=\s*/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (!match) continue;
    const start = html.indexOf("{", match.index);
    if (start === -1) continue;
    try {
      return extractJsonObject(html, start);
    } catch {
      continue;
    }
  }
  return null;
}

export function unwrapPbj(parsed) {
  if (Array.isArray(parsed)) {
    const withResponse = parsed.find((item) => isObject(item) && "response" in item);
    if (withResponse && isObject(withResponse)) return withResponse.response;
    return parsed[0];
  }
  if (isObject(parsed) && "response" in parsed) return parsed.response;
  return parsed;
}

export function parseYouTubePayload(body, contentType = "") {
  const trimmed = body.trim();
  const looksJson =
    contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[");
  if (looksJson) {
    try {
      return unwrapPbj(JSON.parse(trimmed));
    } catch {
      // HTML disguised as JSON, or truncated payload.
    }
  }

  const data = extractYtInitialData(body);
  if (data) return data;

  if (/before you continue to youtube|consent\.youtube|CONSENT/i.test(body)) {
    throw new ExtractError("YouTube asked for cookie consent before showing this post.");
  }
  if (/sign in to confirm you.?re not a bot/i.test(body)) {
    throw new ExtractError("YouTube blocked this request. Try again in a few minutes.");
  }
  throw new ExtractError("Could not read this Community Post from YouTube.");
}

export function extractCommunityPost(data, postId) {
  const alerts = collectAlerts(data);
  const post = findPostNode(data, postId);

  if (!post) {
    if (isMembersOnly(alerts, null)) {
      throw new ExtractError("This Community Post is members-only and cannot be read.");
    }
    const alertText = alerts[0];
    throw new ExtractError(alertText || "This Community Post is unavailable or has no public media.");
  }

  if (isMembersOnly(alerts, post) && !attachmentOf(post)) {
    throw new ExtractError("This Community Post is members-only and cannot be read.");
  }

  const images = [];
  const videos = [];
  const notices = [];
  extractAttachment(attachmentOf(post), images, videos, notices);

  const author = runsText(post.authorText) || "YouTube";
  const authorUrl = absoluteYoutubeUrl(firstUrl(post.authorEndpoint) || firstUrl(post.authorText));
  const authorThumb = asObject(post.authorThumbnail);
  const publishedText = runsText(post.publishedTimeText) || undefined;
  const text = runsText(post.contentText).trim();
  const likeCount = runsText(post.voteCount) || undefined;

  const uniqueImages = dedupeImages(images);
  const uniqueVideos = [];
  const seenVideo = new Set();
  for (const video of videos) {
    const key = mediaIdentityKey(video.sourceUrl);
    if (seenVideo.has(key)) continue;
    seenVideo.add(key);
    uniqueVideos.push(video);
  }

  if (uniqueImages.length === 0 && uniqueVideos.length === 0 && notices.length === 0) {
    notices.push("This public post does not contain downloadable image or video files.");
  }

  return {
    postId,
    author,
    authorUrl,
    authorAvatar: largestAvatar(authorThumb?.thumbnails),
    publishedText,
    text,
    likeCount,
    images: uniqueImages,
    videos: uniqueVideos,
    notices,
  };
}
