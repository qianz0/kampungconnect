@echo off
echo ========================================
echo 🚀 Deploying to Kubernetes
echo ========================================

:: Step 1 — Recreate Namespace
echo.
echo 🧹 Recreating namespace 'kampungconnect'...
kubectl delete namespace kampungconnect --ignore-not-found

:: Clean up PersistentVolumeClaims to force fresh database initialization
echo 🗑️ Cleaning up old PersistentVolumeClaims...
kubectl delete pvc --all -n kampungconnect --ignore-not-found 2>nul

kubectl create namespace kampungconnect

:: Optional: Wait a few seconds for namespace to be active
echo Waiting for namespace to be ready...
timeout /t 5 >nul

:: Step 2 — Apply Base Namespace Config
echo.
echo 📦 Applying base namespace configuration...
kubectl apply -f k8s/base/namespace.yaml

:: Step 3 — Create Secrets
echo.
echo 🔐 Creating secrets from .env file...
kubectl delete secret auth-secrets -n kampungconnect --ignore-not-found
kubectl create secret generic auth-secrets --from-env-file=.env -n kampungconnect

:: Step 4 — Create Database Init ConfigMap
echo.
echo 🗄️ Creating database init configmap...
kubectl delete configmap db-init-script -n kampungconnect --ignore-not-found
kubectl create configmap db-init-script --from-file=init.sql=backend/db/init.sql -n kampungconnect

:: Step 5 — Deploy Infrastructure Components
echo.
echo ⚙️ Applying infrastructure components...
kubectl apply -f k8s/infra/ -n kampungconnect

:: Step 6 — Deploy Services
echo.
echo 🌐 Applying services...
kubectl apply -f k8s/services/ -n kampungconnect

:: Step 7 — Restart Deployments
echo.
echo 🔄 Restarting all deployments...
kubectl rollout restart deployment -n kampungconnect

:: Step 8 — Monitor Pod Status
echo.
echo ========================================
echo ✅ Deployment complete!
echo ========================================
echo.
echo 🕒 Waiting for pods to be ready...
echo (Press Ctrl+C to stop watching)
echo.

kubectl get pods -n kampungconnect -w