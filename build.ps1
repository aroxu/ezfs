# Build script for ezfs (Easy File Server)

Write-Host "--- 1. Building Frontend ---" -ForegroundColor Cyan
Set-Location frontend
pnpm install
pnpm build
Set-Location ..

Write-Host "`n--- 2. Building Go Binary ---" -ForegroundColor Cyan
if (Test-Path "ezfs.exe") { Remove-Item "ezfs.exe" }
go build -o ezfs.exe main.go

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nBuild Successful! Run ./ezfs.exe to start the server." -ForegroundColor Green
} else {
    Write-Host "`nBuild Failed!" -ForegroundColor Red
}
