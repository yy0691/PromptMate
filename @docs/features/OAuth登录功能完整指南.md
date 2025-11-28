# OAuth 登录功能完整指南

本文档提供 PromptMate OAuth 登录功能的完整配置和测试指南，支持 Google、GitHub、LinuxDo 等第三方登录。

## 目录

- [功能概述](#功能概述)
- [架构说明](#架构说明)
- [环境配置](#环境配置)
- [Supabase 配置](#supabase-配置)
- [本地开发测试](#本地开发测试)
- [Electron 应用测试](#electron-应用测试)
- [生产环境部署](#生产环境部署)
- [故障排查](#故障排查)

## 功能概述

### 支持的登录方式

1. **邮箱密码登录**
   - 用户注册（需邮箱验证）
   - 邮箱密码登录
   - 密码重置

2. **OAuth 第三方登录**
   - Google 账号登录
   - GitHub 账号登录
   - LinuxDo 账号登录（自定义 OAuth 提供商）

### 核心特性

- ✅ 统一的认证流程
- ✅ Token 自动刷新
- ✅ 跨平台支持（Web + Electron）
- ✅ 安全的 Token 存储
- ✅ 用户资料管理
- ✅ 会话持久化

## 架构说明

```
┌─────────────────────────────────────────────────────────────┐
│                         前端应用                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  AuthDialog (登录对话框)                              │   │
│  │  - 邮箱登录表单                                        │   │
│  │  - OAuth 登录按钮 (Google/GitHub/LinuxDo)            │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  useAuth Hook (认证状态管理)                          │   │
│  │  - 登录/注册/登出                                      │   │
│  │  - Token 管理                                         │   │
│  │  - 用户状态                                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  authService (API 调用)                               │   │
│  │  - HTTP 请求封装                                       │   │
│  │  - 错误处理                                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓ HTTP
┌─────────────────────────────────────────────────────────────┐
│                         后端 API                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  authController (路由处理)                            │   │
│  │  - /api/auth/register/email                          │   │
│  │  - /api/auth/login/email                             │   │
│  │  - /api/auth/oauth/url                               │   │
│  │  - /api/auth/oauth/callback                          │   │
│  │  - /api/auth/token/refresh                           │   │
│  │  - /api/auth/logout                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  supabaseClient (Supabase 集成)                       │   │
│  │  - 认证 API 调用                                       │   │
│  │  - 用户资料管理                                        │   │
│  │  - Token 处理                                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                      Supabase 服务                           │
│  - 用户认证 (auth.users)                                     │
│  - 用户资料 (profiles)                                       │
│  - OAuth 提供商配置                                          │
│  - Token 管理                                               │
└─────────────────────────────────────────────────────────────┘
```

## 环境配置

### 1. 前端环境变量

复制 `env.template` 为 `.env.local`：

```bash
cp env.template .env.local
```

编辑 `.env.local`：

```env
# API 后端地址
VITE_API_BASE_URL=http://localhost:8787

# OAuth 回调地址
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_OAUTH_ELECTRON_REDIRECT_URI=promptmate://oauth

# 应用环境
VITE_APP_ENV=development
```

### 2. 后端环境变量

复制 `server/env.template` 为 `server/.env`：

```bash
cp server/env.template server/.env
```

编辑 `server/.env`：

```env
# 服务器端口
PORT=8787

# Supabase 配置（从 Supabase Dashboard 获取）
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# CORS 配置
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175

# 测试环境
NODE_ENV=development
```

## Supabase 配置

### 1. 创建 Supabase 项目

1. 访问 [https://supabase.com](https://supabase.com)
2. 创建新项目或使用现有项目
3. 记录项目 URL 和 API Keys

### 2. 配置 OAuth 提供商

#### Google OAuth

1. 在 Supabase Dashboard → **Authentication** → **Providers**
2. 启用 **Google** 提供商
3. 在 [Google Cloud Console](https://console.cloud.google.com/) 创建 OAuth 客户端：
   - 创建新项目或选择现有项目
   - 启用 **Google+ API**
   - 创建 **OAuth 2.0 客户端 ID**
   - 应用类型：**Web 应用**
   - 已授权的重定向 URI：
     ```
     https://your-project.supabase.co/auth/v1/callback
     ```
   - 已授权的 JavaScript 来源：
     ```
     http://localhost:5173
     https://your-domain.com
     ```
4. 将 **Client ID** 和 **Client Secret** 填入 Supabase

#### GitHub OAuth

1. 在 Supabase Dashboard 启用 **GitHub** 提供商
2. 前往 [GitHub Settings](https://github.com/settings/developers) → **Developer settings** → **OAuth Apps**
3. 点击 **New OAuth App**
4. 填写信息：
   - Application name: `PromptMate`
   - Homepage URL: `https://your-domain.com`
   - Authorization callback URL:
     ```
     https://your-project.supabase.co/auth/v1/callback
     ```
5. 创建后获取 **Client ID** 和 **Client Secret**
6. 将凭据填入 Supabase

#### LinuxDo OAuth（自定义提供商）

LinuxDo 使用 Discourse OAuth2 认证。配置步骤：

1. 在 Supabase Dashboard → **Authentication** → **Providers**
2. 找到 **Add Custom Provider** 或使用 Supabase CLI
3. 配置自定义 OAuth 提供商：

```sql
-- 在 Supabase SQL Editor 中执行
INSERT INTO auth.saml_providers (id, sso_provider_id, entity_id, metadata_xml, attribute_mapping, created_at, updated_at)
VALUES (
  'linuxdo',
  'linuxdo',
  'https://linux.do',
  -- 配置 OAuth 端点
  NULL,
  jsonb_build_object(
    'authorize_url', 'https://linux.do/oauth2/authorize',
    'token_url', 'https://linux.do/oauth2/token',
    'user_info_url', 'https://linux.do/api/user',
    'scopes', 'read'
  ),
  NOW(),
  NOW()
);
```

或者使用 Supabase 管理面板的自定义 OAuth 配置：

- **Provider Name**: `linuxdo`
- **Authorization URL**: `https://linux.do/oauth2/authorize`
- **Token URL**: `https://linux.do/oauth2/token`
- **User Info URL**: `https://linux.do/api/user`
- **Scopes**: `read`
- **Callback URL**: `https://your-project.supabase.co/auth/v1/callback`

4. 在 Linux.do 中创建 OAuth 应用：
   - 访问 Linux.do 管理面板
   - 创建新的 OAuth2 客户端
   - 设置回调 URL: `https://your-project.supabase.co/auth/v1/callback`
   - 记录 **Client ID** 和 **Client Secret**

5. 将凭据填入 Supabase 配置

### 3. 配置 Redirect URLs

在 Supabase Dashboard → **Authentication** → **URL Configuration**：

**Site URL:**
```
http://localhost:5173
```

**Redirect URLs（允许的回调地址）:**
```
http://localhost:5173/auth/callback
http://127.0.0.1:5173/auth/callback
https://your-domain.com/auth/callback
promptmate://oauth
```

### 4. 数据库表结构

确保以下表存在（通常 Supabase 会自动创建）：

```sql
-- 用户配置表
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 用户可以读取自己的资料
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- 用户可以更新自己的资料
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

## 本地开发测试

### 1. 启动后端服务

```bash
cd server
npm install
npm run dev
```

后端将在 `http://localhost:8787` 启动。

### 2. 启动前端应用

```bash
npm install
npm run dev
```

前端将在 `http://localhost:5173` 启动。

### 3. 使用测试工具

我们提供了自动化测试工具：

```bash
# 测试 Google 登录
node scripts/test-oauth.js google

# 测试 GitHub 登录
node scripts/test-oauth.js github

# 测试 LinuxDo 登录
node scripts/test-oauth.js linuxdo
```

测试工具会：
1. 检查后端连接
2. 检查前端连接
3. 验证环境配置
4. 获取 OAuth URL
5. 自动打开浏览器进行测试

### 4. 手动测试流程

#### 邮箱注册和登录

1. 打开 `http://localhost:5173`
2. 点击右上角的登录按钮
3. 切换到"注册"标签
4. 填写邮箱、密码和昵称
5. 提交注册（会收到验证邮件）
6. 验证邮箱后使用邮箱密码登录

#### OAuth 登录测试

1. 打开 `http://localhost:5173`
2. 点击右上角的登录按钮
3. 点击 Google/GitHub/LinuxDo 按钮
4. 会打开授权页面（可能是弹窗或新标签）
5. 完成授权
6. 自动跳转回应用并完成登录

### 5. 验证登录成功

登录成功后，检查：

- ✅ 右上角显示用户头像/昵称
- ✅ 浏览器控制台无错误
- ✅ localStorage 中存储了 token
- ✅ 可以访问需要认证的功能

## Electron 应用测试

### 1. 启动 Electron 开发模式

```bash
npm run electron:dev
```

### 2. 测试 OAuth 登录

1. 在 Electron 应用中点击登录
2. 点击 OAuth 登录按钮
3. 会在系统默认浏览器中打开授权页面
4. 完成授权后，浏览器会重定向到 `promptmate://oauth?code=...`
5. Electron 应用会捕获这个协议 URL
6. 自动完成登录流程

### 3. 调试 OAuth 回调

查看 Electron 日志：

```bash
# Windows
%APPDATA%\PromptMate\logs\main.log

# macOS
~/Library/Logs/PromptMate/main.log

# Linux
~/.config/PromptMate/logs/main.log
```

搜索 "OAuth" 相关日志。

## 生产环境部署

### 1. 前端部署（Vercel）

1. 在 Vercel 项目设置中添加环境变量：
   ```
   VITE_API_BASE_URL=https://your-api-domain.com
   VITE_OAUTH_REDIRECT_URI=https://your-domain.com/auth/callback
   ```

2. 部署前端：
   ```bash
   npm run build
   vercel --prod
   ```

### 2. 后端部署

根据你的部署方式配置环境变量：

```env
PORT=8787
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CORS_ORIGINS=https://your-domain.com
NODE_ENV=production
```

### 3. 更新 Supabase 配置

在 Supabase Dashboard 更新：

**Site URL:**
```
https://your-domain.com
```

**Redirect URLs:**
```
https://your-domain.com/auth/callback
```

### 4. 更新 OAuth 提供商配置

在各 OAuth 提供商的管理面板中，添加生产环境的回调 URL：

- Google: `https://your-project.supabase.co/auth/v1/callback`
- GitHub: `https://your-project.supabase.co/auth/v1/callback`
- LinuxDo: `https://your-project.supabase.co/auth/v1/callback`

## 故障排查

### 问题 1: 登录失败 - Invalid credentials

**可能原因：**
- Supabase URL 或 API Key 配置错误
- 用户邮箱未验证
- 密码错误

**解决方法：**
1. 检查 `server/.env` 中的 Supabase 配置
2. 在 Supabase Dashboard 检查用户邮箱验证状态
3. 尝试重置密码

### 问题 2: OAuth 登录失败

**可能原因：**
- Redirect URL 配置不正确
- OAuth 客户端配置错误
- CORS 问题

**解决方法：**
1. 确保 Supabase 中的 Redirect URLs 包含你的前端地址
2. 检查 OAuth 提供商的配置（Client ID/Secret）
3. 检查浏览器控制台的 CORS 错误
4. 验证后端 `CORS_ORIGINS` 配置

### 问题 3: 无法连接后端

**可能原因：**
- `VITE_API_BASE_URL` 未配置
- 后端服务未启动
- CORS 配置问题

**解决方法：**
1. 确保 `.env.local` 中配置了正确的 `VITE_API_BASE_URL`
2. 启动后端服务：`cd server && npm run dev`
3. 检查 `server/.env` 中的 `CORS_ORIGINS` 配置
4. 使用测试工具验证连接：`node scripts/test-oauth.js`

### 问题 4: Electron OAuth 回调不工作

**可能原因：**
- 自定义协议未注册
- OAuth 回调处理逻辑错误
- 浏览器未正确重定向

**解决方法：**
1. 确保 Electron 应用已注册 `promptmate://` 协议
2. 检查 `src/main/main.cjs` 中的 `handleOAuthCallback` 函数
3. 查看 Electron 日志文件
4. 在 Supabase 中添加 `promptmate://oauth` 到 Redirect URLs

### 问题 5: LinuxDo 登录失败

**可能原因：**
- LinuxDo OAuth 应用配置错误
- Supabase 自定义提供商配置错误
- LinuxDo 服务不可用

**解决方法：**
1. 验证 LinuxDo OAuth 应用的 Client ID 和 Secret
2. 确认 LinuxDo OAuth 端点 URL 正确
3. 检查 Supabase 中的自定义提供商配置
4. 测试 LinuxDo API 可访问性

### 调试技巧

#### 1. 查看浏览器控制台

打开开发者工具（F12），查看：
- **Console**: 错误日志
- **Network**: API 请求和响应
- **Application**: localStorage 中的 token

#### 2. 查看后端日志

后端服务会输出详细日志：
```bash
cd server
npm run dev
# 观察控制台输出
```

#### 3. 使用测试工具

```bash
node scripts/test-oauth.js [provider]
```

测试工具会自动检查：
- 后端连接
- 前端连接
- 环境配置
- OAuth URL 生成

#### 4. 测试 Supabase 连接

创建测试脚本 `test-supabase.js`：

```javascript
const https = require('https');

const SUPABASE_URL = 'your-url';
const ANON_KEY = 'your-key';

const options = {
  hostname: new URL(SUPABASE_URL).hostname,
  path: '/auth/v1/health',
  method: 'GET',
  headers: { apikey: ANON_KEY }
};

https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Supabase health:', JSON.parse(data));
  });
}).on('error', (err) => {
  console.error('Error:', err);
}).end();
```

运行：
```bash
node test-supabase.js
```

## 安全建议

1. **永远不要** 将 `SUPABASE_SERVICE_ROLE_KEY` 暴露给前端
2. 使用环境变量管理敏感信息
3. 在生产环境启用 RLS (Row Level Security)
4. 定期轮换 API 密钥
5. 限制 CORS 只允许可信域名
6. 启用邮箱验证
7. 实施速率限制防止暴力破解
8. 使用 HTTPS（生产环境）
9. 定期审计用户访问日志
10. 实施 Token 过期和刷新机制

## 相关资源

- [Supabase 文档](https://supabase.com/docs)
- [Supabase Auth 配置](https://supabase.com/docs/guides/auth)
- [OAuth 2.0 详解](https://oauth.net/2/)
- [Google OAuth 文档](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth 文档](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Discourse OAuth 文档](https://meta.discourse.org/t/using-discourse-as-an-identity-provider-sso-discourseconnect/32974)

## 技术支持

如遇到问题，请：

1. 查看本文档的故障排查部分
2. 检查 GitHub Issues
3. 查看 Supabase Dashboard 的日志
4. 运行测试工具诊断问题
5. 提交 Issue 并附上详细日志

---

**文档版本**: 1.0  
**最后更新**: 2024-11-27  
**维护者**: PromptMate Team


