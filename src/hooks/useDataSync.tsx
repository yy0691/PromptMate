import { useState, useEffect, useCallback } from 'react';
import { usePrompts } from './usePrompts';
import { useToast } from './use-toast';
import { Prompt, Category, Settings } from '../types';
import { importAllData } from '../lib/data';

// 条件导入SyncManager，仅在Electron环境中可用
let SyncManager: any = null;
let SyncData: any = null;

// 检查是否在Electron环境中（优先检测 preload 注入的 electronAPI，其次检测 Electron 版本标识）
const isElectron = () => {
  const w = typeof window !== 'undefined' ? (window as any) : {};
  const hasPreloadAPI = !!w.electronAPI;
  const isElectronRuntime = typeof process !== 'undefined' && !!(process as any).versions?.electron;
  return hasPreloadAPI || isElectronRuntime;
};

// 临时类型定义
interface SyncDataType {
  version: string;
  lastModified: string;
  prompts: Prompt[];
  categories: Category[];
  settings: Settings;
  syncMetadata: {
    source: 'desktop' | 'extension';
    checksum: string;
  };
}

// 动态导入SyncManager
const loadSyncManager = async () => {
  if (isElectron() && !SyncManager) {
    try {
      const syncModule = await import('../lib/syncManager');
      SyncManager = syncModule.SyncManager;
      SyncData = syncModule.SyncData;
      return true;
    } catch (error) {
      console.warn('无法加载SyncManager，可能不在Electron环境中:', error);
      return false;
    }
  }
  return false;
};

export interface SyncStatus {
  enabled: boolean;
  connected: boolean;
  lastSync: string | null;
  hasConflicts: boolean;
  syncing: boolean;
  error: string | null;
}

export interface SyncConflict {
  localData: SyncDataType;
  remoteData: SyncDataType;
  timestamp: string;
}

