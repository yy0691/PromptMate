import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { usePrompts } from "@/hooks/usePrompts";
import { Icons } from "@/components/ui/icons";
import { DataImportExport } from "./DataImportExport";
import { useSettings } from "@/hooks/useSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FontSelector } from "./FontSelector";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { CategoryManager } from "./category/CategoryManager";
import { Category } from "@/types";
import { ViewBadge } from "./category/ViewBadge";
import { CategoryIcon } from "./category/CategoryIcon";
import { IconSelector } from "./category/IconSelector";
import { ThemePreview } from "./ThemePreview";
import { themePresets } from "@/lib/themes";
import { ThemeType } from "@/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import React from "react";
import { ThemeCustomizer } from "./ThemeCustomizer";
import { Settings } from "@/types";
import { About } from './About';
import { QuickCreatePrompt } from "./QuickCreatePrompt";
import { CreatePromptDialog } from "./CreatePromptDialog";
import { AISettings } from "./AISettings";
import { useToast } from "@/hooks/use-toast";
import { useAppView } from "@/hooks/useAppView";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useSidebarAlert } from "@/hooks/useSidebarAlert";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { PreferencesPanel } from "./PreferencesPanel";
import { CardContent } from "./ui/card";
import { useTranslation } from 'react-i18next';
import { MCPSettingsPanel } from '@/components/promptx/MCPSettingsPanel';
import { CloudStorageSettings } from "./CloudStorageSettings";

// 侧边栏显示模式类型
type SidebarMode = "expanded" | "collapsed";

