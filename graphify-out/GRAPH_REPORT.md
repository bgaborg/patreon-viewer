# Graph Report - patreon-view  (2026-09-14)

## Corpus Check
- Corpus is ~12,924 words - fits in a single context window. You may not need a graph.

## Summary
- 238 nodes · 343 edges · 17 communities (11 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 5,350 input · 1,884 output

## Community Hubs (Navigation)
- Viewer Package Deps
- Root Tooling Deps
- Download Encode Pipeline
- Biome Lint Config
- Viewer App Data
- Download Client UI
- Download State Routes
- TypeScript Config
- Home Search Pagination
- Video Probe Analysis
- Video Convert CLI
- Post Image Modal
- Data Storage
- FFmpeg
- patreon-dl

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 12 edges
2. `vitest` - 9 edges
3. `createApp()` - 9 edges
4. `createDownloadRouter()` - 8 edges
5. `fs-extra` - 7 edges
6. `encodeVideos()` - 6 edges
7. `scripts` - 6 edges
8. `restoreState()` - 6 edges
9. `readSinglePost()` - 6 edges
10. `readPostData()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `encodeVideos()` --calls--> `encodeFileInPlace()`  [EXTRACTED]
  download-orchestrator.ts → video-encode.ts
- `encodeVideos()` --calls--> `getVideoResolution()`  [EXTRACTED]
  download-orchestrator.ts → video-encode.ts
- `encodeVideos()` --calls--> `is480p()`  [EXTRACTED]
  download-orchestrator.ts → video-encode.ts
- `encodeVideos()` --calls--> `isTempEncodeFile()`  [EXTRACTED]
  download-orchestrator.ts → video-encode.ts
- `encodeVideos()` --calls--> `isVideoFile()`  [EXTRACTED]
  download-orchestrator.ts → video-encode.ts

## Import Cycles
- None detected.

## Communities (17 total, 4 thin omitted)

### Community 0 - "Viewer Package Deps"
Cohesion: 0.06
Nodes (31): author, dependencies, archiver, express, express-handlebars, fs-extra, description, devDependencies (+23 more)

### Community 1 - "Root Tooling Deps"
Cohesion: 0.07
Nodes (28): dependencies, patreon-dl, description, devDependencies, @biomejs/biome, lefthook, supertest, tsx (+20 more)

### Community 2 - "Download Encode Pipeline"
Cohesion: 0.16
Nodes (22): DownloadCallbacks, EmbedConfSettings, EmbedDownloader, EncodeCallbacks, encodeVideos(), EndPayload, parseEmbedConf(), runDownload() (+14 more)

### Community 3 - "Biome Lint Config"
Cohesion: 0.08
Nodes (26): noUnusedImports, noUnusedVariables, files, includes, formatter, enabled, indentStyle, indentWidth (+18 more)

### Community 4 - "Viewer App Data"
Cohesion: 0.16
Nodes (20): ALLOWED_MEDIA_TYPES, createApp(), isPathInside(), Creator, extractYouTubeId(), findPostById(), getCreators(), PostInfo (+12 more)

### Community 5 - "Download Client UI"
Cohesion: 0.14
Nodes (20): appendLogEntry(), clearLog(), els, EmbedDownloader, EncodingState, escapeHtml(), evtSource, loadSettings() (+12 more)

### Community 6 - "Download State Routes"
Cohesion: 0.19
Nodes (15): createDownloadRouter(), OrchestratorModule, PATREON_URL_PATTERN, addLog(), broadcast(), DownloadState, EncodingState, finishJob() (+7 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir, resolveJsonModule (+6 more)

### Community 8 - "Home Search Pagination"
Cohesion: 0.18
Nodes (12): allPosts, applyFiltersAndPaginate(), getFilteredPosts(), getPageNumbers(), PAGE_SIZE_OPTIONS, pageSizeSelect, paginationContainer, postCountDisplay (+4 more)

### Community 9 - "Video Probe Analysis"
Cohesion: 0.31
Nodes (8): DATA_DIR, findVideoFiles(), main(), probeVideo(), runPool(), next(), VIDEO_EXTENSIONS, VideoInfo

### Community 10 - "Video Convert CLI"
Cohesion: 0.38
Nodes (6): ConvertTarget, CSV_PATH, DATA_DIR, encodeFile(), loadTargets(), main()

## Knowledge Gaps
- **125 isolated node(s):** `VIDEO_EXTENSIONS`, `DATA_DIR`, `VideoInfo`, `$schema`, `enabled` (+120 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 133 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Download Encode Pipeline` to `Root Tooling Deps`, `Viewer App Data`, `Download State Routes`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **Why does `fs-extra` connect `Viewer App Data` to `Viewer Package Deps`, `Download State Routes`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **What connects `VIDEO_EXTENSIONS`, `DATA_DIR`, `VideoInfo` to the rest of the system?**
  _125 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Viewer Package Deps` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Root Tooling Deps` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `Biome Lint Config` be split into smaller, more focused modules?**
  _Cohesion score 0.07977207977207977 - nodes in this community are weakly interconnected._
- **Should `Download Client UI` be split into smaller, more focused modules?**
  _Cohesion score 0.1380952380952381 - nodes in this community are weakly interconnected._