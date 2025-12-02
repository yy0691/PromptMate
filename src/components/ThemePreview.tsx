// src/components/ThemePreview.tsx
import { cn } from "@/lib/utils";
import { ThemePreset } from "@/lib/themes";
import { useTranslation } from "react-i18next";

interface ThemePreviewProps {
  theme: ThemePreset;
  selected?: boolean;
  onClick?: () => void;
}

export function ThemePreview({ theme, selected, onClick }: ThemePreviewProps) {
  const { t } = useTranslation();
  return (
    <div 
      className={cn(
        "flex flex-col rounded-lg overflow-hidden border cursor-pointer transition-all h-[132px]",
        "hover:shadow-md hover:border-primary/50",
        selected ? "ring-2 ring-primary border-primary shadow-sm" : "border-border bg-card"
      )}
      onClick={onClick}
    >
      {/* 预览区域 - 统一高度 */}
      <div 
        className="h-20 p-3 flex flex-col justify-between bg-gradient-to-br" 
        style={{ 
          background: theme.preview.background, 
          color: theme.preview.foreground,
        }}
      >
        <div className="flex justify-between items-start">
          <div className="text-[10px] font-medium opacity-80" style={{ color: theme.preview.foreground }}>
            {theme.isDefault ? t('themePreview.systemTheme') : t('themePreview.customTheme')}
          </div>
          {/* 主题色标识圆点 */}
          <div 
            className="w-4 h-4 rounded-full border-2 border-background/50 shadow-sm"
            style={{ background: theme.preview.primary }}
          />
        </div>
        {/* 统一按钮样式，仅改变颜色 */}
        <div 
          className="w-16 h-6 rounded-md flex items-center justify-center text-[10px] font-medium shadow-sm"
          style={{ 
            background: theme.preview.accent || theme.preview.primary, 
            color: theme.preview.foreground 
          }}
        >
          {t('themePreview.button')}
        </div>
      </div>
      {/* 信息区域 - 统一背景 */}
      <div className="p-2.5 bg-background border-t border-border/50">
        <div className="text-xs font-semibold mb-0.5">{theme.name}</div>
        <div className="text-[10px] text-muted-foreground line-clamp-1">{theme.description}</div>
      </div>
    </div>
  );
}