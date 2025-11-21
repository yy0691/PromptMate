import { useState } from "react";
import { WorkflowsProvider, useWorkflows } from "@/hooks/useWorkflows";
import WorkflowList from "@/components/workflow/WorkflowList";
import WorkflowBuilder from "@/components/workflow/WorkflowBuilder";
import WorkflowExecutor from "@/components/workflow/WorkflowExecutor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";
import { Workflow } from "@/types/workflow";
import { useAppView } from "@/hooks/useAppView";
import { Sidebar } from "@/components/Sidebar";

type ViewMode = 'list' | 'builder' | 'executor' | 'templates';

function WorkflowViewContent() {
  const { 
    selectedWorkflow, 
    templates, 
    createWorkflow, 
    updateWorkflow, 
    createWorkflowFromTemplate 
  } = useWorkflows();
  const { setCurrentView } = useAppView();
  
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [executingWorkflow, setExecutingWorkflow] = useState<Workflow | null>(null);

  // 创建新工作流
  const handleCreateNew = () => {
    setEditingWorkflow(null);
    setViewMode('builder');
  };

  // 编辑工作流
  const handleEdit = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setViewMode('builder');
  };

  // 执行工作流
  const handleExecute = (workflow: Workflow) => {
    setExecutingWorkflow(workflow);
    setViewMode('executor');
  };

  // 保存工作流
  const handleSave = (workflow: Workflow) => {
    if (editingWorkflow) {
      updateWorkflow(workflow.id, workflow);
    } else {
      createWorkflow(workflow);
    }
    setViewMode('list');
    setEditingWorkflow(null);
  };

  // 取消编辑
  const handleCancel = () => {
    setViewMode('list');
    setEditingWorkflow(null);
  };

  // 关闭执行器
  const handleCloseExecutor = () => {
    setViewMode('list');
    setExecutingWorkflow(null);
  };

  // 从模板创建工作流
  const handleCreateFromTemplate = (templateId: string) => {
    createWorkflowFromTemplate(templateId);
    setViewMode('list');
  };

  // 渲染模板视图
  const renderTemplatesView = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">工作流模板</h2>
          <Button variant="outline" onClick={() => setViewMode('list')}>
            <Icons.arrowLeft className="h-4 w-4 mr-2" />
            返回列表
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {template.description}
                    </CardDescription>
                  </div>
                  {template.isBuiltIn && (
                    <Badge variant="secondary" className="text-xs">
                      内置
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{template.workflow.steps.length} 个步骤</span>
                    <span>{template.category}</span>
                  </div>
                  
                  {template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {template.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  <Button 
                    className="w-full" 
                    size="sm"
                    onClick={() => handleCreateFromTemplate(template.id)}
                  >
                    <Icons.plus className="h-4 w-4 mr-2" />
                    使用模板
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  // 根据当前视图模式渲染内容
  switch (viewMode) {
    case 'builder':
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentView('prompts')}>
                <Icons.arrowLeft className="h-4 w-4 mr-2" />
                返回提示词
              </Button>
              <div className="h-4 w-px bg-border" />
              <h1 className="text-lg font-semibold">
                {editingWorkflow ? '编辑工作流' : '创建工作流'}
              </h1>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <WorkflowBuilder
              workflow={editingWorkflow || undefined}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        </div>
      );
      
    case 'executor':
      return executingWorkflow ? (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentView('prompts')}>
                <Icons.arrowLeft className="h-4 w-4 mr-2" />
                返回提示词
              </Button>
              <div className="h-4 w-px bg-border" />
              <h1 className="text-lg font-semibold">执行工作流</h1>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <WorkflowExecutor
              workflow={executingWorkflow}
              onClose={handleCloseExecutor}
            />
          </div>
        </div>
      ) : null;
      
    case 'templates':
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentView('prompts')}>
                <Icons.arrowLeft className="h-4 w-4 mr-2" />
                返回提示词
              </Button>
              <div className="h-4 w-px bg-border" />
              <h1 className="text-lg font-semibold">工作流模板</h1>
            </div>
            <Button variant="outline" onClick={() => setViewMode('list')}>
              <Icons.fileText className="h-4 w-4 mr-2" />
              工作流列表
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            {renderTemplatesView()}
          </div>
        </div>
      );
      
    default:
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentView('prompts')}>
                <Icons.arrowLeft className="h-4 w-4 mr-2" />
                返回提示词
              </Button>
              <div className="h-4 w-px bg-border" />
              <h1 className="text-lg font-semibold">工作流管理</h1>
            </div>
            <Button onClick={() => setViewMode('templates')}>
              <Icons.template className="h-4 w-4 mr-2" />
              浏览模板
            </Button>
          </div>
            <div className="flex flex-1 overflow-hidden">
              {/* 左侧：工作流列表 */}
              <div className="w-1/2 border-r">
                <WorkflowList
                  onCreateNew={handleCreateNew}
                  onEdit={handleEdit}
                  onExecute={handleExecute}
                />
              </div>
              
              {/* 右侧：详情面板 */}
              <div className="w-1/2">
                {selectedWorkflow ? (
                  <div className="p-4 h-full overflow-auto">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{selectedWorkflow.name}</h3>
                          {selectedWorkflow.description && (
                            <p className="text-muted-foreground mt-1">
                              {selectedWorkflow.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleExecute(selectedWorkflow)}>
                            <Icons.play className="h-4 w-4 mr-2" />
                            执行
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(selectedWorkflow)}>
                            <Icons.edit className="h-4 w-4 mr-2" />
                            编辑
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{selectedWorkflow.steps.length} 个步骤</span>
                        <span>{selectedWorkflow.category}</span>
                        <span>v{selectedWorkflow.version}</span>
                      </div>
                      
                      {selectedWorkflow.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {selectedWorkflow.tags.map(tag => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {/* 变量列表 */}
                      {selectedWorkflow.variables.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">输入变量</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {selectedWorkflow.variables.map(variable => (
                                <div key={variable.name} className="flex items-center justify-between p-2 border rounded">
                                  <div>
                                    <span className="font-medium">{variable.name}</span>
                                    {variable.description && (
                                      <p className="text-xs text-muted-foreground">
                                        {variable.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    <Badge variant="outline" className="text-xs">
                                      {variable.type}
                                    </Badge>
                                    {variable.required && (
                                      <Badge variant="destructive" className="text-xs">
                                        必需
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      {/* 步骤列表 */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">执行步骤</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {selectedWorkflow.steps.map((step, index) => (
                              <div key={step.id} className="flex items-start gap-3 p-3 border rounded">
                                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center mt-0.5">
                                  {index + 1}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium">{step.name}</span>
                                    {step.isOptional && (
                                      <Badge variant="outline" className="text-xs">可选</Badge>
                                    )}
                                    {step.outputVariable && (
                                      <Badge variant="secondary" className="text-xs">
                                        输出: {step.outputVariable}
                                      </Badge>
                                    )}
                                  </div>
                                  {step.description && (
                                    <p className="text-sm text-muted-foreground mb-2">
                                      {step.description}
                                    </p>
                                  )}
                                  <div className="text-xs text-muted-foreground">
                                    {step.promptId ? "使用现有提示词" : "自定义提示词"}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Icons.workflow className="h-16 w-16 mb-4 opacity-50" />
                    <p className="text-lg mb-2">选择一个工作流</p>
                    <p className="text-sm mb-4">在左侧列表中选择工作流查看详情</p>
                    <div className="flex gap-2">
                      <Button onClick={handleCreateNew}>
                        <Icons.plus className="h-4 w-4 mr-2" />
                        创建工作流
                      </Button>
                      <Button variant="outline" onClick={() => setViewMode('templates')}>
                        <Icons.template className="h-4 w-4 mr-2" />
                        浏览模板
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
      );
  }
}

function WorkflowView() {
  return (
    <WorkflowsProvider>
      <div className="flex flex-1 min-h-0">
        {/* 左侧边栏 - 始终显示 */}
        <Sidebar />
        
        {/* 右侧内容区域 */}
        <div className="flex-1 min-h-0">
          <WorkflowViewContent />
        </div>
      </div>
    </WorkflowsProvider>
  );
}

export default WorkflowView;