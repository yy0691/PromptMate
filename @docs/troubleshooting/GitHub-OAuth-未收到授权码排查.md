# GitHub OAuth "未收到授权码" 错误排查指南

## 问题描述

在使用 GitHub OAuth 登录时，遇到错误：
```
OAuth 回调处理失败: Error: 未收到授权码，请重试
```

## 常见原因及解决方案

### 1. Supabase Redirect URLs 配置不正确

**症状：**
- 回调页面加载但无法获取授权码
- 控制台显示"未收到授权码"

**解决方案：**

1. **检查 Supabase Dashboard 配置：**
   - 登录 [Supabase Dashboard](https://supabase.com/dashboard)
   - 进入你的项目
   - 导航到 **Authentication** → **URL Configuration**
   - 在 **Redirect URLs** 中添加：
     ```
     http://localhost:5173/auth/callback
     http://127.0.0.1:5173/auth/callback
     https://your-domain.com/auth/callback
     promptmate://oauth  (如果是 Electron 应用)
     ```
   - 点击 **Save**

2. **验证配置：**
   - 确保 URL 完全匹配（包括协议、域名、端口、路径）
   - 注意大小写敏感
   - 确保没有多余的斜杠或空格

### 2. GitHub OAuth App 回调 URL 配置错误

**症状：**
- GitHub 授权页面显示错误
- 授权后无法正确回调

**解决方案：**

1. **检查 GitHub OAuth App 配置：**
   - 访问 [GitHub Settings](https://github.com/settings/developers) → **Developer settings** → **OAuth Apps**
   - 找到你的 OAuth App
   - 检查 **Authorization callback URL**：
     ```
     https://your-project.supabase.co/auth/v1/callback
     ```
   - **注意**：这里必须是 Supabase 的回调 URL，不是你的前端 URL

2. **更新回调 URL：**
   - 如果回调 URL 不正确，点击 **Edit** 修改
   - 保存更改
   - 等待几分钟让更改生效

### 3. 弹窗流程问题

**症状：**
- 在新标签页中完成授权，但父窗口收不到消息
- 控制台显示消息事件但没有授权码

**解决方案：**

1. **检查浏览器控制台：**
   - 打开浏览器开发者工具（F12）
   - 查看控制台日志，应该看到：
     ```
     [OAuth] 收到消息事件: {...}
     [OAuth] 收到 OAuth 回调消息: {...}
     ```

2. **检查消息传递：**
   - 确保回调页面和父窗口在同一域名下
   - 检查是否有 CORS 错误
   - 确保浏览器允许弹窗（不要阻止弹窗）

3. **尝试直接跳转模式：**
   - 如果弹窗模式有问题，可以临时修改代码使用直接跳转
   - 在 `AuthDialog.tsx` 中，将 `window.open(oauthUrl, '_blank')` 改为 `window.location.href = oauthUrl`

### 4. Supabase GitHub Provider 未正确配置

**症状：**
- Supabase 中 GitHub 提供商未启用或配置错误

**解决方案：**

1. **检查 Supabase GitHub 配置：**
   - 登录 Supabase Dashboard
   - 进入 **Authentication** → **Providers**
   - 找到 **GitHub** 提供商
   - 确保已启用（**Enable** 开关打开）

2. **配置 GitHub OAuth App 凭据：**
   - 在 GitHub 中创建 OAuth App（如果还没有）
   - 获取 **Client ID** 和 **Client Secret**
   - 在 Supabase 的 GitHub 提供商配置中填入：
     - **Client ID (for OAuth)**: 你的 GitHub Client ID
     - **Client Secret (for OAuth)**: 你的 GitHub Client Secret
   - 点击 **Save**

3. **验证配置：**
   - 确保 Client ID 和 Secret 正确
   - 确保没有多余的空格或换行

### 5. 环境变量配置问题

**症状：**
- 控制台显示 Supabase 配置缺失
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

### 6. 浏览器缓存或 Cookie 问题

**症状：**
- 之前登录过，现在无法登录
- 浏览器缓存了错误的配置

**解决方案：**

1. **清除浏览器缓存：**
   - Chrome: 设置 → 隐私和安全 → 清除浏览数据
   - 选择"缓存的图片和文件"和"Cookie 及其他网站数据"
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

打开浏览器开发者工具（F12），查看控制台输出。你应该看到：

```javascript
[OAuth] 开始 github 登录流程
[OAuth] 重定向 URI: http://localhost:5173/auth/callback
[OAuth] 获取到授权 URL，长度: 1234 字符
[OAuth Callback] 开始处理回调
[OAuth Callback] 当前 URL: http://localhost:5173/auth/callback?code=...
[OAuth Callback] 提取的参数: { code: '...', provider: 'github', ... }
```

如果看到"未收到授权码"，检查：
- URL 中是否包含 `code` 参数
- Hash 中是否包含 `code` 参数
- 是否有错误信息

### 步骤 2：检查网络请求

1. 打开开发者工具的 **Network** 标签
2. 尝试 GitHub 登录
3. 查找相关的请求：
   - 查找对 `/auth/callback` 的请求
   - 查看请求 URL 中是否包含 `code` 参数
   - 查看响应内容

### 步骤 3：检查回调 URL

在浏览器地址栏查看回调页面的完整 URL：

```
http://localhost:5173/auth/callback?code=xxx&state=yyy
```

或者：

```
http://localhost:5173/auth/callback#code=xxx&state=yyy
```

确保 URL 中包含 `code` 参数。

### 步骤 4：验证 Supabase 配置

在浏览器控制台执行：

```javascript
// 检查 Supabase 配置
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '已配置' : '未配置');
```

### 步骤 5：测试 OAuth URL 生成

在浏览器控制台执行：

```javascript
// 测试 OAuth URL 生成（需要先导入 authService）
import { authService } from './src/services/authService';
const url = await authService.getOAuthUrl('github', 'http://localhost:5173/auth/callback');
console.log('OAuth URL:', url);
```

点击生成的 URL，检查是否能正确跳转到 GitHub 授权页面。

## 快速修复清单

- [ ] 在 Supabase Dashboard 配置正确的 Redirect URLs
- [ ] 在 GitHub OAuth App 配置正确的回调 URL（必须是 Supabase 的回调 URL）
- [ ] 确保 Supabase 中 GitHub 提供商已启用并配置了正确的 Client ID 和 Secret
- [ ] 检查并配置 Supabase 环境变量
- [ ] 清除浏览器缓存和 Cookie
- [ ] 检查浏览器控制台日志，查看详细的错误信息
- [ ] 验证回调 URL 中是否包含 `code` 参数
- [ ] 重启开发服务器

## 常见错误模式

### 错误 1：回调 URL 不匹配

**症状：**
```
未收到授权码，请重试
```

**原因：**
- Supabase Redirect URLs 中没有包含当前的回调 URL
- GitHub OAuth App 的回调 URL 配置错误

**解决：**
- 检查并更新 Supabase 和 GitHub 的配置

### 错误 2：弹窗消息传递失败

**症状：**
- 在新标签页中完成授权，但父窗口没有反应
- 控制台没有收到消息事件

**原因：**
- 浏览器阻止了跨窗口消息传递
- 回调页面和父窗口不在同一域名

**解决：**
- 确保使用同一域名
- 检查浏览器安全设置
- 尝试直接跳转模式

### 错误 3：Supabase 配置缺失

**症状：**
```
Supabase 配置缺失。请检查 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 环境变量。
```

**原因：**
- 环境变量未配置或配置错误

**解决：**
- 检查 `.env.local` 文件
- 重启开发服务器

## 仍然无法解决？

如果以上方法都无法解决问题，请提供以下信息：

1. **错误截图**（包括浏览器控制台和网络请求）
2. **环境信息：**
   - 操作系统
   - 浏览器版本
   - 开发环境还是生产环境
3. **配置信息**（脱敏后）：
   - Supabase 项目 URL（不含密钥）
   - 使用的 Redirect URI
   - GitHub OAuth App 的回调 URL
4. **控制台日志**（复制完整的错误信息和诊断日志）
5. **回调 URL**（完整的回调页面 URL，脱敏授权码）

## 相关文档

- [OAuth 登录功能完整指南](../features/OAuth登录功能完整指南.md)
- [OAuth 快速开始](../features/OAuth快速开始.md)
- [Google OAuth 400 错误排查](./Google-OAuth-400错误排查.md)


