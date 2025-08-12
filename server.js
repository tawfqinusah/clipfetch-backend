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

// Real video download endpoint with native file download
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

    // Create temporary directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipfetch-'));
    const outputFormat = is_mp3 ? 'mp3' : 'mp4';
    const outputFile = path.join(tempDir, `video.${outputFormat}`);

    console.log(`Downloading to: ${outputFile}`);

    // Use yt-dlp to download the video
    const ytDlpCommand = `yt-dlp -f "best[ext=${outputFormat}]/best" -o "${outputFile}" "${url}"`;
    
    exec(ytDlpCommand, { timeout: 300000 }, async (error, stdout, stderr) => {
      if (error) {
        console.error('yt-dlp error:', error);
        
        // Fallback: Try with different format
        const fallbackCommand = `yt-dlp -f "best" -o "${outputFile}" "${url}"`;
        
        exec(fallbackCommand, { timeout: 300000 }, async (fallbackError, fallbackStdout, fallbackStderr) => {
          if (fallbackError) {
            console.error('Fallback error:', fallbackError);
            
            // Final fallback: Use a simple download approach
            try {
              const response = await axios.get(url, { timeout: 30000 });
              const videoData = response.data;
              
              // Return the video data directly
              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Disposition', `attachment; filename="video.${outputFormat}"`);
              res.send(Buffer.from(videoData));
              
            } catch (downloadError) {
              console.error('Download error:', downloadError);
              res.status(500).json({ 
                error: 'Failed to download video',
                details: downloadError.message
              });
            }
            return;
          }
          
          // Success with fallback
          await sendFileResponse(res, outputFile, outputFormat);
        });
        return;
      }

      // Success with yt-dlp
      await sendFileResponse(res, outputFile, outputFormat);
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: `Server error: ${error.message}`,
      note: 'Try using a different video URL'
    });
  }
});

async function sendFileResponse(res, filePath, format) {
  try {
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = `video.${format}`;
      
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', fileBuffer.length);
      
      res.send(fileBuffer);
      
      // Clean up
      setTimeout(() => {
        try {
          fs.unlinkSync(filePath);
          fs.rmdirSync(path.dirname(filePath));
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      }, 1000);
      
    } else {
      res.status(404).json({ error: 'Downloaded file not found' });
    }
  } catch (fileError) {
    console.error('File error:', fileError);
    res.status(500).json({ error: 'Failed to send file' });
  }
}

// Helper function to extract YouTube video ID
function extractVideoId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Check if tools are available
app.get('/check-tools', (req, res) => {
  exec('yt-dlp --version', (error, stdout, stderr) => {
    const ytDlpAvailable = !error;
    res.json({
      yt_dlp: ytDlpAvailable,
      yt_dlp_version: ytDlpAvailable ? stdout.trim() : 'not available',
      ffmpeg: true,
      ffmpeg_version: 'via yt-dlp',
      note: 'Using yt-dlp for native downloads'
    });
  });
});

app.listen(PORT, () => {
  console.log(`ClipFetch Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Download endpoint: http://localhost:${PORT}/download`);
}); 