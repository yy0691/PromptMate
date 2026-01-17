/**
 * 认证服务
 * 封装用户登录、注册、OAuth等API调用
 */

import { supabase } from '../lib/supabase';

// API基础URL配置
// 在生产环境使用相对路径（同域），开发环境使用本地服务器
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:8787');

// OAuth 提供商类型
export type OAuthProvider = 'google' | 'github' | 'linuxdo';

export interface User {
  id: string;
  email: string;
  nickname: string | null;
  avatar_url?: string | null;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

export interface RegisterResponse {
  user: User;
  session: any | null;
  email_confirmed: boolean;
}

export interface OAuthUrlResponse {
  url: string;
}

class AuthService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * 邮箱注册
   */
  async registerWithEmail(email: string, password: string, nickname: string): Promise<RegisterResponse> {
    const response = await fetch(`${this.baseURL}/api/auth/register/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, nickname }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '注册失败' }));
      throw new Error(error.message || '注册失败');
    }

    return response.json();
  }

  /**
   * 邮箱登录
   */
  async loginWithEmail(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${this.baseURL}/api/auth/login/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '登录失败' }));
      throw new Error(error.message || '登录失败');
    }

    return response.json();
  }

  /**
   * 获取OAuth授权URL
   */
  async getOAuthUrl(provider: OAuthProvider, redirectUri: string): Promise<string> {
    // Linuxdo 依然走后端 API
    if (provider === 'linuxdo') {
      const response = await fetch(
        `${this.baseURL}/api/auth/oauth/url?provider=${provider}&redirect_uri=${encodeURIComponent(redirectUri)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: '获取授权URL失败' }));
        throw new Error(error.message || '获取授权URL失败');
      }

      const data: OAuthUrlResponse = await response.json();
      return data.url;
    }

    // Google / GitHub 走 Supabase SDK
    try {
      // 检查 Supabase 配置
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase 配置缺失。请检查 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 环境变量。');
      }

      // 在 redirect_uri 中添加 provider 参数，方便回调时识别
      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set('provider', provider);
      const finalRedirectUri = redirectUrl.toString();

      // 优化 OAuth 选项，只包含必要的参数
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as 'google' | 'github',
        options: {
          redirectTo: finalRedirectUri,
          skipBrowserRedirect: true,
          // 只请求必要的 scope，减少 URL 长度
          scopes: provider === 'google' ? 'email profile' : undefined,
          // 不添加额外的 queryParams，避免 URL 过长
          queryParams: {},
        },
      });

      if (error) {
        console.error('Supabase OAuth 错误:', error);
        throw new Error(error.message || '获取授权URL失败');
      }

      if (!data?.url) {
        throw new Error('未能获取 OAuth 授权 URL');
      }

      // 检查 URL 长度（Google 对 URL 长度有限制，通常为 2048 字符）
      if (data.url.length > 2000) {
        console.warn('OAuth URL 过长，可能导致请求失败:', data.url.length, '字符');
        console.warn('URL 预览:', data.url.substring(0, 200) + '...');
      }

      // 检查是否通过代理（可能导致问题）
      if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
        console.info('检测到本地环境，如果使用代理（如 Clash、V2Ray），请确保代理不会修改 OAuth 请求');
      }

      return data.url;
    } catch (error: any) {
      // 提供更详细的错误信息
      if (error.message?.includes('Supabase')) {
        throw error;
      }
      throw new Error(`获取 ${provider} OAuth 授权 URL 失败: ${error.message || '未知错误'}`);
    }
  }

  /**
   * OAuth回调处理
   */
  async oauthCallback(provider: OAuthProvider, code: string, redirectUri: string, codeVerifier?: string): Promise<AuthResponse> {
    // Linuxdo 依然走后端 API
    if (provider === 'linuxdo') {
      console.log('[Linuxdo OAuth] 开始回调处理');
      console.log('[Linuxdo OAuth] redirect_uri:', redirectUri);
      console.log('[Linuxdo OAuth] code:', code.substring(0, 20) + '...');
      
      const response = await fetch(`${this.baseURL}/api/auth/oauth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, code, redirect_uri: redirectUri, ...(codeVerifier ? { code_verifier: codeVerifier } : {}) }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'OAuth登录失败' } }));
        console.error('[Linuxdo OAuth] 回调失败:', response.status, errorData);
        
        // 解析错误信息（后端格式：{ error: { code, message } }）
        let errorMessage = errorData.error?.message || errorData.message || 'OAuth登录失败';
        
        // 提供更友好的错误提示
        if (response.status === 400) {
          if (errorMessage.includes('redirect_uri') || errorMessage.includes('redirect')) {
            errorMessage = 'Linuxdo 登录配置错误：回调地址不匹配，请联系管理员';
          } else if (errorMessage.includes('code') || errorMessage.includes('授权码') || errorMessage.includes('invalid_grant')) {
            errorMessage = 'Linuxdo 授权码无效或已过期，请重新登录';
          } else if (errorMessage.includes('not configured') || errorMessage.includes('未配置')) {
            errorMessage = 'Linuxdo 登录功能未配置，请联系管理员';
          }
        }
        throw new Error(errorMessage);
      }

      return response.json();
    }

    // Google / GitHub 走 Supabase SDK
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // 检查是否是 code_verifier 相关的错误
      const errorMessage = error.message || '';
      if (errorMessage.includes('code_verifier') || errorMessage.includes('code verifier')) {
        console.error('[OAuth] PKCE code_verifier 验证失败，可能是因为：');
        console.error('  1. 弹窗被浏览器阻止，导致在新页面跳转');
        console.error('  2. 页面刷新导致 code_verifier 丢失');
        console.error('  3. localStorage 被清理');
        throw new Error('登录验证失败：请检查浏览器是否阻止了弹窗，建议允许弹窗后重试。如果问题持续，请尝试使用其他浏览器。');
      }
      throw new Error(error.message || 'OAuth登录失败');
    }

    if (!data.session || !data.user) {
      throw new Error('未获取到会话信息');
    }

    // 尝试同步 Profile (nickname)
    try {
      const nickname = data.user.user_metadata?.nickname || data.user.user_metadata?.full_name || data.user.user_metadata?.name;
      if (nickname) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          nickname: nickname,
          avatar_url: data.user.user_metadata?.avatar_url
        }, { onConflict: 'id' });
      }
    } catch (e) {
      console.warn('Sync profile failed', e);
    }

    // 获取最新的 Profile 以构建 User 对象
    let nickname = data.user.user_metadata?.nickname;
    try {
      const { data: profile } = await supabase.from('profiles').select('nickname').eq('id', data.user.id).single();
      if (profile?.nickname) {
        nickname = profile.nickname;
      }
    } catch (e) {
      // ignore
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      user: {
        id: data.user.id,
        email: data.user.email || '',
        nickname: nickname || null,
        avatar_url: data.user.user_metadata?.avatar_url
      }
    };
  }

  /**
   * 刷新Token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const response = await fetch(`${this.baseURL}/api/auth/token/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '刷新Token失败' }));
      throw new Error(error.message || '刷新Token失败');
    }

    return response.json();
  }

  /**
   * 退出登录
   */
  async logout(accessToken: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '退出登录失败' }));
      throw new Error(error.message || '退出登录失败');
    }
  }

  /**
   * 获取用户资料
   */
  async getProfile(accessToken: string): Promise<User> {
    const response = await fetch(`${this.baseURL}/api/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '获取用户资料失败' }));
      throw new Error(error.message || '获取用户资料失败');
    }

    return response.json();
  }
}

export const authService = new AuthService();
