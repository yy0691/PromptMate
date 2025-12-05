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
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as 'google' | 'github',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      throw new Error(error.message || '获取授权URL失败');
    }

    return data.url;
  }

  /**
   * OAuth回调处理
   */
  async oauthCallback(provider: OAuthProvider, code: string, redirectUri: string, codeVerifier?: string): Promise<AuthResponse> {
    // Linuxdo 依然走后端 API
    if (provider === 'linuxdo') {
      const response = await fetch(`${this.baseURL}/api/auth/oauth/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, code, redirect_uri: redirectUri, ...(codeVerifier ? { code_verifier: codeVerifier } : {}) }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'OAuth登录失败' }));
        throw new Error(error.message || 'OAuth登录失败');
      }

      return response.json();
    }

    // Google / GitHub 走 Supabase SDK
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
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
