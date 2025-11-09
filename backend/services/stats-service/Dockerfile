FROM node:18-slim
WORKDIR /app
# COPY package*.json ./
COPY backend/services/stats-service/package*.json ./

RUN npm install --production

RUN npm install --omit=dev

# Copy shared middleware
COPY backend/shared ./shared

# Copy the service source
COPY backend/services/stats-service/src ./src

#COPY . .

EXPOSE 5009
CMD ["npm", "start"]