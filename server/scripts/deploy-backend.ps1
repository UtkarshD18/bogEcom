param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Convert-SecureStringToPlainText {
  param(
    [Parameter(Mandatory = $true)]
    [System.Security.SecureString]$Value
  )

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function New-RandomSecret {
  param(
    [int]$Bytes = 48
  )

  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
  $secret = [Convert]::ToBase64String($buffer)
  return $secret.TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Normalize-InputValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  $normalized = $Value.Trim()
  if (
    ($normalized.StartsWith('"') -and $normalized.EndsWith('"')) -or
    ($normalized.StartsWith("'") -and $normalized.EndsWith("'"))
  ) {
    return $normalized.Substring(1, $normalized.Length - 2).Trim()
  }

  return $normalized
}

function Read-RequiredSecret {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Prompt,
    [switch]$GenerateIfEmpty
  )

  while ($true) {
    $secureInput = Read-Host -Prompt $Prompt -AsSecureString
    $plainText = Convert-SecureStringToPlainText -Value $secureInput

    if (-not [string]::IsNullOrWhiteSpace($plainText)) {
      return Normalize-InputValue -Value $plainText
    }

    if ($GenerateIfEmpty) {
      return New-RandomSecret
    }

    Write-Host "Value is required." -ForegroundColor Yellow
  }
}

function Read-OptionalSecret {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Prompt
  )

  $secureInput = Read-Host -Prompt $Prompt -AsSecureString
  $plainText = Convert-SecureStringToPlainText -Value $secureInput
  if ([string]::IsNullOrWhiteSpace($plainText)) {
    return ""
  }

  return Normalize-InputValue -Value $plainText
}

function Read-RequiredText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Prompt,
    [string]$DefaultValue = ""
  )

  while ($true) {
    if ([string]::IsNullOrWhiteSpace($DefaultValue)) {
      $inputValue = Read-Host -Prompt $Prompt
    } else {
      $inputValue = Read-Host -Prompt "$Prompt [$DefaultValue]"
      if ([string]::IsNullOrWhiteSpace($inputValue)) {
        $inputValue = $DefaultValue
      }
    }

    if (-not [string]::IsNullOrWhiteSpace($inputValue)) {
      return Normalize-InputValue -Value $inputValue
    }

    Write-Host "Value is required." -ForegroundColor Yellow
  }
}

function Read-OptionalText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Prompt
  )

  $inputValue = Read-Host -Prompt $Prompt
  if ([string]::IsNullOrWhiteSpace($inputValue)) {
    return ""
  }

  return Normalize-InputValue -Value $inputValue
}

function Quote-YamlValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  return '"' + $Value.Replace('\', '\\').Replace('"', '\"') + '"'
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$tempDeployFile = Join-Path $repoRoot "app.deploy.temp.yaml"

$mongoUri = Read-RequiredSecret -Prompt "Mongo URI (input hidden)"
$accessTokenSecret = Read-RequiredSecret -Prompt "Access token secret (leave blank to auto-generate)" -GenerateIfEmpty
$refreshTokenSecret = Read-RequiredSecret -Prompt "Refresh token secret (leave blank to auto-generate)" -GenerateIfEmpty
$clientUrl = Read-RequiredText -Prompt "Client URL" -DefaultValue "https://client-dot-healthy-one-gram.el.r.appspot.com/"
$adminUrl = Read-RequiredText -Prompt "Admin URL"

$cloudinaryCloudName = Read-OptionalText -Prompt "Cloudinary cloud name (optional, Enter to skip)"
$cloudinaryApiKey = ""
$cloudinaryApiSecret = ""
if (-not [string]::IsNullOrWhiteSpace($cloudinaryCloudName)) {
  $cloudinaryApiKey = Read-OptionalSecret -Prompt "Cloudinary API key (input hidden)"
  $cloudinaryApiSecret = Read-OptionalSecret -Prompt "Cloudinary API secret (input hidden)"

  if ([string]::IsNullOrWhiteSpace($cloudinaryApiKey) -or [string]::IsNullOrWhiteSpace($cloudinaryApiSecret)) {
    throw "Cloudinary API key and API secret are required when cloud name is provided."
  }
}

$yamlContent = @(
  "runtime: nodejs22"
  "service: default"
  ""
  "env_variables:"
  "  NODE_ENV: ""production"""
  ("  MONGO_URI: " + (Quote-YamlValue -Value $mongoUri))
  ("  ACCESS_TOKEN_SECRET: " + (Quote-YamlValue -Value $accessTokenSecret))
  ("  REFRESH_TOKEN_SECRET: " + (Quote-YamlValue -Value $refreshTokenSecret))
  ("  CLIENT_URL: " + (Quote-YamlValue -Value $clientUrl))
  ("  ADMIN_URL: " + (Quote-YamlValue -Value $adminUrl))
) -join [Environment]::NewLine

if (-not [string]::IsNullOrWhiteSpace($cloudinaryCloudName)) {
  $yamlContent = @(
    $yamlContent
    ("  CLOUDINARY_CLOUD_NAME: " + (Quote-YamlValue -Value $cloudinaryCloudName))
    ("  CLOUDINARY_API_KEY: " + (Quote-YamlValue -Value $cloudinaryApiKey))
    ("  CLOUDINARY_API_SECRET: " + (Quote-YamlValue -Value $cloudinaryApiSecret))
  ) -join [Environment]::NewLine
}

try {
  Set-Content -Path $tempDeployFile -Value $yamlContent -Encoding UTF8

  Push-Location $repoRoot
  try {
    gcloud app deploy $tempDeployFile --project $ProjectId --quiet
  } finally {
    Pop-Location
  }
} finally {
  if (Test-Path $tempDeployFile) {
    Remove-Item $tempDeployFile -Force
  }
}
