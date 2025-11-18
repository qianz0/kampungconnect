# Persistent Port Forward Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Persistent Port Forward" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "WARNING: Keep this window open to maintain port forwards!" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop all port forwards" -ForegroundColor Yellow
Write-Host ""

# Array to store process objects
$processes = @()

# Function to start port-forward in background
function Start-PortForward {
    param($Name, $Namespace, $Service, $LocalPort, $RemotePort)
    
    Write-Host "Starting $Name`: localhost:$LocalPort -> $Service`:$RemotePort" -ForegroundColor Green
    
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "kubectl"
    $psi.Arguments = "port-forward -n $Namespace svc/$Service $LocalPort`:$RemotePort"
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    
    # Add custom property to track metadata
    $process | Add-Member -NotePropertyName "ServiceName" -NotePropertyValue $Name
    $process | Add-Member -NotePropertyName "LocalPort" -NotePropertyValue $LocalPort
    
    $process.Start() | Out-Null
    
    return $process
}

# Cleanup function
function Stop-AllPortForwards {
    Write-Host ""
    Write-Host "Stopping all port forwards..." -ForegroundColor Yellow
    foreach ($proc in $script:processes) {
        try {
            if (!$proc.HasExited) {
                $proc.Kill()
            }
        }
        catch {
            # Ignore errors when killing processes
        }
    }
    Write-Host "All port forwards stopped." -ForegroundColor Green
}

# Handle Ctrl+C gracefully
try {
    Write-Host "Starting port forwards..." -ForegroundColor Cyan
    Write-Host ""

    # Start all port forwards
    $processes += Start-PortForward "Frontend" "kampungconnect" "frontend" 8080 80
    $processes += Start-PortForward "RabbitMQ" "kampungconnect" "rabbitmq" 25672 15672
    $processes += Start-PortForward "Prometheus" "kampungconnect" "prometheus" 9090 9090
    $processes += Start-PortForward "Grafana" "kampungconnect" "grafana" 3000 3000
    $processes += Start-PortForward "Tempo" "kampungconnect" "tempo" 3200 3200
    $processes += Start-PortForward "Auth Service" "kampungconnect" "auth-service" 5001 5000
    $processes += Start-PortForward "Request Service" "kampungconnect" "request-service" 5002 5002
    $processes += Start-PortForward "Matching Service" "kampungconnect" "matching-service" 5003 5003
    $processes += Start-PortForward "Notification Service" "kampungconnect" "notification-service" 5004 5000
    $processes += Start-PortForward "Rating Service" "kampungconnect" "rating-service" 5006 5000
    $processes += Start-PortForward "Admin Service" "kampungconnect" "admin-service" 5007 5000
    $processes += Start-PortForward "Social Service" "kampungconnect" "social-service" 5008 5008
    $processes += Start-PortForward "Social Service gRPC" "kampungconnect" "social-service" 50051 50051
    $processes += Start-PortForward "Stats Service" "kampungconnect" "stats-service" 5009 5009

    Start-Sleep -Seconds 2

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "All port forwards are running!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "FRONTEND & MONITORING:" -ForegroundColor Cyan
    Write-Host "  Frontend:        http://localhost:8080" -ForegroundColor White
    Write-Host "  RabbitMQ:        http://localhost:25672" -ForegroundColor White
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
    Write-Host "  Social:          http://localhost:5008" -ForegroundColor White
    Write-Host "  Social (gRPC):   grpc://localhost:50051" -ForegroundColor White
    Write-Host "  Stats:           http://localhost:5009" -ForegroundColor White
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "Keep this window open!" -ForegroundColor Yellow
    Write-Host "Press Ctrl+C to stop all port forwards" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""

    # Keep script running and monitor processes
    while ($true) {
        Start-Sleep -Seconds 10
        
        # Check if any process has died
        $anyDied = $false
        for ($i = 0; $i -lt $processes.Count; $i++) {
            if ($processes[$i].HasExited -and !$anyDied) {
                $anyDied = $true
                $proc = $processes[$i]
                $stderr = $proc.StandardError.ReadToEnd()
                $stdout = $proc.StandardOutput.ReadToEnd()
                
                Write-Host ""
                Write-Host "Port forward failed for $($proc.ServiceName) (port $($proc.LocalPort))" -ForegroundColor Red
                if ($stderr) {
                    Write-Host "Error: $stderr" -ForegroundColor Red
                }
                if ($stdout) {
                    Write-Host "Output: $stdout" -ForegroundColor Yellow
                }
                Write-Host ""
            }
        }
        
        # If all processes died, exit
        $allDead = $true
        foreach ($proc in $processes) {
            if (!$proc.HasExited) {
                $allDead = $false
                break
            }
        }
        
        if ($allDead) {
            Write-Host "All port forwards have died. Exiting..." -ForegroundColor Red
            break
        }
    }
}
finally {
    Stop-AllPortForwards
}