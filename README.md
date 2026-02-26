# Patreon Viewer

> **Personal use only.** This tool is intended solely for reading offline content that you have already purchased and own on Patreon. It is not designed for downloading, distributing, or accessing content you do not have rights to. Respect creators and their work.

Offline viewer for legally purchased Patreon content. Two components: a web viewer app and a batch video encoding utility.

## Prerequisites

- Node.js 20+
- `ffmpeg` and `ffprobe`
- `patreon-dl` (installed globally via pnpm)

## Setup

```bash
pnpm install
```

## Usage

All commands below assume you are in the project root (`patreon-view/`).

### Download content

```bash
# From data/ subdirectory (keeps .patreon-dl tracking db contained)
cd data
patreon-dl -C embed.conf -y <patreon-url>
```

Cookie config lives in `data/embed.conf`. Refresh cookies when they expire.

YouTube embeds are skipped during download (no `yt-dlp` needed) — the viewer renders them as inline iframes from YouTube directly. Vimeo embeds are still downloaded locally via `patreon-dl-vimeo`.

### Encode videos to 480p

```bash
pnpm -w run encode
```

Scans `data/` recursively for `.mp4`, `.webm`, `.mkv` files. Skips files already at 480p. Uses hardware encoding (VideoToolbox) on macOS, software encoding (libx264) on other platforms. Audio streams are copied without re-encoding.

### Start the viewer

```bash
pnpm --filter patreon-post-viewer start   # http://localhost:3000
pnpm --filter patreon-post-viewer dev     # with auto-restart (nodemon)
```

## Project Structure

```
patreon-view/
├── patreon-viewer/              # Express web app (pnpm workspace member)
│   ├── server.ts                # Thin entry point — imports createApp, calls listen
│   ├── lib/                     # Server-side logic
│   │   ├── app.ts               # createApp(dataDir) factory (Express app)
│   │   ├── data.ts              # Data access + YouTube embed parsing
│   │   ├── helpers.ts           # Handlebars helpers + parseInfoFile
│   │   ├── download-state.ts    # Download state management + SSE
│   │   └── download-routes.ts   # Download/settings routes
│   ├── client/                  # Client-side TypeScript (built with esbuild)
│   │   ├── home.ts              # Search filtering
│   │   ├── post.ts              # Image modal management
│   │   └── download.ts          # Download page SSE + UI
│   ├── views/                   # Handlebars templates
│   └── public/                  # Static assets (styles.css, built js/)
├── download-orchestrator.ts     # Download orchestrator (patreon-dl + encoding)
├── encode-to-480p.ts            # Batch video encoder (VideoToolbox h264, q:v 65)
├── data/                        # Downloaded content (gitignored)
│   ├── [creator]/posts/         # Post directories
│   ├── [creator]/campaign_info/ # Creator metadata
│   └── embed.conf               # Auth cookies + embed downloader config
└── package.json                 # Root package (encoder scripts)
```

## Routes

| Route | Description |
|---|---|
| `GET /` | Home page with post grid, search, creator filter |
| `GET /?creator=<dir>` | Filter posts by creator |
| `GET /post/:id` | Post detail view with inline video players |
| `GET /post/:id/attachments.zip` | Download all attachments as ZIP |
| `GET /api/posts` | JSON API for posts (supports `?creator=`) |
| `GET /api/creators` | JSON list of creators |
| `GET /media/:creator/:post/:type/:file` | Serve media files |
| `GET /download` | Content download page with SSE progress |

## Video Handling

- **Local videos** (`video/` and `embed/` dirs): Rendered as inline `<video>` players with 480px max height
- **YouTube embeds**: Parsed from `embedded-video.txt` metadata, rendered as inline iframes (supports all YouTube URL formats: youtu.be, watch?v=, embed/, shorts/, live/, etc.)
- **Vimeo embeds**: Downloaded locally by `patreon-dl-vimeo`, played as local video files

## Tech Stack

- **Server:** Express 4, express-handlebars 7, TypeScript (via tsx)
- **Frontend:** Bootstrap 5.3, Font Awesome 6 (CDN), TypeScript (esbuild)
- **Encoding:** TypeScript via tsx, ffmpeg/ffprobe
- **Testing:** Vitest, supertest
- **Linting:** Biome (4-space indent, single quotes, semicolons)
- **Git hooks:** Lefthook (pre-commit: biome check)
- **CI:** GitHub Actions (lint + test on PRs to main)
- **Package manager:** pnpm (workspace)

## Security

- Path traversal protection on media routes (`path.resolve` + `startsWith` check)
- Media type whitelist (`post_info`, `attachments`, `embed`, `images`, `video`)
- URL-encoded media paths for special characters in directory names
- No inline event handlers (delegated listeners via `data-*` attributes)
