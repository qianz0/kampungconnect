FROM node:18-slim
WORKDIR /app
COPY backend/services/rating-service/package*.json ./
COPY backend/services/rating-service/src ./src
COPY backend/shared ./shared

RUN npm install --production
CMD ["npm", "start"]