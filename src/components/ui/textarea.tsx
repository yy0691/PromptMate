import * as React from "react"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 是否启用快捷键支持（默认：true） */
  enableShortcuts?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, enableShortcuts = true, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    
    // 合并外部 ref 和内部 ref
    React.useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement, []);

    // 启用快捷键支持
    useKeyboardShortcuts(textareaRef, {
      enabled: enableShortcuts,
    });

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border bg-background px-6 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-3 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={(node) => {
          textareaRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
