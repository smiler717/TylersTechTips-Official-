# Git Push Helper Script
# This script will help authenticate and push changes to GitHub

Write-Host "Git Push Helper for TylersTechTips" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# Check if we're in a git repo
if (-not (Test-Path .git)) {
    Write-Host "ERROR: Not in a git repository" -ForegroundColor Red
    exit 1
}

# Check current status
Write-Host "Checking git status..." -ForegroundColor Yellow
$status = git status --porcelain
if ($status) {
    Write-Host "Uncommitted changes detected. Staging and committing..." -ForegroundColor Yellow
    git add -A
    git commit -m "fix(nav): standardize navbar links; add Community API status banner"
} else {
    Write-Host "Working directory clean - changes already committed" -ForegroundColor Green
}

# Show current branch
$currentBranch = git branch --show-current
Write-Host "`nCurrent branch: $currentBranch" -ForegroundColor Cyan

# Check remote
$remoteUrl = git config --get remote.origin.url
Write-Host "Remote URL: $remoteUrl`n" -ForegroundColor Cyan

# Attempt push with credential helper
Write-Host "Attempting to push to origin/main..." -ForegroundColor Yellow
Write-Host "If prompted, sign in with your GitHub credentials`n" -ForegroundColor Yellow

# Try using Git Credential Manager
$env:GCM_INTERACTIVE = "always"
git config --global credential.helper manager-core

# Push
try {
    $pushResult = git push origin HEAD:main 2>&1
    Write-Host $pushResult
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nSUCCESS! Changes pushed to GitHub" -ForegroundColor Green
        Write-Host "Cloudflare Pages will auto-deploy from the main branch" -ForegroundColor Green
    } else {
        Write-Host "`nPush failed. Exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "You may need to authenticate via browser or VS Code Source Control" -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTo verify, check: https://github.com/smiler717/TylersTechTips-Official-/commits/main" -ForegroundColor Cyan
