import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserPreferences, UserPreferences } from '@/hooks/useUserPreferences';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings,
  Monitor,
  Eye,
  Save,
  RefreshCw,
  Download,
  Upload
} from 'lucide-react';

interface PreferencesPanelProps {
  className?: string;
}

export function PreferencesPanel({ className }: PreferencesPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    preferences,
    updatePreference,
    resetPreferences,
    exportPreferences,
    importPreferences,
    loading,
    error
  } = useUserPreferences();

  // 处理偏好设置重置
  const handleReset = async () => {
    const success = await resetPreferences();
    if (success) {
      toast({
        title: t('preferences.resetSuccess'),
        description: t('preferences.resetSuccessDescription'),
        variant: 'default',
      });
    } else {
      toast({
        title: t('preferences.resetFailed'),
        description: t('preferences.resetFailedDescription'),
        variant: 'destructive',
      });
    }
  };

  // 处理偏好设置导出
  const handleExport = () => {
    try {
      const data = exportPreferences();
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(data)}`;
      const exportFileName = `promptmate-preferences-${new Date().toISOString().slice(0, 10)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileName);
      linkElement.click();
      
      toast({
        title: t('preferences.exportSuccess'),
        description: t('preferences.exportSuccessDescription'),
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: t('preferences.exportFailed'),
        description: t('preferences.exportFailedDescription'),
        variant: 'destructive',
      });
    }
  };

  // 处理偏好设置导入
  const handleImportFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result as string;
        const success = await importPreferences(data);
        
        if (success) {
          toast({
            title: t('preferences.importSuccess'),
            description: t('preferences.importSuccessDescription'),
            variant: 'default',
          });
        } else {
          toast({
            title: t('preferences.importFailed'),
            description: t('preferences.importFailedDescription'),
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: t('preferences.importFailed'),
          description: t('preferences.importFailedDescription'),
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    
    // 重置文件输入
    event.target.value = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">{t('preferences.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        <p>{t('preferences.loadError')}</p>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 界面偏好 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            {t('preferences.ui.title')}
          </CardTitle>
          <CardDescription>
            {t('preferences.ui.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 侧边栏设置 */}
          <div className="space-y-2">
            <Label>{t('preferences.ui.sidebar')}</Label>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('preferences.ui.sidebarExpanded')}
              </span>
              <Switch
                checked={preferences.ui.sidebarExpanded}
                onCheckedChange={(checked) => 
                  updatePreference('ui', { sidebarExpanded: checked })
                }
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('preferences.ui.sidebarWidth')}
                </span>
                <span className="text-sm font-medium">
                  {preferences.ui.sidebarWidth}px
                </span>
              </div>
              <Slider
                value={[preferences.ui.sidebarWidth]}
                onValueChange={([value]) => 
                  updatePreference('ui', { sidebarWidth: value })
                }
                min={200}
                max={500}
                step={10}
                className="w-full"
              />
            </div>
          </div>

          <Separator />

          {/* 主题设置 */}
          <div className="space-y-2">
            <Label>{t('preferences.ui.theme')}</Label>
            <Select
              value={preferences.ui.theme}
              onValueChange={(value: 'light' | 'dark' | 'system') =>
                updatePreference('ui', { theme: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('preferences.ui.lightTheme')}</SelectItem>
                <SelectItem value="dark">{t('preferences.ui.darkTheme')}</SelectItem>
                <SelectItem value="system">{t('preferences.ui.systemTheme')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* 字体设置 */}
          <div className="space-y-2">
            <Label>{t('preferences.ui.font')}</Label>
            <div className="space-y-2">
              <Select
                value={preferences.ui.font}
                onValueChange={(value) => updatePreference('ui', { font: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system-ui">系统字体</SelectItem>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="Roboto">Roboto</SelectItem>
                  <SelectItem value="Noto Sans SC">Noto Sans SC</SelectItem>
                  <SelectItem value="微软雅黑">微软雅黑</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('preferences.ui.fontSize')}
                  </span>
                  <span className="text-sm font-medium">
                    {preferences.ui.fontSize}px
                  </span>
                </div>
                <Slider
                  value={[preferences.ui.fontSize]}
                  onValueChange={([value]) => 
                    updatePreference('ui', { fontSize: value })
                  }
                  min={12}
                  max={20}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 编辑器偏好 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('preferences.editor.title')}
          </CardTitle>
          <CardDescription>
            {t('preferences.editor.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('preferences.editor.wordWrap')}
            </span>
            <Switch
              checked={preferences.editor.wordWrap}
              onCheckedChange={(checked) => 
                updatePreference('editor', { wordWrap: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('preferences.editor.autoSave')}
            </span>
            <Switch
              checked={preferences.editor.autoSave}
              onCheckedChange={(checked) => 
                updatePreference('editor', { autoSave: checked })
              }
            />
          </div>

          {preferences.editor.autoSave && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('preferences.editor.autoSaveInterval')}
                </span>
                <span className="text-sm font-medium">
                  {preferences.editor.autoSaveInterval / 1000}s
                </span>
              </div>
              <Slider
                value={[preferences.editor.autoSaveInterval]}
                onValueChange={([value]) => 
                  updatePreference('editor', { autoSaveInterval: value })
                }
                min={1000}
                max={10000}
                step={1000}
                className="w-full"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 功能偏好 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {t('preferences.features.title')}
          </CardTitle>
          <CardDescription>
            {t('preferences.features.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('preferences.features.showPreviewByDefault')}
            </span>
            <Switch
              checked={preferences.features.showPreviewByDefault}
              onCheckedChange={(checked) => 
                updatePreference('features', { showPreviewByDefault: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('preferences.features.enableVariableHighlight')}
            </span>
            <Switch
              checked={preferences.features.enableVariableHighlight}
              onCheckedChange={(checked) => 
                updatePreference('features', { enableVariableHighlight: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('preferences.features.enableAutoComplete')}
            </span>
            <Switch
              checked={preferences.features.enableAutoComplete}
              onCheckedChange={(checked) => 
                updatePreference('features', { enableAutoComplete: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('preferences.features.enableTooltips')}
            </span>
            <Switch
              checked={preferences.features.enableTooltips}
              onCheckedChange={(checked) => 
                updatePreference('features', { enableTooltips: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 同步偏好 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            {t('preferences.sync.title')}
          </CardTitle>
          <CardDescription>
            {t('preferences.sync.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('preferences.sync.includePreferences')}
            </span>
            <Switch
              checked={preferences.sync.includePreferences}
              onCheckedChange={(checked) => 
                updatePreference('sync', { includePreferences: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('preferences.actions.title')}</CardTitle>
          <CardDescription>
            {t('preferences.actions.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleExport}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {t('preferences.actions.export')}
            </Button>

            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportFromFile}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Button
                variant="outline"
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {t('preferences.actions.import')}
              </Button>
            </div>

            <Button
              variant="destructive"
              onClick={handleReset}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {t('preferences.actions.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
















