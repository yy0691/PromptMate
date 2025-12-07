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

  // 解析 hash 参数，兼容部分提供商返回在 # 后
  const parseHashParams = () => {
    const hash = window.location.hash?.replace(/^#/, '') || '';
    return new URLSearchParams(hash);
  };

  // 如果当前页面是弹窗，向父窗口 postMessage 并关闭
  const sendMessageToOpener = (payload: any) => {
    if (window.opener && window.opener !== window) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
      return true;
    }
    return false;
  };

  useEffect(() => {
    const processCallback = async () => {
      try {
        // 详细的诊断信息
        console.log('[OAuth Callback] 开始处理回调');
        console.log('[OAuth Callback] 当前 URL:', window.location.href);
        console.log('[OAuth Callback] Search params:', Object.fromEntries(searchParams.entries()));
        console.log('[OAuth Callback] Hash:', window.location.hash);
        
        // 从URL参数或 hash 获取授权码/错误信息
        const hashParams = parseHashParams();
        const code = searchParams.get('code') || hashParams.get('code');
        const error = searchParams.get('error') || hashParams.get('error');
        const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');
        const state = searchParams.get('state') || hashParams.get('state') || '';
        const provider = (searchParams.get('provider') || hashParams.get('provider') || 'google').toLowerCase();
        let codeVerifier: string | undefined;

        console.log('[OAuth Callback] 提取的参数:', {
          code: code ? `${code.substring(0, 20)}...` : null,
          error,
          errorDescription,
          state: state ? `${state.substring(0, 20)}...` : null,
          provider,
        });

        // 尝试从 state 中解析 PKCE 的 code_verifier
        // 注意：迁移到 Supabase Client SDK 后，state 由 SDK 自动处理，这里不再需要手动解析
        // 但为了兼容 Linuxdo (后端处理)，保留变量定义
        if (provider === 'linuxdo' && state) {
          try {
            const decoded = JSON.parse(atob(state.replace(/-/g, '+').replace(/_/g, '/')));
            if (decoded?.cv) {
              codeVerifier = decoded.cv;
            }
          } catch (e) {
            console.warn('Failed to parse state for PKCE', e);
          }
        }

        // 检查是否有错误
        if (error) {
          const message = errorDescription || error || '授权失败';
          console.error('[OAuth Callback] OAuth 错误:', { error, errorDescription, provider });
          if (sendMessageToOpener({ type: 'oauth-callback', error: message, provider })) {
            return;
          }
          throw new Error(message);
        }

        // 检查是否有授权码
        if (!code) {
          // 提供更详细的诊断信息
          const fullUrl = window.location.href;
          const urlObj = new URL(fullUrl);
          const allParams = Object.fromEntries(urlObj.searchParams.entries());
          const allHashParams = Object.fromEntries(hashParams.entries());
          
          console.error('[OAuth Callback] 未找到授权码');
          console.error('[OAuth Callback] 完整 URL:', fullUrl);
          console.error('[OAuth Callback] 所有查询参数:', allParams);
          console.error('[OAuth Callback] 所有 Hash 参数:', allHashParams);
          console.error('[OAuth Callback] 当前路径:', window.location.pathname);
          console.error('[OAuth Callback] 当前搜索字符串:', window.location.search);
          console.error('[OAuth Callback] 当前 Hash:', window.location.hash);
          
          // 尝试从 Supabase 的 session 中获取（某些情况下 Supabase 会自动处理）
          try {
            const { supabase } = await import('@/lib/supabase');
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              console.log('[OAuth Callback] 发现现有会话，可能已自动登录');
              // 如果已有会话，直接使用
              setStatus('success');
              toast({
                title: '登录成功',
                description: '检测到已有会话，正在跳转...',
                variant: 'success',
              });
              setTimeout(() => {
                navigate('/', { replace: true });
              }, 1500);
              return;
            }
          } catch (e) {
            console.warn('[OAuth Callback] 检查会话失败:', e);
          }
          
          const message = '未收到授权码，请重试。请检查：\n1. Supabase Redirect URLs 配置是否正确\n2. GitHub OAuth App 回调 URL 是否正确\n3. 是否在弹窗中完成授权（需要允许弹窗）';
          if (sendMessageToOpener({ type: 'oauth-callback', error: message, provider })) {
            return;
          }
          throw new Error(message);
        }
        
        console.log('[OAuth Callback] 找到授权码，继续处理...');

        // 检测是否为 Electron 环境
        const isElectron = !!(window as any).electronAPI;

        // 特殊处理：Electron + Linuxdo 需要转发到自定义协议
        if (isElectron && provider === 'linuxdo') {
          const redirectUri = 'promptmate://oauth';
          window.location.href = `${redirectUri}?code=${encodeURIComponent(code)}&provider=${provider}`;
          return;
        }

        // 构建重定向URI（必须与请求时一致）
        const redirectUri = isElectron
          ? 'promptmate://oauth'
          : `${window.location.origin}/auth/callback`;

        // 弹窗流程：通知父窗口并关闭
        if (sendMessageToOpener({ type: 'oauth-callback', code, provider, state })) {
          return;
        }

        // 调用认证处理（直接在当前窗口）
        await handleOAuthCallback(provider as any, code, redirectUri, codeVerifier);

        setStatus('success');
        toast({
          title: '登录成功',
          description: '正在跳转...',
          variant: 'success',
        });

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
