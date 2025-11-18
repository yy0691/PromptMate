/**
 * 登录/注册对话框组件
 * 支持邮箱登录、注册和OAuth登录
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/authService';
import { Loader2, Mail, Github } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'login' | 'register';
}

export function AuthDialog({ open, onOpenChange, defaultTab = 'login' }: AuthDialogProps) {
  const { t } = useTranslation();
  const { login, register } = useAuth();
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
      // 注册成功后切换到登录标签
      setActiveTab('login');
      setLoginEmail(registerEmail);
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
  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setOAuthLoading(provider);
    try {
      // 构建重定向URI（对于Electron应用，使用自定义协议）
      const redirectUri = window.location.origin.includes('localhost')
        ? 'http://localhost:5173/auth/callback'
        : 'promptmate://oauth';

      const oauthUrl = await authService.getOAuthUrl(provider, redirectUri);
      
      // 打开OAuth授权页面
      // 对于Electron，可能需要使用shell.openExternal
      if ((window as any).electronAPI?.openExternal) {
        (window as any).electronAPI.openExternal(oauthUrl);
      } else {
        // 浏览器环境，直接打开新窗口
        const popup = window.open(oauthUrl, 'oauth', 'width=500,height=600');
        
        // 监听OAuth回调（简化版，实际应该通过消息传递）
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            setOAuthLoading(null);
            toast({
              title: t('auth.oauth.cancelled'),
              description: t('auth.oauth.cancelledDesc'),
            });
          }
        }, 500);
      }

      // 注意：OAuth回调处理需要额外的实现
      // 这里只是打开授权页面，实际回调处理需要在应用启动时配置
    } catch (error: any) {
      toast({
        title: t('auth.oauth.failed'),
        description: error.message || t('auth.oauth.failedDesc'),
        variant: 'destructive',
      });
      setOAuthLoading(null);
    }
  };

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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