export function Sidebar({ className }: { className?: string }) {
  // Hooks and shared state
  const { t } = useTranslation();
  const { showAlert, showConfirm, AlertComponent } = useSidebarAlert();
  const {
    activeCategory,
    setActiveCategory,
    categories,
    showFavorites,
    setShowFavorites,
    showRecommended,
    setShowRecommended,
    setSearchTerm,
    setSelectedTag,
    prompts,
    addPrompt,
    selectedPrompt,
    setSelectedPrompt,
    resetAllFilters,
    forceRefresh,
    reloadData,
    updateCategory,
    deleteCategory,
    updateCategoriesOrder,
    allTags,
  } = usePrompts();

  const { settings, toggleTheme, updateSettings, availableFonts } = useSettings();
  const { preferences, updatePreference, loading: preferencesLoading } = useUserPreferences();
  const { toast } = useToast();
  const { currentView, setCurrentView } = useAppView();
  const isDev = import.meta.env.DEV;
  const [showDataImportExport, setShowDataImportExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(preferences.ui.sidebarWidth); 
  const [isDragging, setIsDragging] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(
    preferences.ui.sidebarExpanded ? "expanded" : "collapsed"
  );
  const [settingsPanel, setSettingsPanel] = useState<"appearance" | "data" | "ai" | "mcp" | "cloud-storage" | "about" | "preferences">("appearance");
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingIcon, setEditingIcon] = useState("");
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const [tempCustomTheme, setTempCustomTheme] = useState<Settings['customTheme']>(
    settings.customTheme || {
      background: "#ffffff",
      foreground: "#000000",
      primary: "#3b82f6",
      accent: "#f1f5f9",
    }
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNewPromptDialog, setShowNewPromptDialog] = useState(false);
  const [newPromptCategoryId, setNewPromptCategoryId] = useState<string | null>(null);

  // 处理点击全部提示词
  const handleAllPromptsClick = useCallback(() => {
    console.log('All prompts clicked');
    resetAllFilters();
    console.log(t("sidebar.message.allPromptsClicked"));
  }, [resetAllFilters, t]); // ✅ 添加依赖项
  
  // 当设置对话框关闭时，重置面板状态
  useEffect(() => {
    if (!showSettings) {
      // 延迟重置面板，确保动画完成后再切换
      const timer = setTimeout(() => {
        setSettingsPanel("appearance");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showSettings]);

  // 监听全局事件以便从其他组件打开到指定设置面板（如MCP）
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as any;
        if (detail?.panel) {
          setShowSettings(true);
          setSettingsPanel(detail.panel);
        }
      } catch {}
    };
    window.addEventListener('open-settings-panel' as any, handler);
    return () => window.removeEventListener('open-settings-panel' as any, handler);
  }, []);

  // 同步用户偏好设置的变化
  useEffect(() => {
    if (!preferencesLoading) {
      setSidebarWidth(preferences.ui.sidebarWidth);
      setSidebarMode(preferences.ui.sidebarExpanded ? "expanded" : "collapsed");
    }
  }, [preferences.ui.sidebarWidth, preferences.ui.sidebarExpanded, preferencesLoading]);
  
  const draggingRef = useRef<boolean>(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // 计算每个分类下的提示词数量
  const promptCounts = prompts.reduce((acc, prompt) => {
    acc[prompt.category] = (acc[prompt.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // 计算收藏的提示词数量
  const favoritesCount = prompts.filter(prompt => prompt.isFavorite).length;

  // 添加调试日志
  useEffect(() => {
    console.log('Sidebar state:', {
      activeCategory,
      showFavorites,
      showRecommended,
      categories
    });
  }, [activeCategory, showFavorites, showRecommended, categories]);

  
  const handleDeleteCategory = useCallback((categoryId: string) => {
    console.log('🗑️ handleDeleteCategory called with:', categoryId);
    
    const categoryToDelete = categories.find(cat => cat.id === categoryId);
    
    if (!categoryToDelete) {
      console.warn('❌ Category not found:', categoryId);
      return;
    }
  
    console.log('📝 About to show confirm dialog for:', categoryToDelete.name);
     
    
    showConfirm(
      t("sidebar.message.deleteCategory").replace("{name}", categoryToDelete.name),
      t("common.confirmDelete"),
      () => {
        console.log('✅ Confirm callback executed for:', categoryId);
        try {
          deleteCategory(categoryId);
          console.log('✅ Category deleted successfully');
          
          if (activeCategory === categoryId) {
            handleAllPromptsClick();
            console.log('✅ Switched to all prompts view');
          }
          
          toast({
            title: "删除成功",
            description: `分类 "${categoryToDelete.name}" 已删除`,
          });
        } catch (error) {
          console.error('❌ Error deleting category:', error);
          showAlert("删除失败，请重试", "错误");
        }
      },
      () => {
        console.log('❌ Cancel callback executed for:', categoryId);
      }
    );
  }, [categories, deleteCategory, activeCategory, handleAllPromptsClick, toast, showAlert, showConfirm, t]);

  // 处理点击分类
  const handleCategoryClick = (categoryId: string) => {
    console.log('Category clicked:', categoryId);
    
    // 先设置一个缓存变量
    const targetCategory = categoryId;
    
    // 清空所有其他状态
    setShowFavorites(false);
    setShowRecommended(false);
    setSearchTerm("");
    setSelectedTag(null);
    setSelectedPrompt(null);
    
    // 最后设置当前分类
    setActiveCategory(targetCategory);
    
    // 强制刷新
    forceRefresh();
    
    // 添加强制刷新的调试日志
    console.log(t("sidebar.message.categoryClicked"), targetCategory);
  };

  // 处理点击收藏
  const handleFavoritesClick = () => {
    console.log('Favorites clicked');
    
    // 清空所有其他状态
    setActiveCategory(null);
    setShowRecommended(false);
    setSearchTerm("");
    setSelectedTag(null);
    setSelectedPrompt(null);
    
    // 设置收藏状态
    setShowFavorites(true);
    
    // 强制刷新
    forceRefresh();
    
    // 添加强制刷新的调试日志
    console.log(t("sidebar.message.favoritesClicked"));
  };

  // 处理点击推荐模板
  const handleRecommendedClick = () => {
    console.log('Recommended clicked');
    
    // 清空所有其他状态
    setActiveCategory(null);
    setShowFavorites(false);
    setSearchTerm("");
    setSelectedTag(null);
    setSelectedPrompt(null);
    
    // 设置推荐状态
    setShowRecommended(true);
    
    // 强制刷新
    forceRefresh();
    
    // 添加强制刷新的调试日志
    console.log(t("sidebar.message.recommendedClicked"));
  };

  

  // 数据变更后刷新
  const handleDataChanged = async () => {
    console.log("[DEBUG] handleDataChanged: Entered. Calling reloadData.");
    // 重新加载数据
    await reloadData();
    // 重置为默认视图
    handleAllPromptsClick();
    // 这里可以添加额外的刷新逻辑
  };

  // 侧边栏宽度调整处理
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    setIsDragging(true);
    
    // 添加全局事件监听
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 处理鼠标移动事件
  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingRef.current) return;
    
    const deltaX = e.clientX - startXRef.current;
    let newWidth = startWidthRef.current + deltaX;
    
    // 设置最小和最大宽度限制
    newWidth = Math.max(60, Math.min(450, newWidth));
    
    // 如果宽度小于100px，自动切换到折叠模式
    if (newWidth < 100 && sidebarMode === "expanded") {
      setSidebarMode("collapsed");
      // 保存折叠状态到用户偏好
      updatePreference('ui', { sidebarExpanded: false });
    } else if (newWidth >= 100 && sidebarMode === "collapsed") {
      setSidebarMode("expanded");
      // 保存展开状态到用户偏好
      updatePreference('ui', { sidebarExpanded: true });
    }
    
    setSidebarWidth(newWidth);
  };

  // 处理鼠标抬起事件
  const handleMouseUp = () => {
    draggingRef.current = false;
    setIsDragging(false);
    
    // 保存最终宽度到用户偏好
    updatePreference('ui', { sidebarWidth });
    
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // 更新鼠标样式
  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.cursor = '';
    }
    
    return () => {
      document.body.style.cursor = '';
    };
  }, [isDragging]);

  // 清理事件监听
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // 切换侧边栏模式
  const toggleSidebarMode = () => {
    const newMode = sidebarMode === "expanded" ? "collapsed" : "expanded";
    setSidebarMode(newMode);
    
    // 根据模式自动调整宽度
    let newWidth;
    if (newMode === "collapsed") {
      newWidth = 50;
    } else {
      newWidth = preferences.ui.sidebarWidth > 100 ? preferences.ui.sidebarWidth : 180;
    }
    setSidebarWidth(newWidth);
    
    // 保存到用户偏好
    updatePreference('ui', { 
      sidebarExpanded: newMode === "expanded",
      sidebarWidth: newWidth
    });
    
    // 重置所有tooltip的状态，防止收起侧边栏时所有tooltip都显示
  };

  const isCollapsed = sidebarMode === "collapsed";

  // 添加键盘事件处理函数
  const handleKeyDown = (e: React.KeyboardEvent, category: Category) => {
    if (e.key === "F2") {
      e.preventDefault();
      handleEditCategory(category);
    } else if (e.key === "Escape") {
      setEditingCategory(null);
    }
  };

  // 选择一个分类进行编辑
  const handleEditCategory = (category: Category) => {
    // 如果侧边栏是折叠状态，自动展开
    if (sidebarMode === "collapsed") {
      setSidebarMode("expanded");
      setSidebarWidth(180);
    }

    setEditingCategory(category.id);
    setEditingName(category.name);
    setEditingIcon(category.icon || "");
  };

  // 添加重命名处理函数
  const handleRename = (categoryId: string) => {
    if (editingName.trim()) {
      // 更新分类名称和图标
      updateCategory(categoryId, editingName.trim(), editingIcon);
      setEditingCategory(null);
    }
  };



  // 处理右键菜单新建提示词
  const handleContextMenuNewPrompt = (categoryId: string) => {
    console.log('🔍 右键菜单新建提示词调试:', {
      categoryId,
      categoryName: categories.find(c => c.id === categoryId)?.name,
      activeCategory,
      newPromptCategoryId: categoryId
    });
    setNewPromptCategoryId(categoryId);
    setShowNewPromptDialog(true);
  };



  // 应用自定义主题
  const applyCustomTheme = () => {
    updateSettings({ 
      theme: 'custom', 
      customTheme: tempCustomTheme 
    });
    // 同时保存到用户偏好
    updatePreference('ui', { theme: 'system' }); // 自定义主题暂时映射为system
    setShowThemeCustomizer(false);
  };

  // 主题切换的包装函数
  const handleThemeToggle = () => {
    const currentTheme = settings.theme;
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // 更新设置
    toggleTheme();
    
    // 同时保存到用户偏好
    updatePreference('ui', { theme: newTheme });
  };

  // 主题选择的包装函数
  const handleThemeSelect = (theme: any) => {
    updateSettings({ theme: theme.id as any });
    // 同时保存到用户偏好
    updatePreference('ui', { theme: theme.id === 'system' ? 'system' : theme.id === 'dark' ? 'dark' : 'light' });
  };

  // 拖拽状态
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  // 处理拖拽开始
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, categoryId: string) => {
    e.dataTransfer.setData('text/plain', categoryId);
    setDraggedCategory(categoryId);
    
    // 设置拖拽图像
    if (e.currentTarget.firstChild instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget.firstChild, 20, 20);
    }
  };

  // 处理拖拽结束
  const handleDragEnd = () => {
    setDraggedCategory(null);
    setDragOverCategory(null);
  };

  // 处理拖拽悬停
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, categoryId: string) => {
    e.preventDefault();
    if (draggedCategory === categoryId) return;
    setDragOverCategory(categoryId);
  };

  // 处理拖拽离开
  const handleDragLeave = () => {
    setDragOverCategory(null);
  };

  // 处理放置
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetCategoryId: string) => {
    e.preventDefault();
    const draggedCategoryId = e.dataTransfer.getData('text/plain');
    
    if (draggedCategoryId === targetCategoryId) return;
    
    // 找到拖拽的分类和目标分类的索引
    const draggedIndex = categories.findIndex(cat => cat.id === draggedCategoryId);
    const targetIndex = categories.findIndex(cat => cat.id === targetCategoryId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // 创建新的分类数组并调整顺序
    const newCategories = [...categories];
    const [movedCategory] = newCategories.splice(draggedIndex, 1);
    
    // 关键修复：计算正确的插入位置
    // 当目标索引大于拖拽索引时，由于我们已经移除了一个元素，目标索引需要减1
    let insertIndex = targetIndex;
    if (targetIndex > draggedIndex) {
      insertIndex = targetIndex - 1;
    }
    
    newCategories.splice(insertIndex, 0, movedCategory);
    
    // 更新分类顺序
    updateCategoriesOrder(newCategories);
    
    // 重置拖拽状态
    setDraggedCategory(null);
    setDragOverCategory(null);
  };

  // 处理拖拽到末尾
  const handleDropToEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const draggedCategoryId = e.dataTransfer.getData('text/plain');
    const draggedIndex = categories.findIndex(cat => cat.id === draggedCategoryId);
    
    if (draggedIndex === -1) return;
    
    // 创建新的分类数组并调整顺序
    const newCategories = [...categories];
    const [movedCategory] = newCategories.splice(draggedIndex, 1);
    
    // 插入到末尾
    newCategories.push(movedCategory);
    
    // 更新分类顺序
    updateCategoriesOrder(newCategories);
    
    // 重置拖拽状态
    setDraggedCategory(null);
    setDragOverCategory(null);
  };

  //处理设置面板全屏功能
  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // 渲染侧边栏
  return (
    <div 
      ref={sidebarRef}
      className={cn(
        "h-[calc(100vh-3rem)] border-r relative transition-all duration-300 flex-shrink-0 bg-background flex flex-col",
        isCollapsed && "w-[60px]",
        !isCollapsed && "sidebar-dynamic-width",
        className
      )}
      style={!isCollapsed ? { '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties : undefined}
    >
      <AlertComponent />
      {/* 拖拽调整区域 - 整个右边缘 */}
      <div
        className="absolute top-0 right-0 w-4 h-full cursor-col-resize transform translate-x-0.5"
        style={{ zIndex: isDragging ? 30 : -1 }}
        onMouseDown={handleMouseDown}
      />

      {/* 顶部标题和按钮 */}
      <div className={cn(
        "flex items-center justify-between py-3 flex-shrink-0",
        isCollapsed ? "px-2" : "px-4"
      )}>
        {!isCollapsed && (
          <h2 className="text-lg font-medium">
            PromptMate
          </h2>
        )}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebarMode}
                className={cn(
                  "rounded-full",
                  isCollapsed ? "mx-auto" : "ml-auto"
                )}
              >
                <Icons.chevronLeft
                  className={`h-4 w-4 transition-transform duration-200 ${
                    isCollapsed ? "rotate-180" : ""
                  }`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ?  t('sidebar.expandSidebar') : t('sidebar.collapseSidebar')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 中间内容区域 */}
      <ScrollArea className="flex-1">
        <div className={cn(
          "h-full pb-4", 
          isCollapsed ? "px-2" : "px-4"
        )}>
          {/* 按钮组 */}
          <div className="py-3">
            <div className="space-y-1">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "rounded-xl group hover:scale-105 transition-transform",
                        isCollapsed
                          ? "h-9 w-9 p-0 mx-auto flex items-center justify-center"
                          : "w-full justify-start py-1 px-3"
                      )}
                      onClick={handleAllPromptsClick}
                    >
                      <Icons.layout className="h-4 w-4" />
                      {!isCollapsed && t("sidebar.tooltip.allPrompts")}
                    </Button>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right">
                      {t("sidebar.tooltip.allPrompts")}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showFavorites ? "default" : "ghost"}
                      className={cn(
                        "rounded-xl group hover:scale-105 transition-transform",
                        showFavorites ? "" : (activeCategory === null && !showRecommended ? "" : "hover:bg-accent hover:text-accent-foreground"),
                        isCollapsed
                          ? "h-9 w-9 p-0 mx-auto flex items-center justify-center"
                          : "w-full justify-start py-1 px-3"
                      )}
                      size="sm"
                      onClick={handleFavoritesClick}
                      >
                      <Icons.starFilled className="h-4 w-4" />
                      {!isCollapsed && t("sidebar.tooltip.favoritePrompts")}
                    </Button>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right">
                      {t("sidebar.tooltip.favoritePrompts")}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showRecommended ? "default" : "ghost"}
                      className={cn(
                        "rounded-xl group hover:scale-105 transition-transform",
                        showRecommended ? "" : (activeCategory === null && !showFavorites ? "" : "hover:bg-accent hover:text-accent-foreground"),
                        isCollapsed
                          ? "h-9 w-9 p-0 mx-auto flex items-center justify-center"
                          : "w-full justify-start py-1 px-3"
                      )}
                      onClick={handleRecommendedClick}
                    >
                      <Icons.gift className="h-4 w-4" />
                      {!isCollapsed && t("sidebar.tooltip.recommendedPrompts")}
                    </Button>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right">
                      {t("sidebar.tooltip.recommendedPrompts")}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              {isDev && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={currentView === 'workflows' ? "default" : "ghost"}
                        className={cn(
                          "rounded-xl group hover:scale-105 transition-transform",
                          isCollapsed
                            ? "h-9 w-9 p-0 mx-auto flex items-center justify-center"
                            : "w-full justify-start py-1 px-3"
                        )}
                        onClick={() => setCurrentView('workflows')}
                      >
                        <Icons.workflow className="h-4 w-4" />
                        {!isCollapsed && t("sidebar.tooltip.workflows")}
                      </Button>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right">
                        {t("sidebar.tooltip.workflows")}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              )}

              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={currentView === 'promptx' ? "default" : "ghost"}
                      className={cn(
                        "rounded-xl group hover:scale-105 transition-transform",
                        isCollapsed
                          ? "h-9 w-9 p-0 mx-auto flex items-center justify-center"
                          : "w-full justify-start py-1 px-3"
                      )}
                      onClick={() => setCurrentView('promptx')}
                    >
                      <Icons.zap className="h-4 w-4" />
                      {!isCollapsed && t('promptx.title')}
                    </Button>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right">
                      {t('promptx.title')}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          {/* 分类列表 */}
          <div className="mt-6">
            {/* 分类列表标题 */}
            <div className={cn(
              "flex items-center justify-between mb-2 px-2 w-full",
              isCollapsed ? "justify-center" : ""
            )}>

              {!isCollapsed && (
                <h2 className="text-sm font-medium text-muted-foreground">
                  {t("sidebar.categories")}
                </h2>
              )}
              {/* 管理分类 */}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowCategoryManager(true)}
                      className={cn(
                        "rounded-full h-7 w-7 hover:scale-105 color transition-transform",
                        isCollapsed ? "mx-auto" : "ml-auto"
                      )}
                    >
                      <Icons.folderPlus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {t("sidebar.tooltip.manageCategories")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            {/* 分类列表内容 */}
            <div className="space-y-1">
            {categories.map((category) => (
              <ContextMenu key={category.id}>
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ContextMenuTrigger asChild>
                        <div
                          className={cn(
                            "w-full",
                            draggedCategory === category.id && "opacity-50",
                            dragOverCategory === category.id && "border-t-2 border-primary"
                          )}
                          onKeyDown={(e) => handleKeyDown(e, category)}
                          tabIndex={0}
                          draggable={editingCategory !== category.id}
                          onDragStart={(e) => handleDragStart(e, category.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleDragOver(e, category.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, category.id)}
                        >
                            {editingCategory === category.id ? (
                              <div className="flex flex-col p-1 space-y-2">
                                {/* 第一行：图标选择和文字输入 */}
                                <div className="flex items-center gap-2 w-full">
                                  <IconSelector
                                    value={editingIcon || category.icon || "folder"}
                                    onChange={(iconName) => setEditingIcon(iconName)}
                                  />
                                  {/* 编辑分类名称 */}
                                  <Input
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        handleRename(category.id);
                                      } else if (e.key === "Escape") {
                                        setEditingCategory(null);
                                      }
                                    }}
                                    onBlur={() => handleRename(category.id)}
                                    autoFocus
                                    className="h-8 w-full min-w-0"
                                  />
                                </div>
                                
                                {/* 第二行：操作按钮 */}
                                <div className="flex justify-center gap-0.5 w-auto px-6">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingCategory(null)}
                                    className="h-6 hover:scale-105 transition-transform"
                                  >
                                    <Icons.x className="h-4 w-4" />
                                    {t('common.cancel')}
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleRename(category.id)}
                                    className="h-6 hover:scale-105 transition-transform"
                                  >
                                    <Icons.check className="h-4 w-4" />
                                    {t('common.ok')}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <TooltipProvider delayDuration={100}>
                                {/* 分类名称 */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={activeCategory === category.id ? "default" : "ghost"}
                                      className={cn(
                                        "rounded-xl group hover:scale-105 transition-transform",
                                        activeCategory === category.id ? "bg-primary/10 text-primary hover:bg-primary/15" : "hover:bg-muted/50",
                                        isCollapsed
                                          ? "h-9 w-9 p-0 mx-auto flex items-center justify-center"
                                          : "w-full justify-start py-1 px-3"
                                      )}
                                      onClick={() => handleCategoryClick(category.id)}
                                    >
                                      {/* 分类图标 */}
                                      <CategoryIcon iconName={category.icon} />
                                      {/* 分类名称 */}
                                      {!isCollapsed && category.name}
                                      {/* 拖拽提示图标 */}
                                      {!isCollapsed && (
                                        <Icons.moveVertical className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-50" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  {isCollapsed && (
                                    <TooltipContent side="right">
                                      {category.name}
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </ContextMenuTrigger>
                        </TooltipTrigger>
                        
                        {isCollapsed && (
                          <TooltipContent side="right">
                            {category.name}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                        <ContextMenuContent>
                        <ContextMenuItem onSelect={() => handleEditCategory(category)}>
                            <Icons.edit className="h-4 w-4 mr-2" />
                            {t('common.edit')}
                          </ContextMenuItem>
                          <ContextMenuItem onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleContextMenuNewPrompt(category.id);
                          }}>
                            <Icons.plus className="h-4 w-4 mr-2" />
                            {t('common.create_prompt.title')}
                          </ContextMenuItem>
                          <ContextMenuItem
                              className="text-destructive"
                              // ✅ 第三步：修改 onSelect 的逻辑
                              onSelect={() => {
                                setTimeout(() => {
                                  handleDeleteCategory(category.id);
                              }, 0);
                              }}
                            >
                              <Icons.trash className="h-4 w-4 mr-2" />
                              {t('common.delete')}
                            </ContextMenuItem>
                            {/* <ContextMenuItem
                              className="text-destructive"
                              onSelect={() => {
                                console.log('[Action] onSelect fired. Setting deletingCategoryId to:', category.id);
                                setDeletingCategoryId(category.id);
                              }}
                            >
                              <Icons.trash className="h-4 w-4 mr-2" />
                              {t('common.delete')}
                            </ContextMenuItem> */}
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
              
              {/* 列表末尾的拖拽区域 */}
              {draggedCategory && (
                <div 
                  className={cn(
                    "h-8 w-full rounded-md border-0 border-dashed border-primary/20",
                    dragOverCategory === "end" && "border-primary bg-primary/5"
                  )}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverCategory("end");
                    }}
                    onDragLeave={() => setDragOverCategory(null)}
                    onDrop={handleDropToEnd}
                />
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* 底部按钮 */}
      <div className={cn(
        "border-t p-3 flex-shrink-0 mt-auto bg-background",
        isCollapsed ? "space-y-2 h-auto flex flex-col items-center" : "flex items-center h-12 justify-between"
      )}>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleThemeToggle}
                className={cn(
                  "rounded-full h-8 w-8",
                  isCollapsed ? "mx-auto" : ""
                )}
              >
                {settings.theme === 'dark' ? (
                  <Icons.sun className="h-4 w-4" />
                ) : (
                  <Icons.moon className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {settings.theme === 'dark' ? t('common.switchToLight') : t('common.switchToDark')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        
        {/* 新建提示词 */}
        

        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <QuickCreatePrompt
                variant="icon"
                className={cn(
                  "bg-primary/10 text-primary hover:bg-primary/20",
                  isCollapsed ? "mx-auto" : ""
                )}
                options={{
                  defaultCategory: activeCategory || categories[0]?.id || "general"
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="right">{t('prompts.createNew')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        
        {/* 设置 */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSettingsPanel("appearance");
                  setShowSettings(true);
                }}
                className={cn(
                  "rounded-full h-8 w-8 hover:scale-95 transition-transform",
                  isCollapsed ? "mx-auto" : ""
                )}
              >
                <Icons.settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t('common.settings')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>


      {/* 设置对话框 */}
      <Dialog 
        open={showSettings} 
        onOpenChange={(open) => {
          setShowSettings(open);
          if (!open) {
            setIsFullscreen(false); // 关闭对话框时重置全屏状态
          }
        }}
      >
        <DialogContent className={cn(
          "transition-all duration-300",
          isFullscreen 
            ? "fixed left-0 top-0 w-screen h-screen max-w-none max-h-none m-0 rounded-none translate-x-0 translate-y-0" 
            : `sm:max-w-[650px] md:max-w-[750px] ${settingsPanel === "data" ? 'max-h-[85vh]' : 'max-h-[85vh]'}`
        )}>
          <DialogHeader className="flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center justify-between w-full">
                <DialogTitle>{t('common.appSettings')}</DialogTitle>
                {/* <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFullscreen}
                  className="ml-4"
                  title={isFullscreen ? t('common.exitFullscreen') : t('common.toggleFullscreen')}
                >
                  {isFullscreen ? (
                    <Icons.minimize className="h-4 w-4" />
                  ) : (
                    <Icons.maximize className="h-4 w-4" />
                  )}
                </Button> */}
              </div>
              <DialogDescription>
                {t('common.customizeAppearance')}
              </DialogDescription>
              
            </div>
            
          </DialogHeader>
          
          {/* 设置导航按钮 */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button 
              variant={settingsPanel === "appearance" ? "default" : "outline"} 
              onClick={() => setSettingsPanel("appearance")}
              className="flex items-center"
            >
              <Icons.palette className="mr-2 h-4 w-4" />
              {t('common.appearance')}
            </Button>
            <Button 
              variant={settingsPanel === "data" ? "default" : "outline"} 
              onClick={() => setSettingsPanel("data")}
              className="flex items-center"
            >
              <Icons.fileJson className="mr-2 h-4 w-4" />
              {t('dataManagement.title')}
            </Button>
            <Button 
              variant={settingsPanel === "ai" ? "default" : "outline"} 
              onClick={() => setSettingsPanel("ai")}
              className="flex items-center"
            >
              <Icons.star className="w-4 h-4 mr-2" />
              {t('common.aiSettings')}
            </Button>
            <Button 
              variant={settingsPanel === "mcp" ? "default" : "outline"} 
              onClick={() => setSettingsPanel("mcp")}
              className="flex items-center"
            >
              <Icons.zap className="w-4 h-4 mr-2" />
              MCP设置
            </Button>
            <Button 
              variant={settingsPanel === "cloud-storage" ? "default" : "outline"} 
              onClick={() => setSettingsPanel("cloud-storage")}
              className="flex items-center"
            >
              <Icons.cloud className="w-4 h-4 mr-2" />
              {t('dataManagement.cloudSync')}
            </Button>
            {/* PromptX settings tab removed; use main view via sidebar button */}
          </div>
          
          {/* 外观设置面板 */}
          {settingsPanel === "appearance" && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="py-2 space-y-6">
                
                {/* 语言设置 */}
                <div className="space-y-2">
                  <Label>{t('common.language')}</Label>
                  <LanguageSelector />
                </div>

                {/* 字体设置 */}
                <div className="space-y-2">
                  <Label htmlFor="font">{t('settings.fontSize')}</Label>
                  <FontSelector
                    value={settings.font}
                    onChange={(font) => updateSettings({ font })}
                  />
                </div>
                
                {/* 主题设置 */}
                <div className="space-y-2">
                  <Label>{t('settings.theme')}</Label>
                  
                  {/* 系统主题部分 */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">{t('settings.default_theme')}</h3>
                    <div className="grid grid-cols-3 gap-6  px-2">
                      {themePresets
                        .filter(theme => theme.isDefault)
                        .map((theme) => (
                          <ThemePreview
                            key={theme.id}
                            theme={theme}
                            selected={settings.theme === theme.id}
                            onClick={() => handleThemeSelect(theme)}
                          />
                        ))}
                    </div>
                  </div>
                  
                  {/* 自定义主题部分 */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">{t('custom_theme.title')}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 px-2">
                      {themePresets
                        .filter(theme => !theme.isDefault)
                        .map((theme) => (
                          <ThemePreview
                            key={theme.id}
                            theme={theme}
                            selected={settings.theme === theme.id}
                            onClick={() => handleThemeSelect(theme)}
                          />
                        ))}
                      
                      {/* 自定义主题按钮 */}
                      <div 
                        className="flex flex-col items-center justify-center rounded-lg overflow-hidden border cursor-pointer h-32 hover:shadow-md hover:scale-102 transition-all"
                        onClick={() => setShowThemeCustomizer(true)}
                      >
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-muted">
                          <Icons.palette className="h-6 w-6 text-primary" />
                        </div>
                        <span className="mt-2 text-sm font-medium">{t('custom_theme.title')}</span>
                        <span className="text-xs text-muted-foreground">{t('custom_theme.create')}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* 窗口置顶设置 */}
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="always-on-top" className="flex-1">{t('common.alwaysOnTop')}</Label>
                  <Switch 
                    id="always-on-top"
                    checked={settings.alwaysOnTop}
                    onCheckedChange={(checked) => {
                      updateSettings({ alwaysOnTop: checked });
                      // 简化置顶逻辑，只改变设置
                    }}
                  />
                </div>
              </div>
            </ScrollArea>
          )}
          
          {/* 数据管理面板 */}
          {settingsPanel === "data" && (
            <div className="py-2 h-[60vh] overflow-y-auto">
              <CardContent className="text-sm font-medium mb-2 text-muted-foreground color-green-500">{t('dataManagement.cloudSyncDescription2')}</CardContent>
              <DataImportExport 
                onDataChanged={handleDataChanged}
              />
            </div>
          )}

          {/* AI设置面板 */}
          {settingsPanel === "ai" && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="py-2">
                <AISettings />
              </div>
            </ScrollArea>
          )}

          {/* MCP 设置面板 */}
          {settingsPanel === "mcp" && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="py-2">
                <MCPSettingsPanel />
              </div>
            </ScrollArea>
          )}

          {/* 云存储设置面板 */}
          {settingsPanel === "cloud-storage" && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="py-2">
                <CloudStorageSettings />
              </div>
            </ScrollArea>
          )}

          {/* PromptX settings panel removed; use main view via sidebar button */}

          {/* 用户偏好设置面板 */}
          {settingsPanel === "preferences" && (
            <ScrollArea className="h-[60vh] pr-4">
              <PreferencesPanel />
            </ScrollArea>
          )}

          {/* 关于面板 */}
          {settingsPanel === "about" && (
            <ScrollArea className="h-[60vh] pr-4">
              <About />
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* 分类管理对话框 */}
      <CategoryManager 
        open={showCategoryManager} 
        onOpenChange={setShowCategoryManager} 
      />

      {/* 自定义主题对话框 */}
      <Dialog open={showThemeCustomizer} onOpenChange={setShowThemeCustomizer}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('custom_theme.title')}</DialogTitle>
            <DialogDescription>
              {t('custom_theme.description')}
            </DialogDescription>
          </DialogHeader>
          <ThemeCustomizer
            customTheme={settings.theme === 'custom' ? settings.customTheme : tempCustomTheme}
            onChange={setTempCustomTheme}
            onApply={applyCustomTheme}
          />
        </DialogContent>
      </Dialog>

      {/* 新建提示词对话框 */}
      <CreatePromptDialog
        open={showNewPromptDialog}
        onOpenChange={setShowNewPromptDialog}
        options={{
          defaultCategory: newPromptCategoryId || undefined,
          onSuccess: () => {
            console.log('🔍 新建提示词成功回调:', { newPromptCategoryId });
            setShowNewPromptDialog(false);
            setNewPromptCategoryId(null);
          }
        }}
      />

    </div>
  );
}
