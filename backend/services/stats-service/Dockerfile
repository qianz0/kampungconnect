FROM node:18-slim

WORKDIR /app

COPY backend/services/stats-service/package*.json ./

RUN npm install --omit=dev

# Copy shared middleware
COPY backend/shared ./shared

# Copy the service source
COPY backend/services/stats-service/src ./src

EXPOSE 5009

CMD ["npm", "start"]