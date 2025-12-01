# 从 GitHub API 恢复指定 commit 中被删除的文件
# Commit: ddc7b113ac85b5ce0a1ded8e286f35d164f4ce55
# Parent: 9375a25d882caed9f545639c4136c4e2496e2fec

$repo = "yy0691/PromptMate"
$commitHash = "ddc7b113ac85b5ce0a1ded8e286f35d164f4ce55"
$parentHash = "9375a25d882caed9f545639c4136c4e2496e2fec"

Write-Host "正在从 GitHub 恢复被删除的文件..." -ForegroundColor Cyan
Write-Host "Commit: $commitHash" -ForegroundColor Gray
Write-Host "Parent: $parentHash" -ForegroundColor Gray

# 获取被删除的文件列表
$response = Invoke-WebRequest -Uri "https://api.github.com/repos/$repo/commits/$commitHash" -UseBasicParsing
$commit = $response.Content | ConvertFrom-Json
$deletedFiles = $commit.files | Where-Object { $_.status -eq 'removed' } | Select-Object -ExpandProperty filename

Write-Host "`n找到 $($deletedFiles.Count) 个被删除的文件" -ForegroundColor Green

$restoredCount = 0
$failedFiles = @()

foreach ($file in $deletedFiles) {
    try {
        # 检查文件是否已经存在
        if (Test-Path $file) {
            Write-Host "  跳过 $file (文件已存在)" -ForegroundColor Yellow
            continue
        }
        
        # 确保目录存在
        $dir = Split-Path $file -Parent
        if ($dir -and -not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        
        # 从 GitHub API 获取文件内容（从父 commit）
        $filePath = $file -replace '\\', '/'
        $apiUrl = "https://api.github.com/repos/$repo/contents/$filePath?ref=$parentHash"
        
        try {
            $fileResponse = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing
            $fileData = $fileResponse.Content | ConvertFrom-Json
            
            # 解码 base64 内容
            $content = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($fileData.content))
            
            # 写入文件
            $content | Out-File -FilePath $file -Encoding UTF8 -NoNewline
            
            Write-Host "  ✓ 已恢复: $file" -ForegroundColor Green
            $restoredCount++
        } catch {
            # 如果 API 获取失败，尝试使用 git show（如果本地有该 commit）
            Write-Host "  ⚠ API 获取失败，尝试使用 git show: $file" -ForegroundColor Yellow
            $gitCmd = "git show `${parentHash}:${file}"
            $output = Invoke-Expression $gitCmd 2>$null
            if ($LASTEXITCODE -eq 0 -and $output) {
                $output | Out-File -FilePath $file -Encoding UTF8 -NoNewline
                Write-Host "  ✓ 已恢复 (通过 git): $file" -ForegroundColor Green
                $restoredCount++
            } else {
                Write-Host "  ✗ 恢复失败: $file" -ForegroundColor Red
                $failedFiles += $file
            }
        }
    } catch {
        Write-Host "  ✗ 恢复失败: $file - $($_.Exception.Message)" -ForegroundColor Red
        $failedFiles += $file
    }
}

Write-Host "`n恢复完成!" -ForegroundColor Green
Write-Host "  成功恢复: $restoredCount 个文件" -ForegroundColor Green
if ($failedFiles.Count -gt 0) {
    Write-Host "  失败: $($failedFiles.Count) 个文件" -ForegroundColor Red
    $failedFiles | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
}

