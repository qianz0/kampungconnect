@echo off
echo ========================================
echo Building All Docker Images
echo ========================================

echo Building auth-service...
docker build -t kampungconnect-auth-service -f backend/services/auth-service/Dockerfile .

echo Building request-service...
docker build -t kampungconnect-request-service -f backend/services/request-service/Dockerfile .

echo Building matching-service...
docker build -t kampungconnect-matching-service -f backend/services/matching-service/Dockerfile .

echo Building notification-service...
docker build -t kampungconnect-notification-service -f backend/services/notification-service/Dockerfile .

echo Building rating-service...
docker build -t kampungconnect-rating-service -f backend/services/rating-service/Dockerfile .

echo Building admin-service...
docker build -t kampungconnect-admin-service -f backend/services/admin-service/Dockerfile .

echo Building stats-service...
docker build -t kampungconnect-stats-service -f backend/services/stats-service/Dockerfile .

echo Building frontend...
docker build -t kampungconnect-frontend ./frontend

echo ========================================
echo All Docker images built successfully!
echo ========================================