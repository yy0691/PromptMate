import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Sparkles, ArrowLeft, Puzzle, Cloud } from "lucide-react";
import { AISettings } from "@/components/AISettings";
import { PluginSettings } from "@/components/PluginSettings";
import { CloudStorageSettings } from "@/components/CloudStorageSettings";
import { useTranslation } from "react-i18next";
import { cloudStorageManager } from "@/services/cloudStorage/CloudStorageManager";
import { CloudStorageSettings as CloudStorageSettingsType, CloudSyncStatus, Settings as AppSettings } from "@/types";
import { usePrompts } from "@/hooks/usePrompts";
import { toast } from "sonner";
import { loadCategories, loadPrompts, savePrompts, saveCategories } from "@/lib/data";

interface SettingsPageProps {
  onBack?: () => void;
}

/**
 * 设置页面组件
 * 提供AI服务配置、插件管理等功能
 */
export const SettingsPage: React.FC<SettingsPageProps> = ({
  onBack,
}) => {
  const { t, i18n } = useTranslation();
  const { prompts, categories } = usePrompts();
  
  // 从localStorage加载设置
  const loadSettings = (): AppSettings | null => {
    try {
      const saved = localStorage.getItem('app_settings');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('加载设置失败:', error);
      return null;
    }
  };

  // 保存设置到localStorage
  const saveSettings = (settings: AppSettings) => {
    try {
      localStorage.setItem('app_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  };

  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadSettings();
    return loaded || {
      theme: 'system',
      font: 'system',
      fontSize: 14,
      alwaysOnTop: false,
      shortcut: 'Ctrl+Shift+P',
    };
  });

  const [cloudSettings, setCloudSettings] = useState<CloudStorageSettingsType | undefined>(
    settings?.cloudStorage
  );
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>({
    syncing: false,
  });

  useEffect(() => {
    if (settings?.cloudStorage) {
      setCloudSettings(settings.cloudStorage);
    }
  }, [settings]);

  useEffect(() => {
    // 监听云存储事件
    const handleSyncStart = () => {
      setSyncStatus(prev => ({ ...prev, syncing: true }));
    };

    const handleSyncComplete = (status: CloudSyncStatus) => {
      setSyncStatus(status);
    };

    const handleSyncError = (error: Error) => {
      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        lastError: error.message,
      }));
    };

    cloudStorageManager.on('syncStart', handleSyncStart);
    cloudStorageManager.on('syncComplete', handleSyncComplete);
    cloudStorageManager.on('syncError', handleSyncError);

    return () => {
      cloudStorageManager.off('syncStart', handleSyncStart);
      cloudStorageManager.off('syncComplete', handleSyncComplete);
      cloudStorageManager.off('syncError', handleSyncError);
    };
  }, []);

  const handleCloudSettingsChange = async (newSettings: CloudStorageSettingsType) => {
    try {
      // 更新设置
      const updatedSettings: AppSettings = {
        ...settings,
        cloudStorage: newSettings,
      };
      setSettings(updatedSettings);
      saveSettings(updatedSettings);

      // 初始化云存储管理器
      if (newSettings.enabled) {
        await cloudStorageManager.initialize(newSettings);
      } else {
        cloudStorageManager.disable();
      }

      setCloudSettings(newSettings);
    } catch (error) {
      toast.error('保存云存储设置失败: ' + (error as Error).message);
    }
  };

  const handleTestConnection = async () => {
    if (!cloudSettings?.enabled) {
      toast.error('请先配置云存储');
      return false;
    }

    try {
      await cloudStorageManager.initialize(cloudSettings);
      return await cloudStorageManager.testConnection();
    } catch (error) {
      console.error('测试连接失败:', error);
      return false;
    }
  };

  const handleManualSync = async () => {
    try {
      // 先上传本地数据
      await cloudStorageManager.uploadData(prompts, categories, settings);
      
      // 再下载云端数据（如果需要）
      const hasCloudData = await cloudStorageManager.hasCloudData();
      if (hasCloudData) {
        const cloudData = await cloudStorageManager.downloadData();
        if (cloudData) {
          // 可以在这里实现数据合并逻辑
          toast.success('同步完成');
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const handleUpload = async () => {
    await cloudStorageManager.uploadData(prompts, categories, settings);
  };

  const handleDownload = async () => {
    const cloudData = await cloudStorageManager.downloadData();
    if (cloudData) {
      // 保存下载的数据
      savePrompts(cloudData.prompts);
      saveCategories(cloudData.categories);
      
      // 更新设置
      if (cloudData.settings) {
        const updatedSettings = { ...settings, ...cloudData.settings };
        setSettings(updatedSettings);
        saveSettings(updatedSettings);
      }
      
      toast.success('数据已下载并保存，刷新页面查看最新数据');
      
      // 可选：自动刷新页面
      setTimeout(() => window.location.reload(), 2000);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* 页面头部 */}
      <div className="flex items-center gap-4 mb-6">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">设置</h1>
        </div>
      </div>

      {/* 设置选项卡 */}
      <Tabs defaultValue="ai" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI设置
          </TabsTrigger>
          <TabsTrigger value="cloud" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            云存储
          </TabsTrigger>
          <TabsTrigger value="plugins" className="flex items-center gap-2">
            <Puzzle className="h-4 w-4" />
            插件管理
          </TabsTrigger>
        </TabsList>

        {/* AI设置选项卡 */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI服务配置
              </CardTitle>
              <CardDescription>
                配置AI服务提供商和API密钥
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AISettings />
            </CardContent>
          </Card>

          {/* 使用说明 */}
          <Card>
            <CardHeader>
              <CardTitle>使用说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">配置步骤</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>选择AI服务提供商（OpenAI、Anthropic等）</li>
                  <li>输入相应的API密钥</li>
                  <li>选择要使用的模型</li>
                  <li>保存配置并测试连接</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">支持的服务商</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><strong>OpenAI</strong> - GPT-3.5、GPT-4等模型</li>
                  <li><strong>Anthropic</strong> - Claude系列模型</li>
                  <li><strong>自定义</strong> - 兼容OpenAI API的其他服务</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">安全提示</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>API密钥将安全存储在本地，不会上传到服务器</li>
                  <li>建议定期更换API密钥以确保安全</li>
                  <li>请勿与他人分享您的API密钥</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 云存储选项卡 */}
        <TabsContent value="cloud" className="space-y-6">
          <CloudStorageSettings
            settings={cloudSettings}
            onSettingsChange={handleCloudSettingsChange}
            onTestConnection={handleTestConnection}
            onManualSync={handleManualSync}
            onUpload={handleUpload}
            onDownload={handleDownload}
            syncStatus={syncStatus}
          />
        </TabsContent>

        {/* 插件管理选项卡 */}
        <TabsContent value="plugins" className="space-y-6">
          <PluginSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
