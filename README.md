# ClipFetch Backend

A Node.js backend for ClipFetch that handles video downloads using yt-dlp and ffmpeg.

## Features

- Video download from YouTube and other platforms
- MP3 audio extraction
- RESTful API endpoints
- CORS enabled for cross-origin requests

## Endpoints

- `GET /health` - Health check
- `POST /download` - Download video/audio
- `GET /check-tools` - Check if yt-dlp and ffmpeg are available

## Railway Deployment

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Initialize project: `railway init`
4. Deploy: `railway up`

## Environment Variables

- `PORT` - Server port (default: 3000)

## Local Development

1. Install dependencies: `npm install`
2. Start server: `npm run dev`
3. Test health check: `curl http://localhost:3000/health` 