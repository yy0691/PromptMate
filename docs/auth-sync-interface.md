# PromptMate 账号与数据同步接口文档

## 1. 概述

本文档定义 PromptMate 浏览器插件版与桌面软件版共享的账户体系与数据同步接口。接口基于 [Supabase](https://supabase.com/) 提供的认证与数据库能力，所有客户端需通过 HTTPS 访问。本设计确保：

- 支持邮箱注册/登录以及谷歌、GitHub 等第三方登录。
- 登录成功后的账号拥有统一的数据同步能力，可跨终端同步 PromptMate 用户的提示词与设置。
- 用户敏感数据需在客户端加密后再存储到 Supabase，保证数据安全。

## 2. 系统架构

```
浏览器插件 / 桌面客户端
        │
        │  HTTPS REST API
        ▼
PromptMate 后端服务 (Node.js + Supabase SDK)
        │
        │  Supabase REST/RPC & Realtime
        ▼
Supabase 项目 (Auth + Postgres + Storage)
```

- **客户端**：浏览器插件、桌面软件，共享同一套 API。
- **后端服务**：统一封装 Supabase API，处理业务逻辑、审计日志、速率限制。
- **Supabase**：提供身份验证、Postgres 数据库存储、对象存储及实时通知。

## 3. 环境与基础信息

| 环境 | Base URL | Supabase Project Ref | 备注 |
| ---- | -------- | -------------------- | ---- |
| 开发 | `https://api-dev.promptmate.com` | `dev-xxxxx` | 使用 Supabase 开发项目，启用日志输出。 |
| 预发布 | `https://staging.promptmate.luoyuanai.cn` | `stage-xxxxx` | 与生产配置一致，用于回归与端到端测试。 |
| 生产 | `https://promptmate.luoyuanai.cn` | `prod-xxxxx` | 作为数据库存储/转发主域，开启 WAF、防火墙及速率限制。 |

> **说明**：`https://promptmate.luoyuanai.cn` 作为统一后端域名，也可通过 `api.promptmate.com` 配置 CNAME 指向，便于迁移或多地区部署。

所有接口均要求请求头包含：

- `Content-Type: application/json`
- `Accept: application/json`
- 若需身份验证，则添加 `Authorization: Bearer <JWT>`（使用 Supabase Auth 的 access token）。

## 4. 认证流程

### 4.1 邮箱注册登录

1. 客户端调用 `POST /api/auth/register/email` 提交邮箱、密码、昵称。
2. 后端调用 Supabase `auth.signUp()` 创建用户并触发验证邮件。
3. 用户通过邮箱验证后，可使用 `POST /api/auth/login/email` 登录获取访问令牌。
4. 后端返回 Supabase access token、refresh token 以及用户 profile。

### 4.2 第三方登录（Google / GitHub）

- 客户端调用 `GET /api/auth/oauth/url?provider=google`（或 `github`），获取 Supabase OAuth 授权地址。
- 用户在浏览器完成 OAuth 授权后，Supabase 将重定向到配置的回调地址，携带 `code`。
- 客户端或后端使用 `code` 调用 `POST /api/auth/oauth/callback` 交换 access token、refresh token。
- 后端将 Supabase 的 JWT 返回给客户端，并创建/更新用户 profile。

### 4.3 Token 刷新

- 客户端使用 `POST /api/auth/token/refresh`，提交 refresh token。
- 后端调用 Supabase `auth.refreshSession()`，返回新的 access token 与 refresh token。

### 4.4 退出登录

- `POST /api/auth/logout`，后端调用 Supabase `auth.signOut()` 使当前 session 失效。

## 5. 数据模型

### 5.1 数据库表结构（Postgres）

| 表名 | 说明 | 关键字段 |
| ---- | ---- | -------- |
| `profiles` | 用户扩展信息 | `id (uuid, 与 auth.users 同步)`, `nickname`, `avatar_url`, `created_at`, `updated_at` |
| `prompt_collections` | 用户提示词集合 | `id (uuid)`, `user_id`, `title`, `description`, `created_at`, `updated_at` |
| `prompts` | 具体提示词项 | `id (uuid)`, `collection_id`, `user_id`, `title`, `content_ciphertext`, `content_nonce`, `tags`, `updated_at` |
| `client_devices` | 设备信息与同步状态 | `id (uuid)`, `user_id`, `device_type`, `app_version`, `last_synced_at`, `sync_cursor` |
| `sync_events` | 变更日志（CDC） | `id (bigint)`, `user_id`, `entity_type`, `entity_id`, `operation`, `created_at`, `payload_ciphertext`, `payload_nonce` |

> 所有业务表均通过 Row Level Security (RLS) 策略，确保用户只能访问自身数据。

### 5.2 加密方案

- **密钥生成**：
  - 邮箱登录：用户首次登录时，由客户端使用 `PBKDF2` 对密码派生对称密钥 `K_user`（增加随机 `salt`，客户端安全存储）。
  - OAuth 登录：客户端提示用户设置用于加密的独立口令，或使用本地安全模块生成密钥并加密存储在设备安全区。
- **加密算法**：`AES-256-GCM`。
- **存储字段**：
  - 每条敏感数据存储 `content_ciphertext`（密文）与 `content_nonce`（随机数）。
  - `payload_ciphertext` 与 `payload_nonce` 用于同步事件。
- **备份恢复**：
  - 允许用户导出密钥或通过主密码恢复。
  - 密钥永不上传到服务器；后端无法解密用户数据。

## 6. REST API 设计

### 6.1 Auth

#### `POST /api/auth/register/email`
- **描述**：邮箱注册。
- **请求体**：
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassw0rd!",
    "nickname": "Alice"
  }
  ```
- **响应**：
  ```json
  {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "nickname": "Alice"
    },
    "session": null,
    "email_confirmed": false
  }
  ```
- **备注**：返回 `email_confirmed=false`，客户端提示用户前往邮箱完成验证。

#### `POST /api/auth/login/email`
- **描述**：邮箱密码登录。
- **请求体**：
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassw0rd!"
  }
  ```
