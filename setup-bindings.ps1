# Setup Cloudflare Pages Bindings via API
# This script will:
# 1) Ensure a KV namespace exists
# 2) Look up your D1 database ID (community_db)
# 3) Configure your Pages project Production environment with:
#    - D1 binding: DB
#    - KV binding: RATE_LIMIT
# 4) Optionally set ADMIN_KEY as a plain-text variable

param(
    [string]$AccountId,
    [string]$ProjectName,
    [string]$ApiToken,
    [string]$AdminKey,
    [switch]$NonInteractive
)

Write-Host "=== Cloudflare Pages Bindings Setup ===" -ForegroundColor Cyan

# Gather required info (support non-interactive mode and env var)
if (-not $AccountId) {
    if ($NonInteractive) { Write-Error "Missing -AccountId"; exit 1 }
    $AccountId = Read-Host "Enter your Cloudflare Account ID (from the dashboard URL)"
}

if (-not $ProjectName) {
    if ($NonInteractive) { Write-Error "Missing -ProjectName"; exit 1 }
    $ProjectName = Read-Host "Enter your Pages project name (exact, e.g. 'tylerstechtips-official')"
}

if (-not $ApiToken) {
    if ($env:CLOUDFLARE_API_TOKEN) {
        $ApiToken = $env:CLOUDFLARE_API_TOKEN
    } elseif ($NonInteractive) {
        Write-Error "Missing -ApiToken or CLOUDFLARE_API_TOKEN"
        exit 1
    } else {
        $sec = Read-Host "Enter your Cloudflare API Token (Account:Edit, D1:Read, KV:Edit, Pages:Edit)" -AsSecureString
        $ApiToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    }
}

$Headers = @{
    "Authorization" = "Bearer $ApiToken"
    "Content-Type"  = "application/json"
}

function Fail($msg) { Write-Host $msg -ForegroundColor Red; exit 1 }

# 1) D1 database lookup
Write-Host "`nStep 1/4: Looking up D1 database 'community_db'..." -ForegroundColor Yellow
$SkipD1 = $false
try {
    $d1Response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$AccountId/d1/database" -Headers $Headers -Method Get
    if (-not $d1Response.success) { 
        if ($d1Response.errors) { Write-Warning ("Failed to list D1 databases: " + ($d1Response.errors | ConvertTo-Json -Depth 5)) }
        $SkipD1 = $true
    } else {
        $communityDb = $d1Response.result | Where-Object { $_.name -eq "community_db" }
        if (-not $communityDb) { Fail "D1 database 'community_db' not found. Create it first in Dashboard > D1." }
        $DB_ID = $communityDb.uuid
        Write-Host "D1 OK: $DB_ID" -ForegroundColor Green
    }
} catch {
    Write-Warning "API error listing D1 databases: $($_.Exception.Message)"
    $SkipD1 = $true
}

# 2) KV namespace ensure
Write-Host "`nStep 2/4: Ensuring KV namespace 'RATE_LIMIT' exists..." -ForegroundColor Yellow
try {
        $kvResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$AccountId/storage/kv/namespaces" -Headers $Headers -Method Get
    if (-not $kvResponse.success) { Fail "Failed to list KV namespaces: $($kvResponse.errors | ConvertTo-Json -Depth 5)" }
    $kvNamespace = $kvResponse.result | Where-Object { $_.title -eq "RATE_LIMIT" }
    if (-not $kvNamespace) {
            $createKvResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$AccountId/storage/kv/namespaces" -Headers $Headers -Method Post -Body (@{ title = "RATE_LIMIT" } | ConvertTo-Json)
        if (-not $createKvResponse.success) { Fail "Failed to create KV namespace: $($createKvResponse.errors | ConvertTo-Json -Depth 5)" }
        $KV_ID = $createKvResponse.result.id
        Write-Host "Created KV: $KV_ID" -ForegroundColor Green
    } else {
        $KV_ID = $kvNamespace.id
        Write-Host "KV OK: $KV_ID" -ForegroundColor Green
    }
} catch { Fail "API error ensuring KV namespace: $($_.Exception.Message)" }

# 3) Update Pages project deployment config (Production)
Write-Host "`nStep 3/4: Updating Pages project bindings (Production)..." -ForegroundColor Yellow
$updateBody = @{ 
    deployment_configs = @{ 
        production = @{ 
            kv_namespaces = @(@{ binding = "RATE_LIMIT"; id = $KV_ID })
            d1_databases  = @()
        }
    }
} | ConvertTo-Json -Depth 6

# Inject D1 only if available
if (-not $SkipD1 -and $DB_ID) {
    $jsonObj = $updateBody | ConvertFrom-Json
    $jsonObj.deployment_configs.production.d1_databases = @(@{ binding = "DB"; database_id = $DB_ID })
    $updateBody = $jsonObj | ConvertTo-Json -Depth 8
} else {
    Write-Warning "Skipping D1 binding update due to insufficient permissions or lookup failure. KV will still be configured."
}

try {
    $updateResp = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects/$ProjectName" -Headers $Headers -Method Patch -Body $updateBody
    if (-not $updateResp.success) { Fail "Failed to update Pages project bindings: $($updateResp.errors | ConvertTo-Json -Depth 5)" }
    Write-Host "Bindings updated in Pages project." -ForegroundColor Green
} catch { Fail "API error updating Pages project: $($_.Exception.Message)" }

# 4) Optional ADMIN_KEY
Write-Host "`nStep 4/4: (Optional) Set ADMIN_KEY variable" -ForegroundColor Yellow
$setAdmin = $false
if ($AdminKey) { $setAdmin = $true; $ADMIN_KEY = $AdminKey }
elseif (-not $NonInteractive) {
    $ans = Read-Host "Do you want to set ADMIN_KEY now? (y/n)"
    if ($ans -match '^(y|Y)') { $setAdmin = $true; $ADMIN_KEY = Read-Host "Enter ADMIN_KEY value (keep this secret)" }
}
if ($setAdmin) {
    $envPayload = @{ 
        deployment_configs = @{ 
            production = @{ 
                env_vars = @{ 
                    ADMIN_KEY = @{ value = $ADMIN_KEY; type = "plain_text" } 
                }
            }
        }
    } | ConvertTo-Json -Depth 8
    try {
        $envResp = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects/$ProjectName" -Headers $Headers -Method Patch -Body $envPayload
        if (-not $envResp.success) { Fail "Failed to set ADMIN_KEY: $($envResp.errors | ConvertTo-Json -Depth 5)" }
        Write-Host "ADMIN_KEY set." -ForegroundColor Green
    } catch { Fail "API error setting ADMIN_KEY: $($_.Exception.Message)" }
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "Configured bindings:" -ForegroundColor Cyan
Write-Host " - DB → community_db (id: $DB_ID)" -ForegroundColor Gray
Write-Host " - RATE_LIMIT → KV (id: $KV_ID)" -ForegroundColor Gray
Write-Host "`nDeploy will apply on next publish; you can trigger a new deploy by re-running your Pages build or making a tiny commit." -ForegroundColor Yellow
