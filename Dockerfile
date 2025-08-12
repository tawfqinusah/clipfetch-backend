FROM node:18-alpine

# Install Python and pip
RUN apk add --no-cache python3 py3-pip

# Install yt-dlp
RUN pip3 install --upgrade yt-dlp

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"] 