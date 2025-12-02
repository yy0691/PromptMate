import { useState, useEffect, Dispatch, SetStateAction, useRef, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { PromptList } from "@/components/PromptList";
import { PromptEditorModular } from "@/components/PromptEditorModular";
import { usePrompts } from "@/hooks/usePrompts";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useTranslation } from "react-i18next";
import { useUserPreferences } from "@/hooks/useUserPreferences";

interface IndexProps {
  sidebarOpen?: boolean;
  setSidebarOpen?: Dispatch<SetStateAction<boolean>>;
  onToggleSidebarRef?: (fn: () => void) => void;
}

// 内容区域组件，负责根据当前状态显示不同内容
function ContentArea({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { t } = useTranslation();
  const { 
    selectedPrompt,
    activeCategory,
    showFavorites,
    showRecommended,
    searchTerm,
    categories,
    filteredPrompts,
    setActiveCategory,
    setShowFavorites,
    setShowRecommended
  } = usePrompts();

  // 添加强制刷新状态
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewKey, setViewKey] = useState(0);
  const [showEditor, setShowEditor] = useState(true);
  
  // 监听状态变化并强制刷新
  useEffect(() => {
    console.log('ContentArea 状态变化:', {
      activeCategory, 
      showFavorites, 
      showRecommended, 
      searchTerm,
      filteredCount: filteredPrompts.length
    });
    // 强制刷新组件
    setRefreshKey(prev => prev + 1);
    setViewKey(prev => prev + 1);
  }, [activeCategory, showFavorites, showRecommended, searchTerm, filteredPrompts.length]);
  
  // 确定当前应该显示哪个组件
  const renderCurrentView = () => {
    // 构建一个唯一的key来强制组件重新渲染
    const viewKey = `view-${activeCategory || 'all'}-${showFavorites ? 'fav' : ''}-${showRecommended ? 'rec' : ''}-${searchTerm ? 'search' : ''}-${refreshKey}`;
    
    // 如果有搜索词，显示搜索结果
    if (searchTerm) {
      return (
        <PromptList 
          key={viewKey}
          onToggleSidebar={onToggleSidebar} 
          contentTitle={`${t("common.search")}: "${searchTerm}"`}
          isEditPanelOpen={!!selectedPrompt}
        />
      );
    }
    
    // 如果是推荐模式
    if (showRecommended) {
      return (
        <PromptList 
          key={viewKey}
          onToggleSidebar={onToggleSidebar} 
          contentTitle={`${t("common.recommended")}`}
          isEditPanelOpen={!!selectedPrompt}
        />
      );
    }
    
    // 如果是收藏模式
    if (showFavorites) {
      return (
        <PromptList 
          key={viewKey}
          onToggleSidebar={onToggleSidebar} 
          contentTitle={`${t("common.favorite")}`}
          isEditPanelOpen={!!selectedPrompt}
        />
      );
    }
    
    // 如果有激活的分类
    if (activeCategory) {
      const categoryName = categories.find(c => c.id === activeCategory)?.name || activeCategory;
      return (
        <PromptList 
          key={viewKey}
          onToggleSidebar={onToggleSidebar} 
          contentTitle={`${t("common.category")}: ${categoryName}`}
          isEditPanelOpen={!!selectedPrompt}
        />
      );
    }
    
    // 默认显示所有提示词
    return (
      <PromptList 
        key={viewKey}
        onToggleSidebar={onToggleSidebar} 
        contentTitle={`${t("common.all")}`}
        isEditPanelOpen={!!selectedPrompt}
      />
    );
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* 左侧：提示词列表 - 始终显示 */}
      <div className={`h-full preview-panel-transition ${selectedPrompt ? "flex-1" : "w-full"}`}>
        {renderCurrentView()}
      </div>


    </div>
  );
}

export function Index({ sidebarOpen: propsSidebarOpen, setSidebarOpen: propSetSidebarOpen, onToggleSidebarRef }: IndexProps) {
  const [localSidebarOpen, setLocalSidebarOpen] = useState(true);
  const { selectedPrompt } = usePrompts();
  const { preferences, updatePreference, loading: preferencesLoading } = useUserPreferences();
  const panelGroupRef = useRef<{ getLayout: () => number[] } | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 使用props传递的状态或本地状态
  const sidebarOpen = propsSidebarOpen !== undefined ? propsSidebarOpen : localSidebarOpen;
  const setSidebarOpen = propSetSidebarOpen || setLocalSidebarOpen;

  // 切换侧边栏显示状态
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // 将toggleSidebar函数暴露给父组件
  useEffect(() => {
    if (onToggleSidebarRef) {
      onToggleSidebarRef(toggleSidebar);
    }
  }, [onToggleSidebarRef]);

  // 处理面板大小变化
  const handlePanelResize = useCallback((sizes: number[]) => {
    if (sizes.length >= 2 && !preferencesLoading) {
      // 防抖保存
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        updatePreference('ui', {
          panelSizes: {
            leftPanel: sizes[0],
            rightPanel: sizes[1],
          },
        });
      }, 300);
    }
  }, [updatePreference, preferencesLoading]) as (sizes: number[]) => void;

  // 获取保存的面板大小
  const getPanelSizes = () => {
    if (preferences?.ui?.panelSizes) {
      return [
        preferences.ui.panelSizes.leftPanel,
        preferences.ui.panelSizes.rightPanel,
      ];
    }
    return [45, 55]; // 默认值
  };

  return (
    <div className="flex flex-1 min-h-0">
      {/* 左侧边栏 */}
      {sidebarOpen && <Sidebar />}
      
      {/* 中间内容区域 */}
      {selectedPrompt ? (
        // 使用 ResizablePanelGroup 实现可拖拽调节宽度
        <ResizablePanelGroup 
          direction="horizontal" 
          className="flex-1 min-h-0"
          onLayout={handlePanelResize}
        >
          {/* 左侧：提示词列表 */}
          <ResizablePanel 
            defaultSize={getPanelSizes()[0]} 
            minSize={25} 
            maxSize={65}
            id="left-panel"
          >
            <div className="h-full border-r">
              <ScrollArea className="h-full">
                <ContentArea onToggleSidebar={toggleSidebar} />
              </ScrollArea>
            </div>
          </ResizablePanel>
          
          {/* 拖拽手柄 */}
          <ResizableHandle withHandle />
          
          {/* 右侧：编辑面板 */}
          <ResizablePanel 
            defaultSize={getPanelSizes()[1]} 
            minSize={35} 
            maxSize={75}
            id="right-panel"
          >
            <div className="h-full bg-background shadow-lg animate-slide-in-panel">
              <PromptEditorModular />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        // 没有选中提示词时，显示全宽内容
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <ContentArea onToggleSidebar={toggleSidebar} />
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
