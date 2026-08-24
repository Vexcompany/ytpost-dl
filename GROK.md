# GROK.md — Implementation Brief

You are responsible for building the `ytpost-dl` project from scratch.

## Objective

Build a lightweight, mobile-first YouTube Community Post media downloader that is deployable directly to Vercel.

The user pastes a public Community Post URL, for example:

`http://youtube.com/post/Ugkx57vsk9xXNKOk1q9s5EqEN-LkHJVlu22X?si=dwxpZLHGDPLJ3qw9`

The application should resolve the public post, detect the actual publicly accessible media contained in the post, show previews, and allow the user to save supported media locally.

## Hard requirements

- Build from scratch. Do not assume an existing implementation exists.
- Do NOT use Python, Flask, Termux, or a persistent server.
- Use JavaScript/Node.js and Vercel serverless functions.
- Use a lightweight static frontend.
- No database.
- No authentication.
- No AI features.
- No permanent server-side media storage.
- Keep dependencies minimal.
- The project must be deployable from GitHub to Vercel.

## URL handling

- Accept both `http://youtube.com/post/...` and `https://youtube.com/post/...`.
- Follow normal redirects.
- Validate that the input is a YouTube Community Post URL.
- Reject unrelated URLs.

## Extraction

Do not assume Community Post media is exposed as a simple `<img>` or `<video>` element.

Inspect the actual publicly accessible page structure and embedded data/JSON when necessary.

The extractor should:

1. Fetch the public post server-side.
2. Identify the actual media belonging to the Community Post.
3. Avoid unrelated YouTube thumbnails, avatars, icons, and page assets.
4. Deduplicate media URLs.
5. Prefer the highest practical image resolution when several variants are available.
6. Support video only when a directly accessible media URL is exposed through normal public page data.
7. Fail clearly when the post is unavailable or media cannot be extracted.

## API

Create a Vercel-compatible API layer for extraction and downloading.

Do not create an unrestricted arbitrary URL proxy. A download endpoint must validate that the requested media URL was legitimately discovered from the validated YouTube post.

Do not assume Vercel has a persistent writable filesystem.

Stream downloads when practical instead of loading large files entirely into memory.

Sanitize download filenames.

## Frontend

Create a clean mobile-first interface containing:

- Project title
- URL input
- Preview/extract button
- Loading state
- Error state
- Media preview grid
- Individual download buttons
- Download-all action when multiple supported media items are detected

Keep the UI lightweight and responsive on Android phones.

## Primary test URL

Use this URL while developing and debugging:

`http://youtube.com/post/Ugkx57vsk9xXNKOk1q9s5EqEN-LkHJVlu22X?si=dwxpZLHGDPLJ3qw9`

Do not merely inspect the code and claim success. Test the actual extraction flow where your environment permits it.

If the first extraction strategy fails, investigate the failure and improve the extractor instead of returning a generic HTML parser and declaring the project complete.

## Suggested structure

Use the simplest structure that Vercel supports, such as:

```text
/
├── api/
│   ├── preview.js
│   └── download.js
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── package.json
├── vercel.json (only if actually required)
└── README.md
```

You may change the structure if there is a technically better Vercel-native approach.

## Safety and access boundaries

Only process publicly accessible content. Do not bypass private content, authentication, DRM, or access restrictions.

## Deliverable

Implement the complete project, not pseudocode and not an explanation-only answer.

Before finishing:

- Verify the project structure.
- Verify imports and dependencies.
- Verify Vercel runtime compatibility.
- Test the extraction path with the primary test URL when possible.
- Fix obvious implementation errors.
- Update README.md with exact Vercel deployment instructions and known limitations.

At the end, report what was actually tested and clearly distinguish tested behavior from assumptions.
