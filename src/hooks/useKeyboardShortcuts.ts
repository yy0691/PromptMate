import { useEffect, useCallback, RefObject } from 'react';

/**
 * 检测当前平台是否为 macOS
 */
const isMac = () => {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    // 在 Electron 环境中，可以通过 process.platform 判断
    // 但由于 contextIsolation，我们需要通过其他方式判断
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  }
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
};

/**
 * 获取修饰键名称（跨平台）
 */
const getModifierKey = () => {
  return isMac() ? 'Meta' : 'Control';
};

/**
 * 检查是否按下了修饰键
 */
const isModifierKey = (key: string, event: KeyboardEvent) => {
  const modifier = getModifierKey();
  if (modifier === 'Meta') {
    return event.metaKey;
  } else {
    return event.ctrlKey;
  }
};

/**
 * 键盘快捷键 Hook
 * 为输入框和文本域提供跨平台的快捷键支持
 * 
 * @param ref - 输入元素的引用
 * @param options - 配置选项
 */
export function useKeyboardShortcuts<T extends HTMLInputElement | HTMLTextAreaElement>(
  ref: RefObject<T>,
  options: {
    /** 是否启用快捷键（默认：true） */
    enabled?: boolean;
    /** 自定义快捷键处理器 */
    onShortcut?: (action: string, event: KeyboardEvent) => boolean | void;
  } = {}
) {
  const { enabled = true, onShortcut } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled || !ref.current) {
        return;
      }

      const element = ref.current;
      const modifier = isModifierKey('', event);
      const key = event.key.toLowerCase();

      // 处理快捷键
      let handled = false;

      // 复制 (Cmd/Ctrl + C)
      if (modifier && key === 'c' && !event.shiftKey) {
        if (onShortcut) {
          const result = onShortcut('copy', event);
          if (result === false) {
            return; // 阻止默认行为
          }
        }
        // 浏览器默认行为已处理，这里只是确保它正常工作
        handled = true;
      }

      // 粘贴 (Cmd/Ctrl + V)
      if (modifier && key === 'v' && !event.shiftKey) {
        if (onShortcut) {
          const result = onShortcut('paste', event);
          if (result === false) {
            return; // 阻止默认行为
          }
        }
        handled = true;
      }

      // 剪切 (Cmd/Ctrl + X)
      if (modifier && key === 'x' && !event.shiftKey) {
        if (onShortcut) {
          const result = onShortcut('cut', event);
          if (result === false) {
            return; // 阻止默认行为
          }
        }
        handled = true;
      }

      // 全选 (Cmd/Ctrl + A)
      if (modifier && key === 'a' && !event.shiftKey) {
        if (onShortcut) {
          const result = onShortcut('selectAll', event);
          if (result === false) {
            return; // 阻止默认行为
          }
        }
        // 如果元素支持 select()，确保全选
        if (element && typeof (element as any).select === 'function') {
          (element as any).select();
        }
        handled = true;
      }

      // 撤销 (Cmd/Ctrl + Z)
      if (modifier && key === 'z' && !event.shiftKey) {
        if (onShortcut) {
          const result = onShortcut('undo', event);
          if (result === false) {
            return; // 阻止默认行为
          }
        }
        handled = true;
      }

      // 重做 (Cmd/Ctrl + Shift + Z 或 Cmd/Ctrl + Y)
      if (
        (modifier && key === 'z' && event.shiftKey) ||
        (modifier && key === 'y' && !event.shiftKey)
      ) {
        if (onShortcut) {
          const result = onShortcut('redo', event);
          if (result === false) {
            return; // 阻止默认行为
          }
        }
        handled = true;
      }

      // 删除到行首 (Cmd/Ctrl + Backspace) - macOS
      if (isMac() && modifier && key === 'backspace') {
        if (onShortcut) {
          const result = onShortcut('deleteToLineStart', event);
          if (result === false) {
            return; // 阻止默认行为
          }
        }
        handled = true;
      }

      // 如果处理了快捷键，阻止进一步传播（可选）
      // 注意：我们通常不阻止默认行为，让浏览器/Electron 处理
    },
    [enabled, onShortcut, ref]
  );

  useEffect(() => {
    if (!enabled || !ref.current) {
      return;
    }

    const element = ref.current;
    element.addEventListener('keydown', handleKeyDown);

    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown, ref]);
}

/**
 * 全局快捷键 Hook
 * 用于在应用级别处理快捷键（如关闭窗口）
 */
export function useGlobalShortcuts(options: {
  /** 是否启用快捷键（默认：true） */
  enabled?: boolean;
  /** 关闭窗口回调 */
  onClose?: () => void;
  /** 最小化窗口回调 */
  onMinimize?: () => void;
  /** 最大化窗口回调 */
  onMaximize?: () => void;
} = {}) {
  const { enabled = true, onClose, onMinimize, onMaximize } = options;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = isModifierKey('', event);
      const key = event.key.toLowerCase();

      // 关闭窗口 (Cmd/Ctrl + W)
      if (modifier && key === 'w' && !event.shiftKey) {
        if (onClose) {
          event.preventDefault();
          onClose();
        }
      }

      // 最小化窗口 (Cmd/Ctrl + M) - 仅在 macOS 上
      if (isMac() && modifier && key === 'm' && !event.shiftKey) {
        if (onMinimize) {
          event.preventDefault();
          onMinimize();
        }
      }

      // 最大化窗口 (Cmd/Ctrl + Shift + M) - Windows/Linux
      if (!isMac() && modifier && key === 'm' && event.shiftKey) {
        if (onMaximize) {
          event.preventDefault();
          onMaximize();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, onClose, onMinimize, onMaximize]);
}

