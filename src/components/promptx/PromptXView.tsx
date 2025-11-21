import { useState, useEffect, Dispatch, SetStateAction } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PromptXMain } from "@/components/promptx/PromptXMain";

interface PromptXViewProps {
  sidebarOpen?: boolean;
  setSidebarOpen?: Dispatch<SetStateAction<boolean>>;
  onToggleSidebarRef?: (fn: () => void) => void;
}

export function PromptXView({ sidebarOpen: propsSidebarOpen, setSidebarOpen: propSetSidebarOpen, onToggleSidebarRef }: PromptXViewProps) {
  // 在这些视图中，侧边栏应该始终显示
  // 使用props传递的状态，如果没有则默认为true
  const sidebarOpen = propsSidebarOpen !== undefined ? propsSidebarOpen : true;

  // 切换侧边栏显示状态（虽然在这些视图中侧边栏应该一直显示，但保留功能以防需要）
  const toggleSidebar = () => {
    if (propSetSidebarOpen) {
      propSetSidebarOpen(!sidebarOpen);
    }
  };

  // 将toggleSidebar函数暴露给父组件
  useEffect(() => {
    if (onToggleSidebarRef) {
      onToggleSidebarRef(toggleSidebar);
    }
  }, [onToggleSidebarRef, sidebarOpen, propSetSidebarOpen]);

  // 确保侧边栏在这些视图中始终显示
  useEffect(() => {
    if (propSetSidebarOpen && !sidebarOpen) {
      propSetSidebarOpen(true);
    }
  }, [sidebarOpen, propSetSidebarOpen]);

  return (
    <div className="flex flex-1 min-h-0">
      {/* 左侧边栏 - 始终显示 */}
      <Sidebar />

      {/* 右侧内容区域：PromptX 主体 */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="h-full flex flex-col">
            {/* 顶部预留区域可放工具条/面包屑等，如需 */}
            <div className="flex-1 min-h-0">
              <PromptXMain />
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
