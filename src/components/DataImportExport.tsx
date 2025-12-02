/**
 * 数据管理组件 - 参考Cherry Studio设置界面设计
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { exportAllData, importAllData, exportPromptsToFile, importPromptsFromFile, resetToDefaults, loadPrompts, loadCategories, getAllTags } from "@/lib/data";
import { Icons } from "@/components/ui/icons";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import { useDataSync } from "@/hooks/useDataSync";
import { SyncConflictDialog } from "@/components/SyncConflictDialog";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { usePrompts } from "@/hooks/usePrompts";

interface DataImportExportProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDataChanged?: () => void;
  inline?: boolean;
}

// 设置分类枚举
enum SettingsCategory {
  CLOUD_SYNC = 'cloud-sync',
  DATA_MANAGEMENT = 'data-management',
  BACKUP_RESTORE = 'backup-restore',
  ADVANCED = 'advanced'
}

export function DataImportExport({ 
  open, 
  onOpenChange, 
  onDataChanged,
  inline = false
}: DataImportExportProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { prompts, categories, allTags } = usePrompts();
  
  // 主要状态管理 - 如果是内联模式，默认显示云同步（包含数据管理）
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(
    inline ? SettingsCategory.CLOUD_SYNC : SettingsCategory.CLOUD_SYNC
  );
  const [exportedData, setExportedData] = useState("");
  const [importData, setImportData] = useState("");
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  
  // 数据统计
  const dataStats = {
    totalPrompts: prompts.length,
    totalCategories: categories.length,
    totalTags: allTags.length
  };
  
  // 同步相关状态
  const { syncStatus, syncSettings, pendingConflict, manualSync, resolveConflict, toggleSync, updateSyncSettings } = useDataSync();
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  
  // 云同步相关状态
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [cloudProvider, setCloudProvider] = useState<'google' | 'dropbox' | 'onedrive' | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState<'realtime' | 'hourly' | 'daily'>('hourly');
  const [customPath, setCustomPath] = useState<string>("");

  // 组件挂载时
  useEffect(() => {
    console.log(t('dataManagement.message.loading'), { inline, activeCategory, open });
  }, []);

  // 同步同步设置到本地状态
  useEffect(() => {
    if (syncSettings) {
      setCloudSyncEnabled(Boolean(syncSettings.enabled));
      setAutoSyncEnabled(Boolean(syncSettings.autoSync));
      setCloudProvider(syncSettings.cloudProvider || null);
      setSyncInterval(syncSettings.syncInterval || 'hourly');
      if (syncSettings.dataPath) setCustomPath(syncSettings.dataPath);
    } else {
      setCloudSyncEnabled(syncStatus.enabled);
    }
  }, [syncSettings, syncStatus.enabled]);
  
  // 主动监听分类变化
  useEffect(() => {
    console.log(t('dataManagement.message.log2'), activeCategory);
  }, [activeCategory]);
  
  // 处理冲突对话框显示
  useEffect(() => {
    if (pendingConflict && !showConflictDialog) {
      setShowConflictDialog(true);
    }
  }, [pendingConflict, showConflictDialog]);

  // 处理冲突解决
  const handleConflictResolve = async (resolution: 'local' | 'remote' | 'merge') => {
    await resolveConflict(resolution);
    setShowConflictDialog(false);
    onDataChanged?.(); // 通知数据已更改
  };

  // 手动同步处理
  const handleManualSync = async () => {
    await manualSync();
    onDataChanged?.(); // 通知数据已更改
  };

  // 生成导出数据
  const handleExport = () => {
    const data = exportAllData();
    setExportedData(data);
    
    toast({
      title: t('dataManagement.message.log3'),
      description: t('dataManagement.message.log4'),
      variant: "success",
    });
  };

  // 下载导出的数据为文件
  const handleDownload = () => {
    if (!exportedData) {
      handleExport();
    }
    
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(exportedData)}`;
    const exportFileName = `promptmate-backup-${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
  };

  // 直接导出提示词到文件
  const handleExportPrompts = () => {
    exportPromptsToFile();
    
    toast({
      title: t('dataManagement.message.exported'),
      description: t('dataManagement.message.exportedFile'),
      variant: "success",
    });
  };

  // 从输入区域导入数据
  const handleImport = () => {
    if (!importData.trim()) {
      toast({
        title: t('dataManagement.message.importFailed'),
        description: t('dataManagement.message.importFailedData'),
        variant: "destructive",
      });
      return;
    }
    
    try {
      const success = importAllData(importData);
      
      if (success) {
        toast({
          title: t('dataManagement.message.importSuccess'),
          description: t('dataManagement.message.importSuccessData'),
          variant: "success",
        });
        
        setImportData("");
        onDataChanged?.();
        onOpenChange?.(false);
      } else {
        toast({
          title: t('dataManagement.message.importFailed'),
          description: t('dataManagement.message.importFailedData'),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t('dataManagement.message.importFailedError'),
        description: t('dataManagement.message.importFailedError'),
        variant: "destructive",
      });
    }
  };

  // 从文件导入数据
  const handleImportFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        setImportData(content);
        
        toast({
          title: t('dataManagement.message.importFile'),
          description: t('dataManagement.message.importFileDesc'),
          variant: "success",
        });
      } catch (error) {
        toast({
          title: t('dataManagement.message.importFileError'),
          description: t('dataManagement.message.importFileErrorDesc'),
          variant: "destructive",
        });
      }
    };
    
    reader.readAsText(file);
  };

  // 从文件导入提示词
  const handleImportPromptsFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const success = await importPromptsFromFile(content);
        
        if (success) {
          toast({
            title: t('dataManagement.importPromptsSuccess') || '导入成功',
            description: t('dataManagement.importPromptsSuccess') || '提示词已成功导入',
            variant: "success",
          });
          
          // 重置文件输入
          event.target.value = '';
          // 触发数据刷新
          onDataChanged?.();
        } else {
          toast({
            title: t('dataManagement.importPromptsFailed') || '导入失败',
            description: t('dataManagement.importPromptsFailed') || '提示词导入失败，请检查文件格式',
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('导入提示词出错:', error);
        toast({
          title: t('dataManagement.message.importFileError') || '导入错误',
          description: error instanceof Error ? error.message : t('dataManagement.message.importFileErrorDesc') || '文件读取失败',
          variant: "destructive",
        });
      }
    };
    
    reader.readAsText(file);
  };

  // 重置为默认数据
  const handleReset = async () => {
    try {
      await resetToDefaults();
      
      toast({
        title: t('dataManagement.message.resetSuccess'),
        description: t('dataManagement.message.resetSuccessData'),
        variant: "warning",
      });
      
      setShowConfirmReset(false);
      
      // 延迟触发数据变更回调，确保数据已保存
      setTimeout(() => {
        onDataChanged?.();
      }, 100);
      
      onOpenChange?.(false);
    } catch (error) {
      console.error('重置数据失败:', error);
      toast({
        title: t('dataManagement.message.resetError'),
        description: t('dataManagement.message.resetErrorData'),
        variant: "destructive",
      });
    }
  };

  // 渲染侧边栏导航
  const renderSidebar = () => (
    <div className={`w-64 border-r bg-muted/30 p-2 space-y-2 ${inline ? 'h-full' : 'h-full overflow-y-auto'}`}>
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">{t('dataManagement.title')}</h3>
      
      {/* 云同步 */}
      <Button
        variant={activeCategory === SettingsCategory.CLOUD_SYNC ? "secondary" : "ghost"}
        className="w-full justify-start"
        onClick={() => setActiveCategory(SettingsCategory.CLOUD_SYNC)}
      >
        <Icons.cloud className="mr-2 h-4 w-4" />
        {t('dataManagement.cloudSync')}
        {cloudSyncEnabled && <Badge variant="secondary" className="ml-auto text-xs">ON</Badge>}
      </Button>
      
      {/* 数据管理 */}
        <Button
        variant={activeCategory === SettingsCategory.DATA_MANAGEMENT ? "secondary" : "ghost"}
        className="w-full justify-start"
        onClick={() => setActiveCategory(SettingsCategory.DATA_MANAGEMENT)}
      >
        <Icons.database className="mr-2 h-4 w-4" />
        {t('dataManagement.dataManagement')}
        </Button>
      
      {/* 备份恢复 */}
        <Button
        variant={activeCategory === SettingsCategory.BACKUP_RESTORE ? "secondary" : "ghost"}
        className="w-full justify-start"
        onClick={() => setActiveCategory(SettingsCategory.BACKUP_RESTORE)}
      >
        <Icons.archive className="mr-2 h-4 w-4" />
        {t('dataManagement.backupRestore')}
        </Button>
      
      {/* 高级设置 */}
        <Button
        variant={activeCategory === SettingsCategory.ADVANCED ? "secondary" : "ghost"}
        className="w-full justify-start"
        onClick={() => setActiveCategory(SettingsCategory.ADVANCED)}
      >
        <Icons.settings className="mr-2 h-4 w-4" />
        {t('dataManagement.advanced')}
        </Button>
    </div>
  );

  // 渲染主内容区域
  const renderMainContent = () => (
    <div className={`flex-1 ${inline ? 'overflow-y-auto' : 'overflow-hidden'}`}>
      <div className={`${inline ? 'p-6' : 'h-full overflow-y-auto p-6'} space-y-6`}>
        {activeCategory === SettingsCategory.CLOUD_SYNC && renderCloudSyncContent()}
        {activeCategory === SettingsCategory.DATA_MANAGEMENT && renderDataManagementContent()}
        {activeCategory === SettingsCategory.BACKUP_RESTORE && renderBackupRestoreContent()}
        {activeCategory === SettingsCategory.ADVANCED && renderAdvancedContent()}
      </div>
    </div>
  );

  // 渲染云同步内容
  const renderCloudSyncContent = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">{t('dataManagement.cloudSync')}</h2>
        <p className="text-muted-foreground">{t('dataManagement.cloudSyncDescription')}</p>
      </div>
      
      {/* 云同步开关 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Icons.cloud className="mr-2 h-5 w-5" />
            {t('dataManagement.enableCloudSync')}
          </CardTitle>
          <CardDescription>
            {t('dataManagement.enableCloudSyncDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="cloud-sync">{t('dataManagement.cloudSync')}</Label>
              <p className="text-sm text-muted-foreground">
                {cloudSyncEnabled ? t('dataManagement.cloudSyncEnabled') : t('dataManagement.cloudSyncDisabled')}
              </p>
            </div>
            <Switch
              id="cloud-sync"
              checked={cloudSyncEnabled}
              onCheckedChange={(checked) => {
                setCloudSyncEnabled(checked);
                toggleSync(checked);
                toast({
                  title: checked ? t('dataManagement.cloudSyncEnabled') : t('dataManagement.cloudSyncDisabled'),
                  variant: checked ? 'success' : 'default'
                });
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 云服务提供商选择 */}
      {cloudSyncEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>{t('dataManagement.cloudProvider')}</CardTitle>
            <CardDescription>
              {t('dataManagement.cloudProviderDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
        <Button
                variant={cloudProvider === 'google' ? "default" : "outline"}
                className="h-20 flex-col"
                onClick={() => {
                  setCloudProvider('google');
                  updateSyncSettings({ cloudProvider: 'google' });
                  toast({ title: t('dataManagement.cloudProviderSelected', { provider: 'Google Drive' }) });
                }}
              >
                <Icons.google className="h-6 w-6 mb-2" />
                Google Drive
        </Button>
        <Button
                variant={cloudProvider === 'dropbox' ? "default" : "outline"}
                className="h-20 flex-col"
                onClick={() => {
                  setCloudProvider('dropbox');
                  updateSyncSettings({ cloudProvider: 'dropbox' });
                  toast({ title: t('dataManagement.cloudProviderSelected', { provider: 'Dropbox' }) });
                }}
              >
                <Icons.dropbox className="h-6 w-6 mb-2" />
                Dropbox
        </Button>
        <Button
                variant={cloudProvider === 'onedrive' ? "default" : "outline"}
                className="h-20 flex-col"
                onClick={() => {
                  setCloudProvider('onedrive');
                  updateSyncSettings({ cloudProvider: 'onedrive' });
                  toast({ title: t('dataManagement.cloudProviderSelected', { provider: 'OneDrive' }) });
                }}
              >
                <Icons.microsoft className="h-6 w-6 mb-2" />
                OneDrive
        </Button>
      </div>
      
            {cloudProvider && (
              <Alert>
                <Icons.info className="h-4 w-4" />
                <AlertDescription>
                  {t('dataManagement.cloudProviderSelected', { provider: cloudProvider })}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* 同步设置 */}
      {cloudSyncEnabled && cloudProvider && (
        <Card>
          <CardHeader>
            <CardTitle>{t('dataManagement.syncSettings')}</CardTitle>
            <CardDescription>
              {t('dataManagement.syncSettingsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-sync">{t('dataManagement.autoSync')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('dataManagement.autoSyncDescription')}
                </p>
            </div>
              <Switch
                id="auto-sync"
                checked={autoSyncEnabled}
                onCheckedChange={(checked) => {
                  setAutoSyncEnabled(checked);
                  updateSyncSettings({ autoSync: checked });
                }}
              />
            </div>
            
            {autoSyncEnabled && (
              <div className="space-y-2">
                <Label>{t('dataManagement.syncInterval')}</Label>
                <div className="flex space-x-2">
                  <Button
                    variant={syncInterval === 'realtime' ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSyncInterval('realtime');
                      updateSyncSettings({ syncInterval: 'realtime' });
                    }}
                  >
                    {t('dataManagement.realtime')}
                  </Button>
                  <Button
                    variant={syncInterval === 'hourly' ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSyncInterval('hourly');
                      updateSyncSettings({ syncInterval: 'hourly' });
                    }}
                  >
                    {t('dataManagement.hourly')}
                  </Button>
                  <Button
                    variant={syncInterval === 'daily' ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSyncInterval('daily');
                      updateSyncSettings({ syncInterval: 'daily' });
                    }}
                  >
                    {t('dataManagement.daily')}
                  </Button>
                </div>
              </div>
            )}

            {/* 云端同步文件路径设置 */}
            <div className="space-y-2">
              <Label>云端同步文件路径</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={"/path/to/your/cloud/folder/sync-data.json"}
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    let p = (customPath || '').trim();
                    if (!p) return;
                    if (!p.toLowerCase().endsWith('.json')) {
                      // 允许用户输入目录，自动补全文件名
                      if (p.endsWith('/') || p.endsWith('\\')) {
                        p = p + 'sync-data.json';
                      } else {
                        p = p + '/sync-data.json';
                      }
                    }
                    updateSyncSettings({ dataPath: p, cloudProvider: null });
                    toast({ title: '已更新云同步路径', description: p });
                  }}
                >
                  应用路径
                </Button>
              </div>
              {syncSettings?.dataPath && (
                <p className="text-xs text-muted-foreground">当前：{syncSettings.dataPath}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 当前同步状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SyncStatusIndicator />
            <span className="ml-2">{t('dataManagement.syncStatus')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('dataManagement.sync.syncEnabled')}</span>
              <Badge variant={syncStatus.enabled ? "default" : "secondary"}>
                {syncStatus.enabled ? t('common.enabled') : t('common.disabled')}
              </Badge>
          </div>
          
            {syncStatus.lastSync && (
              <div className="flex items-center justify-between">
                <span className="text-sm">{t('dataManagement.lastSync')}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(syncStatus.lastSync).toLocaleString()}
                </span>
            </div>
          )}
          
            <div className="flex space-x-2">
              <Button
                onClick={handleManualSync}
                disabled={!syncStatus.enabled || syncStatus.syncing}
                size="sm"
              >
                <Icons.refresh className={`mr-2 h-4 w-4 ${syncStatus.syncing ? 'animate-spin' : ''}`} />
                {syncStatus.syncing ? t('dataManagement.sync.syncing') : t('dataManagement.sync.manualSync')}
              </Button>
              
              {syncStatus.hasConflicts && (
            <Button 
              variant="destructive" 
                  onClick={() => setShowConflictDialog(true)}
                  size="sm"
            >
                  <Icons.alertTriangle className="mr-2 h-4 w-4" />
                  {t('dataManagement.resolveConflicts')}
            </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // 渲染数据管理内容
  const renderDataManagementContent = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">{t('dataManagement.dataManagement')}</h2>
        <p className="text-muted-foreground">{t('dataManagement.dataManagementDescription')}</p>
      </div>

      {/* 数据统计 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dataManagement.dataStatistics')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{dataStats.totalPrompts}</div>
              <div className="text-sm text-muted-foreground">{t('dataManagement.totalPrompts')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{dataStats.totalCategories}</div>
              <div className="text-sm text-muted-foreground">{t('dataManagement.totalCategories')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{dataStats.totalTags}</div>
              <div className="text-sm text-muted-foreground">{t('dataManagement.totalTags')}</div>
          </div>
        </div>
        </CardContent>
      </Card>

      {/* 提示词导入导出 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.fileExport className="h-5 w-5" />
            {t('dataManagement.promptImportExport') || '提示词导入导出'}
          </CardTitle>
          <CardDescription>
            {t('dataManagement.promptImportExportDescription') || '导入或导出提示词数据，支持JSON格式'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 导出提示词 */}
          <div className="space-y-2">
            <Label>{t('dataManagement.exportPrompts') || '导出提示词'}</Label>
            <Button 
              onClick={handleExportPrompts} 
              className="w-full h-12"
              variant="default"
            >
              <Icons.fileExport className="mr-2 h-4 w-4" />
              {t('dataManagement.exportPrompts') || '导出提示词到文件'}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t('dataManagement.exportPromptsHint') || '将当前所有提示词导出为JSON文件'}
            </p>
          </div>
          
          <Separator />
          
          {/* 导入提示词 */}
          <div className="space-y-2">
            <Label>{t('dataManagement.importPrompts') || '导入提示词'}</Label>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => document.getElementById('prompt-file-upload')?.click()}
                className="flex-1"
              >
                <Icons.fileUp className="mr-2 h-4 w-4" />
                {t('dataManagement.selectFile') || '选择文件'}
              </Button>
              <input
                id="prompt-file-upload"
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportPromptsFromFile}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('dataManagement.importPromptsHint') || '从JSON文件导入提示词，新提示词将与现有提示词合并'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 完整数据导入导出 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dataManagement.dataOperations')}</CardTitle>
          <CardDescription>
            {t('dataManagement.dataOperationsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={handleExport} className="h-20 flex-col">
              <Icons.fileJson className="h-6 w-6 mb-2" />
              {t('dataManagement.exportData')}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => document.getElementById('file-upload')?.click()}
              className="h-20 flex-col"
            >
              <Icons.fileUp className="h-6 w-6 mb-2" />
              {t('dataManagement.importData')}
            </Button>
          </div>
          
          <input
            id="file-upload"
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFromFile}
          />
          
          {importData && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>{t('dataManagement.importDataPreview') || '导入数据预览'}</Label>
                <Textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  className="h-32 font-mono text-xs"
                  placeholder={t('dataManagement.importDataPlaceholder')}
                />
                <div className="flex space-x-2">
                  <Button 
                    onClick={handleImport} 
                    className="flex-1"
                    disabled={!importData.trim()}
                  >
                    <Icons.check className="mr-2 h-4 w-4" />
                    {t('dataManagement.confirmImport') || '确认导入'}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setImportData("")}
                  >
                    {t('common.clear') || '清空'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
        </div>
  );

  // 渲染备份恢复内容
  const renderBackupRestoreContent = () => (
    <div className="space-y-6">
              <div>
        <h2 className="text-2xl font-bold mb-2">{t('dataManagement.backupRestore')}</h2>
        <p className="text-muted-foreground">{t('dataManagement.backupRestoreDescription')}</p>
                </div>

      {/* 自动备份 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dataManagement.autoBackup')}</CardTitle>
          <CardDescription>
            {t('dataManagement.autoBackupDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-backup">{t('dataManagement.enableAutoBackup')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('dataManagement.autoBackupHelp')}
              </p>
              </div>
            <Switch id="auto-backup" />
            </div>
        </CardContent>
      </Card>

      {/* 手动备份 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dataManagement.manualBackup')}</CardTitle>
          <CardDescription>
            {t('dataManagement.manualBackupDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={handleDownload} disabled={!exportedData} className="h-16 flex-col">
              <Icons.download className="h-6 w-6 mb-2" />
              {t('dataManagement.downloadBackup')}
            </Button>
            <Button onClick={handleExport} variant="outline" className="h-16 flex-col">
              <Icons.fileJson className="h-6 w-6 mb-2" />
              {t('dataManagement.generateBackup')}
            </Button>
          </div>
          
          {exportedData && (
          <div className="space-y-2">
              <Label>{t('dataManagement.backupPreview')}</Label>
              <Textarea
                value={exportedData}
                readOnly
                className="h-32 font-mono text-xs"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // 渲染高级设置内容
  const renderAdvancedContent = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">{t('dataManagement.advanced')}</h2>
        <p className="text-muted-foreground">{t('dataManagement.advancedDescription')}</p>
      </div>

      {/* 危险操作 */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">{t('dataManagement.dangerousOperations')}</CardTitle>
          <CardDescription>
            {t('dataManagement.dangerousOperationsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <Icons.alertTriangle className="h-4 w-4" />
            <AlertTitle>{t('common.warning')}</AlertTitle>
            <AlertDescription>
              {t('dataManagement.resetWarning')}
            </AlertDescription>
          </Alert>
          
          <div className="mt-4">
              <Button
                variant="destructive"
              onClick={() => setShowConfirmReset(true)}
                className="w-full"
              >
              <Icons.trash className="mr-2 h-4 w-4" />
              {t('dataManagement.resetToDefaults')}
              </Button>
          </div>
        </CardContent>
      </Card>

      {/* 开发者选项 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dataManagement.developerOptions')}</CardTitle>
          <CardDescription>
            {t('dataManagement.developerOptionsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="debug-mode">{t('dataManagement.debugMode')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('dataManagement.debugModeDescription')}
              </p>
            </div>
            <Switch id="debug-mode" />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="verbose-logging">{t('dataManagement.verboseLogging')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('dataManagement.verboseLoggingDescription')}
              </p>
            </div>
            <Switch id="verbose-logging" />
            </div>
        </CardContent>
      </Card>
        </div>
  );

  // 渲染主内容
  const renderContent = () => (
    <div className={`flex ${inline ? 'h-full' : 'h-full min-h-0'}`}>
      {!inline && renderSidebar()}
      {inline ? (
        <div className="flex-1 h-full overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            {activeCategory === SettingsCategory.CLOUD_SYNC && renderCloudSyncContent()}
            {activeCategory === SettingsCategory.DATA_MANAGEMENT && renderDataManagementContent()}
            {activeCategory === SettingsCategory.BACKUP_RESTORE && renderBackupRestoreContent()}
            {activeCategory === SettingsCategory.ADVANCED && renderAdvancedContent()}
          </div>
        </div>
      ) : (
        renderMainContent()
      )}
    </div>
  );

  // 如果是内联模式，直接渲染内容
  if (inline) {
    return (
      <div className="data-import-export-inline h-full flex flex-col">
        {/* 内联模式下的侧边栏导航 */}
        <div className="flex-shrink-0 border-b p-2">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={activeCategory === SettingsCategory.CLOUD_SYNC ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveCategory(SettingsCategory.CLOUD_SYNC)}
            >
              <Icons.cloud className="mr-2 h-4 w-4" />
              {t('dataManagement.cloudSync')}
            </Button>
            <Button
              variant={activeCategory === SettingsCategory.DATA_MANAGEMENT ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveCategory(SettingsCategory.DATA_MANAGEMENT)}
            >
              <Icons.database className="mr-2 h-4 w-4" />
              {t('dataManagement.dataManagement')}
            </Button>
            <Button
              variant={activeCategory === SettingsCategory.BACKUP_RESTORE ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveCategory(SettingsCategory.BACKUP_RESTORE)}
            >
              <Icons.archive className="mr-2 h-4 w-4" />
              {t('dataManagement.backupRestore')}
            </Button>
            <Button
              variant={activeCategory === SettingsCategory.ADVANCED ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveCategory(SettingsCategory.ADVANCED)}
            >
              <Icons.settings className="mr-2 h-4 w-4" />
              {t('dataManagement.advanced')}
            </Button>
          </div>
        </div>
        {/* 内容区域 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto p-4">
            {activeCategory === SettingsCategory.CLOUD_SYNC && renderCloudSyncContent()}
            {activeCategory === SettingsCategory.DATA_MANAGEMENT && renderDataManagementContent()}
            {activeCategory === SettingsCategory.BACKUP_RESTORE && renderBackupRestoreContent()}
            {activeCategory === SettingsCategory.ADVANCED && renderAdvancedContent()}
          </div>
        </div>
        
        {/* 确认重置对话框 */}
        <Dialog open={showConfirmReset} onOpenChange={setShowConfirmReset}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('common.confirmReset')}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Alert variant="destructive">
                <Icons.alertTriangle className="h-4 w-4" />
                <AlertTitle>{t('common.warning')}</AlertTitle>
                <AlertDescription>
                  {t('dataManagement.message.resetWarning')}
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmReset(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" onClick={handleReset}>
                <Icons.trash className="mr-2 h-4 w-4" />
                {t('common.confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* 同步冲突对话框 */}
        <SyncConflictDialog
          conflict={pendingConflict}
          open={showConflictDialog}
          onOpenChange={setShowConflictDialog}
          onResolve={handleConflictResolve}
        />
      </div>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl h-[80vh] p-0 flex flex-col">
          <DialogHeader className="p-6 pb-0 flex-shrink-0">
            <DialogTitle className="text-xl">{t('dataManagement.title')}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 overflow-hidden">
          {renderContent()}
          </div>
          
          <DialogFooter className="p-6 pt-0 flex-shrink-0">
            <Button variant="outline" onClick={() => onOpenChange?.(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 确认重置对话框 */}
      <Dialog open={showConfirmReset} onOpenChange={setShowConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.confirmReset')}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive">
              <Icons.alertTriangle className="h-4 w-4" />
              <AlertTitle>{t('common.warning')}</AlertTitle>
              <AlertDescription>
                {t('dataManagement.message.resetWarning')}
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmReset(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleReset}>
              <Icons.trash className="mr-2 h-4 w-4" />
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 同步冲突对话框 */}
      <SyncConflictDialog
        conflict={pendingConflict}
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        onResolve={handleConflictResolve}
      />
    </>
  );
}