# 认证系统配置指南

本项目使用 Supabase 作为认证后端，支持邮箱登录、Google、GitHub 和 Linux.do 第三方登录。

## 架构说明

```
前端 (React)
  ↓ 调用
authService (src/services/authService.ts)
  ↓ HTTP 请求
后端 API (server/controllers/authController.ts)
  ↓ 调用
Supabase 认证服务
```

## 环境变量配置

### 1. 前端环境变量 (`.env.local`)

```env
# API 后端地址
VITE_API_BASE_URL=http://localhost:8787

# 生产环境在 Vercel 中配置：
# VITE_API_BASE_URL=https://your-api-domain.com
```

### 2. 后端环境变量 (`server/.env`)

```env
PORT=8787

# Supabase 配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CORS 配置（允许的前端域名）
CORS_ORIGINS=http://localhost:5173,https://your-domain.com

# 审计日志管理密钥（可选）
AUDIT_ADMIN_SECRET=your-secret-key
```

## Supabase 配置步骤

### 1. 创建 Supabase 项目

1. 访问 [https://supabase.com](https://supabase.com)
2. 创建新项目
3. 记录项目的 URL 和 API Keys

### 2. 配置 OAuth 提供商

#### Google OAuth

1. 前往 Supabase Dashboard → Authentication → Providers
2. 启用 Google 提供商
3. 在 [Google Cloud Console](https://console.cloud.google.com/) 创建 OAuth 客户端：
   - 已授权的重定向 URI：`https://your-project.supabase.co/auth/v1/callback`
   - 已授权的 JavaScript 来源：你的前端域名
4. 将 Client ID 和 Client Secret 填入 Supabase

#### GitHub OAuth

1. 在 Supabase Dashboard 启用 GitHub 提供商
2. 前往 GitHub Settings → Developer settings → OAuth Apps
3. 创建新的 OAuth App：
   - Authorization callback URL: `https://your-project.supabase.co/auth/v1/callback`
4. 将 Client ID 和 Client Secret 填入 Supabase

#### Linux.do OAuth (自定义 OAuth 提供商)

Linux.do 使用 Discourse OAuth2 认证。配置步骤：

1. 在 Supabase 中使用 **自定义 OAuth** 或通过 API 添加自定义提供商
2. Linux.do OAuth 配置：
   - Authorization URL: `https://linux.do/oauth2/authorize`
   - Token URL: `https://linux.do/oauth2/token`
   - User Info URL: `https://linux.do/api/user`
   - Scopes: `read`
   - Callback URL: `https://your-project.supabase.co/auth/v1/callback`

3. 在 Linux.do 中创建 OAuth 应用：
   - 访问 Linux.do 管理面板
   - 创建新的 OAuth2 客户端
   - 记录 Client ID 和 Client Secret

### 3. 配置 Redirect URLs

在 Supabase Dashboard → Authentication → URL Configuration 中添加：

**Site URL:**
- 开发环境：`http://localhost:5173`
- 生产环境：`https://your-domain.com`

**Redirect URLs（允许的回调地址）:**
```
http://localhost:5173/auth/callback
https://your-domain.com/auth/callback
promptmate://oauth  # Electron 应用
```

### 4. 数据库表结构

确保 Supabase 数据库中存在以下表：

```sql
-- 用户配置表
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  nickname TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 审计日志表（可选）
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 设备管理表（用于同步功能）
CREATE TABLE client_devices (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  device_type TEXT,
  app_version TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_cursor BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 同步事件表
CREATE TABLE sync_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('UPSERT', 'DELETE')),
  payload_ciphertext TEXT,
  payload_nonce TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 为查询性能添加索引
CREATE INDEX idx_profiles_user_id ON profiles(id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_sync_events_user_id ON sync_events(user_id);
CREATE INDEX idx_sync_events_created_at ON sync_events(created_at);
```

## 本地开发环境配置

### 1. 启动后端服务器

```bash
cd server
npm install
npm run dev
```

后端将在 `http://localhost:8787` 启动

### 2. 启动前端

```bash
npm install
npm run dev
```

前端将在 `http://localhost:5173` 启动

### 3. 测试登录功能

1. **邮箱登录测试：**
   - 点击登录按钮
   - 切换到"注册"标签
   - 填写邮箱、密码和昵称
   - 提交注册（会收到验证邮件）
   - 验证邮箱后使用邮箱密码登录

2. **OAuth 登录测试：**
   - 点击 Google/GitHub/Linux.do 按钮
   - 会打开授权页面
   - 授权后自动登录

## Vercel 部署配置

### 环境变量设置

在 Vercel 项目设置中添加以下环境变量：

**前端环境变量：**
- `VITE_API_BASE_URL`: 你的后端 API 地址

**后端环境变量：**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGINS`: 前端域名列表（逗号分隔）

### 部署流程

1. 前端和后端可以分别部署，或使用 Vercel 的 Serverless Functions
2. 确保 CORS 配置正确，允许前端域名访问后端
3. 在 Supabase 中更新生产环境的 Redirect URLs

## 常见问题

### 1. 登录失败：Invalid credentials

**原因：**
- Supabase URL 或 API Key 配置错误
- 用户邮箱未验证
- 密码错误

**解决方法：**
- 检查 `server/.env` 中的 Supabase 配置
- 检查用户邮箱是否已验证
- 重置密码

### 2. OAuth 登录失败

**原因：**
- Redirect URL 配置不正确
- OAuth 客户端配置错误
- CORS 问题

**解决方法：**
- 确保 Supabase 中的 Redirect URLs 包含你的前端地址
- 检查 OAuth 提供商的配置
- 检查浏览器控制台的 CORS 错误

### 3. 无法连接后端

**原因：**
- `VITE_API_BASE_URL` 未配置
- 后端服务未启动
- CORS 配置问题

**解决方法：**
- 确保 `.env.local` 中配置了正确的 `VITE_API_BASE_URL`
- 启动后端服务：`cd server && npm run dev`
- 检查 `server/.env` 中的 `CORS_ORIGINS` 配置

### 4. 生产环境登录失败

**原因：**
- 环境变量未正确配置
- Redirect URLs 不匹配
- HTTPS 证书问题

**解决方法：**
- 确认 Vercel 环境变量已正确设置
- 更新 Supabase Redirect URLs 为生产域名
- 确保使用 HTTPS

## 调试技巧

### 1. 查看浏览器控制台

打开开发者工具，查看 Network 标签中的请求：
- 检查 API 请求是否成功
- 查看错误响应内容
- 确认请求 URL 是否正确

### 2. 查看后端日志

后端服务会输出详细日志：
```bash
cd server
npm run dev
```

### 3. 测试 Supabase 连接

创建测试脚本：
```javascript
// test-supabase.js
const fetch = require('node-fetch');

const SUPABASE_URL = 'your-url';
const ANON_KEY = 'your-key';

fetch(`${SUPABASE_URL}/auth/v1/health`, {
  headers: { apikey: ANON_KEY }
})
.then(res => res.json())
.then(data => console.log('Supabase health:', data))
.catch(err => console.error('Error:', err));
```

## 安全建议

1. **永远不要** 将 `SUPABASE_SERVICE_ROLE_KEY` 暴露给前端
2. 使用环境变量管理敏感信息
3. 在生产环境启用 RLS (Row Level Security)
4. 定期轮换 API 密钥
5. 限制 CORS 只允许可信域名
6. 启用邮箱验证
7. 实施速率限制防止暴力破解

## 相关资源

- [Supabase 文档](https://supabase.com/docs)
- [Supabase Auth 配置](https://supabase.com/docs/guides/auth)
- [OAuth 2.0 详解](https://oauth.net/2/)
- [Linux.do OAuth 文档](https://linux.do/admin/plugins/oauth2)
