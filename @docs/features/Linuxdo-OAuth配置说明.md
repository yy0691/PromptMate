# Linuxdo OAuth 回调地址配置说明

## 📋 回调地址设置

Linuxdo 使用独立的 OAuth 授权服务，回调地址需要直接指向你的应用，而不是 Supabase。

### Web 环境回调地址

**开发环境：**
```
http://localhost:5173/auth/callback
```

**生产环境：**
```
https://your-domain.com/auth/callback
```

例如，如果你的域名是 `promptmate.vercel.app`，则回调地址为：
```
https://promptmate.vercel.app/auth/callback
```

### Electron 环境回调地址

**Electron 应用：**
```
promptmate://oauth
```

## 🔧 在 Linux.do 中配置回调地址

### 步骤 1: 访问 Linux.do OAuth 应用管理

1. 登录 Linux.do 账号
2. 访问 OAuth 应用管理页面（通常在用户设置或开发者设置中）
3. 找到你的 OAuth 应用或创建新应用

### 步骤 2: 设置回调 URL

在 OAuth 应用的配置中，设置 **Redirect URI** 或 **Callback URL**：

#### 开发环境配置

如果只在本地测试，设置：
```
http://localhost:5173/auth/callback
```

#### 生产环境配置

如果部署到生产环境，设置：
```
https://your-domain.com/auth/callback
```

#### 同时支持开发和生产

如果需要在开发和生产环境都能使用，可以设置多个回调地址（如果 Linux.do 支持）：
```
http://localhost:5173/auth/callback
https://your-domain.com/auth/callback
promptmate://oauth
```

**注意：** 如果 Linux.do 只支持单个回调地址，建议：
- 开发时使用开发地址
- 生产时使用生产地址
- 或者使用环境变量动态配置

## 📝 完整配置示例

### 开发环境

在 Linux.do OAuth 应用中配置：

```
应用名称: PromptMate (开发)
回调 URL: http://localhost:5173/auth/callback
```

### 生产环境

在 Linux.do OAuth 应用中配置：

```
应用名称: PromptMate (生产)
回调 URL: https://promptmate.vercel.app/auth/callback
```

### Vercel 部署

如果使用 Vercel 部署，回调地址应该是：

```
https://your-project.vercel.app/auth/callback
```

或者如果你配置了自定义域名：

```
https://your-custom-domain.com/auth/callback
```

## ⚠️ 重要提示

1. **回调地址必须完全匹配**
   - 回调地址必须与代码中构建的 `redirectUri` 完全一致
   - 包括协议（http/https）、域名、端口、路径

2. **开发和生产环境**
   - 开发环境使用 `http://localhost:5173/auth/callback`
   - 生产环境使用 `https://your-domain.com/auth/callback`
   - 确保在 Linux.do 中配置了正确的回调地址

3. **Electron 应用**
   - Electron 使用自定义协议 `promptmate://oauth`
   - 这个协议需要在 Electron 应用中注册
   - Linux.do 可能不支持自定义协议，需要确认

4. **测试回调地址**
   - 使用测试工具验证回调地址是否正确
   - 检查浏览器控制台的错误信息
   - 确认授权后能正确跳转

## 🔍 验证配置

### 检查回调地址是否正确

1. 打开浏览器开发者工具（F12）
2. 点击 Linux.do 登录按钮
3. 完成授权后，检查 URL 是否跳转到：
   ```
   http://localhost:5173/auth/callback?code=xxx
   ```
4. 如果跳转失败或显示错误，检查回调地址配置

### 常见错误

**错误：`redirect_uri_mismatch`**
- **原因：** Linux.do 中配置的回调地址与请求时的不一致
- **解决：** 确保 Linux.do 中的回调地址与代码中的完全一致

**错误：`invalid_client`**
- **原因：** Client ID 或 Client Secret 配置错误
- **解决：** 检查环境变量中的 `LINUXDO_CLIENT_ID` 和 `LINUXDO_CLIENT_SECRET`

## 🔄 多回调地址支持（Web + Electron）

在生产环境中，PromptMate 有 Web 和 Electron 两个版本，但 Linux.do 可能只支持单个回调地址。

### 解决方案：中间代理页面

我们使用中间代理页面统一处理回调，然后根据运行环境分发：

1. **在 Linux.do 中只配置一个回调地址**：
   ```
   https://your-domain.com/auth/callback
   ```

2. **回调页面自动检测环境**：
   - Web 环境：正常处理回调
   - Electron 环境：转发到 `promptmate://oauth` 协议

3. **代码已自动处理**：
   - `AuthCallback.tsx` 会自动检测 Electron 环境
   - 如果是 Electron + Linuxdo，会自动转发到自定义协议

### 配置步骤

1. 在 Linux.do 中配置回调地址为：`https://your-domain.com/auth/callback`
2. 无需额外配置，代码会自动处理 Web 和 Electron 两种情况

详细说明请参考：[生产环境多回调地址配置方案](./生产环境多回调地址配置方案.md)

## 📚 相关文档

- [OAuth 登录功能完整指南](./OAuth登录功能完整指南.md)
- [登录功能测试指南](../testing/登录功能测试指南.md)
- [生产环境多回调地址配置方案](./生产环境多回调地址配置方案.md)

