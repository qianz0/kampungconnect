FROM node:18-alpine

WORKDIR /app

# COPY package*.json ./
COPY backend/services/admin-service/package*.json ./

RUN npm install --omit=dev

# Copy shared middleware
COPY backend/shared ./shared

# Copy the service source
COPY backend/services/admin-service/src ./src

#COPY src ./src

EXPOSE 5000

CMD ["npm", "start"]