# 模板市场数据库表结构

## 前置要求

在执行以下 SQL 之前，请确保已经创建了 `profiles` 表。如果还没有创建，请先执行：

```sql
-- 创建 profiles 表（如果不存在）
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text,
  avatar_url text,
  role text DEFAULT 'user',
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);

-- 启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户可以查看和更新自己的 profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

## marketplace_prompts 表

用于存储公共提示词市场中的模板。

### 表结构

```sql
CREATE TABLE marketplace_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other',
  tags text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  view_count integer DEFAULT 0,
  download_count integer DEFAULT 0,
  review_comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 创建索引
CREATE INDEX idx_marketplace_prompts_status ON marketplace_prompts(status);
CREATE INDEX idx_marketplace_prompts_category ON marketplace_prompts(category);
CREATE INDEX idx_marketplace_prompts_user_id ON marketplace_prompts(user_id);
CREATE INDEX idx_marketplace_prompts_created_at ON marketplace_prompts(created_at DESC);
CREATE INDEX idx_marketplace_prompts_tags ON marketplace_prompts USING GIN(tags);

-- 更新updated_at的触发器
CREATE OR REPLACE FUNCTION update_marketplace_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marketplace_prompts_updated_at
  BEFORE UPDATE ON marketplace_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_marketplace_prompts_updated_at();
```

### Row Level Security (RLS) 策略

**重要：** 以下策略依赖 `profiles` 表。如果还没有创建 `profiles` 表，请先执行上面的"前置要求"部分的 SQL。

如果需要简化版本（不依赖管理员功能），请使用下面的"简化版 RLS 策略"。

#### 完整版 RLS 策略（推荐）

```sql
-- 启用RLS
ALTER TABLE marketplace_prompts ENABLE ROW LEVEL SECURITY;

-- 所有用户都可以查看已审核通过的提示词
CREATE POLICY "Anyone can view approved prompts"
  ON marketplace_prompts
  FOR SELECT
  USING (status = 'approved');

-- 管理员可以查看所有提示词
CREATE POLICY "Admins can view all prompts"
  ON marketplace_prompts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'administrator' OR profiles.is_admin = true)
    )
  );

-- 用户可以查看自己上传的提示词（无论状态）
CREATE POLICY "Users can view their own prompts"
  ON marketplace_prompts
  FOR SELECT
  USING (user_id = auth.uid());

-- 登录用户可以上传提示词
CREATE POLICY "Authenticated users can insert prompts"
  ON marketplace_prompts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的提示词
CREATE POLICY "Users can update their own prompts"
  ON marketplace_prompts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 管理员可以更新任何提示词
CREATE POLICY "Admins can update any prompt"
  ON marketplace_prompts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'administrator' OR profiles.is_admin = true)
    )
  );

-- 用户可以删除自己的提示词
CREATE POLICY "Users can delete their own prompts"
  ON marketplace_prompts
  FOR DELETE
  USING (user_id = auth.uid());

-- 管理员可以删除任何提示词
CREATE POLICY "Admins can delete any prompt"
  ON marketplace_prompts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'admin' OR profiles.role = 'administrator' OR profiles.is_admin = true)
    )
  );
```

#### 简化版 RLS 策略（不依赖管理员功能）

如果暂时不需要管理员功能，可以使用以下简化版策略：

```sql
-- 启用RLS
ALTER TABLE marketplace_prompts ENABLE ROW LEVEL SECURITY;

-- 所有用户都可以查看已审核通过的提示词
CREATE POLICY "Anyone can view approved prompts"
  ON marketplace_prompts
  FOR SELECT
  USING (status = 'approved');

-- 用户可以查看自己上传的提示词（无论状态）
CREATE POLICY "Users can view their own prompts"
  ON marketplace_prompts
  FOR SELECT
  USING (user_id = auth.uid());

-- 登录用户可以上传提示词
CREATE POLICY "Authenticated users can insert prompts"
  ON marketplace_prompts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的提示词
CREATE POLICY "Users can update their own prompts"
  ON marketplace_prompts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 用户可以删除自己的提示词
CREATE POLICY "Users can delete their own prompts"
  ON marketplace_prompts
  FOR DELETE
  USING (user_id = auth.uid());
```

**注意：** 使用简化版策略时，管理员功能将不可用。如果需要管理员审核功能，请使用完整版策略。

### profiles 表扩展（如果已存在 profiles 表）

如果 `profiles` 表已经存在但没有 `role` 和 `is_admin` 字段，可以执行以下 SQL 添加：

```sql
-- 添加角色字段（如果不存在）
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user',
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);
```

### 设置管理员

将某个用户设置为管理员：

```sql
-- 方法1：通过 role 字段
UPDATE profiles 
SET role = 'admin' 
WHERE id = '用户ID';

-- 方法2：通过 is_admin 字段
UPDATE profiles 
SET is_admin = true 
WHERE id = '用户ID';
```

### 分类枚举值

建议的分类值：
- `creative` - 创意
- `productivity` - 效率
- `development` - 开发
- `education` - 教育
- `business` - 商务
- `other` - 其他

### 状态说明

- `pending` - 待审核（新上传的提示词）
- `approved` - 已审核通过（可以在市场显示）
- `rejected` - 已拒绝（不会在市场显示）

