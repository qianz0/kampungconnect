FROM node:18-alpine

WORKDIR /app

COPY backend/services/social-service/package*.json ./

RUN npm install --omit=dev

COPY backend/services/social-service/src/ ./src/
COPY backend/services/social-service/proto/ ./proto/

COPY backend/shared/ ./shared/

EXPOSE 5008
EXPOSE 50051

CMD ["node", "src/index.js"]