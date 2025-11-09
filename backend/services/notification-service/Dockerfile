FROM node:18-slim
WORKDIR /app
# COPY package*.json ./
COPY backend/services/notification-service/package*.json ./
COPY backend/services/notification-service/src ./src

RUN npm install --production
#COPY src ./src
CMD ["npm", "start"]