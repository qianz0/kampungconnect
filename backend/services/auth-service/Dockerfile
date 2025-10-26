FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy only package files first (for better caching)
COPY package*.json ./

# Install dependencies inside the container (Linux build)
RUN npm install --omit=dev

# Copy the rest of your application (node_modules excluded via .dockerignore)
COPY . .

# Make startup script executable
RUN chmod +x start.sh

# Start the service with the startup script
CMD ["./start.sh"]