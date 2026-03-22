param(
    [Parameter(Mandatory=$true)][string]$Version,
    [Parameter(Mandatory=$true)][string]$Message
)

if ($Version -notmatch '^v\d+\.\d+\.\d+$') {
    Write-Host "Error: Version must follow the format 'vX.Y.Z' (e.g. v1.0.0)" -ForegroundColor Red
    exit 1
}

git add -A
git commit -m "$Message"
git tag -a $Version -m "$Message"
git push origin main --tags

Write-Host "`nReleased $Version successfully!" -ForegroundColor Green
