$ErrorActionPreference = "Stop"
$repo = "UtkarshD18/bogEcom"
$domain = "https://healthyonegram.com"

# Read env files
$scriptRoot = Split-Path -Parent $PSCommandPath
$repoRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path

function Parse-Env {
    param([string]$Path)
    $result = @{}
    if (-not (Test-Path $Path)) { return $result }
    foreach ($rawLine in Get-Content -Path $Path -Encoding UTF8) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) { continue }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { continue }
        $key = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $result[$key] = $value
    }
    return $result
}

$serverEnv = Parse-Env -Path (Join-Path $repoRoot "server\.env")
$clientEnv = Parse-Env -Path (Join-Path $repoRoot "frontend\client\.env")

Write-Host "Parsed $($serverEnv.Count) server keys, $($clientEnv.Count) client keys"

# Build secrets map
$secrets = [ordered]@{}

# Required backend secrets
$secrets["GCP_PROJECT_ID"] = "healthy-one-gram"
$secrets["MONGO_URI"] = if ($serverEnv["MONGO_URI"]) { $serverEnv["MONGO_URI"] } else { $serverEnv["MONGODB_URI"] }
$secrets["ACCESS_TOKEN_SECRET"] = if ($serverEnv["ACCESS_TOKEN_SECRET"]) { $serverEnv["ACCESS_TOKEN_SECRET"] } else { $serverEnv["SECRET_KEY_ACCESS_TOKEN"] }
$secrets["REFRESH_TOKEN_SECRET"] = if ($serverEnv["REFRESH_TOKEN_SECRET"]) { $serverEnv["REFRESH_TOKEN_SECRET"] } else { $serverEnv["SECRET_KEY_REFRESH_TOKEN"] }
$secrets["CLIENT_URL"] = $domain
$secrets["ADMIN_URL"] = $domain
$secrets["NEXT_PUBLIC_API_URL"] = $domain
$secrets["NEXT_PUBLIC_APP_API_URL"] = $domain
$secrets["NEXT_PUBLIC_SITE_URL"] = $domain

# Email secrets
foreach ($key in @("EMAIL", "EMAIL_PASSWORD", "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE",
    "SMTP_USER", "SMTP_PASS", "EMAIL_FROM_NAME", "EMAIL_FROM_ADDRESS", "SUPPORT_ADMIN_EMAIL")) {
    if ($serverEnv[$key]) { $secrets[$key] = $serverEnv[$key] }
}

# Cloudinary
foreach ($key in @("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")) {
    if ($serverEnv[$key]) { $secrets[$key] = $serverEnv[$key] }
}

# Firebase Admin SDK
foreach ($key in @("FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY")) {
    if ($serverEnv[$key]) { $secrets[$key] = $serverEnv[$key] }
}

# Xpressbees
foreach ($key in @("XPRESSBEES_EMAIL", "XPRESSBEES_PASSWORD", "XPRESSBEES_WEBHOOK_SECRET",
    "XPRESSBEES_BASE_URL", "XPRESSBEES_TOKEN_TTL_MINUTES")) {
    if ($serverEnv[$key]) { $secrets[$key] = $serverEnv[$key] }
}

# Client Firebase
foreach ($key in @("NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID", "NEXT_PUBLIC_FIREBASE_VAPID_KEY",
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")) {
    if ($clientEnv[$key]) { $secrets[$key] = $clientEnv[$key] }
}

Write-Host "`nPushing $($secrets.Count) secrets to $repo..."
Write-Host "Keys: $([string]::Join(', ', ($secrets.Keys | Sort-Object)))`n"

$count = 0
$failed = @()
foreach ($entry in $secrets.GetEnumerator()) {
    try {
        $entry.Value | gh secret set $entry.Key --repo $repo --app actions 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "gh exit code $LASTEXITCODE" }
        $count++
        Write-Host "  OK: $($entry.Key)"
    } catch {
        $failed += $entry.Key
        Write-Host "  FAIL: $($entry.Key) - $_"
    }
}

Write-Host "`nDone: $count/$($secrets.Count) secrets set."
if ($failed.Count -gt 0) {
    Write-Host "Failed: $([string]::Join(', ', $failed))"
}
