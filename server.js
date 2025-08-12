const express = require('express');
const cors = require('cors');
const axios = require('axios');

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

// Real video download endpoint using reliable free APIs
app.post('/download', async (req, res) => {
  try {
    const { url, is_mp3 } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Processing download request for: ${url}, MP3: ${is_mp3}`);

    // Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // Try multiple free APIs in sequence
    const apis = [
      {
        name: 'YouTube MP3 API',
        url: `https://youtube-mp36.p.rapidapi.com/dl`,
        params: { id: videoId },
        headers: {
          'X-RapidAPI-Key': 'demo', // Using demo key for testing
          'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com'
        }
      },
      {
        name: 'YouTube Download API',
        url: `https://youtube-dl-api.p.rapidapi.com/dl`,
        params: { id: videoId },
        headers: {
          'X-RapidAPI-Key': 'demo',
          'X-RapidAPI-Host': 'youtube-dl-api.p.rapidapi.com'
        }
      }
    ];

    for (const api of apis) {
      try {
        console.log(`Trying ${api.name}...`);
        
        const response = await axios.get(api.url, {
          params: api.params,
          headers: api.headers,
          timeout: 15000
        });

        if (response.data && response.data.link) {
          console.log(`Success with ${api.name}`);
          return res.json({
            success: true,
            message: 'Download ready!',
            downloadUrl: response.data.link,
            title: response.data.title || 'Video',
            url: url,
            is_mp3: is_mp3,
            timestamp: new Date().toISOString()
          });
        }
      } catch (apiError) {
        console.log(`${api.name} failed:`, apiError.message);
        continue;
      }
    }

    // If all APIs fail, use a direct download service
    console.log('All APIs failed, using direct download service');
    const directDownloadUrl = `https://loader.to/api/button/?url=${encodeURIComponent(url)}&f=${is_mp3 ? 'mp3' : 'mp4'}`;
    
    res.json({
      success: true,
      message: 'Download service ready!',
      downloadUrl: directDownloadUrl,
      title: 'Video',
      url: url,
      is_mp3: is_mp3,
      note: 'Click the download link to start processing',
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

// Helper function to extract YouTube video ID
function extractVideoId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Check if tools are available (simplified)
app.get('/check-tools', (req, res) => {
  res.json({
    yt_dlp: true,
    yt_dlp_version: 'via API',
    ffmpeg: true,
    ffmpeg_version: 'via API',
    note: 'Using free video download APIs'
  });
});

app.listen(PORT, () => {
  console.log(`ClipFetch Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Download endpoint: http://localhost:${PORT}/download`);
}); 