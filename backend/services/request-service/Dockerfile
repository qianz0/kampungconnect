FROM node:18-slim
WORKDIR /app
# COPY package*.json ./
COPY backend/services/request-service/package*.json ./

RUN npm install --production

RUN npm install --omit=dev

# Copy shared middleware
COPY backend/shared ./shared

# Copy the service source
COPY backend/services/request-service/src ./src

#COPY . .

CMD ["npm", "start"]