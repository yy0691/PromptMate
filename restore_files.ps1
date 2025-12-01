# Restore deleted files from commit ddc7b113ac85b5ce0a1ded8e286f35d164f4ce55

$repo = "yy0691/PromptMate"
$parentHash = "9375a25d882caed9f545639c4136c4e2496e2fec"
$commitHash = "ddc7b113ac85b5ce0a1ded8e286f35d164f4ce55"

Write-Host "Getting deleted files list..." -ForegroundColor Cyan

$response = Invoke-WebRequest -Uri "https://api.github.com/repos/$repo/commits/$commitHash" -UseBasicParsing
$commit = $response.Content | ConvertFrom-Json
$deletedFiles = $commit.files | Where-Object { $_.status -eq 'removed' } | Select-Object -ExpandProperty filename

Write-Host "Found $($deletedFiles.Count) deleted files" -ForegroundColor Green
Write-Host ""

$restoredCount = 0
$failedFiles = @()

foreach ($file in $deletedFiles) {
    try {
        if (Test-Path $file) {
            Write-Host "Skip: $file (already exists)" -ForegroundColor Yellow
            continue
        }
        
        $dir = Split-Path $file -Parent
        if ($dir -and -not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        
        $filePath = $file -replace '\\', '/'
        $apiUrl = "https://api.github.com/repos/$repo/contents/$filePath" + "?ref=$parentHash"
        
        try {
            $fileResponse = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing
            $fileData = $fileResponse.Content | ConvertFrom-Json
            
            $content = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($fileData.content))
            $content | Out-File -FilePath $file -Encoding UTF8 -NoNewline
            
            Write-Host "Restored: $file" -ForegroundColor Green
            $restoredCount++
        } catch {
            Write-Host "Failed: $file - $($_.Exception.Message)" -ForegroundColor Red
            $failedFiles += $file
        }
    } catch {
        Write-Host "Error: $file - $($_.Exception.Message)" -ForegroundColor Red
        $failedFiles += $file
    }
}

Write-Host ""
Write-Host "Restore completed!" -ForegroundColor Green
Write-Host "  Success: $restoredCount files" -ForegroundColor Green
if ($failedFiles.Count -gt 0) {
    Write-Host "  Failed: $($failedFiles.Count) files" -ForegroundColor Red
    $failedFiles | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
}

