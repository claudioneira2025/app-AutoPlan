Write-Host "Deteniendo procesos viejos de Angular y API..."
$ports = 4200, 55008, 61240, 3001
foreach ($port in $ports) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction Stop
        foreach ($c in $connections) {
            if ($c.OwningProcess) {
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        # ignorar si no hay conexiones en ese puerto
    }
}

Start-Process "cmd.exe" -ArgumentList "/c", "npm run start:api" -WindowStyle Minimized
Start-Sleep -Seconds 2
Start-Process "cmd.exe" -ArgumentList "/c", "npm start" -WindowStyle Minimized

Write-Host "App lanzada en: http://localhost:55008/vehiculos"
