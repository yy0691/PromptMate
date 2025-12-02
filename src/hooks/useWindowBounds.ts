import { useEffect, useCallback, useRef } from 'react';
import { useUserPreferences } from './useUserPreferences';

// 检查是否在Electron环境中运行
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
};

/**
 * Hook 用于保存和恢复窗口位置和大小
 */
export function useWindowBounds() {
  const { preferences, updatePreference, loading } = useUserPreferences();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 保存窗口位置和大小
  const saveWindowBounds = useCallback(() => {
    if (!isElectron() || loading) return;

    try {
      // 在 Electron 环境中，需要通过 IPC 获取窗口位置
      // 但由于我们无法直接访问 BrowserWindow，我们需要在渲染进程中监听窗口事件
      // 或者通过 preload 脚本暴露 API
      
      // 对于浏览器环境，我们可以保存视口大小
      if (!isElectron()) {
        const bounds = {
          x: window.screenX,
          y: window.screenY,
          width: window.innerWidth,
          height: window.innerHeight,
        };
        
        // 防抖保存
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          updatePreference('ui', {
            windowBounds: bounds,
          });
        }, 500);
      }
    } catch (error) {
      console.error('保存窗口位置失败:', error);
    }
  }, [updatePreference, loading]);

  // 恢复窗口位置和大小
  const restoreWindowBounds = useCallback(() => {
    if (!isElectron() || loading || !preferences?.ui?.windowBounds) return;

    try {
      const bounds = preferences.ui.windowBounds;
      
      // 在 Electron 环境中，需要通过 IPC 设置窗口位置
      // 这里我们需要在 Electron 主进程中实现恢复逻辑
      // 暂时先保存，主进程会在创建窗口时读取
      
      // 对于浏览器环境，我们可以尝试恢复（但浏览器通常不允许）
      if (!isElectron() && bounds) {
        // 浏览器环境无法直接设置窗口位置，但可以记录
        console.log('窗口位置已保存:', bounds);
      }
    } catch (error) {
      console.error('恢复窗口位置失败:', error);
    }
  }, [preferences, loading]);

  // 监听窗口大小变化（仅浏览器环境）
  useEffect(() => {
    if (isElectron()) {
      // Electron 环境中的窗口位置保存应该在主进程中处理
      // 这里我们只处理浏览器环境
      return;
    }

    const handleResize = () => {
      saveWindowBounds();
    };

    const handleMove = () => {
      saveWindowBounds();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('move', handleMove);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('move', handleMove);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [saveWindowBounds]);

  // 组件挂载时恢复窗口位置
  useEffect(() => {
    restoreWindowBounds();
  }, [restoreWindowBounds]);

  return {
    saveWindowBounds,
    restoreWindowBounds,
  };
}

