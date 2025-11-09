FROM node:18-slim
WORKDIR /app
COPY backend/services/rating-service/package*.json ./
COPY backend/services/rating-service/src ./src

# COPY package*.json ./
RUN npm install --production
# COPY . .
CMD ["npm", "start"]