@echo off
echo ========================================
echo 🗄️ Resetting Database
echo ========================================
echo.
echo ⚠️  WARNING: This will delete ALL database data!
echo Press Ctrl+C to cancel or
pause

:: Step 1 — Delete database pod and PVC
echo.
echo 🧹 Deleting database StatefulSet and PersistentVolumeClaim...
kubectl delete statefulset db -n kampungconnect --ignore-not-found
kubectl delete pvc pg-data-db-0 -n kampungconnect --ignore-not-found

:: Step 2 — Wait for deletion
echo Waiting for resources to be deleted...
timeout /t 5 >nul

:: Step 3 — Recreate ConfigMap with latest init script
echo.
echo 📝 Updating database init script...
kubectl delete configmap db-init-script -n kampungconnect --ignore-not-found
kubectl create configmap db-init-script --from-file=init.sql=backend/db/init.sql -n kampungconnect

:: Step 4 — Redeploy database
echo.
echo 🚀 Redeploying database...
kubectl apply -f k8s/infra/db.yaml -n kampungconnect

:: Step 5 — Wait for database to be ready
echo.
echo ⏳ Waiting for database pod to be ready...
kubectl wait --for=condition=ready pod -l app=db -n kampungconnect --timeout=120s

:: Step 6 — Show pod status
echo.
echo ========================================
echo ✅ Database reset complete!
echo ========================================
echo.
kubectl get pods -n kampungconnect -l app=db
echo.
echo 💡 The database has been reset with fresh data from init.sql
echo.