# Supabase Profiles 表 RLS 配置指南

## 问题描述

用户注册成功后，Authentication 中有用户信息，但 profiles 表为空，导致用户无法登录。

## 解决步骤

### 1. 后端代码已修复

已在 `server/controllers/authController.ts` 中添加了自动创建 profiles 记录的逻辑。

### 2. 配置 Supabase RLS 策略

**重要：** 必须在 Supabase 中执行以下 SQL 脚本，否则服务端无法向 profiles 表插入数据。

#### 方法一：使用 Supabase Dashboard（推荐）

1. 打开 Supabase Dashboard：https://supabase.com/dashboard/project/[你的项目ID]

2. 点击左侧菜单的 **SQL Editor**

3. 点击 **New query** 创建新查询

4. 复制并粘贴 `server/sql/profiles_rls_policies.sql` 中的内容

5. 点击 **Run** 执行 SQL

6. 确认执行成功（应该显示 "Success. No rows returned"）

#### 方法二：使用 Table Editor

1. 打开 Supabase Dashboard

2. 点击左侧菜单的 **Table Editor**

3. 选择 `profiles` 表

4. 点击右上角的 **⋮** 菜单，选择 **Edit Table**

5. 切换到 **RLS Policies** 标签

6. 点击 **New Policy** 按钮，根据 SQL 脚本内容手动添加策略

### 3. 验证配置

执行 SQL 后，验证策略是否生效：

1. 在 Table Editor 中查看 profiles 表

2. 点击 **RLS policies** 标签

3. 确认以下策略存在：
   - ✅ Service role can do anything
   - ✅ Anyone can view profiles
   - ✅ Users can update their own profile
   - ✅ Users can insert their own profile

### 4. 测试注册功能

1. 重启后端服务器：`npm run server:dev`

2. 在前端注册新用户

3. 检查 Supabase Dashboard：
   - **Authentication > Users**：应该有新用户
   - **Table Editor > profiles**：应该有对应的 profile 记录

4. 测试登录功能

## 常见问题

### Q: 执行 SQL 时报错 "permission denied for table profiles"

**A:** 确保你使用的是项目管理员账户，或者在 SQL Editor 中使用 service_role 权限执行。

### Q: RLS 策略创建成功，但 profiles 表仍然为空

**A:** 
1. 检查后端服务器是否使用了正确的 `SUPABASE_SERVICE_KEY`（不是 anon key）
2. 确认环境变量 `.env` 中的配置正确
3. 重启后端服务器

### Q: 如何删除旧的错误策略？

**A:** 
1. 在 Table Editor 中选择 profiles 表
2. 点击 RLS policies 标签
3. 点击策略右侧的 **⋮** 菜单，选择 **Delete**

## SQL 脚本内容

详见：`server/sql/profiles_rls_policies.sql`

```sql
-- 启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 服务端完全访问
CREATE POLICY "Service role can do anything"
  ON profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 所有人可读
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT TO authenticated, anon
  USING (true);

-- 用户可更新自己的
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 用户可插入自己的
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
```

## 完成检查清单

- [ ] 在 Supabase SQL Editor 中执行 RLS 策略脚本
- [ ] 验证 profiles 表的 RLS 策略已正确创建
- [ ] 确认后端环境变量配置正确（SUPABASE_SERVICE_KEY）
- [ ] 重启后端服务器
- [ ] 测试用户注册功能
- [ ] 检查 profiles 表是否自动创建了记录
- [ ] 测试用户登录功能

