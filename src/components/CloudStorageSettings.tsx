/**
 * 云存储设置组件
 * 第三方云盘数据同步功能配置界面
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Cloud, 
  CloudCog, 
  Settings, 
  CheckCircle, 
  XCircle, 
  Upload, 
  Download, 
  RefreshCw, 
  ExternalLink,
  Lock,
  Key,
  Server,
  Folder,
  AlertTriangle,
  Info
} from 'lucide-react';
import { cloudStorageManager } from '@/services/cloudStorage';
import { 
  CloudStorageSettings as ICloudStorageSettings, 
  CloudSyncStatus,
  CloudStorageProvider,
  WebDAVConfig,
  OneDriveConfig
} from '@/types';
import { usePrompts } from '@/hooks/usePrompts';

interface CloudStorageSettingsProps {
  className?: string;
}

// 预设 WebDAV 配置
const webdavPresets = [
  {
    name: '坚果云',
    url: 'https://dav.jianguoyun.com/dav/',
    description: '推荐使用，稳定可靠的国内云存储服务'
  },
  {
    name: 'NextCloud',
    url: 'https://your-nextcloud.com/remote.php/dav/files/username/',
    description: '开源私有云存储解决方案'
  },
  {
    name: 'ownCloud',
    url: 'https://your-owncloud.com/remote.php/webdav/',
    description: '企业级私有云存储平台'
  }
];

export const CloudStorageSettings: React.FC<CloudStorageSettingsProps> = ({ className }) => {
  const { toast } = useToast();
  const { prompts, categories, settings } = usePrompts();

  // 状态管理
  const [cloudSettings, setCloudSettings] = useState<ICloudStorageSettings>({
    enabled: false,
    provider: 'none',
    autoSync: false,
    syncInterval: 60
  });
  
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>({
    syncing: false
  });
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // WebDAV 配置
  const [webdavConfig, setWebdavConfig] = useState<WebDAVConfig>({
    url: '',
    username: '',
    password: '',
    remotePath: '/PromptMate/data.json'
  });
  
  // OneDrive 配置
  const [onedriveConfig, setOnedriveConfig] = useState<OneDriveConfig>({
    clientId: '',
    remotePath: '/PromptMate/data.json'
  });
  
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  // 初始化
  useEffect(() => {
    const init = async () => {
      try {
        await cloudStorageManager.initialize();
        loadCurrentSettings();
      } catch (error) {
        console.error('初始化云存储管理器失败:', error);
        toast({
          title: '初始化失败',
          description: '云存储功能初始化失败，请刷新页面重试',
          variant: 'destructive'
        });
      }
    };
    
    init();
    
    // 监听事件
    const handleSyncStart = () => setSyncStatus(prev => ({ ...prev, syncing: true }));
    const handleSyncComplete = (status: CloudSyncStatus) => setSyncStatus(status);
    const handleSyncError = (error: Error) => {
      setSyncStatus(prev => ({ ...prev, syncing: false, lastError: error.message }));
      toast({
        title: '同步失败',
        description: error.message,
        variant: 'destructive'
      });
    };
    
    cloudStorageManager.on('syncStart', handleSyncStart);
    cloudStorageManager.on('syncComplete', handleSyncComplete);
    cloudStorageManager.on('syncError', handleSyncError);
    
    return () => {
      cloudStorageManager.off('syncStart', handleSyncStart);
      cloudStorageManager.off('syncComplete', handleSyncComplete);
      cloudStorageManager.off('syncError', handleSyncError);
    };
  }, [toast]);

  // 加载当前设置
  const loadCurrentSettings = () => {
    try {
      const saved = localStorage.getItem('cloudStorageSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        setCloudSettings(settings);
        
        if (settings.webdav) {
          setWebdavConfig(settings.webdav);
        }
        
        if (settings.onedrive) {
          setOnedriveConfig(settings.onedrive);
        }
      }
    } catch (error) {
      console.error('加载云存储设置失败:', error);
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (cloudSettings.provider === 'none') {
      toast({
        title: '请选择云存储服务',
        description: '请先选择一个云存储服务提供商',
        variant: 'destructive'
      });
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('idle');

    try {
      // 更新配置
      const updatedSettings: Partial<ICloudStorageSettings> = {
        provider: cloudSettings.provider
      };

      if (cloudSettings.provider === 'webdav') {
        if (!webdavConfig.url || !webdavConfig.username || !webdavConfig.password) {
          throw new Error('请填写完整的 WebDAV 配置信息');
        }
        updatedSettings.webdav = webdavConfig;
      } else if (cloudSettings.provider === 'onedrive') {
        if (!onedriveConfig.clientId) {
          throw new Error('请填写 OneDrive Client ID');
        }
        updatedSettings.onedrive = onedriveConfig;
      }

      await cloudStorageManager.updateSettings(updatedSettings);
      
      const success = await cloudStorageManager.testConnection();
      
      if (success) {
        setConnectionStatus('success');
        toast({
          title: '连接测试成功',
          description: '云存储服务连接正常',
          variant: 'default'
        });
      } else {
        setConnectionStatus('error');
        toast({
          title: '连接测试失败',
          description: '无法连接到云存储服务，请检查配置',
          variant: 'destructive'
        });
      }
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: '连接测试失败',
        description: error instanceof Error ? error.message : '连接测试失败',
        variant: 'destructive'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // 保存设置
  const handleSaveSettings = async () => {
    try {
      const updatedSettings: Partial<ICloudStorageSettings> = {
        ...cloudSettings
      };

      if (cloudSettings.provider === 'webdav') {
        updatedSettings.webdav = webdavConfig;
      } else if (cloudSettings.provider === 'onedrive') {
        updatedSettings.onedrive = onedriveConfig;
      }

      await cloudStorageManager.updateSettings(updatedSettings);
      setCloudSettings(prev => ({ ...prev, ...updatedSettings }));
      
      toast({
        title: '设置已保存',
        description: '云存储配置已成功保存',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '保存设置失败',
        variant: 'destructive'
      });
    }
  };

  // 手动上传
  const handleUpload = async () => {
    try {
      if (!prompts || !categories || !settings) {
        throw new Error('数据未加载，请稍后重试');
      }
      
      await cloudStorageManager.uploadData(prompts, categories, settings);
      toast({
        title: '上传成功',
        description: '数据已成功上传到云端',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: '上传失败',
        description: error instanceof Error ? error.message : '上传数据失败',
        variant: 'destructive'
      });
    }
  };

  // 手动下载
  const handleDownload = async () => {
    try {
      const data = await cloudStorageManager.downloadData();
      if (data) {
        // 这里需要实现数据导入逻辑
        // 由于涉及到数据替换，应该提示用户确认
        toast({
          title: '下载成功',
          description: '云端数据已下载，请在数据管理中导入',
          variant: 'default'
        });
      } else {
        toast({
          title: '没有云端数据',
          description: '云端没有找到数据文件',
          variant: 'default'
        });
      }
    } catch (error) {
      toast({
        title: '下载失败',
        description: error instanceof Error ? error.message : '下载数据失败',
        variant: 'destructive'
      });
    }
  };

  // 选择预设配置
  const handlePresetSelect = (presetName: string) => {
    const preset = webdavPresets.find(p => p.name === presetName);
    if (preset) {
      setWebdavConfig(prev => ({
        ...prev,
        url: preset.url
      }));
      setSelectedPreset(presetName);
    }
  };

  // OneDrive 授权
  const handleOneDriveAuth = () => {
    if (!onedriveConfig.clientId) {
      toast({
        title: '请填写 Client ID',
        description: '请先填写 OneDrive 应用的 Client ID',
        variant: 'destructive'
      });
      return;
    }

    try {
      const authUrl = cloudStorageManager.getOneDriveAuthUrl();
      window.open(authUrl, '_blank');
      
      toast({
        title: '请完成授权',
        description: '请在新窗口中完成 OneDrive 授权',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: '授权失败',
        description: error instanceof Error ? error.message : '获取授权链接失败',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudCog className="h-5 w-5" />
            云存储状态
          </CardTitle>
          <CardDescription>
            当前云存储服务的连接状态和同步信息
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>服务状态</Label>
              <div className="flex items-center gap-2">
                {cloudSettings.enabled ? (
                  <>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      已启用
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {cloudSettings.provider === 'webdav' ? 'WebDAV' : 
                       cloudSettings.provider === 'onedrive' ? 'OneDrive' : '未配置'}
                    </span>
                  </>
                ) : (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                    <XCircle className="h-3 w-3 mr-1" />
                    未启用
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {syncStatus.syncing && (
                <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleUpload}
                disabled={!cloudSettings.enabled || syncStatus.syncing}
              >
                <Upload className="h-4 w-4 mr-1" />
                上传
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!cloudSettings.enabled || syncStatus.syncing}
              >
                <Download className="h-4 w-4 mr-1" />
                下载
              </Button>
            </div>
          </div>

          {syncStatus.lastSync && (
            <div className="text-sm text-muted-foreground">
              最后同步: {new Date(syncStatus.lastSync).toLocaleString()}
            </div>
          )}

          {syncStatus.lastError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{syncStatus.lastError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 基础设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            基础设置
          </CardTitle>
          <CardDescription>
            配置云存储服务和同步选项
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="enable-cloud">启用云存储</Label>
              <p className="text-sm text-muted-foreground">
                开启后可以将数据同步到第三方云存储服务
              </p>
            </div>
            <Switch
              id="enable-cloud"
              checked={cloudSettings.enabled}
              onCheckedChange={(enabled) => setCloudSettings(prev => ({ ...prev, enabled }))}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>云存储服务商</Label>
            <Select
              value={cloudSettings.provider}
              onValueChange={(provider: CloudStorageProvider) => 
                setCloudSettings(prev => ({ ...prev, provider }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择云存储服务商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不使用云存储</SelectItem>
                <SelectItem value="webdav">WebDAV (坚果云、NextCloud等)</SelectItem>
                <SelectItem value="onedrive">Microsoft OneDrive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-sync">自动同步</Label>
              <p className="text-sm text-muted-foreground">
                数据更改时自动上传到云端
              </p>
            </div>
            <Switch
              id="auto-sync"
              checked={cloudSettings.autoSync}
              onCheckedChange={(autoSync) => setCloudSettings(prev => ({ ...prev, autoSync }))}
            />
          </div>

          {cloudSettings.autoSync && (
            <div className="space-y-2">
              <Label>同步间隔</Label>
              <Select
                value={cloudSettings.syncInterval?.toString()}
                onValueChange={(interval) => 
                  setCloudSettings(prev => ({ ...prev, syncInterval: parseInt(interval, 10) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5分钟</SelectItem>
                  <SelectItem value="15">15分钟</SelectItem>
                  <SelectItem value="30">30分钟</SelectItem>
                  <SelectItem value="60">1小时</SelectItem>
                  <SelectItem value="360">6小时</SelectItem>
                  <SelectItem value="1440">1天</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 服务配置 */}
      {cloudSettings.provider !== 'none' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              {cloudSettings.provider === 'webdav' ? 'WebDAV 配置' : 'OneDrive 配置'}
            </CardTitle>
            <CardDescription>
              {cloudSettings.provider === 'webdav' 
                ? '配置 WebDAV 服务器连接信息' 
                : '配置 Microsoft OneDrive 应用信息'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cloudSettings.provider === 'webdav' ? (
              <div className="space-y-4">
                {/* WebDAV 预设选择 */}
                <div className="space-y-2">
                  <Label>快速配置</Label>
                  <Select value={selectedPreset} onValueChange={handlePresetSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择预设配置或手动填写" />
                    </SelectTrigger>
                    <SelectContent>
                      {webdavPresets.map(preset => (
                        <SelectItem key={preset.name} value={preset.name}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPreset && (
                    <p className="text-sm text-muted-foreground">
                      {webdavPresets.find(p => p.name === selectedPreset)?.description}
                    </p>
                  )}
                </div>

                <Separator />

                {/* WebDAV 配置表单 */}
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="webdav-url">
                      <Server className="h-4 w-4 inline mr-1" />
                      服务器地址
                    </Label>
                    <Input
                      id="webdav-url"
                      type="url"
                      placeholder="https://dav.jianguoyun.com/dav/"
                      value={webdavConfig.url}
                      onChange={(e) => setWebdavConfig(prev => ({ ...prev, url: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="webdav-username">
                        <Key className="h-4 w-4 inline mr-1" />
                        用户名
                      </Label>
                      <Input
                        id="webdav-username"
                        type="text"
                        value={webdavConfig.username}
                        onChange={(e) => setWebdavConfig(prev => ({ ...prev, username: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="webdav-password">
                        <Lock className="h-4 w-4 inline mr-1" />
                        密码/应用密码
                      </Label>
                      <Input
                        id="webdav-password"
                        type="password"
                        value={webdavConfig.password}
                        onChange={(e) => setWebdavConfig(prev => ({ ...prev, password: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webdav-path">
                      <Folder className="h-4 w-4 inline mr-1" />
                      远程文件路径
                    </Label>
                    <Input
                      id="webdav-path"
                      type="text"
                      placeholder="/PromptMate/data.json"
                      value={webdavConfig.remotePath}
                      onChange={(e) => setWebdavConfig(prev => ({ ...prev, remotePath: e.target.value }))}
                    />
                  </div>
                </div>

                {selectedPreset === '坚果云' && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p><strong>坚果云配置提示：</strong></p>
                        <p>• 密码处请填写应用密码，不是登录密码</p>
                        <p>• 在坚果云网页版设置中生成应用密码</p>
                        <p>• 建议使用独立的应用密码保证安全</p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* OneDrive 配置表单 */}
                <div className="space-y-2">
                  <Label htmlFor="onedrive-clientid">
                    <Key className="h-4 w-4 inline mr-1" />
                    Client ID
                  </Label>
                  <Input
                    id="onedrive-clientid"
                    type="text"
                    placeholder="应用程序的 Client ID"
                    value={onedriveConfig.clientId}
                    onChange={(e) => setOnedriveConfig(prev => ({ ...prev, clientId: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="onedrive-path">
                    <Folder className="h-4 w-4 inline mr-1" />
                    远程文件路径
                  </Label>
                  <Input
                    id="onedrive-path"
                    type="text"
                    placeholder="/PromptMate/data.json"
                    value={onedriveConfig.remotePath}
                    onChange={(e) => setOnedriveConfig(prev => ({ ...prev, remotePath: e.target.value }))}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded">
                  <div className="space-y-1">
                    <Label>授权状态</Label>
                    <p className="text-sm text-muted-foreground">
                      {onedriveConfig.accessToken ? '已授权' : '未授权'}
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleOneDriveAuth}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    授权访问
                  </Button>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p><strong>OneDrive 配置说明：</strong></p>
                      <p>• 需要在 Microsoft Azure 中注册应用获取 Client ID</p>
                      <p>• 首次使用需要完成 OAuth 授权流程</p>
                      <p>• 授权后会自动获取访问令牌</p>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="flex items-center gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={handleTestConnection}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                测试连接
              </Button>

              <Button onClick={handleSaveSettings}>
                保存配置
              </Button>

              {connectionStatus === 'success' && (
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  连接成功
                </Badge>
              )}
              
              {connectionStatus === 'error' && (
                <Badge variant="secondary" className="bg-red-100 text-red-700">
                  连接失败
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};