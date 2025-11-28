import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { applyVariableValues, VariableInfo } from '@/lib/variableUtils';

interface VariableReplacementDisplayProps {
  originalContent: string;
  variableValues: Record<string, string>;
  className?: string;
  onVariableClick?: (variable?: VariableInfo) => void; // 新增：点击变量的回调
}

export const VariableReplacementDisplay: React.FC<VariableReplacementDisplayProps> = ({
  originalContent,
  variableValues,
  className = "",
  onVariableClick,
}) => {
  // 使用现有的 applyVariableValues 函数获取最终内容
  const finalContent = applyVariableValues(originalContent, variableValues);
  
  // 创建一个带有高亮标记的版本
  const createHighlightedContent = () => {
    let content = originalContent;
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const matches = Array.from(originalContent.matchAll(variableRegex));
    
    // 从后往前替换，避免位置偏移
    matches.reverse().forEach(match => {
      const variableName = match[1].trim();
      const value = variableValues[variableName];
      
      if (value !== undefined && value !== '') {
        const before = content.substring(0, match.index);
        const after = content.substring(match.index + match[0].length);
        // 使用特殊标记包围变量值
        const replacement = `**[${value}]**`;
        content = before + replacement + after;
      }
    });
    
    return content;
  };

  const highlightedContent = createHighlightedContent();

  return (
    <div className={cn("variable-replacement-display", className)}>
      <div className="markdown-body prose prose-sm max-w-none">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            // 自定义 strong 组件来处理我们的变量高亮标记
            strong: ({ children, ...props }) => {
              const text = children?.toString() || '';
              // 检查是否是我们的变量标记格式 [value]
              if (text.startsWith('[') && text.endsWith(']')) {
                const value = text.slice(1, -1);
                return (
                  <span
                    className={cn(
                      "inline-block px-2 py-0.5 mx-0.5 rounded text-white font-medium text-sm",
                      "bg-gradient-to-r from-blue-500 to-purple-600",
                      "hover:from-blue-600 hover:to-purple-700 hover:shadow-sm",
                      "transition-all duration-200",
                      onVariableClick ? "cursor-pointer" : "cursor-help"
                    )}
                    title="已填写的变量 - 点击打开变量表单"
                    onClick={() => onVariableClick?.()}
                  >
                    {value}
                  </span>
                );
              }
              // 否则使用默认的 strong 渲染
              return <strong {...props}>{children}</strong>;
            }
          }}
        >
          {highlightedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};
