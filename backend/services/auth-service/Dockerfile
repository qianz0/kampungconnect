FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy only package files first (for better caching)
COPY package*.json ./

# Install dependencies inside the container (Linux build)
RUN npm install --omit=dev

# Copy the rest of your application (node_modules excluded via .dockerignore)
COPY . .

# Make startup script executable and fix line endings
RUN chmod +x start.sh && \
    # Convert Windows line endings to Unix line endings if present
    sed -i 's/\r$//' start.sh || true

# Start the service with the startup script
CMD ["sh", "start.sh"]