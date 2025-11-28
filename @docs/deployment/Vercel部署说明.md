# Vercel 部署说明

## 📋 概述

PromptMate 现在支持两种部署方式：

1. **Vercel Serverless Functions**（推荐）- 前端和后端一起部署到 Vercel
2. **独立后端服务器** - 后端单独部署，前端部署到 Vercel

## 🚀 方式一：Vercel Serverless Functions（推荐）

### 优势

- ✅ 无需单独维护后端服务器
- ✅ 自动扩缩容
- ✅ 全球 CDN 加速
- ✅ 免费额度充足
- ✅ 部署简单，一键部署

### 部署步骤

#### 1. 安装依赖

```bash
npm install --save-dev @vercel/node
```

#### 2. 配置环境变量

在 Vercel 项目设置中添加以下环境变量：

**必需的环境变量：**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CORS_ORIGINS=https://your-domain.vercel.app,https://your-custom-domain.com
```

**可选的环境变量：**
```env
AUDIT_ADMIN_SECRET=your-secret-key
NODE_ENV=production
```

#### 3. 更新前端环境变量

在 Vercel 项目设置中添加：

```env
VITE_API_BASE_URL=https://your-domain.vercel.app
VITE_OAUTH_REDIRECT_URI=https://your-domain.vercel.app/auth/callback
```

#### 4. 部署

```bash
# 连接到 Vercel
vercel

# 或通过 GitHub 自动部署
# 推送代码到 GitHub，Vercel 会自动部署
```

### API 路由结构

所有 API 请求会自动路由到 `api/[...path].ts`，该文件会：

1. 处理所有 `/api/*` 路径的请求
2. 自动路由到对应的控制器
3. 处理 CORS、认证、速率限制等

### 本地开发

在本地开发时，你可以选择：

**选项 1：使用 Vercel CLI（推荐）**

```bash
# 安装 Vercel CLI
npm install -g vercel

# 启动开发服务器（会自动处理 API 路由）
vercel dev
```

**选项 2：分别启动前后端**

```bash
# 终端 1: 启动后端
cd server && npm run dev

# 终端 2: 启动前端
npm run dev
```

## 🖥️ 方式二：独立后端服务器

如果你已经有后端服务器，可以：

1. 将后端部署到任何 Node.js 服务器（如 Railway、Render、DigitalOcean 等）
2. 前端部署到 Vercel
3. 在 Vercel 环境变量中设置 `VITE_API_BASE_URL` 指向你的后端服务器

### 部署后端到其他平台

#### Railway

```bash
# 1. 在 Railway 创建新项目
# 2. 连接 GitHub 仓库
# 3. 设置根目录为 server/
# 4. 配置环境变量
# 5. 部署
```

#### Render

```yaml
# render.yaml
services:
  - type: web
    name: promptmate-api
    env: node
    buildCommand: cd server && npm install
    startCommand: cd server && npm start
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
```

## 📊 两种方式对比

| 特性 | Vercel Serverless | 独立后端 |
|------|------------------|---------|
| 部署复杂度 | ⭐ 简单 | ⭐⭐ 中等 |
| 成本 | 免费额度充足 | 需要服务器费用 |
| 扩展性 | 自动扩缩容 | 需要手动配置 |
| 维护成本 | 低 | 中等 |
| 性能 | 全球 CDN | 取决于服务器位置 |
| 适合场景 | 中小型应用 | 大型应用、需要更多控制 |

## 🔧 配置说明

### Vercel 项目设置

1. **Framework Preset**: Vite
2. **Root Directory**: ./
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. **Install Command**: `npm install`

### 环境变量配置

#### 前端环境变量（Vercel）

```env
VITE_API_BASE_URL=https://your-domain.vercel.app
VITE_OAUTH_REDIRECT_URI=https://your-domain.vercel.app/auth/callback
VITE_OAUTH_ELECTRON_REDIRECT_URI=promptmate://oauth
VITE_APP_ENV=production
```

#### 后端环境变量（Vercel）

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CORS_ORIGINS=https://your-domain.vercel.app
NODE_ENV=production
```

### Supabase 配置更新

在 Supabase Dashboard → **Authentication** → **URL Configuration**：

**Site URL:**
```
https://your-domain.vercel.app
```

**Redirect URLs:**
```
https://your-domain.vercel.app/auth/callback
promptmate://oauth
```

## 🐛 故障排查

### 问题 1: API 路由 404

**原因**: Vercel 没有正确识别 API 路由

**解决**:
1. 确保 `api/[...path].ts` 文件存在
2. 检查 `vercel.json` 配置
3. 确保安装了 `@vercel/node` 依赖

### 问题 2: CORS 错误

**原因**: CORS_ORIGINS 配置不正确

**解决**:
1. 检查 Vercel 环境变量中的 `CORS_ORIGINS`
2. 确保包含你的前端域名
3. 格式：`https://domain1.com,https://domain2.com`

### 问题 3: 环境变量未生效

**原因**: 环境变量未正确设置

**解决**:
1. 在 Vercel 项目设置中检查环境变量
2. 确保变量名正确（区分大小写）
3. 重新部署应用

### 问题 4: 函数超时

**原因**: Serverless Function 执行时间过长

**解决**:
1. 优化代码性能
2. 使用 Vercel Pro 计划（更长的超时时间）
3. 考虑将耗时操作移到后台任务

## 📝 注意事项

1. **Serverless Functions 限制**:
   - 免费计划：10 秒超时
   - Pro 计划：60 秒超时
   - 请求大小限制：4.5MB

2. **冷启动**:
   - 首次请求可能较慢（冷启动）
   - 建议使用 Vercel Pro 计划减少冷启动时间

3. **环境变量**:
   - 敏感信息使用环境变量，不要提交到代码库
   - 使用 Vercel 的环境变量管理功能

4. **数据库连接**:
   - Supabase 使用 HTTP API，无需维护连接池
   - 适合 Serverless 环境

## 🎯 推荐配置

### 小型项目（推荐 Vercel Serverless）

- 使用 Vercel Serverless Functions
- 免费计划即可满足需求
- 简单快速部署

### 中大型项目

- 考虑独立后端服务器
- 或使用 Vercel Pro 计划
- 根据实际需求选择

## 📚 相关文档

- [Vercel 文档](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Supabase 文档](https://supabase.com/docs)
- [OAuth 登录功能完整指南](@docs/OAuth登录功能完整指南.md)

---

**最后更新**: 2024-11-27