- **响应**：
  ```json
  {
    "access_token": "jwt",
    "refresh_token": "refresh-jwt",
    "expires_in": 3600,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "nickname": "Alice"
    }
  }
  ```

#### `GET /api/auth/oauth/url`
- **描述**：获取第三方登录授权地址。
- **查询参数**：`provider`（枚举：`google`、`github`）、`redirect_uri`。
- **响应**：
  ```json
  {
    "url": "https://..."
  }
  ```

#### `POST /api/auth/oauth/callback`
- **描述**：用授权码换取 token。
- **请求体**：
  ```json
  {
    "provider": "google",
    "code": "auth-code",
    "redirect_uri": "promptmate://oauth"
  }
  ```
- **响应**：与邮箱登录相同。

#### `POST /api/auth/token/refresh`
- **请求体**：
  ```json
  {
    "refresh_token": "refresh-jwt"
  }
  ```
- **响应**：新的 access token、refresh token。

#### `POST /api/auth/logout`
- **描述**：退出登录，使当前会话失效。

### 6.2 用户资料

#### `GET /api/profile`
- **描述**：获取当前用户资料。
- **鉴权**：需要 Bearer Token。
- **响应**：
  ```json
  {
    "id": "uuid",
    "email": "user@example.com",
    "nickname": "Alice",
    "avatar_url": "https://..."
  }
  ```

#### `PATCH /api/profile`
- **描述**：更新昵称、头像等。
- **请求体**：
  ```json
  {
    "nickname": "Alice",
    "avatar_url": "https://..."
  }
  ```

### 6.3 提示词管理

