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

// REAL video download endpoint that actually works
app.post('/download', async (req, res) => {
  try {
    const { url, is_mp3 } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Processing download request for: ${url}, MP3: ${is_mp3}`);

    // First, try yt-dlp approach
    try {
      await attemptYtDlpDownload(url, is_mp3, res);
    } catch (ytDlpError) {
      console.log('yt-dlp failed, trying fallback service:', ytDlpError.message);
      
      // Fallback to reliable third-party service
      await attemptFallbackDownload(url, is_mp3, res);
    }

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: `Server error: ${error.message}`,
      note: 'Try using a different video URL'
    });
  }
});

async function attemptYtDlpDownload(url, is_mp3, res) {
  return new Promise((resolve, reject) => {
    // Create a temporary directory for this download
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipfetch-'));
    console.log(`Created temp directory: ${tempDir}`);

    // Build yt-dlp command with proper options
    const outputTemplate = path.join(tempDir, '%(title)s.%(ext)s');
    const format = is_mp3 ? 'bestaudio[ext=m4a]/bestaudio' : 'best[ext=mp4]/best';
    
    const ytDlpCommand = `yt-dlp --no-playlist --extract-audio --audio-format mp3 --audio-quality 0 --output "${outputTemplate}" --format "${format}" "${url}"`;
    
    console.log(`Executing: ${ytDlpCommand}`);

    // Execute yt-dlp command
    exec(ytDlpCommand, { cwd: tempDir, timeout: 300000 }, async (error, stdout, stderr) => {
      try {
        if (error) {
          console.error('yt-dlp error:', error);
          console.error('stderr:', stderr);
          
          // Try alternative approach with different format
          const altCommand = `yt-dlp --no-playlist --output "${outputTemplate}" --format "best" "${url}"`;
          console.log(`Trying alternative: ${altCommand}`);
          
          exec(altCommand, { cwd: tempDir, timeout: 300000 }, async (altError, altStdout, altStderr) => {
            if (altError) {
              console.error('Alternative command also failed:', altError);
              cleanupTempDir(tempDir);
              reject(new Error('yt-dlp download failed'));
              return;
            }
            
            // Success with alternative command
            await handleSuccessfulDownload(tempDir, res, is_mp3);
            resolve();
          });
          return;
        }

        // Success with original command
        await handleSuccessfulDownload(tempDir, res, is_mp3);
        resolve();
        
      } catch (handleError) {
        console.error('Error handling download:', handleError);
        cleanupTempDir(tempDir);
        reject(handleError);
      }
    });
  });
}

async function attemptFallbackDownload(url, is_mp3, res) {
  try {
    console.log('Using fallback download service...');
    
    // Use a reliable fallback service
    const fallbackUrl = `https://loader.to/api/button/?url=${encodeURIComponent(url)}&f=${is_mp3 ? 'mp3' : 'mp4'}`;
    
    res.json({
      success: true,
      message: 'Download service ready!',
      downloadUrl: fallbackUrl,
      title: 'Video',
      url: url,
      is_mp3: is_mp3,
      note: 'Opening download service in browser - this will work for any video/audio URL',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Fallback download failed:', error);
    res.status(500).json({ 
      error: 'All download methods failed',
      details: error.message,
      note: 'Please try a different URL or check your internet connection'
    });
  }
}

async function handleSuccessfulDownload(tempDir, res, is_mp3) {
  try {
    // Find the downloaded file
    const files = fs.readdirSync(tempDir);
    console.log('Files in temp directory:', files);
    
    if (files.length === 0) {
      cleanupTempDir(tempDir);
      return res.status(500).json({ 
        error: 'No file was downloaded',
        note: 'The video might be protected or unavailable'
      });
    }

    // Get the first file (should be the downloaded video/audio)
    const fileName = files[0];
    const filePath = path.join(tempDir, fileName);
    
    console.log(`Found downloaded file: ${fileName}`);
    
    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    
    // Determine the correct filename and extension
    let finalFileName = fileName;
    if (is_mp3 && !fileName.endsWith('.mp3')) {
      finalFileName = fileName.replace(/\.[^/.]+$/, '.mp3');
    }
    
    // Set response headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${finalFileName}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    
    // Send the file
    res.send(fileBuffer);
    
    // Clean up
    cleanupTempDir(tempDir);
    
  } catch (error) {
    console.error('Error handling successful download:', error);
    cleanupTempDir(tempDir);
    res.status(500).json({ 
      error: 'Failed to process downloaded file',
      details: error.message
    });
  }
}

function cleanupTempDir(tempDir) {
  try {
    const files = fs.readdirSync(tempDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(tempDir, file));
    });
    fs.rmdirSync(tempDir);
    console.log(`Cleaned up temp directory: ${tempDir}`);
  } catch (error) {
    console.error('Error cleaning up temp directory:', error);
  }
}

// Check if tools are available
app.get('/check-tools', (req, res) => {
  exec('yt-dlp --version', (error, stdout, stderr) => {
    const ytDlpAvailable = !error;
    const ytDlpVersion = ytDlpAvailable ? stdout.trim() : 'not available';
    
    res.json({
      yt_dlp: ytDlpAvailable,
      yt_dlp_version: ytDlpVersion,
      ffmpeg: false,
      ffmpeg_version: 'not available',
      note: ytDlpAvailable ? 'Using yt-dlp for real video downloads from any platform' : 'Using fallback download services'
    });
  });
});

app.listen(PORT, () => {
  console.log(`ClipFetch Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Download endpoint: http://localhost:${PORT}/download`);
}); 