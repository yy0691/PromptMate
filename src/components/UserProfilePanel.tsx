/**
 * 用户信息面板组件
 * 显示用户信息、提示词统计、同步状态等
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePrompts } from '@/hooks/usePrompts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Icons } from '@/components/ui/icons';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { authService } from '@/services/authService';
import { syncService } from '@/services/syncService';
import { useCloudSync } from '@/hooks/useCloudSync';
import { Loader2 } from 'lucide-react';

interface UserProfilePanelProps {
  onSyncClick?: () => void;
}

export function UserProfilePanel({ onSyncClick }: UserProfilePanelProps) {
  const { user, isAuthenticated, getAccessToken } = useAuth();
  const { prompts, categories, allTags } = usePrompts();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { syncEnabled, syncing, lastSyncTime, manualSync, toggleSync } = useCloudSync({
    autoSync: true,
    syncInterval: 30000, // 30秒
  });

  // 手动同步
  const handleSync = async () => {
    if (!isAuthenticated || !user) {
      toast({
        title: t('auth.notLoggedIn') || '未登录',
        description: t('auth.pleaseLogin') || '请先登录',
        variant: 'destructive',
      });
      return;
    }

    await manualSync();
    onSyncClick?.();
  };

  if (!isAuthenticated || !user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.userInfo') || '用户信息'}</CardTitle>
          <CardDescription>
            {t('auth.notLoggedIn') || '未登录'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('auth.pleaseLoginToSync') || '请先登录以使用云同步功能'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // 获取用户头像首字母
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* 用户基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.user className="h-5 w-5" />
            {t('auth.userInfo') || '用户信息'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar_url || undefined} alt={user.nickname || user.email} />
              <AvatarFallback>{getInitials(user.nickname || user.email)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">
                {user.nickname || user.email}
              </h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <Badge variant="outline" className="mt-1">
                {t('auth.loggedIn') || '已登录'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据统计 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.fileText className="h-5 w-5" />
            {t('dataManagement.dataStatistics') || '数据统计'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{prompts.length}</div>
              <div className="text-sm text-muted-foreground">
                {t('dataManagement.totalPrompts') || '提示词'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{categories.length}</div>
              <div className="text-sm text-muted-foreground">
                {t('dataManagement.totalCategories') || '分类'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{allTags.length}</div>
              <div className="text-sm text-muted-foreground">
                {t('dataManagement.totalTags') || '标签'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 云同步状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.cloud className="h-5 w-5" />
            {t('dataManagement.cloudSync') || '云同步'}
          </CardTitle>
          <CardDescription>
            {t('dataManagement.cloudSyncDescription') || '将您的提示词和配置同步到云端'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {t('dataManagement.syncStatus') || '同步状态'}
                </p>
                <Switch
                  checked={syncEnabled}
                  onCheckedChange={toggleSync}
                />
              </div>
              {lastSyncTime ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('dataManagement.lastSync') || '最后同步'}: {new Date(lastSyncTime).toLocaleString('zh-CN')}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('dataManagement.neverSynced') || '从未同步'}
                </p>
              )}
            </div>
            <Badge variant={syncEnabled && lastSyncTime ? 'default' : 'secondary'}>
              {syncEnabled ? (lastSyncTime ? t('dataManagement.synced') || '已同步' : t('dataManagement.syncing') || '同步中') : t('dataManagement.notSynced') || '未同步'}
            </Badge>
          </div>

          <Separator />

          <div className="space-y-2">
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="w-full"
              variant="default"
            >
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('dataManagement.syncing') || '同步中...'}
                </>
              ) : (
                <>
                  <Icons.refresh className="mr-2 h-4 w-4" />
                  {t('dataManagement.manualSync') || '手动同步'}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {t('dataManagement.syncHint') || '点击按钮将本地数据同步到云端'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

