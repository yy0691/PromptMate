import { usePrompts } from "@/hooks/usePrompts";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Button } from "@/components/ui/button";
import { Plus, Star, Search, X, Copy, Edit, Trash, MoreVertical, Menu, Ghost } from "lucide-react"; // Import Ghost
import { Input } from "@/components/ui/input";
import { useState, useEffect, memo, useCallback, useRef } from "react";
import { Prompt, Category, PromptImage, PromptVersion } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { PromptEditForm } from "./PromptEditForm";
import { CreatePromptDialog } from "./CreatePromptDialog";
import { TagDeleteDialog } from "./TagDeleteDialog";
import { FontSelector } from "./FontSelector";
import { PromptVersionManager } from "./PromptVersionManager";
import { PromptRatingManager } from "./PromptRatingManager";
import { PromptComparisonManager } from "./PromptComparisonManager";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import React from "react";
import { ViewBadge } from "./category/ViewBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DialogDescription } from "@/components/ui/dialog";
import { generateId } from "@/lib/data";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { 
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ErrorBoundary from "./ErrorBoundary";
import { useTranslation } from "react-i18next";
import { t } from "i18next";

// Add Ghost to the Icons mapping for consistency
// Icons.ghost = Ghost;

// 提示词详情查看对话框组件 (Memoized)
const PromptDetailDialog = memo(function PromptDetailDialog({ 
  prompt, 
  open, 
  onOpenChange 
}: { 
  prompt: Prompt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { copyPromptContent, toggleFavorite } = usePrompts();
  const { t } = useTranslation();
  if (!prompt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{prompt.title}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyPromptContent(prompt.content)}
                title={t('common.copyPromptContent')}
              >
                <Icons.copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(prompt.id);
                }}
                title={prompt.isFavorite ? t('common.unfavorite') : t('common.favorite')}
              >
                {prompt.isFavorite ? (
                  <Icons.starFilled className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                ) : (
                  <Icons.star className="h-4 w-4" />
                )}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 max-h-[calc(90vh-120px)]">
          <div className="space-y-4 p-1">
            <div>
              <h4 className="text-sm font-medium mb-2">{t('common.promptContent')}</h4>
              <div className="p-4 rounded-md bg-muted/50 text-sm whitespace-pre-wrap markdown-body" style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{prompt.content}</ReactMarkdown>
              </div>
            </div>
            
            {prompt.description && (
              <div>
                <h4 className="text-sm font-medium mb-2">{t('common.description')}</h4>
                <p className="text-sm text-muted-foreground">{prompt.description}</p>
              </div>
            )}
            
            {prompt.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">{t('common.tags')}</h4>
                <div className="flex flex-wrap gap-2">
                  {prompt.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground">
              {t('common.createdAt')}: {new Date(prompt.createdAt).toLocaleString()}
              {prompt.updatedAt !== prompt.createdAt && (
                <span className="ml-4">
                  {t('common.updatedAt')}: {new Date(prompt.updatedAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

// PromptList component (Memoized)
export const PromptList = memo(function PromptList({ 
  onToggleSidebar,
  contentTitle,
  isEditPanelOpen = false
}: { 
  onToggleSidebar?: () => void;
  contentTitle?: string;
  isEditPanelOpen?: boolean;
}) {
  const { toast } = useToast();
  const { preferences } = useUserPreferences();
  const enableHoverPreview = preferences.features.enableHoverPreview;
  const {
    prompts,
    categories,
    addPrompt,
    updatePrompt,
    deletePrompt,
    toggleFavorite,
    searchTerm,
    setSearchTerm,
    activeCategory,
    setActiveCategory,
    showFavorites,
    setShowFavorites,
    showRecommended,
    setShowRecommended,
    selectedPrompt,
    setSelectedPrompt,
    filteredPrompts,
    allTags,
    selectedTag,
    setSelectedTag,
    refreshCounter,
    addFromRecommended,
    copyPromptContent,
    deleteTag,
    getTagsForCategory
  } = usePrompts();
  
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [showNewPromptDialog, setShowNewPromptDialog] = useState(false);
  const [showEditPromptDialog, setShowEditPromptDialog] = useState(false);
  const [showDeletePromptDialog, setShowDeletePromptDialog] = useState(false);
  const [promptToEdit, setPromptToEdit] = useState<Prompt | null>(null);
  const [promptToDelete, setPromptToDelete] = useState<Prompt | null>(null);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  
  // 标签管理相关状态
  const TAGS_DISPLAY_LIMIT = 10;
  const [showAllTags, setShowAllTags] = useState(false);
  
  // 标签删除对话框状态
  const [showTagDeleteDialog, setShowTagDeleteDialog] = useState(false);
  const [tagToDelete, setTagToDelete] = useState('');
  const [tagAffectedCount, setTagAffectedCount] = useState(0);
  
  // 版本管理、评分和对比功能状态
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);
  const [enhancementPrompt, setEnhancementPrompt] = useState<Prompt | null>(null);

  // 简化的新建处理
  const handleCreatePromptSuccess = useCallback(() => {
    setShowNewPromptDialog(false);
    setLocalRefreshKey(prev => prev + 1);
  }, []);

  // 处理选择提示词（显示在右侧编辑面板）
  const handleSelectPrompt = useCallback((prompt: Prompt) => {
    // 如果点击的是当前已选中的提示词，则关闭预览面板
    if (selectedPrompt && selectedPrompt.id === prompt.id) {
      setSelectedPrompt(null);
    } else {
      // 否则选中新的提示词
      setSelectedPrompt(prompt);
    }
  }, [selectedPrompt, setSelectedPrompt]);

  // 处理复制提示词
  const handleCopyPrompt = useCallback((promptId: string) => {
    copyPromptContent(promptId);
  }, [copyPromptContent]);

  // 处理收藏切换
  const handleToggleFavorite = useCallback((e: React.MouseEvent, promptId: string) => {
    e.stopPropagation();
    toggleFavorite(promptId);
  }, [toggleFavorite]);

  // 处理标签点击
  const handleTagClick = useCallback((e: React.MouseEvent | null, tag: string | null) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedTag(tag);
  }, [setSelectedTag]);

  // 处理删除标签
  const handleDeleteTag = (tag: string) => {
    // 计算受影响的提示词数量（仅当前分类）
    const targetPrompts = activeCategory 
      ? prompts.filter(prompt => prompt.category === activeCategory && prompt.tags.includes(tag))
      : prompts.filter(prompt => prompt.tags.includes(tag));
    
    setTagToDelete(tag);
    setTagAffectedCount(targetPrompts.length);
    setShowTagDeleteDialog(true);
  };
  
  // 确认删除标签
  const confirmDeleteTag = () => {
    if (tagToDelete) {
      // 使用分类范围删除标签
      deleteTag(tagToDelete, activeCategory);
      
      const scopeDescription = activeCategory 
        ? `当前分类下的所有提示词`
        : `所有提示词`;
      
      toast({
        title: "删除成功",
        description: `标签 "${tagToDelete}" 已从${scopeDescription}中删除`,
        variant: "success",
      });
      setTagToDelete('');
      setTagAffectedCount(0);
    }
  };

  // 处理编辑提示词
  const handleOpenEditDialog = useCallback((prompt: Prompt) => {
    setPromptToEdit(prompt);
    setShowEditPromptDialog(true);
  }, []);

  // 处理删除提示词
  const handleOpenDeleteDialog = useCallback((prompt: Prompt) => {
    setPromptToDelete(prompt);
    setShowDeletePromptDialog(true);
  }, []);

  // 处理从推荐添加
  const handleAddFromRecommended = useCallback((prompt: Prompt) => {
    addFromRecommended(prompt);
    // toast({
    //   // title: t('common.message.addSuccess'),
    //   // description: t('common.message.addSuccessDescription'),
    //   variant: "success",
    // });
  }, [addFromRecommended, toast]);

  // 简化的编辑处理
  const handleEditPromptSuccess = useCallback(() => {
    setShowEditPromptDialog(false);
    setPromptToEdit(null);
    setLocalRefreshKey(prev => prev + 1);
  }, []);

  // 处理确认删除提示词
  const handleConfirmDeletePrompt = useCallback(() => {
    if (promptToDelete) {
      deletePrompt(promptToDelete.id);
      toast({
        title: "删除成功",
        description: "提示词已删除",
        variant: "success",
      });
      setShowDeletePromptDialog(false);
      setPromptToDelete(null);
    }
  }, [promptToDelete, deletePrompt, toast]);
  
  // *** MODIFICATION START ***
  // Helper to determine the content for the empty state view
  const getEmptyStateContent = () => {
    if (searchTerm) {
      return {
        icon: <Icons.search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
        title: t('common.noPromptFound'),
        description: `${t('common.noMatchingPrompt')} "${searchTerm}"`,
      };
    }
    if (showRecommended) {
      return {
        icon: <Icons.fileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
        title: t('common.noRecommended'),
        description: t('common.noRecommendedDescription'),
      };
    }
    if (showFavorites) {
      return {
        icon: <Icons.star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
        title: t('common.noFavoritePrompt'),
        description: t('common.noFavoritePromptDescription'),
      };
    }
    if (activeCategory) {
      return {
        icon: <Ghost className="h-12 w-12 text-primary/60 mx-auto mb-4" />,
        title: t('common.noCategory'),
        description: t('common.noCategoryDescription'),
      };
    }
    return {
      icon: <Icons.fileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
      title: t('common.noPromptFound'),
      description: t('common.clickNewPrompt'),
    };
  };
  // *** MODIFICATION END ***

  return (
    <>
    <div className="flex flex-col h-full card-container-transition">
      {/* 当前分类/模式指示器 */}
      <div className="bg-muted/30 px-4 py-2 text-sm flex items-center w-full sticky top-0 z-20 border-b border-border/40">
        {/* <span className="font-medium mr-2">{t('common.currentView')}:</span> */}
        <ViewBadge 
          showRecommended={showRecommended}
          showFavorites={showFavorites}
          activeCategory={activeCategory}
          categories={categories}
        />
        <span className="ml-auto text-muted-foreground">{t('common.found')} {filteredPrompts.length} {t('common.prompts')}</span>
      </div>

      {/* 标签过滤器 */}
      {allTags.length > 0 && (
        <div className="p-2 border-b w-full">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={selectedTag === null ? "default" : "outline"}
              className="cursor-pointer text-xs px-2 py-0.5"
              onClick={(e) => handleTagClick(e, null)}
            >
              {t('common.all')}
            </Badge>
            {(showAllTags ? allTags : allTags.slice(0, TAGS_DISPLAY_LIMIT)).map(tag => (
              <ContextMenu key={tag}>
                <ContextMenuTrigger>
                  <Badge
                    variant={selectedTag === tag ? "default" : "outline"}
                    className="cursor-pointer text-xs px-2 py-0.5"
                    onClick={(e) => handleTagClick(e, tag)}
                  >
                    {tag}
                  </Badge>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => handleTagClick(null, tag)}>
                    <Icons.fileText className="mr-2 h-4 w-4" />
                    {t('common.filterByTag')}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => handleDeleteTag(tag)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Icons.trash className="mr-2 h-4 w-4" />
                    {t('common.deleteTag')}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
            {allTags.length > TAGS_DISPLAY_LIMIT && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => setShowAllTags(!showAllTags)}
              >
                {showAllTags ? (
                  <>
                    <Icons.chevronUp className="h-3 w-3 mr-1" />
                    {t('common.collapse')}
                  </>
                ) : (
                  <>
                    <Icons.chevronDown className="h-3 w-3 mr-1" />
                    {t('common.viewMore')} ({allTags.length - TAGS_DISPLAY_LIMIT})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 搜索结果提示 */}
      {searchTerm && (
        <div className="flex items-center px-4 py-2 bg-muted/50 w-full border-b">
          <Icons.search className="h-4 w-4 mr-2 text-muted-foreground" />
          <span className="text-sm">
            {t('common.searchResults')} "{searchTerm}"
          </span>
        </div>
      )}

      {/* 提示词列表 */}
      <ScrollArea className="flex-1">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div 
              className="p-4 w-full" 
              style={{ 
                minHeight: 'calc(100vh - 200px)',
                width: '100%',
                height: '100%'
              }}
            >
          {filteredPrompts.length === 0 ? (
            // *** MODIFICATION START ***
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-300px)] text-center pt-16">
              <div className="p-8 rounded-lg bg-muted/50 max-w-md">
                {getEmptyStateContent().icon}
                <h3 className="text-lg font-medium mb-2">{getEmptyStateContent().title}</h3>
                <p className="text-muted-foreground">
                  {getEmptyStateContent().description}
                </p>
                {!searchTerm && !showRecommended && (
                  <Button 
                    className="mt-4"
                    onClick={() => {
                      setShowNewPromptDialog(true);
                    }}
                  >
                    <Icons.plus className="h-4 w-4 mr-2" />
                    {t('common.create_prompt.title')}
                  </Button>
                )}
              </div>
            </div>
            // *** MODIFICATION END ***
          ) : (
            <div 
              className={`grid gap-4 grid-layout-transition ${
                isEditPanelOpen 
                  ? 'grid-cols-1 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3' 
                  : 'grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
              }`}
              style={{ 
                minHeight: '100%',
                height: '100%',
                  alignContent: 'start',
                  width: '100%'
              }}
            >
              {filteredPrompts.map((prompt) => {
                const cardElement = (
                    <Card 
                      className={cn(
                        "prompt-card cursor-pointer p-0.5",
                        "w-full max-w-none", // 确保卡片占满网格单元格
                        "focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1",
                        "border border-border/20",
                        selectedPrompt?.id === prompt.id 
                        ? "selected"
                        : "hover:border-primary/30 hover:shadow-md"
                      )}
                      onClick={() => handleSelectPrompt(prompt)}
                      onContextMenu={(e) => {
                        // 如果右键点击的不是标签区域，确保事件能够冒泡到外层的 ContextMenu
                        const target = e.target as HTMLElement;
                        const isTagArea = target.closest('[data-tag-badge]') || target.closest('[data-tag-context-menu]');
                        if (!isTagArea) {
                          // 允许事件冒泡到外层的 ContextMenuTrigger
                          // 不阻止默认行为，让外层的 ContextMenu 处理
                        }
                      }}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectPrompt(prompt);
                        }
                      }}
                    >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg line-clamp-1">{prompt.title}</CardTitle>
                      <div className="flex flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyPrompt(prompt.id);
                          }}
                          title={t('common.edit')}
                        >
                          <Icons.copy className="h-4 w-4" />
                        </Button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Icons.moreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!showRecommended && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditDialog(prompt);
                              }}>
                                <Icons.pencil className="mr-2 h-4 w-4" />
                                {t('common.edit')}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              if (showRecommended) {
                                handleAddFromRecommended(prompt);
                              } else {
                                handleToggleFavorite(e, prompt.id);
                              }
                            }}>
                              {showRecommended ? (
                                <>
                                  <Icons.plus className="mr-2 h-4 w-4" />
                                  {t('common.addmyPrompt')}
                                </>
                              ) : prompt.isFavorite ? (
                                <>
                                  <Icons.starOff className="mr-2 h-4 w-4" />
                                  {t('common.removeFavorite')}
                                </>
                              ) : (
                                <>
                                  <Icons.star className="mr-2 h-4 w-4" />
                                  {t('common.addFavorite')}
                                </>
                              )}
                            </DropdownMenuItem>
                            {!showRecommended && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  setEnhancementPrompt(prompt);
                                  setShowVersionDialog(true);
                                }}>
                                  <Icons.history className="mr-2 h-4 w-4" />
                                  {t('common.versionManagement')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  setEnhancementPrompt(prompt);
                                  setShowRatingDialog(true);
                                }}>
                                  <Icons.star className="mr-2 h-4 w-4" />
                                  {t('common.ratingManagement')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  setEnhancementPrompt(prompt);
                                  setShowComparisonDialog(true);
                                }}>
                                  <Icons.gitCompare className="mr-2 h-4 w-4" />
                                  {t('common.modelComparison')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDeleteDialog(prompt);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Icons.trash className="mr-2 h-4 w-4" />
                                  {t('common.delete')}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pb-2">
                    <div className="text-sm text-muted-foreground line-clamp-3 h-[4.5em] markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{prompt.content}</ReactMarkdown>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-0 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2 text-[8px] max-w-[calc(100%-40px)] overflow-hidden">
                      {prompt.tags.slice(0, 3).map((tag) => (
                        <ContextMenu key={tag}>
                          <ContextMenuTrigger asChild>
                            <div data-tag-context-menu="true">
                              <Badge 
                                variant="secondary" 
                                className="cursor-pointer text-nowrap text-[8px] py-0 px-1.5 font-normal h-5 bg-secondary/70"
                                onClick={(e) => handleTagClick(e, tag)}
                                data-tag-badge="true"
                                onContextMenu={(e) => {
                                  // 标签的右键菜单，阻止冒泡到外层
                                  e.stopPropagation();
                                }}
                              >
                                {tag}
                              </Badge>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => handleTagClick(null, tag)}>
                              <Icons.fileText className="mr-2 h-4 w-4" />
                              {t('common.filterByTag')}
                            </ContextMenuItem>
                            <ContextMenuItem 
                              onClick={() => handleDeleteTag(tag)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Icons.trash className="mr-2 h-4 w-4" />
                              {t('common.deleteTag')}
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                      {prompt.tags.length > 3 && (
                        <Badge variant="outline" className="cursor-pointer text-[10px] py-0 px-1.5 font-normal h-5">
                          +{prompt.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                    
                    {!showRecommended && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={(e) => handleToggleFavorite(e, prompt.id)}
                        title={prompt.isFavorite ? t('common.removeFavorite') : t('common.addFavorite')}
                      >
                        {prompt.isFavorite ? (
                          <Icons.starFilled className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        ) : (
                          <Icons.star className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </CardFooter>
                    </Card>
                );

                // 如果启用了快速预览，使用 HoverCard 包裹
                if (enableHoverPreview) {
                  return (
                    <HoverCard key={prompt.id}>
                      <HoverCardTrigger asChild>
                        {cardElement}
                  </HoverCardTrigger>
                  <HoverCardContent 
                        className="w-96 max-h-80 p-4 bg-popover" 
                    side="top"
                    align="center"
                    sideOffset={8}
                        style={{ backgroundColor: 'hsl(var(--popover))' }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">{prompt.title}</h4>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPrompt(prompt.id);
                            }}
                            title={t('common.copyPrompt')}
                          >
                            <Icons.copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(e, prompt.id);
                            }}
                            title={prompt.isFavorite ? t('common.unfavorite') : t('common.favorite')}
                          >
                            {prompt.isFavorite ? (
                              <Icons.starFilled className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            ) : (
                              <Icons.star className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      
                          <div 
                            className="text-xs text-muted-foreground max-h-48 overflow-y-auto prose prose-sm max-w-none" 
                            style={{ 
                              backgroundColor: 'transparent',
                              color: 'hsl(var(--popover-foreground))'
                            }}
                          >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {prompt.content}
                        </ReactMarkdown>
                      </div>
                      
                      {prompt.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {prompt.tags.slice(0, 5).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0.5">
                              {tag}
                            </Badge>
                          ))}
                          {prompt.tags.length > 5 && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                              +{prompt.tags.length - 5}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
                  );
                }

                // 如果未启用快速预览，直接返回卡片
                return <React.Fragment key={prompt.id}>{cardElement}</React.Fragment>;
              })}
            </div>
          )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => setShowNewPromptDialog(true)}>
              <Icons.plus className="mr-2 h-4 w-4" />
              {t('common.create_prompt.title')}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setShowFavorites(!showFavorites)}>
              <Icons.star className="mr-2 h-4 w-4" />
              {showFavorites ? t('common.showAll') : t('common.showFavorites')}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setShowRecommended(!showRecommended)}>
              <Icons.fileText className="mr-2 h-4 w-4" />
              {showRecommended ? t('common.showAll') : t('common.showRecommended')}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </ScrollArea>
    </div>

    {/* 版本管理对话框 */}
      {enhancementPrompt && (
        <PromptVersionManager
          prompt={enhancementPrompt}
          isOpen={showVersionDialog}
          onClose={() => setShowVersionDialog(false)}
          onRestoreVersion={(version) => {
            const updatedPrompt = {
              ...enhancementPrompt,
              title: version.title,
              content: version.content,
              description: version.description,
              images: version.images,
              version: (enhancementPrompt.version || 1) + 1
            };
            updatePrompt(enhancementPrompt.id, updatedPrompt);
            setShowVersionDialog(false);
          }}
          onCreateVersion={(changeNotes) => {
            // 创建新版本的逻辑
            const newVersion: PromptVersion = {
              id: Date.now().toString(),
              version: (enhancementPrompt.version || 1) + 1,
              title: enhancementPrompt.title,
              content: enhancementPrompt.content,
              description: enhancementPrompt.description,
              images: enhancementPrompt.images,
              createdAt: new Date().toISOString(),
              changeNotes: changeNotes || t('common.manualCreateVersion')
            };
            const updatedPrompt = {
              ...enhancementPrompt,
              versions: [...(enhancementPrompt.versions || []), newVersion],
              version: newVersion.version
            };
            updatePrompt(enhancementPrompt.id, updatedPrompt);
          }}
        />
      )}

      {/* 评分管理对话框 */}
      {enhancementPrompt && (
        <PromptRatingManager
          prompt={enhancementPrompt}
          isOpen={showRatingDialog}
          onClose={() => setShowRatingDialog(false)}
          onSaveRating={(rating, notes) => {
            const updatedPrompt = {
              ...enhancementPrompt,
              rating: rating,
              ratingNotes: notes
            };
            updatePrompt(enhancementPrompt.id, updatedPrompt);
            setShowRatingDialog(false);
          }}
        />
      )}

      {/* 对比管理对话框 */}
      {enhancementPrompt && (
        <PromptComparisonManager
          prompt={enhancementPrompt}
          isOpen={showComparisonDialog}
          onClose={() => setShowComparisonDialog(false)}
          onRunComparison={async (selectedModels, testInput) => {
            // 这里应该调用AI服务进行对比
            // 暂时返回空数组，实际实现需要调用AI服务
            return [];
          }}
          onSaveComparison={(comparison) => {
            // 保存对比结果的逻辑
            console.log(t('common.saveComparisonResult'), comparison);
          }}
          existingComparisons={[]}
        />
      )}

      {/* 编辑提示词对话框 */}
      <CreatePromptDialog
        open={showEditPromptDialog}
        onOpenChange={setShowEditPromptDialog}
        mode="edit"
        prompt={promptToEdit}
        options={{
          onSuccess: handleEditPromptSuccess,
          onCancel: () => setShowEditPromptDialog(false)
        }}
      />

      {/* 删除提示词确认对话框 */}
      <Dialog open={showDeletePromptDialog} onOpenChange={setShowDeletePromptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
            <DialogDescription>
              {t('common.confirmDeleteDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeletePromptDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeletePrompt}>
              {t('common.confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建提示词对话框 */}
      <CreatePromptDialog
        open={showNewPromptDialog}
        onOpenChange={setShowNewPromptDialog}
        mode="create"
        options={{
          defaultCategory: activeCategory || categories[0]?.id || "general",
          onSuccess: handleCreatePromptSuccess,
          onCancel: () => setShowNewPromptDialog(false)
        }}
      />

      {/* 自定义标签删除确认对话框 */}
      <TagDeleteDialog
        isOpen={showTagDeleteDialog}
        onClose={() => setShowTagDeleteDialog(false)}
        onConfirm={confirmDeleteTag}
        tagName={tagToDelete}
        affectedPromptsCount={tagAffectedCount}
      />
    </>
  );
});