# Graph Report - patreon-view  (2026-09-14)

## Corpus Check
- Corpus is ~12,517 words - fits in a single context window. You may not need a graph.

## Summary
- 240 nodes · 313 edges · 23 communities (13 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 5,668 input · 6,151 output

## Community Hubs (Navigation)
- Viewer App Data
- Root Tooling Deps
- Biome Lint Config
- Viewer Package Deps
- Download Client UI
- Download Encode Pipeline
- Download State Routes
- TypeScript Config
- Home Search Pagination
- Video Probe Analysis
- Encode 480p CLI
- Video Convert CLI
- Viewer NPM Scripts
- Post Image Modal
- Project Overview Doc
- Path Traversal Guard
- CI Workflow
- Lefthook Pre-commit
- PNPM Workspace
- Root README

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 12 edges
2. `createApp()` - 8 edges
3. `vitest` - 7 edges
4. `createDownloadRouter()` - 7 edges
5. `fs-extra` - 7 edges
6. `scripts` - 6 edges
7. `restoreState()` - 6 edges
8. `readSinglePost()` - 6 edges
9. `scripts` - 6 edges
10. `vcs` - 5 edges

## Surprising Connections (you probably didn't know these)
- `createApp()` --calls--> `createDownloadRouter()`  [EXTRACTED]
  patreon-viewer/lib/app.ts → patreon-viewer/lib/download-routes.ts
- `createApp()` --calls--> `findPostById()`  [EXTRACTED]
  patreon-viewer/lib/app.ts → patreon-viewer/lib/data.ts
- `createApp()` --calls--> `getCreators()`  [EXTRACTED]
  patreon-viewer/lib/app.ts → patreon-viewer/lib/data.ts
- `createApp()` --calls--> `readPostData()`  [EXTRACTED]
  patreon-viewer/lib/app.ts → patreon-viewer/lib/data.ts
- `readSinglePost()` --calls--> `parseInfoFile()`  [EXTRACTED]
  patreon-viewer/lib/data.ts → patreon-viewer/lib/helpers.ts

## Import Cycles
- None detected.

## Communities (23 total, 7 thin omitted)

### Community 0 - "Viewer App Data"
Cohesion: 0.15
Nodes (21): ALLOWED_MEDIA_TYPES, createApp(), Creator, extractYouTubeId(), findPostById(), getCreators(), PostInfo, readPostData() (+13 more)

### Community 1 - "Root Tooling Deps"
Cohesion: 0.07
Nodes (27): dependencies, patreon-dl, description, devDependencies, @biomejs/biome, lefthook, supertest, tsx (+19 more)

### Community 2 - "Biome Lint Config"
Cohesion: 0.08
Nodes (26): noUnusedImports, noUnusedVariables, files, includes, formatter, enabled, indentStyle, indentWidth (+18 more)

### Community 3 - "Viewer Package Deps"
Cohesion: 0.07
Nodes (26): author, dependencies, archiver, express, express-handlebars, fs-extra, moment, description (+18 more)

### Community 4 - "Download Client UI"
Cohesion: 0.14
Nodes (20): appendLogEntry(), clearLog(), els, EmbedDownloader, EncodingState, escapeHtml(), evtSource, loadSettings() (+12 more)

### Community 5 - "Download Encode Pipeline"
Cohesion: 0.16
Nodes (16): DownloadCallbacks, EmbedConfSettings, EmbedDownloader, EncodeCallbacks, encodeFile(), encodeVideos(), EndPayload, getVideoResolution() (+8 more)

### Community 6 - "Download State Routes"
Cohesion: 0.20
Nodes (14): createDownloadRouter(), OrchestratorModule, PATREON_URL_PATTERN, addLog(), broadcast(), DownloadState, EncodingState, getSnapshot() (+6 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir, resolveJsonModule (+6 more)

### Community 8 - "Home Search Pagination"
Cohesion: 0.18
Nodes (12): allPosts, applyFiltersAndPaginate(), getFilteredPosts(), getPageNumbers(), PAGE_SIZE_OPTIONS, pageSizeSelect, paginationContainer, postCountDisplay (+4 more)

### Community 9 - "Video Probe Analysis"
Cohesion: 0.31
Nodes (8): DATA_DIR, findVideoFiles(), main(), probeVideo(), runPool(), next(), VIDEO_EXTENSIONS, VideoInfo

### Community 10 - "Encode 480p CLI"
Cohesion: 0.42
Nodes (7): encodeToP480(), findVideoFiles(), getVideoResolution(), is480p(), main(), VIDEO_EXTENSIONS, VideoResolution

### Community 11 - "Video Convert CLI"
Cohesion: 0.38
Nodes (6): ConvertTarget, CSV_PATH, DATA_DIR, encodeFile(), loadTargets(), main()

### Community 12 - "Viewer NPM Scripts"
Cohesion: 0.33
Nodes (6): scripts, build:client, dev, predev, prestart, start

## Knowledge Gaps
- **134 isolated node(s):** `VIDEO_EXTENSIONS`, `DATA_DIR`, `VideoInfo`, `$schema`, `enabled` (+129 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 140 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Viewer App Data` to `Root Tooling Deps`, `Encode 480p CLI`, `Download Encode Pipeline`?**
  _High betweenness centrality (0.140) - this node is a cross-community bridge._
- **Why does `fs-extra` connect `Viewer App Data` to `Viewer Package Deps`, `Download State Routes`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **What connects `VIDEO_EXTENSIONS`, `DATA_DIR`, `VideoInfo` to the rest of the system?**
  _134 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Root Tooling Deps` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `Biome Lint Config` be split into smaller, more focused modules?**
  _Cohesion score 0.07977207977207977 - nodes in this community are weakly interconnected._
- **Should `Viewer Package Deps` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `Download Client UI` be split into smaller, more focused modules?**
  _Cohesion score 0.1380952380952381 - nodes in this community are weakly interconnected._