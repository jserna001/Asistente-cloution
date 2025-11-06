# Script de PowerShell para ejecutar el resumen diario en Windows
# Configurar como Tarea Programada en Windows

# Configuración
$BaseUrl = "http://localhost:3000"  # Cambiar por tu URL de producción
$CronSecret = $env:CRON_SECRET

if (-not $CronSecret) {
    Write-Error "CRON_SECRET no está definido en las variables de entorno"
    exit 1
}

# Hacer la solicitud al endpoint
try {
    $headers = @{
        "Authorization" = "Bearer $CronSecret"
    }

    $response = Invoke-RestMethod -Uri "$BaseUrl/api/cron/daily-summary" -Method Get -Headers $headers

    Write-Host "✓ Resumen diario generado exitosamente" -ForegroundColor Green
    Write-Host "Eventos del calendario: $($response.stats.calendarEvents)"
    Write-Host "Tareas de Notion: $($response.stats.notionChunks)"
    Write-Host "Correos de Gmail: $($response.stats.gmailChunks)"
}
catch {
    Write-Error "Error ejecutando el cron job: $_"
    exit 1
}
