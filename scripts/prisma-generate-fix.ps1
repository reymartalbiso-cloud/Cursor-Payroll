# Prisma Generate Fix Script
# IMPORTANT: Close Cursor/VS Code COMPLETELY before running this script.
# Run from Windows PowerShell (not Cursor terminal): Right-click > Run as Administrator
# Or: Win+R > powershell > cd to project > .\scripts\prisma-generate-fix.ps1

Write-Host "=== Prisma Generate Fix ===" -ForegroundColor Cyan
Write-Host "Make sure Cursor is fully closed!" -ForegroundColor Red
Write-Host ""

# 1. Kill all Node processes (they may be holding the Prisma DLL)
Write-Host "1. Stopping all Node.js processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "   Done." -ForegroundColor Green

# 2. Navigate to project
$projectPath = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectPath
Write-Host "2. Project path: $projectPath" -ForegroundColor Yellow

# 3. Remove .prisma folder
Write-Host "3. Removing node_modules\.prisma..." -ForegroundColor Yellow
$prismaPath = Join-Path $projectPath "node_modules\.prisma"
if (Test-Path $prismaPath) {
    Remove-Item -Recurse -Force $prismaPath
    Write-Host "   Removed." -ForegroundColor Green
} else {
    Write-Host "   Not found (OK)." -ForegroundColor Gray
}

# 4. If step 3 isn't enough, try full node_modules reinstall
Write-Host ""
Write-Host "4. Running npx prisma generate..." -ForegroundColor Yellow
& npx prisma generate

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS! Prisma client generated." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Still failed. Trying full node_modules reinstall..." -ForegroundColor Yellow
    Write-Host "   (This will take a few minutes)" -ForegroundColor Gray
    
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
    & npm install
    & npx prisma generate
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "SUCCESS after reinstall!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "FAILED. Try running from a path WITHOUT spaces, e.g. C:\PayrollApp" -ForegroundColor Red
    }
}
