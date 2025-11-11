# PromptMate 后端部署检查清单

本文档列出了部署 PromptMate 账号与数据同步服务时需要逐项确认的任务，确保浏览器插件和桌面端能够通过 `promptmate.luoyuanai.cn` 访问完全可用的 Supabase 后端。

## 1. Supabase 项目准备

- [ ] 创建 Supabase 项目，并记录 `Project URL` 与 `anon`、`service_role` 密钥。
- [ ] 在 **Authentication → Providers** 中启用邮箱、Google、GitHub 登录：
  - 填写 OAuth 回调地址：`https://promptmate.luoyuanai.cn/auth/callback` 与 `https://staging.promptmate.luoyuanai.cn/auth/callback`。
  - 在本地调试时可额外添加 `http://localhost:8787/auth/callback`。
- [ ] 在 **Authentication → URL Configuration** 中设置 `Site URL` 为 `https://promptmate.luoyuanai.cn`，并补充允许的重定向域（含 staging 与本地调试地址）。
- [ ] 确认启用了邮箱验证 (Confirm email) 并配置邮件模板。

## 2. 数据库结构与策略

1. 通过 SQL Editor 创建所需表：
   ```sql
   create table if not exists profiles (
     id uuid primary key references auth.users(id) on delete cascade,
     nickname text,
     avatar_url text,
     created_at timestamptz default now(),
     updated_at timestamptz default now()
   );

   create table if not exists prompt_collections (
     id uuid primary key default gen_random_uuid(),
     user_id uuid references auth.users(id) on delete cascade,
     title text not null,
     description text,
     created_at timestamptz default now(),
     updated_at timestamptz default now()
   );

   create table if not exists prompts (
     id uuid primary key default gen_random_uuid(),
     user_id uuid references auth.users(id) on delete cascade,
     collection_id uuid references prompt_collections(id) on delete cascade,
     title text not null,
     content_ciphertext text not null,
     content_nonce text not null,
     tags jsonb default '[]'::jsonb,
     created_at timestamptz default now(),
     updated_at timestamptz default now()
   );

   create table if not exists client_devices (
     id uuid primary key,
     user_id uuid references auth.users(id) on delete cascade,
     device_type text,
     app_version text,
     last_synced_at timestamptz,
     sync_cursor bigint,
     updated_at timestamptz default now()
   );

   create table if not exists sync_events (
     id bigserial primary key,
     user_id uuid references auth.users(id) on delete cascade,
     entity_type text not null,
     entity_id text not null,
     operation text not null,
     payload_ciphertext text,
     payload_nonce text,
     created_at timestamptz default now()
   );

   create table if not exists audit_logs (
     id bigserial primary key,
     user_id uuid references auth.users(id),
     action text not null,
     metadata jsonb,
     created_at timestamptz default now()
   );
   ```
2. 为上述业务表开启 Row Level Security (RLS)：
   ```sql
   alter table profiles enable row level security;
   alter table prompt_collections enable row level security;
   alter table prompts enable row level security;
   alter table client_devices enable row level security;
   alter table sync_events enable row level security;
   alter table audit_logs enable row level security;
   ```
3. 添加策略，确保用户仅能访问自己的数据。例如：
   ```sql
   create policy "profiles own records" on profiles
     for all using (auth.uid() = id) with check (auth.uid() = id);

   create policy "collections by owner" on prompt_collections
     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

   create policy "prompts by owner" on prompts
     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

   create policy "devices by owner" on client_devices
     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

   create policy "sync events by owner" on sync_events
     for select using (auth.uid() = user_id);

   create policy "audit logs service" on audit_logs
     for insert with check (auth.role() = 'service_role');
   ```
   > 其中 `audit_logs` 表通常只允许 service role 写入，可视需求添加只读策略供后端受保护访问。

## 3. 自定义域与网络

- [ ] 在 DNS 中将 `promptmate.luoyuanai.cn` 指向后端服务器 IP，或通过反向代理转发到运行中的 Node.js 服务。
- [ ] 如需保留 `api.promptmate.com` 域名，可配置 CNAME 解析至 `promptmate.luoyuanai.cn`。
- [ ] 申请 TLS 证书（推荐使用 Let’s Encrypt），并在反向代理层开启 HSTS。
- [ ] 若使用 Cloudflare / 阿里云 WAF，请将 `/api/*` 路径加入白名单规则，避免 Supabase 回调被阻断。

## 4. 服务端环境

1. 复制环境变量模板并填写 Supabase 相关配置：
   ```bash
   cp server/.env.example server/.env
   ```
2. 修改 `server/.env`：
   ```env
   PORT=8787
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   CORS_ORIGINS=https://promptmate.luoyuanai.cn,https://staging.promptmate.luoyuanai.cn,chrome-extension://*
   AUDIT_ADMIN_SECRET=<custom-admin-secret>
   ```
3. 构建与启动：
   ```bash
   npm install
   npm run server:build
   npm run server:start
   ```
4. 若以 PM2 或 systemd 部署，请将服务设置为随系统启动，并开启日志轮转。

## 5. 客户端联调前的自测

- [ ] 使用 `curl` 或 Postman 调用 `POST /api/auth/register/email` 与 `POST /api/auth/login/email`，验证 Supabase 流程。
- [ ] 调用 `POST /api/sync/push`、`GET /api/sync/pull`，确认同步事件能够写入并读取。
- [ ] 使用 `POST /api/devices/heartbeat` 更新设备状态，并在 `client_devices` 表中查看记录。
- [ ] 通过 `GET /api/security/audit-logs` 并附带 `X-Admin-Secret` 请求头，检查审计日志访问权限。
- [ ] 确认数据库中存储的提示词内容已由客户端加密（只出现密文与 nonce）。

完成以上步骤后，即可将浏览器插件与桌面端指向 `https://promptmate.luoyuanai.cn`，实现统一的账号登录与数据同步能力。更多 API 细节可参考《[账号与数据同步接口文档](./auth-sync-interface.md)》。
