const express = require('express');
const cors = require('cors');
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

// Download video endpoint
app.post('/download', async (req, res) => {
  try {
    const { url, is_mp3 } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Processing download request for: ${url}, MP3: ${is_mp3}`);

    // Create temporary directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipfetch-'));
    console.log(`Created temp directory: ${tempDir}`);

    // Build yt-dlp command
    let cmd = `yt-dlp --no-playlist -o "${path.join(tempDir, '%(title)s.%(ext)s')}" --write-info-json "${url}"`;
    
    // Add MP3 conversion if requested
    if (is_mp3) {
      cmd = `yt-dlp --no-playlist -x --audio-format mp3 -o "${path.join(tempDir, '%(title)s.%(ext)s')}" --write-info-json "${url}"`;
    }

    console.log(`Executing command: ${cmd}`);

    // Execute yt-dlp
    exec(cmd, { timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('yt-dlp error:', error);
        return res.status(500).json({ 
          error: 'Download failed', 
          details: error.message
        });
      }

      console.log('yt-dlp stdout:', stdout);
      if (stderr) console.log('yt-dlp stderr:', stderr);

      // Find the downloaded file
      const files = fs.readdirSync(tempDir);
      const videoFiles = files.filter(f => !f.endsWith('.json') && !f.endsWith('.webp'));
      
      console.log('Files in temp directory:', files);
      console.log('Video files found:', videoFiles);

      if (videoFiles.length === 0) {
        return res.status(500).json({ 
          error: 'No video file found after download'
        });
      }

      const videoFile = videoFiles[0];
      const videoPath = path.join(tempDir, videoFile);
      const fileStats = fs.statSync(videoPath);

      console.log(`Download completed: ${videoFile} (${fileStats.size} bytes)`);

      // Return success with file info
      res.json({
        success: true,
        message: 'Download completed successfully!',
        filename: videoFile,
        fileSize: fileStats.size,
        url: url,
        is_mp3: is_mp3,
        timestamp: new Date().toISOString()
      });

      // Clean up temporary files after 30 seconds
      setTimeout(() => {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
          console.log(`Cleaned up temp directory: ${tempDir}`);
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      }, 30000);

    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: `Server error: ${error.message}`
    });
  }
});

// Check if yt-dlp is available
app.get('/check-tools', (req, res) => {
  exec('yt-dlp --version', (error, stdout, stderr) => {
    if (error) {
      return res.json({
        yt_dlp: false,
        error: error.message
      });
    }
    
    exec('ffmpeg -version', (ffmpegError, ffmpegStdout, ffmpegStderr) => {
      res.json({
        yt_dlp: true,
        yt_dlp_version: stdout.trim(),
        ffmpeg: !ffmpegError,
        ffmpeg_version: ffmpegError ? null : ffmpegStdout.split('\n')[0]
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`ClipFetch Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Download endpoint: http://localhost:${PORT}/download`);
}); 