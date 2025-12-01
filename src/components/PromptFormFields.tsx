{/*
  角色：可重用的表单字段组件
  主要功能：
    包含所有可配置的表单字段
    支持通过 showFields 属性控制显示哪些字段
    提供标签建议功能
    处理图片上传和预览
*/}
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, X, Upload } from "lucide-react";
import { PromptFormState } from "@/hooks/usePromptForm";
import { Category } from "@/types";
import { AIOptimizeButton } from "./AIOptimizeButton";
import { VariableTextArea } from "./VariableHighlighter";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface PromptFormFieldsProps {
  state: PromptFormState;
  categories: Category[];
  allTags: string[];
  onFieldChange: <K extends keyof PromptFormState>(field: K, value: PromptFormState[K]) => void;
  
  // 图片相关
  onImageUpload: () => void;
  onImageUploadChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImageSelect: (index: number) => void;
  onImageDelete: (index: number) => void;
  onImageCaptionUpdate: (index: number, caption: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  
  // AI优化
  onAIOptimize?: (optimizedContent: string) => void;
  onOpenAISettings?: () => void;
  
  // 拖拽支持
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  isDragging?: boolean;
  
  // 配置选项
  showFields?: {
    title?: boolean;
    content?: boolean;
    category?: boolean;
    tags?: boolean;
    images?: boolean;
    markdownPreview?: boolean;
    aiOptimization?: boolean;
  };
  
  // 样式
  className?: string;
  mode?: 'create' | 'edit';
}

/**
 * 通用的提示词表单字段组件
 * 支持新建和编辑模式，可配置显示的字段
 */
export const PromptFormFields: React.FC<PromptFormFieldsProps> = ({
  state,
  categories,
  allTags,
  onFieldChange,
  onImageUpload,
  onImageUploadChange,
  onImageSelect,
  onImageDelete,
  onImageCaptionUpdate,
  fileInputRef,
  onAIOptimize,
  onOpenAISettings,
  onDragOver,
  onDragLeave,
  onDrop,
  onPaste,
  isDragging = false,
  showFields = {},
  className,
  mode = 'create',
}) => {
  const { t } = useTranslation();
  
  const {
    title: showTitle = true,
    content: showContent = true,
    category: showCategory = true,
    tags: showTags = true,
    images: showImages = true,
    markdownPreview: showMarkdownPreview = true,
    aiOptimization: showAIOptimization = true,
  } = showFields;

  // 获取标签建议
  const getTagSuggestions = () => {
    const currentTags = state.tags.split(/[,，;；]/).map(tag => tag.trim()).filter(Boolean);
    return allTags.filter(tag => 
      !currentTags.includes(tag) && 
      tag.toLowerCase().includes(state.tags.toLowerCase())
    ).slice(0, 8);
  };

  // 添加建议标签
  const addSuggestedTag = (tag: string) => {
    const currentTags = state.tags.split(/[,，;；]/).map(t => t.trim()).filter(Boolean);
    if (!currentTags.includes(tag)) {
      const newTags = [...currentTags, tag].join(", ");
      onFieldChange('tags', newTags);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* 标题输入 */}
      {showTitle && (
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-medium">
            {t('common.title')}
          </Label>
          <Input
            id="title"
            value={state.title}
            onChange={(e) => onFieldChange('title', e.target.value)}
            placeholder={t('prompteditform.description')}
            className="w-full"
          />
        </div>
      )}

      {/* 分类选择 */}
      {showCategory && (
        <div className="space-y-2">
          <Label htmlFor="category" className="text-sm font-medium">
            {t('prompts.promptCategory')}
          </Label>
          <Select
            value={state.category || categories[0]?.id || ""}
            onValueChange={(value) => {
              if (value) {
                onFieldChange('category', value);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('prompteditform.promptCategoryPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 内容编辑 */}
      {showContent && (
        <div className="space-y-4">
          <Label htmlFor="content" className="text-sm font-medium">
            {t('prompteditform.promptContent')}
          </Label>
          <div className="relative">
            <VariableTextArea
              value={state.content}
              onChange={(value) => onFieldChange('content', value)}
              placeholder={t('prompteditform.promptContentPlaceholder')}
              showVariables={mode === 'create'}
              showMarkdownPreview={showMarkdownPreview}
              previewMode="tabs"
              minHeight={120}
              maxHeight={500}
              enableResize={false}
              className="pr-12"
            />
            
              {/* AI优化按钮 */}
              {showAIOptimization && (
                <div className="absolute bottom-2 right-2 z-10">
                  <AIOptimizeButton
                    content={state.content}
                    title={state.title}
                    onOptimize={onAIOptimize}
                    onOpenSettings={onOpenAISettings}
                    variant="inline"
                  />
                </div>
              )}
          </div>
        </div>
      )}

      {/* 标签输入 */}
      {showTags && (
        <div className="space-y-2">
          <Label htmlFor="tags" className="text-sm font-medium">
            {t('prompteditform.tags')}
          </Label>
          <div className="relative">
            <Input
              id="tags"
              value={state.tags}
              onChange={(e) => onFieldChange('tags', e.target.value)}
              placeholder={t('prompteditform.tagsPlaceholder')}
              className="w-full"
            />
            
            {/* 标签建议 */}
            {state.tags && getTagSuggestions().length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 bg-popover border rounded-md shadow-md mt-1 p-3">
                <div className="text-xs text-muted-foreground mb-2">
                  {t('prompteditform.tagSuggestion')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {getTagSuggestions().map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent text-xs"
                      onClick={() => addSuggestedTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* 已有标签快速选择 */}
          {allTags && allTags.length > 0 && (
            <div className="mt-2">
              <Label className="text-xs text-muted-foreground mb-1 block">
                {t('common.create_prompt.tagChosed')}
              </Label>
              <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto p-1">
                {allTags.slice(0, 20).map(tag => (
                  <Badge 
                    key={tag}
                    variant="outline" 
                    className="cursor-pointer px-2 py-0.5 text-xs font-normal hover:bg-primary/10"
                    onClick={() => addSuggestedTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 图片管理 */}
      {showImages && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {t('prompteditform.image')}
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onImageUpload}
              className="h-8"
            >
              <Upload className="h-4 w-4 mr-1" />
              {t('prompteditform.imageUploadButton')}
            </Button>
          </div>

          {/* 拖拽上传区域 */}
          <div 
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center transition-all",
              isDragging 
                ? "border-primary bg-primary/5" 
                : "border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/20"
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onPaste={onPaste}
          >
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {t('prompteditform.imageUploadPlaceholder')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('prompteditform.imageUploadDescription')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>{t('prompteditform.or')}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onImageUpload}
                  className="h-6 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t('prompteditform.imageUploadButton')}
                </Button>
              </div>
            </div>
          </div>

          {/* 图片网格 */}
          {state.images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {state.images.map((image, index) => (
                <div key={image.id} className="relative group">
                  <Popover>
                    <PopoverTrigger asChild>
                      <div 
                        className={cn(
                          "border rounded-md overflow-hidden cursor-pointer transition-all",
                          state.selectedImageIndex === index 
                            ? "ring-2 ring-primary" 
                            : "hover:opacity-90"
                        )}
                        onClick={() => onImageSelect(index)}
                      >
                        <img 
                          src={image.data} 
                          alt={image.caption || `${t('common.image')} ${index + 1}`} 
                          className="w-full h-20 object-cover"
                        />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="p-2 max-w-xs">
                      <img 
                        src={image.data} 
                        alt={image.caption || `${t('common.image')} ${index + 1}`} 
                        className="w-full mb-2 rounded" 
                      />
                      <div className="text-xs text-muted-foreground">
                        {image.caption || `${t('common.imageCaption')} ${index + 1}`}
                      </div>
                    </PopoverContent>
                  </Popover>
                  
                  {/* 删除按钮 */}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onImageDelete(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* 图片编辑区域 */}
          {state.selectedImageIndex !== null && (
            <div className="rounded-md p-3 bg-muted/50 border">
              <Label className="text-sm font-medium mb-2 block">
                {t('common.imageCaption')}
              </Label>
              <div className="flex gap-2">
                <Input
                  value={state.imageCaption}
                  onChange={(e) => onFieldChange('imageCaption', e.target.value)}
                  placeholder={t('prompteditform.imageCaptionPlaceholder')}
                  className="flex-1"
                />
                <Button 
                  size="sm"
                  onClick={() => {
                    if (state.selectedImageIndex !== null) {
                      onImageCaptionUpdate(state.selectedImageIndex, state.imageCaption);
                      onFieldChange('selectedImageIndex', null);
                      onFieldChange('imageCaption', '');
                    }
                  }}
                >
                  {t('common.confirm')}
                </Button>
              </div>
            </div>
          )}

          {/* 隐藏的文件输入 */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            multiple
            onChange={onImageUploadChange}
          />
        </div>
      )}
    </div>
  );
};
