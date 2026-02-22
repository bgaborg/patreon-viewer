# Patreon Viewer

> **Personal use only.** This tool is intended solely for reading offline content that you have already purchased and own on Patreon. It is not designed for downloading, distributing, or accessing content you do not have rights to. Respect creators and their work.

Offline viewer for legally purchased Patreon content. Two components: a web viewer app and a batch video encoding utility.

## Prerequisites

- Node.js 20+
- `ffmpeg` and `ffprobe`
- `yt-dlp`
- `patreon-dl` (installed globally via pnpm)

## Setup

```bash
# Install root dependencies (video encoder)
pnpm install

# Install viewer dependencies
cd patreon-viewer && npm install
```

## Usage

### Download content

```bash
patreon-dl -C data/embed.conf -o data -y <patreon-url>
```

Cookie config lives in `data/embed.conf`. Refresh cookies when they expire.

### Encode videos to 480p

```bash
pnpm run encode
```

Scans `data/` recursively for `.mp4`, `.webm`, `.mkv` files. Skips files already at 480p. Uses hardware encoding (VideoToolbox) on macOS, software encoding (libx264) on other platforms. Audio streams are copied without re-encoding.

### Start the viewer

```bash
cd patreon-viewer
npm start         # http://localhost:3000
npm run dev       # with auto-restart (nodemon)
```

## Project Structure

```
patreon-view/
├── patreon-viewer/              # Express web app
│   ├── server.js                # Express server (port 3000)
│   ├── views/
│   │   ├── layouts/main.handlebars
│   │   ├── home.handlebars      # Post grid with search + creator filter
│   │   └── post.handlebars      # Post detail with media modals
│   └── public/
│       ├── styles.css
│       └── js/
│           ├── home.js          # Client-side search filtering
│           └── post.js          # Video/image modal management
├── encode-to-480p.ts            # Batch video encoder
├── data/                        # Downloaded content (gitignored)
│   ├── [creator]/posts/         # Post directories
│   ├── [creator]/campaign_info/ # Creator metadata
│   └── embed.conf               # Auth cookies for yt-dlp
└── package.json                 # Root package (encoder scripts)
```

## Routes

| Route | Description |
|---|---|
| `GET /` | Home page with post grid, search, creator filter |
| `GET /?creator=<dir>` | Filter posts by creator |
| `GET /post/:id` | Post detail view |
| `GET /post/:id/attachments.zip` | Download all attachments as ZIP |
| `GET /api/posts` | JSON API for posts (supports `?creator=`) |
| `GET /api/creators` | JSON list of creators |
| `GET /media/:creator/:post/:type/:file` | Serve media files |

## Tech Stack

- **Server:** Express 4, express-handlebars 7, fs-extra, moment, archiver
- **Frontend:** Bootstrap 5.3, Font Awesome 6 (CDN), vanilla JS
- **Encoder:** TypeScript (tsx), ffmpeg/ffprobe

## Security

- Path traversal protection on media routes (`path.resolve` + `startsWith` check)
- Media type whitelist (`post_info`, `attachments`, `embed`, `images`)
- URL-encoded media paths for special characters in directory names
- No inline event handlers (delegated listeners via `data-*` attributes)
