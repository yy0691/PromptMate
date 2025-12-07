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
      
      console.log(`[OAuth] 开始 ${provider} 登录流程`);
      console.log(`[OAuth] 重定向 URI: ${redirectUri}`);
      
      const oauthUrl = await authService.getOAuthUrl(provider, redirectUri);
      
      console.log(`[OAuth] 获取到授权 URL，长度: ${oauthUrl.length} 字符`);
      
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
        // 浏览器环境：新标签页打开（避免被弹窗拦截）
        const popup = window.open(oauthUrl, '_blank');
        if (!popup) {
          // 若被阻止，直接在当前窗口跳转
          window.location.href = oauthUrl;
          return;
        }
        // 监听来自新标签页的消息
        const handleMessage = async (event: MessageEvent) => {
          console.log(`[OAuth] 收到消息事件:`, {
            origin: event.origin,
            expectedOrigin: window.location.origin,
            data: event.data,
          });
          
          // 验证消息来源
          if (event.origin !== window.location.origin) {
            console.warn(`[OAuth] 消息来源不匹配: ${event.origin} !== ${window.location.origin}`);
            return;
          }
          
          if (event.data.type === 'oauth-callback') {
            console.log(`[OAuth] 收到 OAuth 回调消息:`, event.data);
            window.removeEventListener('message', handleMessage);
            cleanupFallback();
            // 让回调页面自行关闭，避免在严格 COOP 环境下由父页面调用 close 触发警告
            const { code, error, state } = event.data as { code?: string; error?: string; state?: string };
            if (error) {
              console.error(`[OAuth] ${provider} 回调错误:`, error);
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
                console.log(`[OAuth] 开始处理授权码，provider: ${provider}`);
                const redirectUri = `${window.location.origin}/auth/callback`;
                const codeVerifier = state ? decodePkceVerifier(state) : undefined;
                await handleOAuthLoginCallback(provider, code, redirectUri, codeVerifier);
                onOpenChange(false); // 关闭登录对话框
              } catch (error: any) {
                console.error(`[OAuth] ${provider} 登录处理失败:`, error);
                toast({
                  title: t('auth.oauth.failed'),
                  description: error.message || t('auth.oauth.failedDesc'),
                  variant: 'destructive',
                });
              } finally {
                setOAuthLoading(null);
              }
            } else {
              console.error(`[OAuth] 回调消息中没有授权码:`, event.data);
              toast({
                title: t('auth.oauth.failed'),
                description: '未收到授权码，请重试',
                variant: 'destructive',
              });
              setOAuthLoading(null);
            }
          }
        };
        
        // 添加超时处理：如果 5 分钟内没有收到回调，清理状态
        const timeoutId = setTimeout(() => {
          console.warn(`[OAuth] ${provider} 登录超时，清理状态`);
          window.removeEventListener('message', handleMessage);
          cleanupFallback();
          setOAuthLoading(null);
          toast({
            title: t('auth.oauth.failed'),
            description: '登录超时，请重试',
            variant: 'destructive',
          });
        }, 5 * 60 * 1000); // 5 分钟超时
        
        // 包装 handleMessage 以在收到消息时清除超时
        const wrappedHandleMessage = async (event: MessageEvent) => {
          clearTimeout(timeoutId);
          await handleMessage(event);
        };
        
        window.addEventListener('message', wrappedHandleMessage);
        // 兜底：用户回到原页但未触发回调时清理 loading
        const cleanupFallback = () => {
          clearTimeout(timeoutId);
          window.removeEventListener('message', wrappedHandleMessage);
          window.removeEventListener('focus', handleWindowFocus);
          window.removeEventListener('visibilitychange', handleVisibilityChange);
        };
        const handleWindowFocus = () => {
          cleanupFallback();
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
      console.error(`[OAuth] ${provider} 登录失败:`, error);
      
      // 提供更详细的错误信息
      let errorMessage = error.message || t('auth.oauth.failedDesc');
      
      // 针对常见错误提供解决方案
      if (error.message?.includes('Supabase 配置缺失')) {
        errorMessage = 'Supabase 配置缺失。请检查环境变量 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。';
      } else if (error.message?.includes('400') || error.message?.includes('Bad Request')) {
        errorMessage = 'OAuth 请求格式错误。可能原因：\n1. URL 过长（请检查 Supabase 配置）\n2. 代理修改了请求（如使用 Clash/V2Ray，请尝试关闭代理）\n3. Redirect URI 配置不匹配（请在 Supabase Dashboard 检查）';
      } else if (error.message?.includes('redirect_uri_mismatch')) {
        errorMessage = '重定向 URI 不匹配。请在 Supabase Dashboard → Authentication → URL Configuration 中添加正确的 Redirect URL。';
      }
      
      toast({
        title: t('auth.oauth.failed'),
        description: errorMessage,
        variant: 'destructive',
        duration: 8000, // 延长显示时间以便用户阅读
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
        // If opened in a popup, try to notify the opener; COOP restrictions might block access
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(
              {
                type: 'oauth-callback',
                code: code || undefined,
                error: error || undefined,
              },
              window.location.origin
            );
            // Let the opener decide when to close
            return;
          }
        } catch (openerError) {
          console.warn('Unable to check opener window status, handling OAuth result locally', openerError);
        }
        // Fallback: handle the OAuth result in the current window
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
