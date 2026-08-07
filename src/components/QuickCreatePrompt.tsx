import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { CreatePromptOptions } from "@/hooks/useCreatePrompt";
import { CreatePromptDialog } from "@/components/CreatePromptDialog";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ContextMenuItem } from "@/components/ui/context-menu";

interface QuickCreatePromptProps {
  variant?: "button" | "icon" | "fab" | "menu-item";
  size?: "sm" | "default" | "lg";
  className?: string;
  options?: CreatePromptOptions;
  showMarkdownPreview?: boolean;
  showImageUpload?: boolean;
  showTagSuggestions?: boolean;
  children?: React.ReactNode;
  tooltip?: string;
}

/**
 * 快速新建提示词组件
 * 提供多种样式的触发按钮和统一的创建对话框
 * * ✅ 使用 React.forwardRef 包装，使其能够接收来自父组件的 ref。
 * 这是解决与 TooltipTrigger asChild 等组件集成时出现警告和副作用的关键。
 */
export const QuickCreatePrompt = React.forwardRef<
  HTMLElement, // ref 的类型可以是多种 HTML 元素
  QuickCreatePromptProps
>(
  (
    {
      variant = "button",
      size = "default",
      className,
      options,
      showMarkdownPreview = true,
      showImageUpload = true,
      showTagSuggestions = true,
      children,
      tooltip = "新建提示词",
    },
    ref // ✅ 接收 ref 参数
  ) => {
    const [showDialog, setShowDialog] = useState(false);

    // 根据不同的 variant 渲染触发器
    const renderTrigger = () => {
      const baseProps = {
        onClick: () => setShowDialog(true),
        className: cn(className),
      };
      const accessibleLabel = typeof tooltip === "string" ? tooltip : "新建提示词";

      switch (variant) {
        case "icon":
          return (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    ref={ref as React.Ref<HTMLButtonElement>} // ✅ 将 ref 传递给 Button
                    variant="ghost"
                    size="icon"
                    aria-label={accessibleLabel}
                    title={accessibleLabel}
                    {...baseProps}
                    className={cn(
                      "rounded-full h-8 w-8 hover:scale-95 transition-transform",
                      className
                    )}
                  >
                    <Icons.plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );

        case "fab":
          return (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    ref={ref as React.Ref<HTMLButtonElement>} // ✅ 将 ref 传递给 Button
                    variant="default"
                    size="icon"
                    aria-label={accessibleLabel}
                    title={accessibleLabel}
                    {...baseProps}
                    className={cn(
                      "rounded-full h-12 w-12 bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all",
                      className
                    )}
                  >
                    <Icons.plus className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );

        case "menu-item":
          return (
            <ContextMenuItem
              ref={ref as React.Ref<HTMLDivElement>} // ✅ 将 ref 传递给 ContextMenuItem
              onClick={() => setShowDialog(true)}
              className={cn(className)}
            >
              <Icons.plus className="h-4 w-4 mr-2" />
              {children || "新建提示词"}
            </ContextMenuItem>
          );

        case "button":
        default:
          return (
            <Button
              ref={ref as React.Ref<HTMLButtonElement>} // ✅ 将 ref 传递给 Button
              variant="default"
              size={size}
              {...baseProps}
            >
              <Icons.plus className="h-4 w-4 mr-2" />
              {children || "新建提示词"}
            </Button>
          );
      }
    };

    return (
      <>
        {renderTrigger()}
        <CreatePromptDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          options={options}
          showMarkdownPreview={showMarkdownPreview}
          showImageUpload={showImageUpload}
          showTagSuggestions={showTagSuggestions}
        />
      </>
    );
  }
);

// 为组件添加 displayName，便于在 React DevTools 中调试
QuickCreatePrompt.displayName = "QuickCreatePrompt";
