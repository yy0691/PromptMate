import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Sparkles, ArrowLeft, Puzzle, Cloud, Users } from "lucide-react";
import { AISettings } from "@/components/AISettings";
import { PluginSettings } from "@/components/PluginSettings";
import { CloudStorageSettings } from "@/components/CloudStorageSettings";
import { LinuxDoSettings } from "@/components/LinuxDoSettings";
import { useTranslation } from "react-i18next";
import { DataImportExport } from "@/components/DataImportExport";

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
  const { t } = useTranslation();

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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI设置
          </TabsTrigger>
          <TabsTrigger value="cloud" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            云同步
          </TabsTrigger>
          <TabsTrigger value="linuxdo" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            LinuxDo
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

        {/* 云同步选项卡 */}
        <TabsContent value="cloud" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                第三方云盘同步
              </CardTitle>
              <CardDescription>
                配置第三方云存储服务，实现跨设备数据同步
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CloudStorageSettings />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>数据管理</CardTitle>
              <CardDescription>
                本地数据备份、导入导出和高级同步功能
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataImportExport inline />
            </CardContent>
          </Card>
        </TabsContent>

        {/* LinuxDo 选项卡 */}
        <TabsContent value="linuxdo" className="space-y-6">
          <LinuxDoSettings />
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
