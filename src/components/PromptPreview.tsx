import React, { useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Prompt } from "@/types";
import { VariableDisplay } from "./VariableHighlighter";
import { VariableForm } from "./VariableForm";
import { VariableReplacementDisplay } from "./VariableReplacementDisplay";
import { applyVariableValues } from "@/lib/variableUtils";
import { useTranslation } from "react-i18next";

interface PromptPreviewProps {
  prompt: Prompt;
  className?: string;
  showVariableForm: boolean;
  variableValues: Record<string, string>;
  onVariableChange: (values: Record<string, string>) => void;
  onPreviewChange: (content: string) => void;
  onOpenVariableForm?: () => void; // 新增：打开变量表单的回调
}

export const PromptPreview: React.FC<PromptPreviewProps> = ({
  prompt,
  className = "",
  showVariableForm,
  variableValues,
  onVariableChange,
  onPreviewChange,
  onOpenVariableForm,
}) => {
  const { t } = useTranslation();

  // 处理变量点击事件
  const handleVariableClick = () => {
    // 如果表单未打开，则打开表单
    if (!showVariableForm && onOpenVariableForm) {
      onOpenVariableForm();
    }
  };

  // 计算预览内容
  const previewContent = variableValues && Object.keys(variableValues).length > 0
    ? applyVariableValues(prompt.content, variableValues)
    : prompt.content;

  // 确保 variableValues 有默认值
  const safeVariableValues = variableValues || {};

  return (
    <div className={`h-full flex flex-col overflow-hidden ${className}`}>
      {/* 变量填写表单 */}
      {showVariableForm && (
        <div className="flex-shrink-0 bg-muted/30 rounded-md p-4 space-y-4 mb-4 w-full min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{t('variableForm.variableFill')}</h3>
            <div className="text-xs text-muted-foreground">
              {t('variableForm.fillVariablesHint')}
            </div>
          </div>
          
          <div className="overflow-y-auto w-full">
            <VariableForm
              content={prompt.content}
              onVariableChange={onVariableChange}
              onPreviewChange={onPreviewChange}
              className="w-full min-w-0"
            />
          </div>
        </div>
      )}
      {/* 内容预览区域 */}
      <div className="flex-1 bg-muted/30 rounded-md p-4 space-y-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            {Object.keys(safeVariableValues).length > 0 ? t('variableForm.finalContent') : t('variableForm.originalContent')}
          </h3>
          {Object.keys(safeVariableValues).length > 0 && (
            <div className="text-xs text-muted-foreground">
              {t('variableForm.variableCount')}: {Object.keys(safeVariableValues).length}
            </div>
          )}
        </div>

        {/* markdown+变量高亮显示 */}
        {/* <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewContent}</ReactMarkdown>
        </div> */}

        {/* 统一的内容显示 */}
        <div className="space-y-3">
          {Object.keys(safeVariableValues).length > 0 ? (
            // 显示带变量高亮的替换后内容
            <VariableReplacementDisplay
              originalContent={prompt.content}
              variableValues={safeVariableValues}
              onVariableClick={handleVariableClick}
            />
          ) : (
            // 显示原始内容（带变量高亮）
            <VariableDisplay
              content={prompt.content}
              showVariableCount={true}
              onVariableClick={handleVariableClick}
            />
          )}
        </div>
      </div>

      
      
      {/* 图片预览区域 */}
      {prompt.images && prompt.images.length > 0 && (
        <div className="flex-shrink-0 space-y-3 mt-4">
          <h3 className="text-sm font-medium">{t('common.imageUpload')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {prompt.images.map((image, index) => (
              <Popover key={image.id}>
                <PopoverTrigger asChild>
                  <div className="border rounded-md overflow-hidden cursor-pointer hover:opacity-90">
                    <img 
                      src={image.data} 
                      alt={image.caption || `$t('common.image') ${index + 1}`} 
                      className="w-full h-28 object-cover"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="p-2 max-w-xs">
                  <img 
                    src={image.data} 
                    alt={image.caption || `$t('common.image') ${index + 1}`} 
                    className="w-full mb-2 rounded" 
                  />
                  <div className="text-xs text-muted-foreground">
                    {image.caption || `${t('common.imageCaptionPlaceholder')} ${index + 1}`}
                  </div>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        </div>
      )}
      
      {/* 标签显示 */}
      {prompt.tags && prompt.tags.length > 0 && (
        <div className="flex-shrink-0 flex flex-wrap gap-2 mt-4">
          {prompt.tags.map((tag) => (
            <div
              key={tag}
              className="bg-muted/80 text-muted-foreground px-1.5 py-0.5 rounded-md text-[10px] font-normal"
            >
              {tag}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
