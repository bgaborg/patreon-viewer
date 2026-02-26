# Patreon Viewer

Offline viewer for legally purchased Patreon content. Two components: a web viewer app and a video encoding utility.

## Project Structure

```
patreon-view/                         # Root git repo
├── patreon-viewer/                   # Express web app (pnpm workspace member)
│   ├── server.ts                     # Thin entry point — imports createApp, calls listen
│   ├── lib/
│   │   ├── app.ts                    # createApp(dataDir) factory (Express app)
│   │   ├── data.ts                   # Data access + YouTube embed parsing (extractYouTubeId)
│   │   ├── helpers.ts                # Handlebars helpers + parseInfoFile
│   │   ├── download-state.ts         # Download state management + SSE broadcasting
│   │   └── download-routes.ts        # Download/settings routes + orchestrator integration
│   ├── views/                        # Handlebars templates
│   │   ├── layouts/main.handlebars   # Base layout (Bootstrap 5 + Font Awesome CDN)
│   │   ├── home.handlebars           # Post grid with search + creator filter
│   │   └── post.handlebars           # Post detail with inline video players
│   ├── client/                       # Client-side TypeScript (built with esbuild → public/js/)
│   │   ├── home.ts                   # Search filtering
│   │   ├── post.ts                   # Image modal management
│   │   └── download.ts               # Download page SSE + UI
│   └── public/                       # Static assets (styles.css, built js/ — gitignored)
├── download-orchestrator.ts           # Download orchestrator (patreon-dl + video encoding)
├── encode-to-480p.ts                 # Batch video encoder (VideoToolbox h264, q:v 65)
├── data/                             # All downloaded content (gitignored)
│   ├── [creator]/posts/              # Downloaded content per creator
│   ├── [creator]/campaign_info/      # Creator metadata (info.txt)
│   ├── .patreon-dl/db.sqlite         # Download tracking database
│   └── embed.conf                    # Embed downloader config (YouTube=no-op, Vimeo=patreon-dl-vimeo)
├── biome.json                        # Biome linter/formatter config
├── lefthook.yml                      # Pre-commit hooks (biome check)
├── vitest.config.ts                  # Test config (viewer + encoder projects)
├── pnpm-workspace.yaml               # Workspace: patreon-viewer
└── .github/workflows/ci.yml          # CI: lint + test on PRs to main
```

## Tech Stack

- **Backend:** Node.js, Express 4, express-handlebars 7, TypeScript (via tsx)
- **Frontend:** Bootstrap 5.3.0, Font Awesome 6.0.0 (both CDN), TypeScript client (esbuild)
- **Encoding:** TypeScript via tsx, ffmpeg/ffprobe
- **Testing:** Vitest, supertest
- **Linting/Formatting:** Biome (4-space indent, single quotes, semicolons)
- **Git hooks:** Lefthook (pre-commit: biome check on staged files)
- **CI:** GitHub Actions (lint + test on PRs to main)
- **Package manager:** pnpm (workspace — root + patreon-viewer)

## Commands

```bash
# Root (use -w to target root workspace)
pnpm -w test                          # Run all tests (vitest)
pnpm -w lint                          # Lint + format check (biome)
pnpm -w lint:fix                      # Auto-fix lint/format issues
pnpm -w run encode                    # Encode MP4s in data/ to 480p

# patreon-viewer/
pnpm --filter patreon-post-viewer start   # Start server on :3000
pnpm --filter patreon-post-viewer dev     # Start with nodemon (auto-restart)
```

## Content Path

The server reads posts from `../data/*/posts/` relative to `patreon-viewer/`. Creator content lives in named dirs (e.g., `jenslarsen - Jens Larsen/posts/`). The `DATA_DIR` constant in `server.ts` points to `../data`.

### Expected post directory structure

```
[POST_ID] - [TITLE]/
├── post_info/          # info.txt (key:value), post-api.json, thumbnail, cover-image
├── attachments/        # PDFs, Guitar Pro files, etc.
├── embed/              # Embedded videos (downloaded .mp4/.webm/.mkv + YouTube .txt metadata)
├── video/              # Uploaded video files (.mp4, .m3u8, thumbnails)
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

## Testing

Tests use vitest with two projects configured in `vitest.config.ts`:
- **viewer** — `patreon-viewer/lib/*.test.ts` (helper, data, route integration tests)
- **encoder** — `*.test.ts` (units for encode-to-480p + download-orchestrator)

All test files use TypeScript with direct ESM imports.

## Development Notes

- Pre-commit hook runs `biome check` on staged JS/TS/CSS/JSON files via lefthook
- CI runs `pnpm lint` and `pnpm test` on PRs to main
- Server uses `fs-extra` for async filesystem ops, `moment` for date formatting
- Client TypeScript in `client/` is bundled with esbuild to `public/js/` (gitignored, built on start/dev)
- Videos render inline: local files as `<video>` (max-height 480px), YouTube as `<iframe>` (16:9 ratio)
- YouTube embeds parsed from `embedded-video.txt` via `extractYouTubeId()` (supports all URL formats)
- YouTube downloads skipped in `embed.conf` (no-op echo); Vimeo still downloaded locally
- Encoding only processes newly downloaded files (not full directory scan)
- Creator display names are read from `campaign_info/info.txt` Name field
- System dependencies: `ffmpeg`, `ffprobe` must be installed
- Run `patreon-dl` from within `data/` directory so artifacts stay contained
