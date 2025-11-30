import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Upload, 
  Download,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { CloudStorageSettings as CloudStorageSettingsType, CloudStorageProvider, CloudSyncStatus } from '@/types';
import { WebDAVProviders } from '@/services/cloudStorage/WebDAVClient';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';

interface CloudStorageSettingsProps {
  settings?: CloudStorageSettingsType | undefined;
  onSettingsChange?: (settings: CloudStorageSettingsType) => void;
  onTestConnection?: () => Promise<boolean>;
  onManualSync?: () => Promise<void>;
  onUpload?: () => Promise<void>;
  onDownload?: () => Promise<void>;
  syncStatus?: CloudSyncStatus;
  className?: string;
}

export const CloudStorageSettings: React.FC<CloudStorageSettingsProps> = ({
  settings: propSettings,
  onSettingsChange: propOnSettingsChange,
  onTestConnection,
  onManualSync,
  onUpload,
  onDownload,
  syncStatus,
  className,
}) => {
  // 使用 useSettings hook 作为后备方案
  const { settings: appSettings, updateSettings } = useSettings();
  
  // 如果没有传入 props，使用内部状态管理
  const settings = propSettings ?? appSettings.cloudStorage;
  const onSettingsChange = useCallback((newSettings: CloudStorageSettingsType) => {
    if (propOnSettingsChange) {
      propOnSettingsChange(newSettings);
    } else {
      updateSettings({ cloudStorage: newSettings });
    }
  }, [propOnSettingsChange, updateSettings]);
  const [localSettings, setLocalSettings] = useState<CloudStorageSettingsType>({
    enabled: false,
    provider: 'none',
    autoSync: false,
    syncInterval: 30,
    ...settings,
  });

  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings({ ...localSettings, ...settings });
    }
  }, [settings]);

  const handleProviderChange = (provider: CloudStorageProvider) => {
    setLocalSettings({
      ...localSettings,
      provider,
      enabled: provider !== 'none',
    });
  };

  const handleWebDAVChange = (field: string, value: string) => {
    setLocalSettings({
      ...localSettings,
      webdav: {
        ...localSettings.webdav!,
        [field]: value,
      },
    });
  };

  const handleOneDriveChange = (field: string, value: string) => {
    setLocalSettings({
      ...localSettings,
      onedrive: {
        ...localSettings.onedrive!,
        [field]: value,
      },
    });
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    toast.success('云存储设置已保存');
  };

  const handleTestConnection = async () => {
    if (!onTestConnection) return;

    setTesting(true);
    try {
      const result = await onTestConnection();
      if (result) {
        toast.success('连接测试成功');
      } else {
        toast.error('连接测试失败，请检查配置');
      }
    } catch (error) {
      toast.error('连接测试失败: ' + (error as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const handleManualSync = async () => {
    if (!onManualSync) return;

    setSyncing(true);
    try {
      await onManualSync();
      toast.success('同步完成');
    } catch (error) {
      toast.error('同步失败: ' + (error as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleUpload = async () => {
    if (!onUpload) return;

    try {
      await onUpload();
      toast.success('数据已上传到云端');
    } catch (error) {
      toast.error('上传失败: ' + (error as Error).message);
    }
  };

  const handleDownload = async () => {
    if (!onDownload) return;

    try {
      await onDownload();
      toast.success('数据已从云端下载');
    } catch (error) {
      toast.error('下载失败: ' + (error as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* 状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {localSettings.enabled ? (
              <>
                <Cloud className="h-5 w-5 text-green-500" />
                云存储已启用
              </>
            ) : (
              <>
                <CloudOff className="h-5 w-5 text-gray-400" />
                云存储未启用
              </>
            )}
          </CardTitle>
          <CardDescription>
            配置云端存储服务，实现数据跨设备同步
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 同步状态 */}
          {syncStatus && localSettings.enabled && (
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">同步状态</span>
                {syncStatus.syncing ? (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    同步中
                  </Badge>
                ) : syncStatus.lastError ? (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    失败
                  </Badge>
                ) : syncStatus.lastSync ? (
                  <Badge variant="default" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    已同步
                  </Badge>
                ) : (
                  <Badge variant="outline">未同步</Badge>
                )}
              </div>
              {syncStatus.lastSync && (
                <div className="text-sm text-muted-foreground">
                  最后同步: {new Date(syncStatus.lastSync).toLocaleString()}
                </div>
              )}
              {syncStatus.lastError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{syncStatus.lastError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* 手动操作按钮 */}
          {localSettings.enabled && (
            <div className="flex gap-2">
              <Button
                onClick={handleManualSync}
                disabled={syncing || syncStatus?.syncing}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                立即同步
              </Button>
              <Button
                onClick={handleUpload}
                disabled={syncing || syncStatus?.syncing}
                size="sm"
                variant="outline"
              >
                <Upload className="h-4 w-4 mr-2" />
                上传到云端
              </Button>
              <Button
                onClick={handleDownload}
                disabled={syncing || syncStatus?.syncing}
                size="sm"
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                从云端下载
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 基础设置 */}
      <Card>
        <CardHeader>
          <CardTitle>基础设置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 存储服务商选择 */}
          <div className="space-y-2">
            <Label>存储服务商</Label>
            <Select
              value={localSettings.provider}
              onValueChange={(value) => handleProviderChange(value as CloudStorageProvider)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择存储服务商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未启用</SelectItem>
                <SelectItem value="webdav">WebDAV（坚果云等）</SelectItem>
                <SelectItem value="onedrive">OneDrive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 自动同步 */}
          {localSettings.provider !== 'none' && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>自动同步</Label>
                  <div className="text-sm text-muted-foreground">
                    定时自动同步数据到云端
                  </div>
                </div>
                <Switch
                  checked={localSettings.autoSync}
                  onCheckedChange={(checked) =>
                    setLocalSettings({ ...localSettings, autoSync: checked })
                  }
                />
              </div>

              {/* 同步间隔 */}
              {localSettings.autoSync && (
                <div className="space-y-2">
                  <Label>同步间隔（分钟）</Label>
                  <Input
                    type="number"
                    min="5"
                    max="1440"
                    value={localSettings.syncInterval}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        syncInterval: parseInt(e.target.value, 10),
                      })
                    }
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* WebDAV配置 */}
      {localSettings.provider === 'webdav' && (
        <Card>
          <CardHeader>
            <CardTitle>WebDAV配置</CardTitle>
            <CardDescription>
              支持坚果云、ownCloud、NextCloud等WebDAV服务
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 预设服务商 */}
            <div className="space-y-2">
              <Label>预设服务商</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(WebDAVProviders).map(([key, provider]) => (
                  <Button
                    key={key}
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      if (provider.url) {
                        handleWebDAVChange('url', provider.url);
                      }
                    }}
                  >
                    {provider.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* WebDAV服务器地址 */}
            <div className="space-y-2">
              <Label>服务器地址</Label>
              <Input
                type="url"
                placeholder="https://dav.jianguoyun.com/dav/"
                value={localSettings.webdav?.url || ''}
                onChange={(e) => handleWebDAVChange('url', e.target.value)}
              />
            </div>

            {/* 用户名 */}
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input
                type="text"
                placeholder="your@email.com"
                value={localSettings.webdav?.username || ''}
                onChange={(e) => handleWebDAVChange('username', e.target.value)}
              />
            </div>

            {/* 密码 */}
            <div className="space-y-2">
              <Label>密码/应用密码</Label>
              <Input
                type="password"
                placeholder="应用密码"
                value={localSettings.webdav?.password || ''}
                onChange={(e) => handleWebDAVChange('password', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                坚果云用户请使用应用密码，不是登录密码
                <a
                  href="https://help.jianguoyun.com/?p=2064"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-primary hover:underline inline-flex items-center"
                >
                  查看帮助
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </p>
            </div>

            {/* 远程路径 */}
            <div className="space-y-2">
              <Label>远程路径</Label>
              <Input
                type="text"
                placeholder="/PromptMate"
                value={localSettings.webdav?.remotePath || ''}
                onChange={(e) => handleWebDAVChange('remotePath', e.target.value)}
              />
            </div>

            {/* 测试连接 */}
            <Button
              onClick={handleTestConnection}
              disabled={testing}
              variant="outline"
              className="w-full"
            >
              {testing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  测试中...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  测试连接
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* OneDrive配置 */}
      {localSettings.provider === 'onedrive' && (
        <Card>
          <CardHeader>
            <CardTitle>OneDrive配置</CardTitle>
            <CardDescription>
              使用Microsoft OneDrive云存储服务
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <HelpCircle className="h-4 w-4" />
              <AlertDescription>
                OneDrive集成需要在Azure门户中注册应用程序。
                <a
                  href="https://portal.azure.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-primary hover:underline inline-flex items-center"
                >
                  前往Azure门户
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </AlertDescription>
            </Alert>

            {/* Client ID */}
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input
                type="text"
                placeholder="您的应用程序Client ID"
                value={localSettings.onedrive?.clientId || ''}
                onChange={(e) => handleOneDriveChange('clientId', e.target.value)}
              />
            </div>

            {/* 远程路径 */}
            <div className="space-y-2">
              <Label>远程路径</Label>
              <Input
                type="text"
                placeholder="/PromptMate"
                value={localSettings.onedrive?.remotePath || ''}
                onChange={(e) => handleOneDriveChange('remotePath', e.target.value)}
              />
            </div>

            {/* 授权状态 */}
            {localSettings.onedrive?.accessToken && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span>已授权</span>
                </div>
                {localSettings.onedrive.expiresAt && (
                  <p className="text-sm text-muted-foreground mt-2">
                    过期时间: {new Date(localSettings.onedrive.expiresAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={handleTestConnection}
              disabled={testing}
              variant="outline"
              className="w-full"
            >
              {testing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  测试中...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  测试连接
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <CheckCircle className="h-4 w-4 mr-2" />
          保存设置
        </Button>
      </div>
    </div>
  );
};


