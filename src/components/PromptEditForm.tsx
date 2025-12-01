{/* 
  角色：编辑表单组件
  主要功能：
    提供完整的提示词编辑表单
    包含标题、分类、标签、内容等输入字段
    处理图片上传和管理
    提供 Markdown 预览功能
*/}
import React from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, X, Edit, Eye } from "lucide-react";
import { PromptEditorState } from "@/hooks/usePromptEditor";
import { Category } from "@/types";
import { AIOptimizeButton } from "./AIOptimizeButton";
import { VariableForm } from "./VariableForm";
import { VariableTextArea } from "./VariableHighlighter";
import { useTranslation } from "react-i18next";

interface PromptEditFormProps {
  state: PromptEditorState;
  categories: Category[];
  allTags: string[];
  onFieldChange: <K extends keyof PromptEditorState>(field: K, value: PromptEditorState[K]) => void;
  onImageUpload: () => void;
  onImageUploadChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImageSelect: (index: number) => void;
  onImageDelete: (index: number) => void;
  onImageCaptionUpdate: (index: number, caption: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onAIOptimize?: (optimizedContent: string) => void;
  onOpenSettings?: () => void;
}

export const PromptEditForm: React.FC<PromptEditFormProps> = ({
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
  onOpenSettings,
}) => {
  const { t } = useTranslation();
  // 获取标签建议
  const getTagSuggestions = () => {
    const currentTags = state.tags.split(/[,，;；]/).map(tag => tag.trim()).filter(Boolean);
    return allTags.filter(tag => 
      !currentTags.includes(tag) && 
      tag.toLowerCase().includes(state.tags.toLowerCase())
    ).slice(0, 5);
  };

  // 添加建议标签
  const addSuggestedTag = (tag: string) => {
    const currentTags = state.tags.split(/[,，;；]/).map(t => t.trim()).filter(Boolean);
    if (!currentTags.includes(tag)) {
      const newTags = [...currentTags, tag].join(", ");
      onFieldChange('tags', newTags);
    }
  };

  // 处理AI优化结果
  const handleAIOptimize = (optimizedContent: string) => {
    if (onAIOptimize) {
      onAIOptimize(optimizedContent);
    }
  };

  // 处理拖拽和粘贴的图片文件
  const handleImageFiles = (files: File[]) => {
    files.forEach(file => {
      // 检查文件大小（10MB限制）
      if (file.size > 10 * 1024 * 1024) {
        console.warn(`${t('common.file')} ${file.name} ${t('prompteditform.message.fileSize')}`);
        return;
      }
      
      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        console.warn(`${t('common.file')} ${file.name} ${t('prompteditform.message.fileType')}`);
        return;
      }
      
      // 创建 FileReader 来读取文件
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        if (imageData) {
          // 模拟文件输入事件，复用现有的图片上传逻辑
          const mockEvent = {
            target: {
              files: [file]
            }
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          onImageUploadChange(mockEvent);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-4 relative">
      {/* 标题输入 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('common.title')}</label>
        <Input
          value={state.title}
          onChange={(e) => onFieldChange('title', e.target.value)}
          placeholder={t('prompteditform.description')}
          className="w-full"
        />
      </div>

      {/* 分类选择 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('prompts.promptCategory')}</label>
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

      {/* 内容编辑 - 标签切换模式 */}
      <div className="space-y-4">
        <label className="text-sm font-medium">{t('prompteditform.promptContent')}</label>
        
        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              {t('common.edit')}
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {t('common.markdownPreview')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="edit" className="mt-4">
            <div className="relative">
              <VariableTextArea
                value={state.content}
                onChange={(value) => onFieldChange('content', value)}
                placeholder={t('prompteditform.promptContentPlaceholder')}
                showVariables={false}
                minHeight={200}
                maxHeight={500}
                enableResize={false}
              />
              {/* AI优化按钮 - 内联模式，位于输入框右下角 */}
              <div className="absolute bottom-2 right-2 z-10">
                <AIOptimizeButton
                  content={state.content}
                  title={state.title}
                  onOptimize={handleAIOptimize}
                  onOpenSettings={onOpenSettings}
                  variant="inline"
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="preview" className="mt-4">
            <div className="border rounded-md min-h-[200px] p-4 bg-muted/30 overflow-auto">
              {state.content ? (
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">
                  {t('common.markdownPreviewPlaceholder')}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 标签输入 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('prompteditform.tags')}</label>
        <div className="relative">
          <Input
            value={state.tags}
            onChange={(e) => onFieldChange('tags', e.target.value)}
            placeholder={t('prompteditform.tagsPlaceholder')}
            className="w-full"
          />
          
          {/* 标签建议 */}
          {state.tags && getTagSuggestions().length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 bg-popover border rounded-md shadow-md mt-1 p-2">
              <div className="text-xs text-muted-foreground mb-2">{t('prompteditform.tagSuggestion')}</div>
              <div className="flex flex-wrap gap-1">
                {getTagSuggestions().map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => addSuggestedTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 图片管理 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{t('prompteditform.image')}</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onImageUpload}
            className="h-8"
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('prompteditform.imageUploadButton')}
          </Button>
        </div>
        {/* 拖拽和粘贴图片区域 */}
        <div 
          className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center transition-all hover:border-muted-foreground/50 hover:bg-muted/20"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('border-primary', 'bg-primary/5');
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
            
            const files = Array.from(e.dataTransfer.files);
            const imageFiles = files.filter(file => file.type.startsWith('image/'));
            
            if (imageFiles.length > 0) {
              handleImageFiles(imageFiles);
            }
          }}
          onPaste={(e) => {
            const items = Array.from(e.clipboardData.items);
            const imageItems = items.filter(item => item.type.startsWith('image/'));
            
            if (imageItems.length > 0) {
              const imageFiles = imageItems.map(item => item.getAsFile()).filter(Boolean);
              handleImageFiles(imageFiles);
            }
          }}
        >
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">{t('prompteditform.imageUploadPlaceholder')}</p>
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
                      className={`border rounded-md overflow-hidden cursor-pointer transition-all ${
                        state.selectedImageIndex === index 
                          ? 'ring-2 ring-primary' 
                          : 'hover:opacity-90'
                      }`}
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
          <div className="rounded-md p-3 bg-muted/50">
            <p className="text-sm font-medium mb-2">{t('common.imageCaption')}</p>
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
                  onImageCaptionUpdate(state.selectedImageIndex!, state.imageCaption);
                  onFieldChange('selectedImageIndex', null);
                  onFieldChange('imageCaption', '');
                }}
              >
                {t('common.confirm')}
              </Button>
            </div>
          </div>
        )}
      </div>

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
  );
};
