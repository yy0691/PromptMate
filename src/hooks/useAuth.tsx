/**
 * 用户认证状态管理Hook
 * 管理登录状态、token存储和刷新
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authService, User, AuthResponse, OAuthProvider } from '@/services/authService';
import { useToast } from '@/hooks/use-toast';

const TOKEN_STORAGE_KEY = 'promptmate_auth_tokens';
const USER_STORAGE_KEY = 'promptmate_user';

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number; // 过期时间戳
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  getAccessToken: () => string | null;
  handleOAuthCallback: (provider: OAuthProvider, code: string, redirectUri: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // 从localStorage加载token和用户信息
  const loadStoredAuth = useCallback((): { tokens: AuthTokens | null; user: User | null } => {
    try {
      const tokensStr = localStorage.getItem(TOKEN_STORAGE_KEY);
      const userStr = localStorage.getItem(USER_STORAGE_KEY);

      if (tokensStr && userStr) {
        const tokens: AuthTokens = JSON.parse(tokensStr);
        const user: User = JSON.parse(userStr);

        // 检查token是否过期
        if (tokens.expires_at && tokens.expires_at > Date.now()) {
          return { tokens, user };
        }
      }
    } catch (error) {
      console.error('加载存储的认证信息失败:', error);
    }
    return { tokens: null, user: null };
  }, []);

  // 保存token和用户信息
  const saveAuth = useCallback((authResponse: AuthResponse) => {
    const tokens: AuthTokens = {
      access_token: authResponse.access_token,
      refresh_token: authResponse.refresh_token,
      expires_in: authResponse.expires_in,
      expires_at: Date.now() + authResponse.expires_in * 1000,
    };

    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authResponse.user));
    setUser(authResponse.user);
  }, []);

  // 清除认证信息
  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  }, []);

  // 刷新token
  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const { tokens } = loadStoredAuth();
      if (!tokens) {
        return false;
      }

      // 如果token还没过期，不需要刷新
      if (tokens.expires_at && tokens.expires_at > Date.now() + 60000) {
        // 提前1分钟刷新
        return true;
      }

      const authResponse = await authService.refreshToken(tokens.refresh_token);
      saveAuth(authResponse);
      return true;
    } catch (error) {
      console.error('刷新token失败:', error);
      clearAuth();
      return false;
    }
  }, [loadStoredAuth, saveAuth, clearAuth]);

  // 初始化：加载存储的认证信息
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      const { tokens, user: storedUser } = loadStoredAuth();

      if (tokens && storedUser) {
        // 验证token是否有效，如果过期则尝试刷新
        if (tokens.expires_at && tokens.expires_at <= Date.now()) {
          const refreshed = await refreshAuth();
          if (!refreshed) {
            clearAuth();
          }
        } else {
          setUser(storedUser);
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  // 定期刷新token（在过期前5分钟）
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      refreshAuth();
    }, 5 * 60 * 1000); // 每5分钟检查一次

    return () => clearInterval(interval);
  }, [user, refreshAuth]);

  // 登录
  const login = useCallback(async (email: string, password: string) => {
    try {
      const authResponse = await authService.loginWithEmail(email, password);
      saveAuth(authResponse);
      toast({
        title: '登录成功',
        description: `欢迎回来，${authResponse.user.nickname || authResponse.user.email}！`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: '登录失败',
        description: error.message || '请检查邮箱和密码',
        variant: 'destructive',
      });
      throw error;
    }
  }, [saveAuth, toast]);

  // 注册
  const register = useCallback(async (email: string, password: string, nickname: string) => {
    try {
      const registerResponse = await authService.registerWithEmail(email, password, nickname);
      toast({
        title: '注册成功',
        description: registerResponse.email_confirmed
          ? '账户已创建，请登录'
          : '请前往邮箱验证账户后登录',
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: '注册失败',
        description: error.message || '注册失败，请重试',
        variant: 'destructive',
      });
      throw error;
    }
  }, [toast]);

  // 退出登录
  const logout = useCallback(async () => {
    try {
      const { tokens } = loadStoredAuth();
      if (tokens) {
        await authService.logout(tokens.access_token);
      }
    } catch (error) {
      console.error('退出登录失败:', error);
    } finally {
      clearAuth();
      toast({
        title: '已退出登录',
        variant: 'success',
      });
    }
  }, [loadStoredAuth, clearAuth, toast]);

  // 获取当前access token
  const getAccessToken = useCallback((): string | null => {
    const { tokens } = loadStoredAuth();
    return tokens?.access_token || null;
  }, [loadStoredAuth]);

  // 处理 OAuth 回调
  const handleOAuthCallback = useCallback(async (provider: OAuthProvider, code: string, redirectUri: string) => {
    try {
      const authResponse = await authService.oauthCallback(provider, code, redirectUri);
      saveAuth(authResponse);
      toast({
        title: '登录成功',
        description: `欢迎回来，${authResponse.user.nickname || authResponse.user.email}！`,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'OAuth登录失败',
        description: error.message || 'OAuth登录失败，请重试',
        variant: 'destructive',
      });
      throw error;
    }
  }, [saveAuth, toast]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshAuth,
        getAccessToken,
        handleOAuthCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

