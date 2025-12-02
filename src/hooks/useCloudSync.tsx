/**
 * 云同步 Hook
 * 自动同步提示词和配置到云端
 */

import { useEffect, useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { usePrompts } from './usePrompts';
import { useSettings } from './useSettings';
import { syncService } from '@/services/syncService';
import { useToast } from './use-toast';
import { useTranslation } from 'react-i18next';

interface CloudSyncOptions {
  autoSync?: boolean;
  syncInterval?: number; // 毫秒
}

export function useCloudSync(options: CloudSyncOptions = {}) {
  const { autoSync = true, syncInterval = 30000 } = options;
  const { isAuthenticated, user } = useAuth();
  const { prompts, categories } = usePrompts();
  const { settings } = useSettings();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);

  // 加载同步设置
  useEffect(() => {
    const saved = localStorage.getItem('promptmate_cloud_sync_enabled');
    if (saved !== null) {
      setSyncEnabled(saved === 'true');
    } else {
      // 默认启用自动同步（如果已登录）
      setSyncEnabled(isAuthenticated);
    }
  }, [isAuthenticated]);

  // 加载最后同步时间
  useEffect(() => {
    const saved = localStorage.getItem('promptmate_last_sync');
    if (saved) {
      setLastSyncTime(saved);
    }
  }, []);

  // 执行同步
  const performSync = useCallback(async (silent = false) => {
    if (!isAuthenticated || !user || syncing) {
      return;
    }

    setSyncing(true);
    try {
      // 同步提示词
      if (prompts.length > 0) {
        await syncService.syncPrompts(prompts);
      }

      // 同步分类
      if (categories.length > 0) {
        await syncService.syncCategories(categories);
      }

      const now = new Date().toISOString();
      setLastSyncTime(now);
      localStorage.setItem('promptmate_last_sync', now);

      if (!silent) {
        toast({
          title: t('dataManagement.syncSuccess') || '同步成功',
          description: t('dataManagement.syncSuccessDesc') || '数据已同步到云端',
          variant: 'success',
        });
      }
    } catch (error: any) {
      console.error('同步失败:', error);
      if (!silent) {
        toast({
          title: t('dataManagement.syncFailed') || '同步失败',
          description: error.message || t('dataManagement.syncFailedDesc') || '同步过程中出现错误',
          variant: 'destructive',
        });
      }
    } finally {
      setSyncing(false);
    }
  }, [isAuthenticated, user, prompts, categories, syncing, toast, t]);

  // 自动同步
  useEffect(() => {
    if (!autoSync || !syncEnabled || !isAuthenticated || syncing) {
      return;
    }

    const interval = setInterval(() => {
      performSync(true); // 静默同步
    }, syncInterval);

    return () => clearInterval(interval);
  }, [autoSync, syncEnabled, isAuthenticated, syncInterval, syncing, performSync]);

  // 数据变更时自动同步（防抖）
  useEffect(() => {
    if (!syncEnabled || !isAuthenticated || syncing) {
      return;
    }

    const timeoutId = setTimeout(() => {
      performSync(true); // 静默同步
    }, 2000); // 2秒防抖

    return () => clearTimeout(timeoutId);
  }, [prompts, categories, syncEnabled, isAuthenticated, syncing, performSync]);

  // 手动同步
  const manualSync = useCallback(async () => {
    await performSync(false);
  }, [performSync]);

  // 启用/禁用同步
  const toggleSync = useCallback((enabled: boolean) => {
    setSyncEnabled(enabled);
    localStorage.setItem('promptmate_cloud_sync_enabled', enabled.toString());
  }, []);

  return {
    syncEnabled,
    syncing,
    lastSyncTime,
    manualSync,
    toggleSync,
    performSync,
  };
}

