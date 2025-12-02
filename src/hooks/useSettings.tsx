import { useState, useEffect, useCallback } from 'react';
import { Settings, ThemeType } from '../types';
import { loadSettings, saveSettings } from '../lib/data';
import { useToast } from '@/hooks/use-toast';
import { applyThemeVariables, getThemePreset } from '../lib/themes';

// 字体映射
const FONT_FAMILIES = {
  'System UI': 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  'SF Pro': 'SF Pro, system-ui, sans-serif',
  'Inter': 'Inter var, sans-serif',
  'Source Code Pro': 'Source Code Pro, monospace',
  '思源黑体': '"Noto Sans SC", "Source Han Sans SC", "Source Han Sans CN", "思源黑体 CN", sans-serif',
  '思源宋体': '"Noto Serif SC", "Source Han Serif SC", "Source Han Serif CN", "思源宋体 CN", serif',
  '苹方': '"PingFang SC", "SF Pro SC", "苹方-简", sans-serif',
  '微软雅黑': '"Microsoft YaHei", "微软雅黑", sans-serif',
};

// 设置主题
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');
  const { toast } = useToast();

  // console.log("[DEBUG] useSettings: Initial settings loaded:", settings);

  // 定义辅助函数
  const applyFont = useCallback((fontName: string, fontSize: number) => {
    // console.log(`[DEBUG] applyFont: Applying font '${fontName}' with size ${fontSize}px.`);
    const fontFamily = FONT_FAMILIES[fontName as keyof typeof FONT_FAMILIES] || fontName;
    document.documentElement.style.setProperty('--app-font', fontFamily, 'important');
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`, 'important');
    document.body.style.fontFamily = fontFamily;
    document.body.style.fontSize = `${fontSize}px`;
    document.body.style.lineHeight = "1.5";
    // 强制所有文本元素使用指定字体，覆盖任何继承设置
    const styleElement = document.getElementById('font-override-style') || document.createElement('style');
    styleElement.id = 'font-override-style';
    styleElement.textContent = `
      :root {
        --app-font: ${fontFamily} !important;
        --app-font-size: ${fontSize}px !important;
      }
      * {
        font-family: ${fontFamily} !important;
      }
      body, p, div, span, h1, h2, h3, h4, h5, h6, button, input, textarea, select {
        font-size: ${fontSize}px !important;
        line-height: 1.5 !important;
      }
      pre, code {
        font-family: ${FONT_FAMILIES['Source Code Pro']} !important;
      }
    `;
    
    if (!document.getElementById('font-override-style')) {
      document.head.appendChild(styleElement);
    }
    
    // 确保字体设置被正确应用
    // console.log(`字体已应用: ${fontName} (${fontSize}px)`);
  }, []);

  const applyTheme = useCallback((theme: ThemeType, currentSettings: Settings) => {
    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');

    // 移除旧的主题类和变量
    root.classList.remove("light", "dark");
    const themeVariableNames = [
      "--background", "--foreground", "--card", "--card-foreground",
      "--popover", "--popover-foreground", "--primary", "--primary-foreground",
      "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
      "--accent", "--accent-foreground", "--destructive", "--destructive-foreground",
      "--border", "--input", "--ring"
    ];
    themeVariableNames.forEach(varName => root.style.removeProperty(varName));

    // 应用新的主题类和变量
    root.classList.add(isDark ? 'dark' : 'light');
    if (theme === 'custom' && currentSettings.customTheme) {
      applyThemeVariables(theme, isDark ? 'dark' : 'light', currentSettings.customTheme);
    } else {
      const themePreset = getThemePreset(theme);
      if (themePreset && !themePreset.isDefault) {
        applyThemeVariables(theme, isDark ? 'dark' : 'light');
      }
    }
  }, [systemTheme]);

  // Effect for initialization and system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    updateSystemTheme();
    mediaQuery.addEventListener('change', updateSystemTheme);
    return () => mediaQuery.removeEventListener('change', updateSystemTheme);
  }, []);

  // A single, primary effect to react to ALL changes
  useEffect(() => {
    console.log("[DEBUG] useSettings: Primary effect triggered. Current settings:", settings);
    console.log("[DEBUG] useSettings: Applying theme and font.");

    // 1. Apply the theme based on current settings and system theme
    applyTheme(settings.theme, settings);

    // 2. Apply the font based on current settings
    applyFont(settings.font, settings.fontSize);

    // 3. Save settings whenever they change
    saveSettings(settings);
    // 先应用主题
    applyTheme(settings.theme, settings);
    
    // 主题应用完成后，立即应用字体设置
    // 使用 requestAnimationFrame 确保在下一帧应用字体
    requestAnimationFrame(() => {
      applyFont(settings.font, settings.fontSize);
    });
    
    // 额外确保字体设置不被覆盖
    setTimeout(() => {
      applyFont(settings.font, settings.fontSize);
    }, 50);
  }, [settings, applyTheme, applyFont]);

  // 单独监听字体和字体大小的变化，确保及时应用
  useEffect(() => {
    applyFont(settings.font, settings.fontSize);
  }, [settings.font, settings.fontSize, applyFont]);


  const updateSettings = (newSettings: Partial<Settings>) => {

    // 检查字体是否变更
    if (newSettings.font && newSettings.font !== settings.font) {
      toast({
        title: "字体已更改",
        description: `当前字体: ${newSettings.font}`,
        variant: "success",
      });
    }
    
    // 检查字体大小是否变更
    if (newSettings.fontSize && newSettings.fontSize !== settings.fontSize) {
      toast({
        title: "字体大小已更改",
        description: `当前大小: ${newSettings.fontSize}px`,
        variant: "success",
      });
    }
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const toggleTheme = () => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: newTheme });
  };

  const togglePinWindow = (pinned: boolean) => {
    updateSettings({ alwaysOnTop: pinned });
    if (window.electronAPI) {
      window.electronAPI.togglePinWindow(pinned);
    }
  };

  const availableFonts = [
    { name: 'System UI', value: FONT_FAMILIES['System UI'] },
    { name: '思源黑体', value: FONT_FAMILIES['思源黑体'] },
    { name: '思源宋体', value: FONT_FAMILIES['思源宋体'] },
    { name: 'Source Code Pro', value: FONT_FAMILIES['Source Code Pro'] }
  ];

  return {
    settings,
    updateSettings,
    systemTheme,
    availableFonts,
    currentTheme: settings.theme === 'system' ? systemTheme : settings.theme,
    toggleTheme,
    togglePinWindow
  };
}
