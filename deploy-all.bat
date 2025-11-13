@echo off
echo ========================================
echo KampungConnect - Full Deployment Script
echo ========================================
echo.

echo Step 1: Building all Docker images...
call build-all.bat
if errorlevel 1 (
    echo ERROR: Docker build failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Deploying to Kubernetes...
echo Press Ctrl+C when all pods are running, then run port-forward.ps1
echo.
call deploy-to-kuber.bat

echo.
echo ========================================
echo Deployment process complete!
echo ========================================
echo.
echo Next step: Run port-forward.ps1 to access services
echo Then open http://localhost:8080 in your browser
echo.
pause