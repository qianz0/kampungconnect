# KampungConnect - Port Forward Script (Background)
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Port Forwards (Background)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Frontend & Monitoring
Write-Host "Starting Frontend and Monitoring services..." -ForegroundColor Yellow
Start-Job -Name "frontend" -ScriptBlock { kubectl port-forward -n kampungconnect svc/frontend 8080:80 } | Out-Null
Start-Job -Name "rabbitmq" -ScriptBlock { kubectl port-forward -n kampungconnect svc/rabbitmq 15672:15672 } | Out-Null
Start-Job -Name "prometheus" -ScriptBlock { kubectl port-forward -n kampungconnect svc/prometheus 9090:9090 } | Out-Null
Start-Job -Name "grafana" -ScriptBlock { kubectl port-forward -n kampungconnect svc/grafana 3000:3000 } | Out-Null
Start-Job -Name "tempo" -ScriptBlock { kubectl port-forward -n kampungconnect svc/tempo 3200:3200 } | Out-Null

# Backend Services
Write-Host "Starting Backend services..." -ForegroundColor Yellow
Start-Job -Name "auth-service" -ScriptBlock { kubectl port-forward -n kampungconnect svc/auth-service 5001:5000 } | Out-Null
Start-Job -Name "request-service" -ScriptBlock { kubectl port-forward -n kampungconnect svc/request-service 5002:5002 } | Out-Null
Start-Job -Name "matching-service" -ScriptBlock { kubectl port-forward -n kampungconnect svc/matching-service 5003:5003 } | Out-Null
Start-Job -Name "notification-service" -ScriptBlock { kubectl port-forward -n kampungconnect svc/notification-service 5004:5000 } | Out-Null
Start-Job -Name "rating-service" -ScriptBlock { kubectl port-forward -n kampungconnect svc/rating-service 5006:5000 } | Out-Null
Start-Job -Name "admin-service" -ScriptBlock { kubectl port-forward -n kampungconnect svc/admin-service 5007:5000 } | Out-Null
Start-Job -Name "stats-service" -ScriptBlock { kubectl port-forward -n kampungconnect svc/stats-service 5009:5009 } | Out-Null

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "All port forwards started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "FRONTEND & MONITORING:" -ForegroundColor Cyan
Write-Host "  Frontend:        http://localhost:8080" -ForegroundColor White
Write-Host "  RabbitMQ:        http://localhost:15672" -ForegroundColor White
Write-Host "  Prometheus:      http://localhost:9090" -ForegroundColor White
Write-Host "  Grafana:         http://localhost:3000" -ForegroundColor White
Write-Host "  Tempo:           http://localhost:3200" -ForegroundColor White
Write-Host ""
Write-Host "BACKEND SERVICES:" -ForegroundColor Cyan
Write-Host "  Auth:            http://localhost:5001" -ForegroundColor White
Write-Host "  Request:         http://localhost:5002" -ForegroundColor White
Write-Host "  Matching:        http://localhost:5003" -ForegroundColor White
Write-Host "  Notification:    http://localhost:5004" -ForegroundColor White
Write-Host "  Rating:          http://localhost:5006" -ForegroundColor White
Write-Host "  Admin:           http://localhost:5007" -ForegroundColor White
Write-Host "  Stats:           http://localhost:5009" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "COMMANDS:" -ForegroundColor Yellow
Write-Host "  View status:     Get-Job" -ForegroundColor White
Write-Host "  Stop all:        Get-Job | Stop-Job; Get-Job | Remove-Job" -ForegroundColor White
Write-Host "  View logs:       Get-Job -Name frontend | Receive-Job" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Yellow