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

1. Navigate to the project directory:
```bash
cd patreon-viewer
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and go to `http://localhost:3000`

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
- GET `/media/:postDir/:type/:filename` - Serves media files (attachments, images, embed content)

## File Structure

The application expects the following directory structure for Patreon posts:
```
posts/
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

## Technologies Used

- **Backend**: Node.js, Express.js
- **Templating**: Handlebars with express-handlebars
- **Template Helpers**: handlebars-helpers library + custom helpers
- **Frontend**: Bootstrap 5, Font Awesome icons
- **File handling**: fs-extra for async file operations
- **Date formatting**: Moment.js
- **Styling**: Custom CSS with Bootstrap 5 framework

## Features in Detail

### Post Types Supported
- Video embeds (YouTube videos)
- Text posts
- Posts with attachments
- Posts with images

### Media Types Handled
- **Videos**: .webm, .mp4 (playable in modal video player)
- **Audio**: .mp3, .wav (downloadable with audio icon)
- **Documents**: .pdf (downloadable with PDF icon)
- **Guitar Pro**: .gp, .gpx files (downloadable with music icon)
- **Images**: .jpg, .png, .gif (viewable in fullscreen modal)
- **Text files**: .txt (viewable in new tab)
- **Generic files**: All other file types with generic file icon

### Search Capabilities
- **Real-time search**: Instant filtering as you type
- **Multi-field search**: Searches across post title, teaser, and post type
- **Case-insensitive**: Works regardless of text case
- **Visual feedback**: Posts are shown/hidden dynamically

### Navigation Features
- **Clickable thumbnails**: Click any post image to navigate to details
- **Breadcrumb navigation**: Easy navigation back to home page
- **Direct post links**: Each post has a unique URL `/post/:id`

## Development

To run in development mode with auto-restart:
```bash
npm run dev
```

### Post Metadata Display
- **Publication dates**: Formatted publication and last edited dates
- **Engagement stats**: Like counts and comment counts with icons
- **Post types**: Visual badges indicating video posts, text posts, etc.
- **Media summary**: Count of attachments, embedded files, and images
- **Thumbnail status**: Indicators for posts with thumbnails or cover images

## Browser Support
- Modern browsers with ES6 support
- Chrome, Firefox, Safari, Edge
- Bootstrap 5 modal support required for image/video viewing

## License
MIT License
