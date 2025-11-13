FROM node:18-slim

WORKDIR /app

COPY backend/services/notification-service/package*.json ./

COPY backend/services/notification-service/src ./src

# Copy shared middleware
COPY backend/shared ./shared

RUN npm install --omit=dev

CMD ["npm", "start"]