FROM node:18-slim

WORKDIR /app

COPY backend/services/matching-service/package*.json ./

RUN npm install --omit=dev

# Copy shared middleware
COPY backend/shared ./shared

# Copy the service source
COPY backend/services/matching-service/src ./src

CMD ["npm", "start"]