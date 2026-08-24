import assert from "node:assert/strict";
import test from "node:test";
import { parseCommunityPostUrl, PostUrlError } from "../lib/post-url.js";
import { isAllowedMediaUrl, mediaIdentityKey, upgradeStillUrl } from "../lib/allowed-media.js";
import { extractCommunityPost, parseYouTubePayload } from "../lib/extract.js";

const SAMPLE = "http://youtube.com/post/Ugkx57vsk9xXNKOk1q9s5EqEN-LkHJVlu22X?si=dwxpZLHGDPLJ3qw9";

test("parses community post URLs and rejects watch links", () => {
  const parsed = parseCommunityPostUrl(SAMPLE);
  assert.equal(parsed.postId, "Ugkx57vsk9xXNKOk1q9s5EqEN-LkHJVlu22X");
  assert.equal(parsed.canonicalUrl, "https://www.youtube.com/post/Ugkx57vsk9xXNKOk1q9s5EqEN-LkHJVlu22X");
  assert.throws(() => parseCommunityPostUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), PostUrlError);
  assert.throws(() => parseCommunityPostUrl("https://example.com/post/Ugkx57vsk9xXNKOk1q9s5EqEN-LkHJVlu22X"), PostUrlError);
});

test("upgrades ggpht stills to original size", () => {
  const raw =
    "https://yt3.ggpht.com/wzHeDhX_5iVJYFnzEMWlxx6wTRfWuvBnn01fgDCrzf4V2yEbC7roUhQj2ZNvjJFD9QWOifNjJGE3qA=s1366-c-fcrop64=1,00002aa0ffffd55f-rw-nd-v1";
  const upgraded = upgradeStillUrl(raw);
  assert.match(upgraded, /=s0$/);
  assert.equal(isAllowedMediaUrl(upgraded), true);
  assert.equal(mediaIdentityKey(raw), mediaIdentityKey(upgraded));
});

test("extracts attachment images from a live public post", async () => {
  const { previewCommunityPost } = await import("../lib/fetch-post.js");
  const result = await previewCommunityPost(SAMPLE);
  assert.equal(result.ok, true);
  assert.equal(result.postId, "Ugkx57vsk9xXNKOk1q9s5EqEN-LkHJVlu22X");
  assert.ok(result.media.length >= 1);
  for (const item of result.media) {
    assert.equal(item.type, "image");
    assert.ok(item.token);
    assert.ok(item.previewUrl.startsWith("https://"));
  }
});
