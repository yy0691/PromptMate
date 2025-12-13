# PromptMate 生产环境登录/注册功能测试脚本
# 测试域名: https://prompt.luoyuanai.cn/

$baseUrl = "https://prompt.luoyuanai.cn"
$apiBase = "$baseUrl/api"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PromptMate 生产环境认证功能测试" -ForegroundColor Cyan
Write-Host "测试域名: $baseUrl" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 生成随机测试邮箱
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$testEmail = "test_$timestamp@test.com"
$testPassword = "Test123456"
$testNickname = "测试用户_$timestamp"

Write-Host "[1/4] 测试网站可访问性..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $baseUrl -Method Get -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ 网站可访问 (状态码: $($response.StatusCode))" -ForegroundColor Green
    } else {
        Write-Host "✗ 网站返回异常状态码: $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ 无法访问网站: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "[2/4] 测试注册功能..." -ForegroundColor Yellow
Write-Host "  测试邮箱: $testEmail" -ForegroundColor Gray
Write-Host "  测试昵称: $testNickname" -ForegroundColor Gray

$registerBody = @{
    email = $testEmail
    password = $testPassword
    nickname = $testNickname
} | ConvertTo-Json

try {
    $registerResponse = Invoke-WebRequest -Uri "$apiBase/auth/register/email" `
        -Method Post `
        -ContentType "application/json" `
        -Body $registerBody `
        -UseBasicParsing `
        -ErrorAction Stop

    if ($registerResponse.StatusCode -eq 200) {
        $registerData = $registerResponse.Content | ConvertFrom-Json
        Write-Host "✓ 注册成功" -ForegroundColor Green
        Write-Host "  用户ID: $($registerData.user.id)" -ForegroundColor Gray
        Write-Host "  邮箱: $($registerData.user.email)" -ForegroundColor Gray
        Write-Host "  昵称: $($registerData.user.nickname)" -ForegroundColor Gray
        Write-Host "  邮箱已验证: $($registerData.email_confirmed)" -ForegroundColor Gray
    } else {
        Write-Host "✗ 注册失败，状态码: $($registerResponse.StatusCode)" -ForegroundColor Red
        Write-Host "  响应: $($registerResponse.Content)" -ForegroundColor Red
    }
} catch {
    $errorResponse = $_.Exception.Response
    if ($errorResponse) {
        $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "✗ 注册失败" -ForegroundColor Red
        Write-Host "  状态码: $([int]$errorResponse.StatusCode)" -ForegroundColor Red
        Write-Host "  错误信息: $responseBody" -ForegroundColor Red
    } else {
        Write-Host "✗ 注册请求异常: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "[3/4] 测试登录功能..." -ForegroundColor Yellow
Write-Host "  使用邮箱: $testEmail" -ForegroundColor Gray

$loginBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri "$apiBase/auth/login/email" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody `
        -UseBasicParsing `
        -ErrorAction Stop

    if ($loginResponse.StatusCode -eq 200) {
        $loginData = $loginResponse.Content | ConvertFrom-Json
        Write-Host "✓ 登录成功" -ForegroundColor Green
        Write-Host "  用户ID: $($loginData.user.id)" -ForegroundColor Gray
        Write-Host "  邮箱: $($loginData.user.email)" -ForegroundColor Gray
        Write-Host "  昵称: $($loginData.user.nickname)" -ForegroundColor Gray
        Write-Host "  访问令牌: $($loginData.access_token.Substring(0, 20))..." -ForegroundColor Gray
        Write-Host "  刷新令牌: $($loginData.refresh_token.Substring(0, 20))..." -ForegroundColor Gray
        Write-Host "  过期时间: $($loginData.expires_in) 秒" -ForegroundColor Gray
        
        $accessToken = $loginData.access_token
    } else {
        Write-Host "✗ 登录失败，状态码: $($loginResponse.StatusCode)" -ForegroundColor Red
        Write-Host "  响应: $($loginResponse.Content)" -ForegroundColor Red
        $accessToken = $null
    }
} catch {
    $errorResponse = $_.Exception.Response
    if ($errorResponse) {
        $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "✗ 登录失败" -ForegroundColor Red
        Write-Host "  状态码: $([int]$errorResponse.StatusCode)" -ForegroundColor Red
        Write-Host "  错误信息: $responseBody" -ForegroundColor Red
    } else {
        Write-Host "✗ 登录请求异常: $($_.Exception.Message)" -ForegroundColor Red
    }
    $accessToken = $null
}
Write-Host ""

Write-Host "[4/4] 测试错误密码登录（验证错误处理）..." -ForegroundColor Yellow
$wrongPasswordBody = @{
    email = $testEmail
    password = "WrongPassword123"
} | ConvertTo-Json

try {
    $wrongLoginResponse = Invoke-WebRequest -Uri "$apiBase/auth/login/email" `
        -Method Post `
        -ContentType "application/json" `
        -Body $wrongPasswordBody `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "✗ 错误：错误密码应该被拒绝，但返回了成功" -ForegroundColor Red
} catch {
    $errorResponse = $_.Exception.Response
    if ($errorResponse) {
        $statusCode = [int]$errorResponse.StatusCode
        if ($statusCode -eq 401) {
            Write-Host "✓ 错误密码被正确拒绝 (401 Unauthorized)" -ForegroundColor Green
        } else {
            Write-Host "⚠ 错误密码返回状态码: $statusCode (预期: 401)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠ 错误密码请求异常: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "测试完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan






