#!/bin/bash

echo "Installing yt-dlp and ffmpeg for ClipFetch Backend..."

# Update package list
apt-get update

# Install Python and pip (for yt-dlp)
apt-get install -y python3 python3-pip

# Install yt-dlp
pip3 install --upgrade yt-dlp

# Install ffmpeg
apt-get install -y ffmpeg

# Verify installations
echo "Checking installations..."

echo "yt-dlp version:"
yt-dlp --version

echo "ffmpeg version:"
ffmpeg -version

echo "Installation complete!" 