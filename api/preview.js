import { ExtractError, previewCommunityPost } from "../lib/fetch-post.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "Use POST with a JSON body: { url }." });
    return;
  }

  let url = "";
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    url = typeof body.url === "string" ? body.url : "";
  } catch {
    res.status(400).json({ ok: false, error: "Send a JSON body with a url field." });
    return;
  }

  try {
    const result = await previewCommunityPost(url);
    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof ExtractError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Could not extract this post.";
    const status = error instanceof ExtractError ? 422 : 502;
    res.status(status).json({ ok: false, error: message });
  }
}
