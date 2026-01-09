import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuickPromptEditor } from "./QuickPromptEditor";
import { PromptEditorDialog } from "./PromptEditorDialog";
import { PromptPreview } from "./PromptPreview";
import { usePrompts } from "@/hooks/usePrompts";

/**
 * 这个文件展示了如何使用新的模块化提示词编辑组件
 * 
 * 主要组件：
 * 1. usePromptEditor - 自定义 Hook，管理编辑状态和逻辑
 * 2. PromptEditForm - 编辑表单组件
 * 3. PromptPreview - 预览组件
 * 4. PromptEditorDialog - 完整的编辑对话框
 * 5. QuickPromptEditor - 快速编辑触发器
 * 6. PromptEditorModular - 替换原始 PromptEditor 的模块化版本
 */

export const ModularComponentsExample: React.FC = () => {
  const { prompts } = usePrompts();
  const [selectedPrompt, setSelectedPrompt] = useState(prompts[0] || null);
  const [showEditorDialog, setShowEditorDialog] = useState(false);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">模块化提示词编辑组件示例</h1>

      {/* 组件使用示例 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">1. QuickPromptEditor 组件</h2>
        <p className="text-sm text-muted-foreground">
          快速编辑触发器，支持多种样式和尺寸
        </p>
        <div className="flex gap-2">
          <QuickPromptEditor
            prompt={selectedPrompt}
            variant="button"
            size="sm"
          >
            编辑提示词
          </QuickPromptEditor>

          <QuickPromptEditor
            prompt={selectedPrompt}
            variant="icon"
            size="sm"
          />

          <QuickPromptEditor
            prompt={selectedPrompt}
            variant="ghost"
            size="sm"
          >
            编辑
          </QuickPromptEditor>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">2. PromptEditorDialog 组件</h2>
        <p className="text-sm text-muted-foreground">
          完整的编辑对话框，包含所有编辑和预览功能
        </p>
        <Button onClick={() => setShowEditorDialog(true)}>
          打开编辑对话框
        </Button>

        <PromptEditorDialog
          open={showEditorDialog}
          onOpenChange={setShowEditorDialog}
          prompt={selectedPrompt}
          options={{
            autoSave: true,
            autoSaveDelay: 2000,
            onSave: (prompt) => {
              //console.log("提示词已保存:", prompt);
            },
            onDelete: (promptId) => {
              // console.log("提示词已删除:", promptId);
            },
          }}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">3. PromptPreview 组件</h2>
        <p className="text-sm text-muted-foreground">
          独立的预览组件，可以在任何地方使用
        </p>
        {selectedPrompt && (
          <div className="border rounded-lg p-4">
            <PromptPreview prompt={selectedPrompt} />
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">4. 提示词选择</h2>
        <p className="text-sm text-muted-foreground">
          选择不同的提示词来测试组件功能
        </p>
        <div className="flex flex-wrap gap-2">
          {prompts.slice(0, 5).map((prompt) => (
            <Button
              key={prompt.id}
              variant={selectedPrompt?.id === prompt.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPrompt(prompt)}
            >
              {prompt.title}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">5. 使用说明</h2>
        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>usePromptEditor Hook:</strong> 提供完整的编辑状态管理和操作函数</p>
          <p><strong>PromptEditForm:</strong> 可复用的编辑表单，支持标题、内容、分类、标签、图片等</p>
          <p><strong>PromptPreview:</strong> 可复用的预览组件，支持 Markdown 渲染和图片显示</p>
          <p><strong>PromptEditorDialog:</strong> 完整的编辑对话框，集成所有功能</p>
          <p><strong>QuickPromptEditor:</strong> 快速编辑触发器，支持多种样式</p>
          <p><strong>PromptEditorModular:</strong> 替换原始 PromptEditor 的模块化版本</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">6. 功能特性</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>✅ 自动保存功能（可配置延迟时间）</li>
          <li>✅ 未保存更改检测和提醒</li>
          <li>✅ 图片上传和管理</li>
          <li>✅ Markdown 预览</li>
          <li>✅ 标签建议和自动完成</li>
          <li>✅ 分类选择</li>
          <li>✅ 收藏功能</li>
          <li>✅ 复制和删除操作</li>
          <li>✅ 响应式设计</li>
          <li>✅ 完整的 TypeScript 支持</li>
        </ul>
      </div>
    </div>
  );
};
