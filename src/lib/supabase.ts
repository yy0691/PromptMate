import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('CRITICAL: Supabase URL or Anon Key is missing! OAuth features WILL FAIL.');
}

// 防止页面白屏崩溃：如果没有 URL，使用占位符 (会导致 Auth 调用失败但页面能加载)
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
);
