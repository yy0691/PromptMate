@echo off
chcp 65001 >nul
echo.
echo ==========================================
echo    🚀 PromptX 快速启动脚本
echo ==========================================
echo.
echo 正在启动 PromptX 功能测试...
echo.

REM 检查 Node.js 是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js 环境检测通过
echo.

REM 运行功能测试
echo 📊 运行 PromptX 功能测试...
node test-promptx.js
echo.

REM 打开浏览器测试页面
echo 🌐 启动浏览器测试页面...
start "" "test-promptx.html"
echo.

echo ==========================================
echo    🎉 PromptX 启动完成！
echo ==========================================
echo.
echo 📋 接下来您可以：
echo.
echo 1. 🔧 配置 AI 服务
echo    - 打开 PromptMate 应用
echo    - 设置 → AI设置 → 配置 API 密钥
echo.
echo 2. 🎭 激活专业角色
echo    - 设置 → PromptX 角色
echo    - 输入: "我需要产品经理专家"
echo.
echo 3. 💬 开始 AI 对话
echo    - 角色激活后直接对话
echo    - 体验专业级 AI 协作
echo.
echo 4. 🧪 功能测试
echo    - 浏览器测试页面已自动打开
echo    - 测试各种角色激活场景
echo.
echo ==========================================
echo.
pause
