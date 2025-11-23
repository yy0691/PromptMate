/**
 * LinuxDo 设置组件
 * 用于配置 LinuxDo Connect API 认证信息
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { linuxdoService, LinuxDoConfig } from '@/services/linuxdoService';
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function LinuxDoSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [config, setConfig] = useState<LinuxDoConfig>({
    clientId: '',
    clientSecret: '',
    apiKey: '',
  });
  const [showClearDialog, setShowClearDialog] = useState(false);

  useEffect(() => {
    const savedConfig = linuxdoService.getConfig();
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, []);

  const handleSave = async () => {
    if (!config.clientId || !config.clientSecret || !config.apiKey) {
      toast({
        title: '配置不完整',
        description: '请填写所有必需的配置项',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      linuxdoService.saveConfig(config);
      toast({
        title: '保存成功',
        description: 'LinuxDo 配置已保存',
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: '保存失败',
        description: error.message || '保存配置时出错',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!config.clientId || !config.clientSecret || !config.apiKey) {
      toast({
        title: '配置不完整',
        description: '请先填写并保存配置',
        variant: 'destructive',
      });
      return;
    }

    setVerifying(true);
    try {
      // 临时保存配置以进行验证
      linuxdoService.saveConfig(config);
      const isValid = await linuxdoService.verifyApiKey();
      
      if (isValid) {
        toast({
          title: '验证成功',
          description: 'API Key 验证通过',
          variant: 'success',
        });
      } else {
        toast({
          title: '验证失败',
          description: 'API Key 无效，请检查配置',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: '验证失败',
        description: error.message || '验证时出错',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleClear = () => {
    setConfig({
      clientId: '',
      clientSecret: '',
      apiKey: '',
    });
    localStorage.removeItem('linuxdo_config');
    setShowClearDialog(false);
    toast({
      title: '已清除配置',
      description: 'LinuxDo 配置已清除',
      variant: 'success',
    });
  };

  const openLinuxDoConnect = () => {
    window.open('https://connect.linux.do', '_blank');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>LinuxDo Connect 配置</CardTitle>
          <CardDescription>
            配置 LinuxDo Connect API 认证信息以启用论坛集成功能
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              type="text"
              placeholder="输入 Client ID"
              value={config.clientId}
              onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              从 LinuxDo Connect 应用管理页面获取
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientSecret">Client Secret</Label>
            <Input
              id="clientSecret"
              type="password"
              placeholder="输入 Client Secret"
              value={config.clientSecret}
              onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              与 Client ID 配对的密钥，请妥善保管
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="输入 API Key"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              从 LinuxDo Connect 用户设置页面获取个人 API Key
            </p>
          </div>

          <div className="flex items-center gap-2 pt-4">
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存配置
            </Button>
            <Button
              variant="outline"
              onClick={handleVerify}
              disabled={verifying || !config.clientId || !config.clientSecret || !config.apiKey}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  验证中...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  验证连接
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowClearDialog(true)}
              disabled={loading}
            >
              <XCircle className="mr-2 h-4 w-4" />
              清除配置
            </Button>
            <Button
              variant="ghost"
              onClick={openLinuxDoConnect}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              访问 LinuxDo Connect
            </Button>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="text-sm font-semibold">获取认证信息步骤：</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>访问 LinuxDo Connect 网站</li>
              <li>注册或登录您的 LinuxDo 账户</li>
              <li>点击"我的应用接入" → "申请新接入"</li>
              <li>填写应用信息，包括应用名称、描述和回调地址</li>
              <li>获取 Client ID 和 Client Secret</li>
              <li>在用户设置页面获取个人 API Key</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清除配置</AlertDialogTitle>
            <AlertDialogDescription>
              确定要清除所有 LinuxDo 配置吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear}>确认清除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

