# ytpost-dl

A lightweight, Vercel-ready web project for processing publicly accessible YouTube Community Post URLs for personal use.

## Goal

Paste a YouTube Community Post URL such as:

`https://youtube.com/post/...`

The application should resolve the public post, detect the actual media contained in it, show previews, and let the user save supported media locally.

## Planned architecture

- Mobile-first static frontend
- Vercel serverless API routes
- JavaScript/Node.js runtime
- No Python or Flask
- No database
- No authentication
- No AI
- No persistent media storage

## Important constraints

- Only publicly accessible Community Posts are supported.
- Do not bypass private content, authentication, DRM, or access restrictions.
- Do not turn the API into an unrestricted arbitrary URL proxy.
- Validate YouTube post URLs and discovered media URLs.
- Do not permanently store user media on the server.

## Development status

The repository has been initialized and is ready for the first complete Vercel implementation.

See `GROK.md` for the implementation brief.
