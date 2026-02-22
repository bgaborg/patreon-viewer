# Patreon Post Viewer

A Node.js web application for viewing and browsing Patreon posts downloaded with patreon-dl.

## Features

- **Browse all posts**: View all downloaded Patreon posts in a responsive card grid layout
- **Search functionality**: Real-time search through posts by title, content, and type
- **Detailed post view**: View full post content, metadata, attachments, embedded videos, and images
- **Media handling**: Download attachments, view images in modal, and play embedded videos in modal
- **Responsive design**: Bootstrap 5-based responsive design for desktop, tablet, and mobile
- **Post statistics**: Display like counts, comment counts, and post types with badges
- **File type recognition**: Comprehensive icons for different file types (PDF, audio, video, Guitar Pro, etc.)
- **Image navigation**: Click post thumbnails to navigate directly to post details
- **Modal viewers**: Dedicated modal windows for viewing images and playing videos

## Installation

1. From the project root, install all dependencies:
```bash
pnpm install
```

2. Start the server:
```bash
cd patreon-viewer
pnpm start
```

3. Open your browser and go to `http://localhost:3000`

## Usage

### Home Page
- Browse all posts in a card layout
- Use the search bar to filter posts
- Click "View Details" to see the full post

### Post Detail Page
- View complete post content and metadata
- Download attachments directly
- View embedded videos and images
- Navigate back to the home page

### API Endpoints
- GET `/api/posts` - Returns JSON data of all posts with full metadata
- GET `/api/creators` - Returns JSON list of creators with display names
- GET `/media/:creatorDir/:postDir/:type/:filename` - Serves media files

## File Structure

The application expects the following directory structure for Patreon posts:
```
data/
└── [CREATOR_DIR]/
    ├── campaign_info/
    │   └── info.txt
    └── posts/
        └── [POST_ID] - [POST_TITLE]/
            ├── post_info/
            │   ├── info.txt
            │   ├── post-api.json
            │   ├── thumbnail.jpg
            │   └── cover-image.jpg
            ├── attachments/
            │   └── [files...]
            ├── embed/
            │   └── [videos...]
            └── images/
                └── [images...]
```

## Architecture

The server code is split into testable modules:

- **`lib/helpers.js`** — Pure Handlebars helpers + `parseInfoFile` (no fs deps)
- **`lib/data.js`** — Data access functions (`resolveImage`, `findPostById`, `readPostData`, `getCreators`), accept `dataDir` param
- **`lib/app.js`** — `createApp(dataDir)` factory returning an Express app (used by tests with supertest)
- **`server.js`** — Thin entry point: imports `createApp`, passes `DATA_DIR`, calls `listen`

## Technologies Used

- **Backend**: Node.js, Express 4, express-handlebars 7
- **Frontend**: Bootstrap 5.3.0, Font Awesome 6.0.0 (CDN)
- **File handling**: fs-extra for async file operations
- **Date formatting**: Moment.js

## Development

To run in development mode with auto-restart:
```bash
pnpm run dev
```

### Testing

From the project root:
```bash
pnpm test            # Run all tests
pnpm lint            # Check linting/formatting
pnpm lint:fix        # Auto-fix lint/format issues
```

Tests are in `lib/*.test.mjs` using vitest + supertest.

### Pre-commit Hooks

Lefthook runs `biome check` on staged JS/TS/CSS/JSON files before each commit.

### CI

GitHub Actions runs `pnpm lint` and `pnpm test` on PRs to main.

## License
MIT License
