@echo off
echo ========================================
echo Building All Docker Images
echo ========================================

echo Building auth-service...
docker build -t aliciatws/kampungconnect-auth-service:latest -f backend/services/auth-service/Dockerfile .

echo Building request-service...
docker build -t aliciatws/kampungconnect-request-service:latest -f backend/services/request-service/Dockerfile .

echo Building matching-service...
docker build -t aliciatws/kampungconnect-matching-service:latest -f backend/services/matching-service/Dockerfile .

echo Building notification-service...
docker build -t aliciatws/kampungconnect-notification-service:latest -f backend/services/notification-service/Dockerfile .

echo Building rating-service...
docker build -t aliciatws/kampungconnect-rating-service:latest -f backend/services/rating-service/Dockerfile .

echo Building admin-service...
docker build -t aliciatws/kampungconnect-admin-service:latest -f backend/services/admin-service/Dockerfile .

echo Building stats-service...
docker build -t aliciatws/kampungconnect-stats-service:latest -f backend/services/stats-service/Dockerfile .

echo Building social-service...
docker build -t aliciatws/kampungconnect-social-service:latest -f backend/services/social-service/Dockerfile .

echo Building frontend...
docker build -t aliciatws/kampungconnect-frontend:latest ./frontend

echo ========================================
echo All Docker images built successfully!
echo ========================================