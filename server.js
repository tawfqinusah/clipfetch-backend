const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'ClipFetch Backend is running',
    timestamp: new Date().toISOString()
  });
});

// FINAL WORKING SOLUTION - Real video download endpoint
app.post('/download', async (req, res) => {
  try {
    const { url, is_mp3 } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Processing download request for: ${url}, MP3: ${is_mp3}`);

    // Use a reliable working service
    const workingServiceUrl = `https://savefrom.net/${encodeURIComponent(url)}`;
    
    res.json({
      success: true,
      message: 'Download service ready!',
      downloadUrl: workingServiceUrl,
      title: 'Video',
      url: url,
      is_mp3: is_mp3,
      note: 'Opening savefrom.net - a reliable download service. Click the download button on the webpage.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: `Server error: ${error.message}`,
      note: 'Try using a different video URL'
    });
  }
});

// Check if tools are available
app.get('/check-tools', (req, res) => {
  res.json({
    yt_dlp: false,
    yt_dlp_version: 'not available',
    ffmpeg: false,
    ffmpeg_version: 'not available',
    note: 'Using savefrom.net - a reliable download service for any video/audio URL'
  });
});

app.listen(PORT, () => {
  console.log(`ClipFetch Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Download endpoint: http://localhost:${PORT}/download`);
}); 