# OAuth 登录快速开始

本指南帮助你快速配置和测试 PromptMate 的 OAuth 登录功能。

## 🚀 5分钟快速开始

### 步骤 1: 配置环境变量

```bash
# 1. 复制环境变量模板
cp env.template .env.local
cp server/env.template server/.env

# 2. 编辑 server/.env，填入你的 Supabase 凭据
# 从 Supabase Dashboard -> Settings -> API 获取
```

在 `server/.env` 中填入：
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 步骤 2: 配置 Supabase OAuth

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入你的项目
3. 导航到 **Authentication** → **Providers**
4. 启用你想要的 OAuth 提供商：

#### Google
- 点击 **Google** → **Enable**
- 在 [Google Cloud Console](https://console.cloud.google.com/) 创建 OAuth 客户端
- 回调 URL: `https://your-project.supabase.co/auth/v1/callback`
- 填入 Client ID 和 Secret

#### GitHub  
- 点击 **GitHub** → **Enable**
- 在 [GitHub Settings](https://github.com/settings/developers) 创建 OAuth App
- 回调 URL: `https://your-project.supabase.co/auth/v1/callback`
- 填入 Client ID 和 Secret

#### LinuxDo（可选）
- 使用自定义 OAuth 提供商功能
- 配置端点：
  - Authorize: `https://linux.do/oauth2/authorize`
  - Token: `https://linux.do/oauth2/token`
  - User Info: `https://linux.do/api/user`

### 步骤 3: 配置回调 URL

在 Supabase Dashboard → **Authentication** → **URL Configuration**:

**Redirect URLs** 添加：
```
http://localhost:5173/auth/callback
http://127.0.0.1:5173/auth/callback
promptmate://oauth
```

### 步骤 4: 启动应用

#### 方式 A: 本地开发（需要单独启动后端）

```bash
# 终端 1: 启动后端
cd server
npm install
npm run dev

# 终端 2: 启动前端
npm install
npm run dev
```

#### 方式 B: Vercel 部署（无需单独后端）

如果部署到 Vercel，后端会自动作为 Serverless Functions 运行，无需单独启动：

```bash
# 1. 安装 Vercel CLI（如果还没有）
npm install -g vercel

# 2. 在项目根目录运行
vercel dev
```

这会同时启动前端和 API 路由。详见 [Vercel部署说明.md](@docs/Vercel部署说明.md)

### 步骤 5: 测试登录

#### 方式 1: 使用测试工具（推荐）

```bash
# 测试 Google 登录
node scripts/test-oauth.js google

# 测试 GitHub 登录
node scripts/test-oauth.js github

# 测试 LinuxDo 登录
node scripts/test-oauth.js linuxdo
```

测试工具会自动：
- ✅ 检查后端和前端连接
- ✅ 验证环境配置
- ✅ 获取 OAuth URL
- ✅ 打开浏览器进行测试

#### 方式 2: 手动测试

1. 打开浏览器访问 `http://localhost:5173`
2. 点击右上角的**登录**按钮
3. 选择 OAuth 提供商（Google/GitHub/LinuxDo）
4. 完成授权
5. 自动跳转回应用并登录成功

## 🔧 常见问题

### 问题 1: 后端连接失败

**错误**: `ERR_CONNECTION_REFUSED`

**解决**:

**本地开发：**
```bash
# 确保后端正在运行
cd server
npm run dev
```

**Vercel 部署：**
- 如果使用 Vercel Serverless Functions，无需单独启动后端
- 确保 `api/[...path].ts` 文件存在
- 检查 Vercel 环境变量配置
- 使用 `vercel dev` 启动本地开发服务器

### 问题 2: OAuth 授权失败

**错误**: `redirect_uri_mismatch`

**解决**:
1. 检查 Supabase 中的 Redirect URLs 配置
2. 确保包含 `http://localhost:5173/auth/callback`
3. 检查 OAuth 提供商的回调 URL 配置

### 问题 3: Supabase 配置错误

**错误**: `Invalid API key`

**解决**:
1. 检查 `server/.env` 中的 Supabase 配置
2. 确保 URL 和 Keys 正确无误
3. 重启后端服务

## 📱 Electron 测试

```bash
# 启动 Electron 开发模式
npm run electron:dev
```

在 Electron 中：
1. 点击 OAuth 登录按钮
2. 会在系统浏览器中打开授权页面
3. 完成授权后自动返回应用
4. 登录成功

## 📚 更多资源

- [完整配置指南](@docs/OAuth登录功能完整指南.md)
- [认证系统配置](../AUTH_SETUP.md)
- [Supabase 文档](https://supabase.com/docs/guides/auth)

## 💡 提示

- 首次配置建议先测试 Google 或 GitHub，这两个提供商最稳定
- LinuxDo 是自定义提供商，配置相对复杂
- 使用测试工具可以快速诊断配置问题
- 查看浏览器控制台和后端日志可以获取详细错误信息

## 🎉 成功标志

登录成功后，你应该看到：
- ✅ 右上角显示用户头像/昵称
- ✅ 浏览器控制台无错误
- ✅ localStorage 中存储了认证 token
- ✅ 可以访问需要认证的功能

---

**遇到问题？** 查看[完整故障排查指南](@docs/OAuth登录功能完整指南.md#故障排查)

