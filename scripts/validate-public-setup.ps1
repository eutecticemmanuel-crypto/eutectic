param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root ".env"

function Write-Check($label, $status, $detail) {
    Write-Host ("[{0}] {1} - {2}" -f $status, $label, $detail)
}

if (-not (Test-Path $envPath)) {
    Write-Check ".env" "FAIL" "Missing .env file."
    exit 1
}

$values = @{}
Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    $values[$key] = $value
}

$checks = @(
    @{ Key = "ADMIN_EMAIL"; Invalid = @(""); Message = "Admin email is set." }
    @{ Key = "ADMIN_PASSWORD"; Invalid = @("", "admin@123"); Message = "Admin password should be changed before public launch." }
    @{ Key = "PUBLIC_BASE_URL"; Invalid = @("", "http://localhost:3000"); Message = "Public base URL should point to the real HTTPS domain." }
    @{ Key = "VERIFICATION_TOKEN_SECRET"; Invalid = @("", "replace-with-a-long-random-secret"); Message = "Verification token secret must be real." }
    @{ Key = "VERIFICATION_SENDER_EMAIL"; Invalid = @("", "your-email@example.com"); Message = "Verification sender email must be real." }
    @{ Key = "SMTP_USER"; Invalid = @("", "your-email@example.com"); Message = "SMTP user must be real." }
    @{ Key = "SMTP_PASS"; Invalid = @("", "replace-with-your-app-password"); Message = "SMTP password must be real." }
)

$failed = $false
foreach ($check in $checks) {
    $value = if ($values.ContainsKey($check.Key)) { $values[$check.Key] } else { "" }
    if ($check.Invalid -contains $value) {
        Write-Check $check.Key "WARN" $check.Message
        $failed = $true
    } else {
        Write-Check $check.Key "OK" $value
    }
}

try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -TimeoutSec 5
    Write-Check "Health" "OK" ("Backend is running. Storage: {0}" -f $health.storage)
} catch {
    Write-Check "Health" "WARN" "Backend is not running on http://127.0.0.1:3000 right now."
}

if ($failed) {
    exit 1
}
