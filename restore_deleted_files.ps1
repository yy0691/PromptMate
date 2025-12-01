# 恢复指定 commit 中所有被删除的文件
# Usage: .\restore_deleted_files.ps1 <commit-hash>

param(
    [Parameter(Mandatory=$true)]
    [string]$CommitHash
)

Write-Host "正在查找 commit: $CommitHash" -ForegroundColor Cyan

# 检查 commit 是否存在
$commitExists = git cat-file -e $CommitHash 2>$null
if (-not $commitExists) {
    Write-Host "错误: 找不到 commit $CommitHash" -ForegroundColor Red
    Write-Host "请确保:" -ForegroundColor Yellow
    Write-Host "  1. 该 commit 存在于当前仓库中" -ForegroundColor Yellow
    Write-Host "  2. 或者先执行: git fetch origin" -ForegroundColor Yellow
    Write-Host "  3. 或者从其他仓库获取该 commit" -ForegroundColor Yellow
    exit 1
}

Write-Host "找到 commit，正在分析被删除的文件..." -ForegroundColor Green

# 获取该 commit 中所有被删除的文件
$deletedFiles = git show --name-status --diff-filter=D --pretty=format:"" $CommitHash | Where-Object { $_ -match '^D\s+(.+)$' } | ForEach-Object {
    if ($_ -match '^D\s+(.+)$') {
        $matches[1].Trim()
    }
}

if ($deletedFiles.Count -eq 0) {
    Write-Host "该 commit 中没有被删除的文件" -ForegroundColor Yellow
    exit 0
}

Write-Host "`n找到以下被删除的文件:" -ForegroundColor Cyan
$deletedFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }

# 获取该 commit 的父 commit（删除操作之前的版本）
$parentCommit = "$CommitHash^"

Write-Host "`n正在从父 commit ($parentCommit) 恢复文件..." -ForegroundColor Cyan

$restoredCount = 0
$failedFiles = @()

foreach ($file in $deletedFiles) {
    try {
        # 检查文件是否已经存在
        if (Test-Path $file) {
            Write-Host "  跳过 $file (文件已存在)" -ForegroundColor Yellow
            continue
        }
        
        # 从父 commit 恢复文件
        git show "$parentCommit:$file" > $file 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ 已恢复: $file" -ForegroundColor Green
            $restoredCount++
        } else {
            Write-Host "  ✗ 恢复失败: $file" -ForegroundColor Red
            $failedFiles += $file
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

