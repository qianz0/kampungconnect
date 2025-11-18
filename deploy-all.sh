#!/bin/bash

echo "========================================"
echo "KampungConnect - Full Deployment Script"
echo "========================================"
echo

# Step 1: Build all Docker images
echo "Step 1: Building all Docker images..."
./build-all.sh  
if [ $? -ne 0 ]; then
    echo "ERROR: Docker build failed!"
    exit 1
fi

echo
# Step 2: Deploying to Kubernetes
echo "Step 2: Deploying to Kubernetes..."
echo "Press Ctrl+C when all pods are running, then run port-forward.sh"
echo
./deploy-to-kuber.sh 

echo
echo "========================================"
echo "Deployment process complete!"
echo "========================================"
echo
echo "Next step: Run port-forward.sh to access services"
echo "Then open http://localhost:8080 in your browser"
echo
read -p "Press [Enter] to exit..."
