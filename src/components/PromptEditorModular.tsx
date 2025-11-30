{/**
  角色：容器组件，是提示词编辑器的入口
  主要功能：
    管理编辑器的整体状态
    处理保存、删除、复制等操作
    包含顶部操作栏（保存、删除、复制等按钮）
    根据编辑/预览模式切换显示内容

  PromptEditorModular (容器)
  ├── 管理状态和操作
  ├── 切换编辑/预览模式
  │
  ├── 编辑模式 → 显示 PromptEditForm
  │   └── 包含完整的编辑表单
  │       └── 使用 PromptFormFields 渲染字段
  │
  └── 预览模式 → 显示 PromptPreview
      └── 显示渲染后的提示词预览
*/}
import React, { useRef, useState } from "react";
import { usePrompts } from "@/hooks/usePrompts";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Star, Copy, Edit, Trash, Save, X, Eye, PenTool, RotateCcw } from "lucide-react";
import { Icons } from "@/components/ui/icons";
import { usePromptEditor } from "@/hooks/usePromptEditor";
import { PromptEditForm } from "./PromptEditForm";
import { PromptPreview } from "./PromptPreview";
import { AISettingsDialog } from "./AISettingsDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VariableDisplay } from "./VariableHighlighter";
import { VariableForm } from "./VariableForm";
import { applyVariableValues } from "@/lib/variableUtils";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";


export function PromptEditorModular() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { selectedPrompt } = usePrompts();
  const [showAISettings, setShowAISettings] = useState(false);
  const { t } = useTranslation();
  const {
    state,
    deleteDialogOpen,
    setDeleteDialogOpen,
    switchConfirmOpen,
    setSwitchConfirmOpen,
    pendingPromptId,
    fileInputRef,
    categories,
    allTags,
    updateField,
    handleManualSave,
    handleImageUpload,
    deleteImage,
    selectImage,
    updateImageCaption,
    handleToggleFavorite,
    handleDelete,
    handleCopy,
    startEditing,
    cancelEditing,
    confirmCancelEditing,
    confirmSwitchPrompt,
    saveAndSwitchPrompt,
    handleAIOptimize,
  } = usePromptEditor({ 
    prompt: selectedPrompt,
    autoSave: true,
    autoSaveDelay: 2000,
    enableSwitchConfirmation: true,
  });

  // 选中新提示词时，默认进入预览模式
  const previousPromptIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const currentId = selectedPrompt?.id || null;
    const prevId = previousPromptIdRef.current;
    
    // 只有当切换到不同的提示词时才触发（避免自动保存时退出编辑模式）
    if (currentId !== prevId) {
      previousPromptIdRef.current = currentId;
      
      if (selectedPrompt && state.isEditing && !state.hasChanges) {
        cancelEditing();
      }
    }
  }, [selectedPrompt?.id, state.isEditing, state.hasChanges, cancelEditing]);

  if (!selectedPrompt) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">{t("promptEditorModular.selectPromptToEdit")}</p>   // 选择一个提示词开始编辑
          <p className="text-sm">{t("promptEditorModular.selectPromptToEditDescription")}</p>   // 从左侧列表中选择要编辑的提示词
        </div>
      </div>
    );
  }

  // 自动保存状态显示
  const getAutoSaveStatusText = () => {
    switch (state.autoSaveStatus) {
      case "saving":
        return t("common.saving");
      case "saved":
        return t("common.saved");
      default:
        return "";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* 头部工具栏 */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold truncate">
              {selectedPrompt.title}
            </h2>
            {state.hasChanges && (
              <span className="text-xs text-muted-foreground">
                • {getAutoSaveStatusText() || t("promptEditorModular.unsavedChanges")}
              </span>
            )}
          </div>
          
          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            {/* 预览模式下的变量操作按钮 */}
            {!state.isEditing && (
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={state.showVariableForm ? "default" : "outline"}
                            size="icon"
                            onClick={() => updateField('showVariableForm', !state.showVariableForm)}
                                                         className={cn(
                               "h-9 w-9 transition-all duration-300",
                               state.showVariableForm 
                                 ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:shadow-xl hover:from-blue-600 hover:to-purple-700 transform hover:scale-105" 
                                 : "hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-blue-200"
                             )}
                          >
                                                         <PenTool className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {/* 隐藏变量表单/填写变量 */}
                          {state.showVariableForm ? t("promptEditorModular.hideVariableForm") : t("promptEditorModular.fillVariable")}  
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            )}
            <TooltipProvider>
              {/* 编辑/预览切换按钮 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={state.isEditing ? cancelEditing : startEditing}
                  >
                    {state.isEditing ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <Edit className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {state.isEditing ? t("promptEditorModular.switchToPreviewMode") : t("promptEditorModular.switchToEditMode")}
                </TooltipContent>
              </Tooltip>

              {/* 复制按钮 - 合并复制功能 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {state.isEditing ? t("promptEditorModular.copyOriginalContent") : t("promptEditorModular.copyFinalContent")}
                </TooltipContent>
              </Tooltip>


              {/* 删除按钮 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("promptEditorModular.delete")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      

      {/* 主要内容区域 */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6 h-full">
            {state.isEditing ? (
              <PromptEditForm
                state={state}
                categories={categories}
                allTags={allTags}
                onFieldChange={updateField}
                onImageUpload={() => fileInputRef.current?.click()}
                onImageUploadChange={handleImageUpload}
                onImageSelect={selectImage}
                onImageDelete={deleteImage}
                onImageCaptionUpdate={updateImageCaption}
                fileInputRef={fileInputRef}
                onAIOptimize={handleAIOptimize}
                onOpenSettings={() => setShowAISettings(true)}
              />
            ) : (
              <PromptPreview
                prompt={selectedPrompt}
                showVariableForm={state.showVariableForm}
                variableValues={state.variableValues}
                onVariableChange={(values) => updateField('variableValues', values)}
                onPreviewChange={(content) => {
                  // 这里可以添加预览内容变化的处理逻辑
                  console.log('Preview content changed:', content);
                }}
                onOpenVariableForm={() => updateField('showVariableForm', true)}
                className="h-full"
              />
            )}
          </div>
        </ScrollArea>
      </div>



      {/* 确认删除对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("promptEditorModular.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("promptEditorModular.confirmDeleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {/* 取消 */}
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            {/* 删除 */}
            <AlertDialogAction onClick={handleDelete}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 取消编辑确认对话框 */}
      <AlertDialog open={switchConfirmOpen} onOpenChange={setSwitchConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            {/* 未保存的更改 */}
            <AlertDialogTitle>{t("promptEditorModular.unsavedChanges")}</AlertDialogTitle>  
            <AlertDialogDescription>
              {/* 您有未保存的更改。要保存更改并继续，放弃更改，还是留在当前编辑页面？ */}
              {t("promptEditorModular.unsavedChangesDescription")}  
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
            {/* 留在当前页面 */}
            <AlertDialogCancel className="mt-0">{t("promptEditorModular.stayOnCurrentPage")}</AlertDialogCancel>
            <Button variant="outline" onClick={confirmSwitchPrompt}>
              {/* 放弃更改 */}
              {t("promptEditorModular.discardChanges")}
            </Button>
            <Button onClick={saveAndSwitchPrompt}>
              {/* 保存并继续 */}
              {t("promptEditorModular.saveAndContinue")}  
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI设置对话框 */}
      <AISettingsDialog
        open={showAISettings}
        onOpenChange={setShowAISettings}
      />
    </div>
  );
}
