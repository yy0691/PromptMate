-- ============================================
-- Profiles 表 RLS (Row Level Security) 策略
-- ============================================

-- 1. 启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. 允许服务端角色完全访问（用于注册时创建 profile）
CREATE POLICY "Service role can do anything"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. 允许用户读取所有 profiles（用于显示用户信息）
CREATE POLICY "Anyone can view profiles"
  ON profiles
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- 4. 允许用户更新自己的 profile
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 5. 允许用户插入自己的 profile（注册后补充信息）
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

