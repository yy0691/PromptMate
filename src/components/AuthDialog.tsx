/**
 * 登录/注册对话框组件
 * 支持邮箱登录、注册和OAuth登录
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { authService, OAuthProvider } from '@/services/authService';
import { Loader2, Mail, Github, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { decodePkceVerifier } from '@/utils/pkce';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'login' | 'register';
}

export function AuthDialog({ open, onOpenChange, defaultTab = 'login' }: AuthDialogProps) {
  const { t } = useTranslation();
  const { login, register, handleOAuthCallback: handleOAuthCallbackFromAuth } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(defaultTab);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOAuthLoading] = useState<string | null>(null);

  // 登录表单状态
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 注册表单状态
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerNickname, setRegisterNickname] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');

  // 处理邮箱登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast({
        title: t('auth.error.invalidInput'),
        description: t('auth.error.pleaseFillAllFields'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      onOpenChange(false);
      // 重置表单
      setLoginEmail('');
      setLoginPassword('');
    } catch (error) {
      // 错误已在useAuth中处理
    } finally {
      setLoading(false);
    }
  };

  // 处理邮箱注册
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerEmail || !registerPassword || !registerNickname) {
      toast({
        title: t('auth.error.invalidInput'),
        description: t('auth.error.pleaseFillAllFields'),
        variant: 'destructive',
      });
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      toast({
        title: t('auth.error.passwordMismatch'),
        description: t('auth.error.passwordMismatchDesc'),
        variant: 'destructive',
      });
      return;
    }

    if (registerPassword.length < 6) {
      toast({
        title: t('auth.error.passwordTooShort'),
        description: t('auth.error.passwordTooShortDesc'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await register(registerEmail, registerPassword, registerNickname);
      // 注册成功后关闭弹窗，返回原界面
      onOpenChange(false);
      // 重置注册表单
      setRegisterEmail('');
      setRegisterPassword('');
      setRegisterNickname('');
      setRegisterConfirmPassword('');
    } catch (error) {
      // 错误已在useAuth中处理
    } finally {
      setLoading(false);
    }
  };

  // 处理OAuth登录
  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setOAuthLoading(provider);
    try {
      // 构建重定向URI（对于Electron应用，使用自定义协议）
      const isElectron = !!(window as any).electronAPI;
      const redirectUri = isElectron
        ? 'promptmate://oauth'
        : `${window.location.origin}/auth/callback`;

      const oauthUrl = await authService.getOAuthUrl(provider, redirectUri);

      // 打开OAuth授权页面
      if (isElectron && (window as any).electronAPI?.openExternal) {
        // Electron 环境：使用 shell.openExternal 打开外部浏览器
        (window as any).electronAPI.openExternal(oauthUrl);

        // 监听 OAuth 回调（通过 IPC）
        const cleanup = (window as any).electronAPI.onOAuthCallback?.((data: any) => {
          cleanup?.();
          handleOAuthCallback(provider, data);
        });
      } else {
        // 浏览器环境：打开弹出窗口
        const popup = window.open(oauthUrl, 'oauth', 'width=500,height=600');

        if (!popup) {
          throw new Error('无法打开弹出窗口，请检查浏览器弹窗设置');
        }

        // 监听来自弹窗的消息
        const handleMessage = async (event: MessageEvent) => {
          // 验证消息来源
          if (event.origin !== window.location.origin) {
            return;
          }

          if (event.data.type === 'oauth-callback') {
            window.removeEventListener('message', handleMessage);
            cleanupFallback();
            popup.close();
            
            const { code, error, state } = event.data as { code?: string; error?: string; state?: string };
            if (error) {
              toast({
                title: t('auth.oauth.failed'),
                description: error,
                variant: 'destructive',
              });
              setOAuthLoading(null);
              return;
            }

            if (code) {
              try {
                const redirectUri = `${window.location.origin}/auth/callback`;
                const codeVerifier = state ? decodePkceVerifier(state) : undefined;
                await handleOAuthLoginCallback(provider, code, redirectUri, codeVerifier);
                onOpenChange(false); // 关闭登录对话框
              } catch (error: any) {
                toast({
                  title: t('auth.oauth.failed'),
                  description: error.message || t('auth.oauth.failedDesc'),
                  variant: 'destructive',
                });
              } finally {
                setOAuthLoading(null);
              }
            }
          }
        };

        window.addEventListener('message', handleMessage);

        // 在开启 COOP 的站点上访问 popup.closed 会直接抛错，因此不再轮询 .closed。
        // 使用“用户重新聚焦主窗口”作为兜底关闭逻辑，避免控制台报错。
        const cleanupFallback = () => {
          window.removeEventListener('focus', handleWindowFocus);
          window.removeEventListener('visibilitychange', handleVisibilityChange);
        };

        const handleWindowFocus = () => {
          cleanupFallback();
          // 如果用户关掉了弹窗且没有触发回调，重置 loading 状态
          setOAuthLoading((current) => (current ? null : current));
        };

        const handleVisibilityChange = () => {
          if (!document.hidden) {
            handleWindowFocus();
          }
        };

        window.addEventListener('focus', handleWindowFocus);
        window.addEventListener('visibilitychange', handleVisibilityChange);
      }
    } catch (error: any) {
      toast({
        title: t('auth.oauth.failed'),
        description: error.message || t('auth.oauth.failedDesc'),
        variant: 'destructive',
      });
      setOAuthLoading(null);
    }
  };

  // 处理 OAuth 回调
  const handleOAuthCallback = async (provider: OAuthProvider, data: any) => {
    try {
      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.code) {
        throw new Error('未收到授权码');
      }

      const redirectUri = (window as any).electronAPI
        ? 'promptmate://oauth'
        : `${window.location.origin}/auth/callback`;

      await handleOAuthLoginCallback(provider, data.code, redirectUri);
      setOAuthLoading(null);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: t('auth.oauth.failed'),
        description: error.message || t('auth.oauth.failedDesc'),
        variant: 'destructive',
      });
      setOAuthLoading(null);
    }
  };

  // 处理 OAuth 登录回调
  const handleOAuthLoginCallback = async (provider: OAuthProvider, code: string, redirectUri: string, codeVerifier?: string) => {
    await handleOAuthCallbackFromAuth(provider, code, redirectUri, codeVerifier);
  };

  // 检查浏览器环境的 OAuth 回调（通过 URL 参数）
  const checkBrowserOAuthCallback = async (provider: OAuthProvider) => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        throw new Error(error);
      }

      if (code) {
        const redirectUri = `${window.location.origin}/auth/callback`;
        await handleOAuthLoginCallback(provider, code, redirectUri);
        // 清除 URL 参数
        window.history.replaceState({}, '', window.location.pathname);
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: t('auth.oauth.failed'),
        description: error.message || t('auth.oauth.failedDesc'),
        variant: 'destructive',
      });
    }
  };

  // 组件挂载时检查 URL 参数（浏览器环境）
  useEffect(() => {
    if (!(window as any).electronAPI) {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      
      if (code || error) {
        // 如果是在弹窗中（有 opener），向主窗口发送消息
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: 'oauth-callback',
              code: code || undefined,
              error: error || undefined,
            },
            window.location.origin
          );
          // 不要关闭窗口，让主窗口来关闭
          return;
        }
        
        // 如果不是弹窗，直接在当前窗口处理（兼容旧逻辑）
        if (code) {
          const state = urlParams.get('state') || '';
          let provider: OAuthProvider = 'google';
          if (state.includes('github')) {
            provider = 'github';
          } else if (state.includes('linuxdo')) {
            provider = 'linuxdo';
          }
          checkBrowserOAuthCallback(provider);
        }
      }
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('auth.title')}</DialogTitle>
          <DialogDescription>{t('auth.description')}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'register')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">{t('auth.login.title')}</TabsTrigger>
            <TabsTrigger value="register">{t('auth.register.title')}</TabsTrigger>
          </TabsList>

          {/* 登录标签页 */}
          <TabsContent value="login" className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">{t('auth.email')}</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">{t('auth.password')}</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('auth.login.loggingIn')}
                  </>
                ) : (
                  t('auth.login.button')
                )}
              </Button>
            </form>

            {/* OAuth登录选项 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">{t('auth.or')}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthLogin('google')}
                disabled={oauthLoading !== null}
                className="w-full"
              >
                {oauthLoading === 'google' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthLogin('github')}
                disabled={oauthLoading !== null}
                className="w-full"
              >
                {oauthLoading === 'github' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Github className="mr-2 h-4 w-4" />
                )}
                GitHub
              </Button>
            </div>

            {/* Linux.do 登录按钮 */}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuthLogin('linuxdo')}
              disabled={oauthLoading !== null}
              className="w-full"
            >
              {oauthLoading === 'linuxdo' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Globe className="mr-2 h-4 w-4" />
              )}
              Linux.do
            </Button>
          </TabsContent>

          {/* 注册标签页 */}
          <TabsContent value="register" className="space-y-4">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-nickname">{t('auth.nickname')}</Label>
                <Input
                  id="register-nickname"
                  type="text"
                  placeholder={t('auth.nicknamePlaceholder')}
                  value={registerNickname}
                  onChange={(e) => setRegisterNickname(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email">{t('auth.email')}</Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">{t('auth.password')}</Label>
                <Input
                  id="register-password"
                  type="password"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-confirm-password">{t('auth.confirmPassword')}</Label>
                <Input
                  id="register-confirm-password"
                  type="password"
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('auth.register.registering')}
                  </>
                ) : (
                  t('auth.register.button')
                )}
              </Button>
            </form>

            {/* OAuth注册选项 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">{t('auth.or')}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthLogin('google')}
                disabled={oauthLoading !== null}
                className="w-full"
              >
                {oauthLoading === 'google' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthLogin('github')}
                disabled={oauthLoading !== null}
                className="w-full"
              >
                {oauthLoading === 'github' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Github className="mr-2 h-4 w-4" />
                )}
                GitHub
              </Button>
            </div>

            {/* Linux.do 登录按钮 */}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuthLogin('linuxdo')}
              disabled={oauthLoading !== null}
              className="w-full"
            >
              {oauthLoading === 'linuxdo' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Globe className="mr-2 h-4 w-4" />
              )}
              Linux.do
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