export const useDataSync = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    enabled: false,
    connected: false,
    lastSync: null,
    hasConflicts: false,
    syncing: false,
    error: null
  });
  
  const [pendingConflict, setPendingConflict] = useState<SyncConflict | null>(null);
  const [syncManager, setSyncManager] = useState<any>(null);
  const [isElectronEnv, setIsElectronEnv] = useState(false);
  const [syncSettings, setSyncSettings] = useState<any>(null);
  const { prompts, categories, settings, refreshData } = usePrompts();
  const { toast } = useToast();

  // 初始化同步管理器
  useEffect(() => {
    const initializeSync = async () => {
      try {
        // 检查环境并尝试加载SyncManager
        const electronCheck = isElectron();
        setIsElectronEnv(electronCheck);
        
        if (electronCheck) {
          const loaded = await loadSyncManager();
          if (loaded && SyncManager) {
            const manager = SyncManager.getInstance();
            setSyncManager(manager);
            
            await manager.initialize();
            
            // 更新同步状态
            const status = manager.getSyncStatus();
            setSyncStatus(prev => ({
              ...prev,
              enabled: status.enabled,
              connected: true,
              lastSync: status.lastSync,
              hasConflicts: status.hasConflicts
            }));

            // 获取并保存当前同步设置
            if (typeof manager.getSyncSettings === 'function') {
              setSyncSettings(manager.getSyncSettings());
            }

            // 设置事件监听器
            setupEventListeners(manager);
          } else {
            console.log('SyncManager不可用，跳过同步功能');
          }
        } else {
          console.log('非Electron环境，同步功能不可用');
        }
        
      } catch (error) {
        console.error('同步初始化失败:', error);
        setSyncStatus(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : '同步初始化失败'
        }));
      }
    };

    initializeSync();

    return () => {
      if (syncManager) {
        syncManager.removeAllListeners();
      }
    };
  }, []);

  // 设置事件监听器
  const setupEventListeners = useCallback((manager: any) => {
    if (!manager) return;
    
    // 数据变更事件
    manager.on('dataChanged', async (syncData: any) => {
      try {
        setSyncStatus(prev => ({ ...prev, syncing: true }));
        
        // 检测冲突
        const currentData = await createCurrentSyncData();
        const hasConflict = await manager.detectConflict(currentData, syncData);
        
        if (hasConflict) {
          // 显示冲突解决界面
          setPendingConflict({
            localData: currentData,
            remoteData: syncData,
            timestamp: new Date().toISOString()
          });
          
          setSyncStatus(prev => ({ ...prev, hasConflicts: true, syncing: false }));
          
          toast({
            title: "数据同步冲突",
            description: "检测到数据冲突，请选择解决方案",
            variant: "destructive"
          });
        } else {
          // 自动应用远程数据
          await applyRemoteData(syncData);
          
          setSyncStatus(prev => ({ 
            ...prev, 
            lastSync: new Date().toISOString(),
            syncing: false,
            error: null
          }));
          
          toast({
            title: "数据同步成功",
            description: "已从桌面端同步最新数据"
          });
        }
      } catch (error) {
        console.error('处理数据变更失败:', error);
        setSyncStatus(prev => ({
          ...prev,
          syncing: false,
          error: error instanceof Error ? error.message : '数据同步失败'
        }));
      }
    });

    // 同步完成事件
    manager.on('dataSynced', () => {
      setSyncStatus(prev => ({
        ...prev,
        lastSync: new Date().toISOString(),
        syncing: false,
        error: null
      }));
    });

    // 冲突检测事件
    manager.on('conflictDetected', ({ localData, remoteData }: { localData: any, remoteData: any }) => {
      setPendingConflict({
        localData,
        remoteData,
        timestamp: new Date().toISOString()
      });
      
      setSyncStatus(prev => ({ ...prev, hasConflicts: true }));
    });

    // 错误事件
    manager.on('error', (error: Error) => {
      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        error: error.message
      }));
      
      toast({
        title: "同步错误",
        description: error.message,
        variant: "destructive"
      });
    });

    // 设置变更事件
    manager.on('settingsChanged', (settings: any) => {
      setSyncStatus(prev => ({
        ...prev,
        enabled: settings.enabled
      }));
      setSyncSettings(settings);
    });
  }, [toast]);

  // 创建当前数据的同步格式
  const createCurrentSyncData = useCallback(async (): Promise<SyncDataType> => {
    return {
      version: '1.0.0',
      lastModified: new Date().toISOString(),
      prompts: prompts || [],
      categories: categories || [],
      settings: settings || {} as Settings,
      syncMetadata: {
        source: 'desktop',
        checksum: ''
      }
    };
  }, [prompts, categories, settings]);

  // 应用远程数据
  const applyRemoteData = useCallback(async (syncData: SyncDataType) => {
    const success = await importAllData(JSON.stringify({
      prompts: syncData.prompts || [],
      categories: syncData.categories || [],
      settings: syncData.settings || {},
    }));

    if (!success) {
      throw new Error('远程同步数据导入失败');
    }

    await refreshData();
  }, [refreshData]);

  // 手动同步
  const manualSync = useCallback(async () => {
    if (!syncManager || !isElectronEnv) {
      toast({
        title: "同步功能不可用",
        description: "同步功能仅在Electron环境中可用",
        variant: "destructive"
      });
      return;
    }

    try {
      setSyncStatus(prev => ({ ...prev, syncing: true, error: null }));
      
      if (prompts && categories && settings) {
        await syncManager.manualSync(prompts, categories, settings);
      }
      
      toast({
        title: "手动同步成功",
        description: "数据已同步到浏览器扩展"
      });
    } catch (error) {
      console.error('手动同步失败:', error);
      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : '手动同步失败'
      }));
      
      toast({
        title: "手动同步失败",
        description: error instanceof Error ? error.message : '手动同步失败',
        variant: "destructive"
      });
    }
  }, [prompts, categories, settings, syncManager, isElectronEnv, toast]);

  // 解决冲突
  const resolveConflict = useCallback(async (resolution: 'local' | 'remote' | 'merge') => {
    if (!pendingConflict || !syncManager || !isElectronEnv) return;

    try {
      setSyncStatus(prev => ({ ...prev, syncing: true }));
      
      const resolvedData = await syncManager.resolveConflict(
        pendingConflict.localData,
        pendingConflict.remoteData
      );
      
      if (resolution === 'remote') {
        await applyRemoteData(pendingConflict.remoteData);
      } else if (resolution === 'merge') {
        await applyRemoteData(resolvedData);
      }
      // 'local' 情况下不需要做任何事，保持本地数据
      
      setPendingConflict(null);
      setSyncStatus(prev => ({
        ...prev,
        hasConflicts: false,
        syncing: false,
        lastSync: new Date().toISOString()
      }));
      
      toast({
        title: "冲突解决成功",
        description: `已采用${resolution === 'local' ? '本地' : resolution === 'remote' ? '远程' : '合并'}数据`
      });
      
    } catch (error) {
      console.error('解决冲突失败:', error);
      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : '解决冲突失败'
      }));
    }
  }, [pendingConflict, syncManager, isElectronEnv, applyRemoteData, toast]);

  // 启用/禁用同步
  const toggleSync = useCallback((enabled: boolean) => {
    if (!syncManager || !isElectronEnv) return;
    syncManager.updateSyncSettings({ enabled });
    setSyncStatus(prev => ({ ...prev, enabled }));
    if (syncSettings) setSyncSettings({ ...syncSettings, enabled });
  }, [syncManager, isElectronEnv, syncSettings]);

  // 更新同步设置
  const updateSyncSettings = useCallback((settings: any) => {
    if (!syncManager || !isElectronEnv) return;
    syncManager.updateSyncSettings(settings);
    if (syncSettings) setSyncSettings({ ...syncSettings, ...settings });
  }, [syncManager, isElectronEnv, syncSettings]);

  // 自动同步数据变更
  useEffect(() => {
    if (syncStatus.enabled && !syncStatus.syncing && prompts && categories && settings && syncManager && isElectronEnv) {
      const syncData = async () => {
        try {
          await syncManager.writeSyncData(prompts, categories, settings);
        } catch (error) {
          console.error('自动同步失败:', error);
        }
      };
      
      // 防抖处理，避免频繁同步
      const timeoutId = setTimeout(syncData, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [prompts, categories, settings, syncStatus.enabled, syncStatus.syncing, syncManager, isElectronEnv]);

  return {
    syncStatus,
    syncSettings,
    pendingConflict,
    isElectronEnv,
    manualSync,
    resolveConflict,
    toggleSync,
    updateSyncSettings
  };
};
