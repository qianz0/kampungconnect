@echo off
echo ========================================
echo Deploying to Kubernetes
echo ========================================

echo Creating namespace...
kubectl apply -f k8s/base/namespace.yaml

echo Creating secrets from .env file...
kubectl delete secret auth-secrets -n kampungconnect --ignore-not-found
kubectl create secret generic auth-secrets --from-env-file=.env -n kampungconnect

echo Creating database init configmap...
kubectl delete configmap db-init-script -n kampungconnect --ignore-not-found
kubectl create configmap db-init-script --from-file=init.sql=backend/db/init.sql -n kampungconnect

echo Applying infrastructure components...
kubectl apply -f k8s/infra/

echo Applying services...
kubectl apply -f k8s/services/

echo Restarting deployments...
kubectl rollout restart deployment -n kampungconnect

echo ========================================
echo Deployment complete!
echo ========================================
echo.
echo Waiting for pods to be ready...
echo Press Ctrl+C when all pods are running.
echo.
kubectl get pods -n kampungconnect -w