#### `GET /api/prompts`
- **描述**：获取用户的提示词列表，可按集合过滤。
- **查询参数**：`collection_id`、`updated_after`。
- **响应**：
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "collection_id": "uuid",
        "title": "写作助手",
        "content_ciphertext": "...",
        "content_nonce": "...",
        "tags": ["writing"],
        "updated_at": "2024-06-01T12:00:00Z"
      }
    ]
  }
  ```

#### `POST /api/prompts`
- **描述**：创建新的提示词。
- **请求体**：
  ```json
  {
    "collection_id": "uuid",
    "title": "写作助手",
    "content_ciphertext": "...",
    "content_nonce": "...",
    "tags": ["writing"]
  }
  ```

#### `PATCH /api/prompts/{id}`
- 更新提示词标题、密文内容、标签。

#### `DELETE /api/prompts/{id}`
- 删除指定提示词。

### 6.4 集合管理

- `GET /api/prompt-collections`
- `POST /api/prompt-collections`
- `PATCH /api/prompt-collections/{id}`
- `DELETE /api/prompt-collections/{id}`

### 6.5 数据同步

#### `GET /api/sync/pull`
- **描述**：拉取自上次同步后的变更。
- **查询参数**：`cursor`（上次 `sync_events.id`）。
- **响应**：
  ```json
  {
    "events": [
      {
        "id": 101,
        "entity_type": "prompt",
        "entity_id": "uuid",
        "operation": "UPSERT",
        "payload_ciphertext": "...",
        "payload_nonce": "...",
        "created_at": "2024-06-01T12:00:00Z"
      }
    ],
    "next_cursor": 101
  }
  ```

#### `POST /api/sync/push`
- **描述**：推送本地新增/更新/删除的数据，供其他设备同步。
- **请求体**：
  ```json
  {
    "device_id": "uuid",
    "events": [
      {
        "entity_type": "prompt",
        "entity_id": "uuid",
        "operation": "UPSERT",
        "payload_ciphertext": "...",
        "payload_nonce": "...",
        "updated_at": "2024-06-01T12:00:00Z"
      }
    ]
  }
  ```
- **响应**：返回已落库事件的 `id` 与新的 `sync_cursor`。

#### `POST /api/devices/heartbeat`
- **描述**：上报设备在线状态、应用版本、最近同步时间。

### 6.6 审计与安全

- `GET /api/security/audit-logs`：管理员查询。
- 所有接口需记录请求来源、user_id、设备类型。

## 7. 错误码与响应规范

| 状态码 | 描述 | 备注 |
| ------ | ---- | ---- |
| 200 | 请求成功 | `data` 字段包含具体内容。 |
| 201 | 创建成功 | 返回新建资源 ID。 |
| 204 | 删除成功，无内容返回。 | |
| 400 | 参数错误 | 返回 `error.code = "INVALID_PARAMS"`。 |
| 401 | 未授权 | Token 过期或无效。 |
| 403 | 权限不足 | 违反 RLS 或访问他人数据。 |
| 404 | 资源不存在 | |
| 409 | 冲突 | 例如重复注册邮箱。 |
| 429 | 触发速率限制 | |
| 500 | 服务器错误 | 记录详细日志。 |

错误响应示例：
```json
{
  "error": {
    "code": "INVALID_PARAMS",
    "message": "email is required"
  }
}
```

## 8. 安全要求

1. **传输安全**：所有接口必须通过 HTTPS，并启用 HSTS。
2. **鉴权**：使用 Supabase JWT，后端验证并检查 RLS 策略。
3. **速率限制**：
   - `POST /api/auth/*`：每个 IP 每分钟不超过 10 次。
   - 其他写接口：每个用户每分钟不超过 60 次。
4. **审计日志**：关键操作写入 `audit_logs` 表，记录 `user_id`、`action`、`metadata`。
5. **数据加密**：客户端侧加密敏感数据，服务端只存储密文。
6. **密钥管理**：客户端需定期提醒用户备份密钥，提供导出与恢复流程。

## 9. 客户端实现建议

- **浏览器插件**：
  - 使用 Supabase JavaScript SDK 获取 OAuth 授权地址并处理回调。
  - 将 access token 保存于浏览器 `chrome.storage.session`，refresh token 加密后存储在 `chrome.storage.local`。
  - 使用 IndexedDB 缓存最近的提示词，采用乐观更新策略。

- **桌面软件**：
  - 建议使用 Electron + Supabase JS 或原生 SDK。
  - refresh token 存储在系统安全存储（Keychain、Credential Manager）。
  - 支持离线模式，恢复网络后执行 `sync/push` 与 `sync/pull`。

## 10. 日志与监控

- 关键指标：注册转化率、每日活跃设备数、同步成功率、OAuth 错误率。
- 使用 Supabase Logs + 自建 Prometheus/Grafana 监控接口延迟与错误。
- 实现告警：Token 刷新失败率超过阈值、同步推送失败次数异常等。

## 11. 变更记录

| 版本 | 日期 | 说明 |
| ---- | ---- | ---- |
| v1.0 | 2024-06-02 | 初始版本，定义认证、同步、加密要求。 |
