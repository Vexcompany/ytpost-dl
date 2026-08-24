# ytpost-dl

A lightweight, mobile-first downloader for **public** YouTube Community Post media. Paste a post URL, preview the files that belong to that post, and save them locally.

Example:

`http://youtube.com/post/Ugkx57vsk9xXNKOk1q9s5EqEN-LkHJVlu22X?si=dwxpZLHGDPLJ3qw9`

## What it does

- Accepts `http://` and `https://` Community Post URLs (`youtube.com/post/…`)
- Fetches the public post on the server
- Reads YouTube’s post JSON (`?pbj=1` and `ytInitialData`), not a naive `<img>` / `<video>` scrape
- Keeps only the post’s own images (including multi-image posts)
- Upgrades stills to the original file YouTube actually serves (`=s0`) instead of the cropped grid preview
- Proxies downloads with a short-lived HMAC token so the API is not an open URL proxy
- Streams the file through; nothing is stored on the server

## What it does not do

- Members-only, private, or login-gated posts
- YouTube watch pages, Shorts, playlists, or DRM
- Shared YouTube videos that only expose a `videoId` (no direct media file)
- Accounts, databases, or permanent media storage

## Project layout

```text
/
├── api/
│   ├── preview.js      POST /api/preview
│   └── download.js     GET  /api/download?token=…
├── lib/                URL parser, extractor, token helper
├── index.html
├── style.css
├── app.js
├── favicon.svg
├── package.json
├── vercel.json
└── README.md
```

Zero runtime npm dependencies. Node 18+ (`fetch` + `node:crypto`).

## Deploy to Vercel

1. Push this repository to GitHub (already the case if you are looking at `Vexcompany/ytpost-dl`).
2. Open [vercel.com/new](https://vercel.com/new) and import the GitHub repo.
3. Leave the framework preset on **Other**. There is no build step.
4. Optional environment variable:
   - `YTPOST_SECRET` — long random string used to sign download tokens. If omitted, a built-in development secret is used. Set this in production.
5. Deploy.

After deploy, open the site, paste a public `/post/Ugkx…` URL, tap **Extract**, then **Save**.

Local preview of the static page (API routes still need Vercel or `vercel dev`):

```bash
npx vercel dev
```

## API

`POST /api/preview`

```json
{ "url": "https://www.youtube.com/post/Ugkx…" }
```

Returns post metadata and a signed download token per discovered file.

`GET /api/download?token=…`

Streams the file. The token is bound to a media URL discovered from a validated post and expires after 30 minutes. Arbitrary URLs are rejected.

## Known limitations

- YouTube may rate-limit or bot-check some IPs. If extraction fails, wait and retry.
- “Save all” fires sequential browser downloads; some mobile browsers only allow one save at a time.
- Direct community-native video files are saved only when the public post data includes a real media URL (for example `googlevideo.com`). Ordinary uploaded YouTube videos are skipped on purpose.
- Only publicly reachable posts are supported. This tool does not bypass memberships or access controls.

## License

Personal use. Respect YouTube’s terms and the creator’s rights.
