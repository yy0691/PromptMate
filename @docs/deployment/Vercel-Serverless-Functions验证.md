# Vercel Serverless Functions 验证指南

## 📋 概述

本文档说明如何验证 Vercel 部署后，前端能否正确识别和使用 Serverless Functions。

## ✅ 验证清单

### 1. 文件结构检查

确保以下文件存在：

```
项目根目录/
├── api/
│   └── [...path].ts          # ✅ Serverless Functions 入口
├── vercel.json                # ✅ Vercel 配置
├── package.json               # ✅ 包含 @vercel/node 依赖
└── server/                    # ✅ 后端代码（被 api/[...path].ts 引用）
```

### 2. 依赖检查

确保 `package.json` 中包含：

```json
{
  "devDependencies": {
    "@vercel/node": "^3.0.0"
  }
}
```

如果没有，安装：
```bash
npm install --save-dev @vercel/node
```

### 3. vercel.json 配置检查

确保 `vercel.json` 包含：

```json
{
  "functions": {
    "api/[...path].ts": {
      "runtime": "@vercel/node@3.0.0",
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    }
  ]
}
```

### 4. API 基础 URL 配置

#### 前端代码配置

在 `src/services/authService.ts` 中：

```typescript
// 生产环境使用相对路径（同域），自动使用 Vercel Serverless Functions
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.PROD ? '' : 'http://localhost:8787');
```

**说明**：
- **开发环境**：使用 `http://localhost:8787`（本地后端）
- **生产环境**：
  - 如果设置了 `VITE_API_BASE_URL`，使用该值
  - 如果未设置，使用相对路径（空字符串），自动使用同域的 Serverless Functions

#### Vercel 环境变量（可选）

**选项 1：不设置 `VITE_API_BASE_URL`（推荐）**
- 使用相对路径，自动使用同域的 Serverless Functions
- 无需额外配置

**选项 2：显式设置 `VITE_API_BASE_URL`**
```env
VITE_API_BASE_URL=https://your-domain.vercel.app
```

### 5. 部署后验证

#### 步骤 1: 检查健康检查端点

访问：
```
https://your-domain.vercel.app/api/health
```

应该返回：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "PromptMate API"
}
```

#### 步骤 2: 检查 Vercel Dashboard

1. 登录 Vercel Dashboard
2. 进入项目 → **Functions** 标签
3. 应该看到 `api/[...path].ts` 函数
4. 查看函数日志，确认请求被正确处理

#### 步骤 3: 测试登录功能

1. 打开 `https://your-domain.vercel.app`
2. 点击登录按钮
3. 尝试邮箱登录或 OAuth 登录
4. 打开浏览器开发者工具（F12）→ **Network** 标签
5. 检查 API 请求：
   - 请求 URL 应该是：`https://your-domain.vercel.app/api/auth/...`
   - 状态码应该是 `200` 或 `201`
   - 响应应该包含 token 或用户信息

#### 步骤 4: 检查控制台错误

1. 打开浏览器开发者工具（F12）→ **Console** 标签
2. 不应该有 API 连接错误
3. 不应该有 CORS 错误

## 🔍 故障排查

### 问题 1: API 请求返回 404

**症状**：
```
GET https://your-domain.vercel.app/api/health 404 (Not Found)
```

**可能原因**：
1. `api/[...path].ts` 文件不存在
2. `vercel.json` 配置错误
3. 未安装 `@vercel/node`

**解决方法**：
1. 检查 `api/[...path].ts` 文件是否存在
2. 检查 `vercel.json` 配置
3. 运行 `npm install --save-dev @vercel/node`
4. 重新部署

### 问题 2: API 请求返回 500

**症状**：
```
POST https://your-domain.vercel.app/api/auth/login/email 500 (Internal Server Error)
```

**可能原因**：
1. 环境变量未配置
2. Serverless Function 代码错误
3. 依赖缺失

**解决方法**：
1. 检查 Vercel 环境变量配置
2. 查看 Vercel Dashboard → Functions → 日志
3. 检查 `api/[...path].ts` 中的错误处理

### 问题 3: CORS 错误

**症状**：
```
Access to fetch at 'https://your-domain.vercel.app/api/...' from origin 'https://your-domain.vercel.app' has been blocked by CORS policy
```

**可能原因**：
1. `CORS_ORIGINS` 环境变量未配置
2. CORS 配置不正确

**解决方法**：
1. 在 Vercel 环境变量中设置：
   ```env
   CORS_ORIGINS=https://your-domain.vercel.app
   ```
2. 检查 `api/[...path].ts` 中的 CORS 设置
3. 重新部署

### 问题 4: 函数超时

**症状**：
```
Function execution exceeded timeout
```

**可能原因**：
1. 函数执行时间过长
2. 免费计划限制（10秒）

**解决方法**：
1. 优化代码性能
2. 升级到 Vercel Pro（60秒超时）
3. 将耗时操作移到后台任务

### 问题 5: 环境变量未生效

**症状**：
- API 请求失败
- 日志显示环境变量未定义

**解决方法**：
1. 在 Vercel Dashboard → Settings → Environment Variables 中检查
2. 确保变量名正确（区分大小写）
3. 确保为 Production 环境设置了变量
4. 重新部署

## 📊 验证测试脚本

创建一个简单的测试脚本：

```bash
# test-vercel-api.sh
#!/bin/bash

DOMAIN="https://your-domain.vercel.app"

echo "测试健康检查端点..."
curl -s "$DOMAIN/api/health" | jq .

echo -e "\n测试 OAuth URL 获取..."
curl -s "$DOMAIN/api/auth/oauth/url?provider=google&redirect_uri=https://your-domain.vercel.app/auth/callback" | jq .
```

运行：
```bash
chmod +x test-vercel-api.sh
./test-vercel-api.sh
```

## 🎯 最佳实践

### 1. 使用相对路径（推荐）

在生产环境中，不设置 `VITE_API_BASE_URL`，让代码使用相对路径：

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.PROD ? '' : 'http://localhost:8787');
```

**优势**：
- 自动适配域名
- 无需为不同环境配置不同 URL
- 支持自定义域名

### 2. 环境变量管理

在 Vercel Dashboard 中统一管理环境变量：
- Production
- Preview
- Development

### 3. 监控和日志

- 定期检查 Vercel Dashboard → Functions → 日志
- 设置错误告警
- 监控函数执行时间

### 4. 性能优化

- 减少冷启动时间
- 优化数据库查询
- 使用缓存
- 避免长时间运行的任务

## 📚 相关文档

- [Vercel 部署说明](./Vercel部署说明.md)
- [生产环境多回调地址配置方案](../features/生产环境多回调地址配置方案.md)
- [登录功能测试指南](../testing/登录功能测试指南.md)

