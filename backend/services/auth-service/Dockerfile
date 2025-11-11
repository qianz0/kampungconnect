FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy only package files first (for better caching)
# COPY package*.json ./
COPY backend/services/auth-service/package*.json ./

# Install dependencies inside the container (Linux build)
RUN npm install --omit=dev

# Copy source code (explicitly exclude node_modules by copying individual items)
COPY backend/services/auth-service/src ./src
COPY backend/services/auth-service/start.sh ./start.sh
COPY backend/services/auth-service/create-admin.js ./create-admin.js

# Make startup script executable and fix line endings
RUN chmod +x start.sh && \
    # Convert Windows line endings to Unix line endings if present
    sed -i 's/\r$//' start.sh || true

# Start the service with the startup script
CMD ["sh", "start.sh"]