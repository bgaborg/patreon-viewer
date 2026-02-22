# Patreon Viewer

Offline viewer for legally purchased Patreon content. Two components: a web viewer app and a video encoding utility.

## Project Structure

```
patreon-view/                         # Root git repo
├── patreon-viewer/                   # Express web app
│   ├── server.js                     # Express server, port 3000
│   ├── views/                        # Handlebars templates
│   │   ├── layouts/main.handlebars   # Base layout (Bootstrap 5 + Font Awesome CDN)
│   │   ├── home.handlebars           # Post grid with search + creator filter
│   │   └── post.handlebars           # Post detail with media modals
│   └── public/                       # Static assets (styles.css, js/home.js, js/post.js)
├── encode-to-480p.ts                 # Batch video encoder (VideoToolbox h264, q:v 65)
├── data/                             # All downloaded content (gitignored)
│   ├── [creator]/posts/              # Downloaded content per creator
│   ├── [creator]/campaign_info/      # Creator metadata (info.txt)
│   ├── .patreon-dl/db.sqlite         # Download tracking database
│   └── embed.conf                    # yt-dlp / vimeo download config (auth cookies)
└── .gitignore
```

## Tech Stack

- **Backend:** Node.js, Express 4, express-handlebars 7
- **Frontend:** Bootstrap 5.3.0, Font Awesome 6.0.0 (both CDN)
- **Encoding:** TypeScript via tsx, ffmpeg/ffprobe
- **Package manager:** pnpm (root), npm (patreon-viewer — legacy)

## Commands

```bash
# Root — video encoding
pnpm run encode                    # Encode MP4s in data/ to 480p

# patreon-viewer/
npm start                          # Start server on :3000
npm run dev                        # Start with nodemon (auto-restart)
```

## Content Path

The server reads posts from `../data/*/posts/` relative to `patreon-viewer/`. Creator content lives in named dirs (e.g., `jenslarsen - Jens Larsen/posts/`). The `DATA_DIR` constant in `server.js` points to `../data`.

### Expected post directory structure

```
[POST_ID] - [TITLE]/
├── post_info/          # info.txt (key:value), post-api.json, thumbnail, cover-image
├── attachments/        # PDFs, Guitar Pro files, etc.
├── embed/              # Downloaded video files
└── images/             # Post images
```

## API Routes

- `GET /` — Home page (post grid, creator filter dropdown, search)
- `GET /?creator=<dir>` — Home page filtered to one creator
- `GET /post/:id` — Post detail view
- `GET /api/posts` — JSON API (supports `?creator=` filter)
- `GET /api/creators` — JSON list of creators with display names
- `GET /post/:id/attachments.zip` — Download all attachments as ZIP
- `GET /media/:creatorDir/:postDir/:type/:filename` — Serves media files

## Development Notes

- No test suite exists
- Server uses `fs-extra` for async filesystem ops, `moment` for date formatting
- Client JS is vanilla (search filtering, Bootstrap modal management)
- Video modal clears `<video>` src on close to stop playback
- Encoding script scans `data/` recursively, skips files already at 480p, handles portrait/landscape
- Creator display names are read from `campaign_info/info.txt` Name field
- System dependencies: `ffmpeg`, `ffprobe`, `yt-dlp` must be installed
- Run `patreon-dl` from within `data/` directory so artifacts stay contained
