import * as React from "react"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  /** 是否启用快捷键支持（默认：true） */
  enableShortcuts?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, enableShortcuts = true, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    
    // 合并外部 ref 和内部 ref
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

    // 启用快捷键支持
    useKeyboardShortcuts(inputRef, {
      enabled: enableShortcuts,
    });

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={(node) => {
          inputRef.current = node;
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
Input.displayName = "Input"

export { Input }
