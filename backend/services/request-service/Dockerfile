FROM node:18-slim

WORKDIR /app

COPY backend/services/request-service/package*.json ./

# Configure npm for better reliability and install dependencies
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    npm install --omit=dev --verbose || \
    (echo "Retrying npm install..." && npm install --omit=dev --verbose)

# Copy shared middleware
COPY backend/shared ./shared

# Copy the service source
COPY backend/services/request-service/src/ ./src/

CMD ["npm", "start"]