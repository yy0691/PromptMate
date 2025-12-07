# Google OAuth 400 错误排查指南

## 问题描述

在使用 Google OAuth 登录时，遇到 400 Bad Request 错误，错误信息显示：
```
400. That's an error.
The server cannot process the request because it is malformed. It should not be retried.
```

## 常见原因及解决方案

### 1. URL 过长问题

**症状：**
- OAuth 授权 URL 超过 2000 字符
- Google 拒绝处理过长的 URL

**解决方案：**
1. 检查 Supabase 配置，确保没有添加不必要的参数
2. 在 Supabase Dashboard → Authentication → Providers → Google 中，只配置必要的 Scope
3. 确保 Redirect URI 配置简洁

**检查方法：**
打开浏览器开发者工具（F12），在控制台查看 OAuth URL 长度：
```javascript
// 在控制台执行
console.log('OAuth URL 长度:', oauthUrl.length);
```

### 2. 代理问题（最常见）

**症状：**
- 网络请求显示远程地址为 `127.0.0.1:7890` 或其他本地代理端口
- 代理可能修改了 OAuth 请求，导致格式错误

**解决方案：**

#### 方案 A：临时关闭代理
1. 关闭 Clash、V2Ray 或其他代理工具
2. 重新尝试 Google 登录
3. 如果成功，说明是代理问题

#### 方案 B：配置代理绕过规则
在代理工具中添加规则，让 Google OAuth 相关域名直连：

**Clash 配置示例：**
```yaml
rules:
  - DOMAIN-SUFFIX,accounts.google.com,DIRECT
  - DOMAIN-SUFFIX,oauth2.googleapis.com,DIRECT
  - DOMAIN-SUFFIX,supabase.co,DIRECT
```

**V2Ray 配置示例：**
```json
{
  "rules": [
    {
      "type": "field",
      "domain": ["accounts.google.com", "oauth2.googleapis.com", "supabase.co"],
      "outboundTag": "direct"
    }
  ]
}
```

#### 方案 C：使用系统代理设置
在浏览器中配置系统代理，而不是使用代理工具的系统代理模式。

### 3. Redirect URI 配置不匹配

**症状：**
- 错误信息包含 `redirect_uri_mismatch`
- 登录流程在重定向时失败

**解决方案：**

1. **检查 Supabase 配置：**
   - 登录 Supabase Dashboard
   - 进入 Authentication → URL Configuration
   - 在 **Redirect URLs** 中添加：
     ```
     http://localhost:5173/auth/callback
     http://127.0.0.1:5173/auth/callback
     https://your-domain.com/auth/callback
     promptmate://oauth  (如果是 Electron 应用)
     ```

2. **检查 Google Cloud Console 配置：**
   - 访问 [Google Cloud Console](https://console.cloud.google.com/)
   - 进入 APIs & Services → Credentials
   - 找到你的 OAuth 2.0 客户端 ID
   - 在 **已授权的重定向 URI** 中添加：
     ```
     https://your-project.supabase.co/auth/v1/callback
     ```

### 4. Supabase 环境变量配置错误

**症状：**
- 控制台显示 "Supabase 配置缺失"
- OAuth 功能完全无法使用

**解决方案：**

1. **检查前端环境变量：**
   创建或编辑 `.env.local` 文件：
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

2. **检查后端环境变量：**
   编辑 `server/.env` 文件：
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

3. **重启开发服务器：**
   ```bash
   # 停止当前服务器（Ctrl+C）
   # 重新启动
   npm run dev
   ```

### 5. Google OAuth 客户端配置错误

**症状：**
- 在 Google Cloud Console 中配置不正确
- Client ID 或 Client Secret 错误

**解决方案：**

1. **检查 Google Cloud Console 配置：**
   - 访问 [Google Cloud Console](https://console.cloud.google.com/)
   - 确保已启用 **Google+ API** 或 **Google Identity Services API**
   - 创建 OAuth 2.0 客户端 ID（应用类型：Web 应用）
   - 确保已授权的重定向 URI 正确配置

2. **检查 Supabase 中的配置：**
   - 登录 Supabase Dashboard
   - 进入 Authentication → Providers → Google
   - 确保 Client ID 和 Client Secret 正确填写
   - 确保 Google 提供商已启用

### 6. 浏览器缓存问题

**症状：**
- 之前登录过，现在无法登录
- 浏览器缓存了错误的配置

**解决方案：**

1. **清除浏览器缓存：**
   - Chrome: 设置 → 隐私和安全 → 清除浏览数据
   - 选择"缓存的图片和文件"
   - 时间范围选择"全部时间"

2. **使用无痕模式测试：**
   - 打开无痕/隐私浏览窗口
   - 重新尝试登录

3. **清除 Supabase 会话：**
   ```javascript
   // 在浏览器控制台执行
   localStorage.clear();
   sessionStorage.clear();
   ```

## 诊断步骤

### 步骤 1：检查控制台日志

打开浏览器开发者工具（F12），查看控制台输出：

```javascript
// 应该看到类似日志：
[OAuth] 开始 google 登录流程
[OAuth] 重定向 URI: http://localhost:5173/auth/callback
[OAuth] 获取到授权 URL，长度: 1234 字符
```

如果看到错误信息，记录错误详情。

### 步骤 2：检查网络请求

1. 打开开发者工具的 **Network** 标签
2. 尝试 Google 登录
3. 查找失败的请求（红色标记）
4. 查看请求详情：
   - **Request URL**: 检查 URL 是否过长或格式错误
   - **Status Code**: 确认是否为 400
   - **Response Headers**: 查看错误详情

### 步骤 3：验证 Supabase 配置

在浏览器控制台执行：

```javascript
// 检查 Supabase 配置
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '已配置' : '未配置');
```

### 步骤 4：测试 OAuth URL 生成

在浏览器控制台执行：

```javascript
// 测试 OAuth URL 生成（需要先导入 authService）
import { authService } from './src/services/authService';
const url = await authService.getOAuthUrl('google', 'http://localhost:5173/auth/callback');
console.log('OAuth URL:', url);
console.log('URL 长度:', url.length);
```

## 快速修复清单

- [ ] 检查并配置 Supabase 环境变量
- [ ] 在 Supabase Dashboard 配置正确的 Redirect URLs
- [ ] 在 Google Cloud Console 配置正确的回调 URL
- [ ] 检查代理设置，必要时关闭或配置绕过规则
- [ ] 清除浏览器缓存
- [ ] 检查 OAuth URL 长度（不应超过 2000 字符）
- [ ] 验证 Google OAuth 客户端配置
- [ ] 重启开发服务器

## 仍然无法解决？

如果以上方法都无法解决问题，请提供以下信息：

1. **错误截图**（包括浏览器控制台和网络请求）
2. **环境信息**：
   - 操作系统
   - 浏览器版本
   - 是否使用代理
   - 开发环境还是生产环境
3. **配置信息**（脱敏后）：
   - Supabase 项目 URL（不含密钥）
   - 使用的 Redirect URI
4. **控制台日志**（复制完整的错误信息）

## 相关文档

- [OAuth 登录功能完整指南](../features/OAuth登录功能完整指南.md)
- [OAuth 快速开始](../features/OAuth快速开始.md)
- [登录功能测试指南](../testing/登录功能测试指南.md)


