$ErrorActionPreference = 'Stop'
$baseUrl = if ($env:GADGETOS_TEST_URL) { $env:GADGETOS_TEST_URL.TrimEnd('/') } else { 'http://localhost:3000' }
$stats = Invoke-RestMethod -Uri "$baseUrl/api/internal/stats/daily"
$telegramBody = @{
  message = @{
    chat = @{ id = 123 }
    from = @{ id = 123; first_name = 'Test' }
    text = '/catalog'
  }
} | ConvertTo-Json -Depth 5
$telegram = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/telegram/webhook" -ContentType 'application/json' -Body $telegramBody
try {
  Invoke-WebRequest -Method Post -Uri "$baseUrl/api/n8n/webhook" -ContentType 'application/json' -Body '{"event":"order.created"}' | Out-Null
  $unsignedStatus = 200
} catch {
  $unsignedStatus = [int]$_.Exception.Response.StatusCode
}
if (-not $stats.revenue) { throw 'Daily stats did not return revenue' }
if ($telegram.action -ne 'send_message') { throw 'Telegram catalog did not return a message action' }
if ($unsignedStatus -ne 401) { throw "Unsigned n8n request returned $unsignedStatus instead of 401" }
[pscustomobject]@{
  StatsRevenue = $stats.revenue
  LowStockCount = @($stats.low_stock).Count
  TelegramAction = $telegram.action
  UnsignedN8nStatus = $unsignedStatus
}
