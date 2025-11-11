# Stop all port-forward jobs
Write-Host "Stopping all port forwards..." -ForegroundColor Yellow
Get-Job | Stop-Job
Get-Job | Remove-Job
Write-Host "All port forwards stopped!" -ForegroundColor Green