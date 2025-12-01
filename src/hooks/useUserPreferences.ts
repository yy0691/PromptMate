import { useState, useEffect, useCallback } from 'react';

// 声明全局的 chrome API 类型
declare global {
  var chrome: {
    storage: {
      local: {
        get: (keys: string[]) => Promise<Record<string, any>>;
        set: (items: Record<string, any>) => Promise<void>;
      };
    };
  } | undefined;
}

// 用户偏好设置接口
export interface UserPreferences {
  // 界面偏好
  ui: {
    sidebarExpanded: boolean;
    sidebarWidth: number;
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    font: string;
    // 窗口设置（仅Electron环境）
    windowBounds?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    // 分栏宽度设置
    panelSizes?: {
      leftPanel: number; // 左侧面板的百分比
      rightPanel: number; // 右侧面板的百分比
    };
  };
  // 编辑器偏好
  editor: {
    lineNumbers: boolean;
    wordWrap: boolean;
    autoSave: boolean;
    autoSaveInterval: number; // 毫秒
  };
  // 功能偏好
  features: {
    showPreviewByDefault: boolean;
    enableVariableHighlight: boolean;
    enableAutoComplete: boolean;
    enableTooltips: boolean;
  };
  // 同步偏好
  sync: {
    autoSync: boolean;
    syncInterval: number; // 毫秒
    includePreferences: boolean; // 是否在同步中包含偏好设置
  };
}

// 默认偏好设置
const DEFAULT_PREFERENCES: UserPreferences = {
  ui: {
    sidebarExpanded: true,
    sidebarWidth: 180,
    theme: 'system',
    fontSize: 14,
    font: 'system-ui',
    windowBounds: undefined,
    panelSizes: {
      leftPanel: 45,
      rightPanel: 55,
    },
  },
  editor: {
    lineNumbers: false,
    wordWrap: true,
    autoSave: true,
    autoSaveInterval: 2000,
  },
  features: {
    showPreviewByDefault: true,
    enableVariableHighlight: true,
    enableAutoComplete: true,
    enableTooltips: true,
  },
  sync: {
    autoSync: false,
    syncInterval: 30000,
    includePreferences: true,
  },
};

// 存储键名
const PREFERENCES_STORAGE_KEY = 'promptmate-user-preferences';

// 用户偏好管理Hook
export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 从存储中加载偏好设置
  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 检查是否在浏览器扩展环境中
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // 浏览器扩展环境 - 使用 chrome.storage
        const result = await chrome.storage.local.get([PREFERENCES_STORAGE_KEY]);
        const savedPreferences = result[PREFERENCES_STORAGE_KEY];
        
        if (savedPreferences) {
          // 合并默认设置与保存的设置，确保新增的设置项有默认值
          const mergedPreferences = mergePreferences(DEFAULT_PREFERENCES, savedPreferences);
          setPreferences(mergedPreferences);
        }
      } else {
        // 桌面应用环境 - 使用 localStorage
        const savedPreferences = localStorage.getItem(PREFERENCES_STORAGE_KEY);
        
        if (savedPreferences) {
          const parsed = JSON.parse(savedPreferences);
          const mergedPreferences = mergePreferences(DEFAULT_PREFERENCES, parsed);
          setPreferences(mergedPreferences);
        }
      }
    } catch (err) {
      console.error('加载用户偏好设置失败:', err);
      setError('加载用户偏好设置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 保存偏好设置到存储
  const savePreferences = useCallback(async (newPreferences: Partial<UserPreferences>) => {
    try {
      const updatedPreferences = mergePreferences(preferences, newPreferences);
      
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // 浏览器扩展环境
        await chrome.storage.local.set({
          [PREFERENCES_STORAGE_KEY]: updatedPreferences
        });
      } else {
        // 桌面应用环境
        localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(updatedPreferences));
      }
      
      setPreferences(updatedPreferences);
      return true;
    } catch (err) {
      console.error('保存用户偏好设置失败:', err);
      setError('保存用户偏好设置失败');
      return false;
    }
  }, [preferences]);

  // 更新特定的偏好设置
  const updatePreference = useCallback(async <K extends keyof UserPreferences>(
    category: K,
    updates: Partial<UserPreferences[K]>
  ) => {
    return await savePreferences({
      [category]: {
        ...preferences[category],
        ...updates
      }
    } as Partial<UserPreferences>);
  }, [preferences, savePreferences]);

  // 重置偏好设置
  const resetPreferences = useCallback(async () => {
    return await savePreferences(DEFAULT_PREFERENCES);
  }, [savePreferences]);

  // 导出偏好设置
  const exportPreferences = useCallback(() => {
    return JSON.stringify(preferences, null, 2);
  }, [preferences]);

  // 导入偏好设置
  const importPreferences = useCallback(async (data: string) => {
    try {
      const importedPreferences = JSON.parse(data);
      const mergedPreferences = mergePreferences(DEFAULT_PREFERENCES, importedPreferences);
      return await savePreferences(mergedPreferences);
    } catch (err) {
      console.error('导入用户偏好设置失败:', err);
      setError('导入用户偏好设置失败');
      return false;
    }
  }, [savePreferences]);

  // 组件加载时加载偏好设置
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return {
    preferences,
    loading,
    error,
    updatePreference,
    savePreferences,
    resetPreferences,
    exportPreferences,
    importPreferences,
    loadPreferences,
  };
}

// 深度合并偏好设置对象
function mergePreferences(
  defaultPrefs: UserPreferences,
  savedPrefs: Partial<UserPreferences>
): UserPreferences {
  const merged = { ...defaultPrefs };
  
  for (const [category, values] of Object.entries(savedPrefs)) {
    if (category in merged && typeof values === 'object' && values !== null) {
      merged[category as keyof UserPreferences] = {
        ...merged[category as keyof UserPreferences],
        ...values
      } as any;
    }
  }
  
  return merged;
}

// 获取偏好设置的特定值
export function getPreferenceValue<K extends keyof UserPreferences, T extends keyof UserPreferences[K]>(
  preferences: UserPreferences,
  category: K,
  key: T
): UserPreferences[K][T] {
  return preferences[category][key];
}

// 检查偏好设置是否为默认值
export function isDefaultPreference<K extends keyof UserPreferences>(
  preferences: UserPreferences,
  category: K
): boolean {
  const defaultCategory = DEFAULT_PREFERENCES[category];
  const currentCategory = preferences[category];
  
  return JSON.stringify(defaultCategory) === JSON.stringify(currentCategory);
}

