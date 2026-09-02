# One-off helper: set DISCORD_WEBHOOK_URL secret on the hosted Supabase project.
# Security: this script does NOT store secrets. It prompts for them at runtime.
#   - Supabase Personal Access Token: https://supabase.com/dashboard/account/tokens
#   - Discord Webhook URL: Discord server settings -> Integrations -> Webhooks
$token = Read-Host -AsSecureString 'Supabase Personal Access Token'
$tokenPlain = [System.Net.NetworkCredential]::new('', $token).Password
$webhook = Read-Host 'Discord Webhook URL'
$ref = 'zpxyunxpakuetqfxcuhe'
$headers = @{ Authorization = "Bearer $tokenPlain"; 'Content-Type' = 'application/json' }
$body = ConvertTo-Json @(
  @{ name = 'DISCORD_WEBHOOK_URL'; value = $webhook }
)
try {
  $r = Invoke-WebRequest -Uri "https://api.supabase.com/v1/projects/$ref/secrets" -Method POST -Headers $headers -Body $body -UseBasicParsing -TimeoutSec 30
  Write-Output "Set secret -> HTTP $($r.StatusCode)"
} catch {
  Write-Output "FAILED: $($_.Exception.Message)"
}
