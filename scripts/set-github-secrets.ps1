param(
  [string]$Repo = "",
  [string]$Domain = "healthyonegram.com",
  [string]$ServerEnvPath = "server/.env",
  [string]$ClientEnvPath = "frontend/client/.env",
  [string]$AdminUrl = "",
  [string]$GcpProjectId = "",
  [string]$GcpSaKeyPath = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path

function Resolve-InputPath {
  param(
    [string]$PathValue
  )

  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    return $PathValue
  }

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }

  return (Join-Path $repoRoot $PathValue)
}

function Test-CommandExists {
  param([string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Parse-EnvFile {
  param([string]$Path)

  $result = @{}
  if (-not (Test-Path $Path)) {
    return $result
  }

  foreach ($rawLine in Get-Content -Path $Path) {
    $line = $rawLine.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line.StartsWith("#")) { continue }

    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { continue }

    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()

    if (
      (($value.StartsWith('"')) -and ($value.EndsWith('"'))) -or
      (($value.StartsWith("'")) -and ($value.EndsWith("'")))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $result[$key] = $value
  }

  return $result
}

function Resolve-RepoName {
  param([string]$ExplicitRepo)

  if (-not [string]::IsNullOrWhiteSpace($ExplicitRepo)) {
    return $ExplicitRepo.Trim()
  }

  $remote = (git config --get remote.origin.url 2>$null).Trim()
  if ([string]::IsNullOrWhiteSpace($remote)) {
    throw "Could not resolve repo automatically. Pass -Repo owner/name."
  }

  $regex = [regex]"github\.com[:/](?<repo>[^/]+/[^/.]+)(\.git)?$"
  $match = $regex.Match($remote)
  if (-not $match.Success) {
    throw "Remote origin is not a GitHub repo URL. Pass -Repo owner/name."
  }

  return $match.Groups["repo"].Value
}

function Normalize-BaseUrl {
  param([string]$InputValue)

  $trimmed = [string]$InputValue
  $trimmed = $trimmed.Trim()
  if ([string]::IsNullOrWhiteSpace($trimmed)) {
    throw "Domain value is empty."
  }

  if ($trimmed -match "^https?://") {
    return $trimmed.TrimEnd("/")
  }

  return ("https://" + $trimmed.Trim("/")).TrimEnd("/")
}

function Add-IfPresent {
  param(
    [System.Collections.IDictionary]$Target,
    [System.Collections.IDictionary]$Source,
    [string[]]$Keys
  )

  foreach ($key in $Keys) {
    if ($Source.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($Source[$key])) {
      $Target[$key] = $Source[$key]
    }
  }
}

function Get-FirstNonEmptyValue {
  param(
    [System.Collections.IDictionary]$Source,
    [string[]]$Keys
  )

  foreach ($key in $Keys) {
    if ($Source.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($Source[$key])) {
      return $Source[$key]
    }
  }

  return $null
}

function Add-FromAliases {
  param(
    [System.Collections.IDictionary]$Target,
    [System.Collections.IDictionary]$Source,
    [string]$TargetKey,
    [string[]]$Aliases
  )

  $value = Get-FirstNonEmptyValue -Source $Source -Keys $Aliases
  if (-not [string]::IsNullOrWhiteSpace($value)) {
    $Target[$TargetKey] = $value
  }
}

function Set-GitHubSecretValue {
  param(
    [string]$RepoName,
    [string]$Key,
    [string]$Value,
    [switch]$IsDryRun
  )

  if ($IsDryRun) {
    Write-Host "[dry-run] gh secret set $Key --repo $RepoName --app actions"
    return
  }

  $output = ($Value | gh secret set $Key --repo $RepoName --app actions 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to set secret '$Key'. gh output: $output"
  }
  Write-Host "set $Key"
}

$hasGh = Test-CommandExists "gh"
if (-not $hasGh -and -not $DryRun) {
  throw "GitHub CLI not found. Install from https://cli.github.com and run 'gh auth login' first."
}
if (-not $hasGh -and $DryRun) {
  Write-Warning "GitHub CLI not found. Running in dry-run mode without secret uploads."
}

if ($hasGh -and -not $DryRun) {
  try {
    gh auth status 1>$null 2>$null
  } catch {
    # handled below via exit code check
  }
  if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI is not authenticated. Run: gh auth login"
  }
}

$ServerEnvPath = Resolve-InputPath -PathValue $ServerEnvPath
$ClientEnvPath = Resolve-InputPath -PathValue $ClientEnvPath
if (-not [string]::IsNullOrWhiteSpace($GcpSaKeyPath)) {
  $GcpSaKeyPath = Resolve-InputPath -PathValue $GcpSaKeyPath
}

Set-Location $repoRoot

$repoName = Resolve-RepoName -ExplicitRepo $Repo
$serverEnv = Parse-EnvFile -Path $ServerEnvPath
$clientEnv = Parse-EnvFile -Path $ClientEnvPath
$baseUrl = Normalize-BaseUrl -InputValue $Domain

if ($DryRun) {
  Write-Host "server env path: $ServerEnvPath"
  Write-Host "client env path: $ClientEnvPath"
  Write-Host "server keys parsed: $($serverEnv.Keys.Count)"
  Write-Host "client keys parsed: $($clientEnv.Keys.Count)"
  Write-Host "server key names: $([string]::Join(', ', ($serverEnv.Keys | Sort-Object)))"
  Write-Host "client key names: $([string]::Join(', ', ($clientEnv.Keys | Sort-Object)))"
}

$secrets = [ordered]@{}

Add-FromAliases -Target $secrets -Source $serverEnv -TargetKey "MONGO_URI" -Aliases @("MONGO_URI", "MONGODB_URI")
Add-FromAliases -Target $secrets -Source $serverEnv -TargetKey "ACCESS_TOKEN_SECRET" -Aliases @(
  "ACCESS_TOKEN_SECRET",
  "SECRET_KEY_ACCESS_TOKEN",
  "JSON_WEB_TOKEN_SECRET_KEY",
  "JWT_SECRET"
)
Add-FromAliases -Target $secrets -Source $serverEnv -TargetKey "REFRESH_TOKEN_SECRET" -Aliases @(
  "REFRESH_TOKEN_SECRET",
  "SECRET_KEY_REFRESH_TOKEN",
  "JSON_WEB_TOKEN_SECRET_KEY",
  "JWT_SECRET"
)

Add-IfPresent -Target $secrets -Source $serverEnv -Keys @(
  "EMAIL",
  "EMAIL_PASSWORD",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY"
)

Add-IfPresent -Target $secrets -Source $clientEnv -Keys @(
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
  "NEXT_PUBLIC_FIREBASE_VAPID_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
)

# Force production URLs for live domain cutover.
$secrets["CLIENT_URL"] = $baseUrl
$secrets["NEXT_PUBLIC_API_URL"] = $baseUrl
$secrets["NEXT_PUBLIC_APP_API_URL"] = $baseUrl
$secrets["NEXT_PUBLIC_SITE_URL"] = $baseUrl

if (-not [string]::IsNullOrWhiteSpace($AdminUrl)) {
  $secrets["ADMIN_URL"] = (Normalize-BaseUrl -InputValue $AdminUrl)
} elseif ($serverEnv.ContainsKey("ADMIN_URL") -and -not [string]::IsNullOrWhiteSpace($serverEnv["ADMIN_URL"])) {
  $secrets["ADMIN_URL"] = $serverEnv["ADMIN_URL"].Trim().TrimEnd("/")
} else {
  # Fallback only if no dedicated admin domain is configured.
  $secrets["ADMIN_URL"] = $baseUrl
}

if ([string]::IsNullOrWhiteSpace($GcpProjectId) -and (Test-CommandExists "gcloud")) {
  try {
    $resolvedProject = (gcloud config get-value project 2>$null).Trim()
    if (-not [string]::IsNullOrWhiteSpace($resolvedProject) -and $resolvedProject -ne "(unset)") {
      $GcpProjectId = $resolvedProject
    }
  } catch {
  }
}
if (-not [string]::IsNullOrWhiteSpace($GcpProjectId)) {
  $secrets["GCP_PROJECT_ID"] = $GcpProjectId.Trim()
}

if (-not [string]::IsNullOrWhiteSpace($GcpSaKeyPath)) {
  if (-not (Test-Path $GcpSaKeyPath)) {
    throw "GCP SA key file not found: $GcpSaKeyPath"
  }
  $secrets["GCP_SA_KEY"] = Get-Content -Path $GcpSaKeyPath -Raw
}

if ($DryRun) {
  Write-Host "candidate secrets populated: $($secrets.Keys.Count)"
}

$requiredKeys = @(
  "MONGO_URI",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "CLIENT_URL",
  "ADMIN_URL",
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_SITE_URL",
  "EMAIL",
  "EMAIL_PASSWORD",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_VAPID_KEY"
)

$missing = @()
foreach ($key in $requiredKeys) {
  if (-not $secrets.Contains($key) -or [string]::IsNullOrWhiteSpace($secrets[$key])) {
    $missing += $key
  }
}

if ($missing.Count -gt 0) {
  throw (
    "Missing required values for secrets:`n - " +
    ($missing -join "`n - ") +
    "`n`nFill server/.env + frontend/client/.env (or pass params), then retry."
  )
}

Write-Host "target repo: $repoName"
Write-Host "domain base URL: $baseUrl"
Write-Host "updating $($secrets.Count) GitHub Actions secrets..."

foreach ($entry in $secrets.GetEnumerator()) {
  Set-GitHubSecretValue -RepoName $repoName -Key $entry.Key -Value $entry.Value -IsDryRun:$DryRun
}

if ($DryRun) {
  Write-Host "dry-run completed"
} else {
  Write-Host "done. secrets updated."
}
