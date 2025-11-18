FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy only package files first (for better caching)
# COPY package*.json ./
COPY backend/services/auth-service/package*.json ./

# Install dependencies inside the container (Linux build)
RUN npm install --omit=dev

# Copy shared middleware
COPY backend/shared ./shared

# Copy source code (explicitly exclude node_modules by copying individual items)
COPY backend/services/auth-service/src ./src

# Start the service
CMD ["npm", "start"]