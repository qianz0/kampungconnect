#!/bin/bash

echo "========================================"
echo "Persistent Port Forward"
echo "========================================"
echo ""
echo "WARNING: Keep this terminal open to maintain port forwards!"
echo "Press Ctrl+C to stop all port forwards"
echo ""

# Array to store PIDs
pids=()

# Function to start port-forward
start_port_forward() {
  local NAME=$1
  local NAMESPACE=$2
  local SERVICE=$3
  local LOCAL_PORT=$4
  local REMOTE_PORT=$5

  echo "Starting $NAME: localhost:$LOCAL_PORT -> $SERVICE:$REMOTE_PORT"
  
  # Run port-forward in background
  kubectl port-forward -n "$NAMESPACE" "svc/$SERVICE" "$LOCAL_PORT:$REMOTE_PORT" >/dev/null 2>&1 &
  pids+=($!)
}

# Start all port-forwards
start_port_forward "Frontend" "kampungconnect" "frontend" 8080 80
start_port_forward "RabbitMQ" "kampungconnect" "rabbitmq" 15672 15672
start_port_forward "Prometheus" "kampungconnect" "prometheus" 9090 9090
start_port_forward "Grafana" "kampungconnect" "grafana" 3000 3000
start_port_forward "Tempo" "kampungconnect" "tempo" 3200 3200
start_port_forward "Auth Service" "kampungconnect" "auth-service" 5001 5000
start_port_forward "Request Service" "kampungconnect" "request-service" 5002 5002
start_port_forward "Matching Service" "kampungconnect" "matching-service" 5003 5003
start_port_forward "Notification Service" "kampungconnect" "notification-service" 5004 5000
start_port_forward "Rating Service" "kampungconnect" "rating-service" 5006 5000
start_port_forward "Admin Service" "kampungconnect" "admin-service" 5007 5000
start_port_forward "Social Service" "kampungconnect" "social-service" 5008 5008
start_port_forward "Social Service gRPC" "kampungconnect" "social-service" 50051 50051
start_port_forward "Stats Service" "kampungconnect" "stats-service" 5009 5009

echo ""
echo "All port forwards are running!"
echo ""
echo "FRONTEND & MONITORING:"
echo "  Frontend:        http://localhost:8080"
echo "  RabbitMQ:        http://localhost:15672"
echo "  Prometheus:      http://localhost:9090"
echo "  Grafana:         http://localhost:3000"
echo "  Tempo:           http://localhost:3200"
echo ""
echo "BACKEND SERVICES:"
echo "  Auth:            http://localhost:5001"
echo "  Request:         http://localhost:5002"
echo "  Matching:        http://localhost:5003"
echo "  Notification:    http://localhost:5004"
echo "  Rating:          http://localhost:5006"
echo "  Admin:           http://localhost:5007"
echo "  Social:          http://localhost:5008"
echo "  Social (gRPC):   grpc://localhost:50051"
echo "  Stats:           http://localhost:5009"
echo ""
echo "Keep this terminal open! Press Ctrl+C to stop all port forwards."
echo ""

# Handle Ctrl+C and kill all port-forwards
trap "echo ''; echo 'Stopping all port forwards...'; kill ${pids[@]}; exit" SIGINT

# Wait forever to keep port-forwards alive
wait