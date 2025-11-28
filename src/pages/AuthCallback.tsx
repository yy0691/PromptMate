/**
 * OAuth 回调处理页面
 * 处理第三方登录的回调并完成认证流程
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type AuthStatus = 'processing' | 'success' | 'error';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<AuthStatus>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const processCallback = async () => {
      try {
        // 从 URL 参数获取授权码和错误信息
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        const provider = searchParams.get('provider') || 'google'; // 默认 Google

        // 检查是否有错误
        if (error) {
          throw new Error(errorDescription || error || '授权失败');
        }

        // 检查是否有授权码
        if (!code) {
          throw new Error('未收到授权码，请重试');
        }

        // 构建重定向 URI（必须与请求时一致）
        const isElectron = !!(window as any).electronAPI;
        const redirectUri = isElectron
          ? 'promptmate://oauth'
          : `${window.location.origin}/auth/callback`;

        // 调用认证处理
        await handleOAuthCallback(provider as any, code, redirectUri);

        // 成功
        setStatus('success');
        toast({
          title: '登录成功',
          description: '正在跳转...',
          variant: 'success',
        });

        // 延迟跳转到首页
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);
      } catch (error: any) {
        console.error('OAuth 回调处理失败:', error);
        setStatus('error');
        setErrorMessage(error.message || '登录失败，请重试');
        toast({
          title: 'OAuth 登录失败',
          description: error.message || '登录失败，请重试',
          variant: 'destructive',
        });
      }
    };

    processCallback();
  }, [searchParams, handleOAuthCallback, navigate, toast]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {status === 'processing' && '正在处理登录...'}
            {status === 'success' && '登录成功'}
            {status === 'error' && '登录失败'}
          </CardTitle>
          <CardDescription className="text-center">
            {status === 'processing' && '请稍候，正在完成认证流程'}
            {status === 'success' && '即将跳转到主页'}
            {status === 'error' && '登录过程中出现错误'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === 'processing' && (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}
          {status === 'success' && (
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          )}
          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              {errorMessage && (
                <p className="text-sm text-muted-foreground text-center">
                  {errorMessage}
                </p>
              )}
              <Button
                onClick={() => navigate('/', { replace: true })}
                variant="outline"
                className="mt-4"
              >
                返回首页
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


