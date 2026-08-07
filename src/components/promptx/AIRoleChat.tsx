/**
 * PromptX AI 角色对话组件
 * 实现与激活角色的实际对话功能
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Send, 
  User, 
  Bot,
  Sparkles,
  MessageSquare,
  Copy,
  RefreshCw,
  Settings
} from 'lucide-react';

import { RoleInstance } from '@/services/promptx/ProfessionalRoles';
import { professionalRolesManager } from '@/services/promptx/ProfessionalRoles';
import { aiRoleService, AIRoleMessage } from '@/services/promptx/AIRoleService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  roleContext?: {
    roleId: string;
    roleName: string;
  };
}

interface AIRoleChatProps {
  activeRole: RoleInstance;
  onRoleDeactivated?: () => void;
  className?: string;
}

export const AIRoleChat: React.FC<AIRoleChatProps> = ({
  activeRole,
  onRoleDeactivated,
  className = ''
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 获取角色详细信息
  const roleDetails = professionalRolesManager.getRoleById(activeRole.roleId);

  useEffect(() => {
    // 角色激活时的欢迎消息
    if (activeRole) {
      const welcomeMessage: ChatMessage = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: generateWelcomeMessage(activeRole),
        timestamp: new Date(),
        roleContext: {
          roleId: activeRole.roleId,
          roleName: activeRole.name
        }
      };
      setMessages([welcomeMessage]);
    }
  }, [activeRole]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * 生成角色欢迎消息
   */
  const generateWelcomeMessage = (role: RoleInstance): string => {
    const greetings = {
      'product-manager': `您好！我是您的专业产品经理助手。我可以帮您进行需求分析、用户研究、产品规划等工作。请告诉我您遇到的产品问题，我会从产品经理的专业角度为您提供建议。`,
      'architect': `您好！我是您的系统架构师顾问。我擅长系统设计、技术选型、性能优化等领域。请描述您的技术挑战，我会为您提供专业的架构建议和解决方案。`,
      'copywriter': `您好！我是您的文案策划专家。我可以帮您创作品牌文案、营销内容、广告创意等。请告诉我您的文案需求，我会为您提供有感染力的文案方案。`,
      'ui-designer': `您好！我是您的UI/UX设计顾问。我专注于用户体验设计、界面优化、交互设计等。请分享您的设计挑战，我会从用户体验的角度为您提供专业建议。`,
      'data-analyst': `您好！我是您的数据分析专家。我可以帮您进行数据分析、指标设计、报告制作等。请描述您的数据问题，我会为您提供数据驱动的解决方案。`
    };

    return greetings[role.roleId as keyof typeof greetings] || 
           `您好！我是您的${role.name}助手，很高兴为您提供专业服务。请告诉我如何帮助您？`;
  };

  /**
   * 发送消息
   */
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      // 检查 AI 服务是否可用
      const isAIAvailable = await aiRoleService.checkAIServiceAvailability();
      
      let response: string;
      
      if (isAIAvailable) {
        // 使用真实的 AI 服务
        const conversationHistory: AIRoleMessage[] = messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        }));

        const aiResponse = await aiRoleService.sendRoleMessage(
          currentInput,
          activeRole,
          conversationHistory
        );
        
        response = aiResponse.content;
      } else {
        // 回退到模拟响应
        response = await simulateAIResponse(currentInput, activeRole);
        toast.info('当前使用模拟 AI 响应，请在设置中配置 AI 服务以获得真实体验');
      }
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        roleContext: {
          roleId: activeRole.roleId,
          roleName: activeRole.name
        }
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI 响应失败:', error);
      
      // 如果真实 AI 失败，尝试模拟响应
      try {
        const fallbackResponse = await simulateAIResponse(currentInput, activeRole);
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: fallbackResponse,
          timestamp: new Date(),
          roleContext: {
            roleId: activeRole.roleId,
            roleName: activeRole.name
          }
        };
        setMessages(prev => [...prev, assistantMessage]);
        toast.warning('AI 服务暂时不可用，使用模拟响应');
      } catch (fallbackError) {
        toast.error('AI 响应失败，请检查网络连接或 AI 配置');
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 模拟 AI 响应（实际项目中替换为真实 AI 服务调用）
   */
  const simulateAIResponse = async (userInput: string, role: RoleInstance): Promise<string> => {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const rolePrompt = roleDetails ? professionalRolesManager.getRolePrompt(role.roleId, role.context) : '';
    
    // 根据角色生成不同风格的回答
    const responses = {
      'product-manager': generateProductManagerResponse(userInput),
      'architect': generateArchitectResponse(userInput),
      'copywriter': generateCopywriterResponse(userInput),
      'ui-designer': generateUIDesignerResponse(userInput),
      'data-analyst': generateDataAnalystResponse(userInput)
    };

    return responses[role.roleId as keyof typeof responses] || 
           `作为${role.name}，我建议您：\n\n${userInput}\n\n这是一个很好的问题，让我从专业角度为您分析...`;
  };

  /**
   * 产品经理风格回答
   */
  const generateProductManagerResponse = (input: string): string => {
    return `从产品经理的角度分析您的问题：

**问题理解：**
${input}

**分析框架：**
1. **用户价值分析**
   - 目标用户群体识别
   - 用户痛点和需求分析
   - 用户场景梳理

2. **商业价值评估**
   - 市场机会评估
   - 竞争优势分析
   - 商业模式影响

3. **技术可行性**
   - 技术实现难度
   - 资源投入评估
   - 开发周期预估

**建议方案：**
- 建议进行用户调研验证需求
- 制定MVP方案快速验证
- 建立数据指标监控效果

**下一步行动：**
1. 制定详细的PRD文档
2. 与技术团队评估可行性
3. 设计A/B测试方案

需要我详细展开某个方面的分析吗？`;
  };

  /**
   * 系统架构师风格回答
   */
  const generateArchitectResponse = (input: string): string => {
    return `从系统架构师的角度为您提供技术方案：

**技术需求分析：**
${input}

**架构设计考虑：**
1. **性能要求**
   - 并发量评估
   - 响应时间要求
   - 吞吐量指标

2. **可扩展性**
   - 水平扩展能力
   - 垂直扩展方案
   - 微服务架构考虑

3. **可靠性保障**
   - 高可用设计
   - 容错机制
   - 数据一致性

**技术选型建议：**
- 数据库选择：根据数据特性选择SQL/NoSQL
- 缓存策略：Redis集群方案
- 消息队列：Kafka/RabbitMQ选型
- 负载均衡：Nginx/HAProxy配置

**实施路径：**
1. 搭建基础架构
2. 核心服务开发
3. 性能测试和优化

需要我详细设计某个技术模块吗？`;
  };

  /**
   * 文案策划风格回答
   */
  const generateCopywriterResponse = (input: string): string => {
    return `从文案策划的角度为您创作内容：

**创作需求理解：**
${input}

**文案策略分析：**
1. **目标受众画像**
   - 年龄群体和消费习惯
   - 痛点和需求分析
   - 沟通偏好识别

2. **品牌调性定位**
   - 品牌个性特征
   - 情感连接点
   - 差异化卖点

3. **传播渠道适配**
   - 平台特性分析
   - 内容形式选择
   - 传播节奏规划

**创意方向建议：**
- 情感共鸣：挖掘用户内心需求
- 场景化表达：具体使用场景描述
- 行动召唤：明确的转化引导

**文案框架：**
1. 吸引注意：强有力的开头
2. 激发兴趣：核心卖点展示
3. 建立信任：权威背书和证明
4. 促成行动：明确的行动指引

需要我为您创作具体的文案内容吗？`;
  };

  /**
   * UI设计师风格回答
   */
  const generateUIDesignerResponse = (input: string): string => {
    return `从UI/UX设计师的角度为您分析：

**设计需求分析：**
${input}

**用户体验考虑：**
1. **用户研究**
   - 用户行为分析
   - 使用场景研究
   - 痛点识别

2. **交互设计**
   - 信息架构梳理
   - 用户流程优化
   - 交互反馈设计

3. **视觉设计**
   - 视觉层级规划
   - 色彩和字体选择
   - 组件一致性

**设计原则：**
- 易用性：降低学习成本
- 一致性：保持设计统一
- 反馈性：及时的操作反馈
- 容错性：友好的错误处理

**设计建议：**
1. 进行用户测试验证设计
2. 建立设计系统保证一致性
3. 关注无障碍设计

**原型规划：**
- 低保真原型：验证信息架构
- 高保真原型：确认视觉效果
- 交互原型：测试用户流程

需要我详细设计某个界面或流程吗？`;
  };

  /**
   * 数据分析师风格回答
   */
  const generateDataAnalystResponse = (input: string): string => {
    return `从数据分析师的角度为您提供分析：

**数据需求理解：**
${input}

**分析框架设计：**
1. **数据收集**
   - 数据源识别
   - 数据质量评估
   - 采集方案设计

2. **分析方法**
   - 描述性分析：现状总结
   - 诊断性分析：原因探索
   - 预测性分析：趋势预测

3. **指标体系**
   - 核心指标定义
   - 辅助指标设计
   - 监控预警机制

**分析建议：**
- 建立数据仪表板实时监控
- 设计A/B测试验证假设
- 构建用户行为分析模型

**实施步骤：**
1. 数据埋点和收集
2. 数据清洗和处理
3. 分析建模和可视化
4. 洞察提取和行动建议

**可视化方案：**
- 趋势图：展示时间序列变化
- 漏斗图：分析转化流程
- 热力图：用户行为分布

需要我详细设计分析方案或制作报告吗？`;
  };

  /**
   * 复制消息内容
   */
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('消息已复制到剪贴板');
  };

  /**
   * 清空对话历史
   */
  const clearChat = () => {
    setMessages([]);
    // 重新添加欢迎消息
    const welcomeMessage: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: generateWelcomeMessage(activeRole),
      timestamp: new Date(),
      roleContext: {
        roleId: activeRole.roleId,
        roleName: activeRole.name
      }
    };
    setMessages([welcomeMessage]);
    toast.success('对话历史已清空');
  };

  /**
   * 滚动到底部
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * 处理键盘事件
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`ai-role-chat flex flex-col h-full ${className}`}>
      {/* 角色信息头部 */}
      <Card className="flex-shrink-0 border-b">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={activeRole.avatar} alt={activeRole.name} />
                <AvatarFallback>
                  <Bot className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold flex items-center">
                  <Sparkles className="h-4 w-4 mr-1 text-blue-500" />
                  {activeRole.name}
                </h3>
                <p className="text-sm text-muted-foreground">{activeRole.description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearChat}
                title="清空对话"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRoleDeactivated}
                title="退出角色"
              >
                退出角色
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 对话消息区域 */}
      <div className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    {message.role === 'assistant' && (
                      <Avatar className="h-6 w-6 mt-1">
                        <AvatarImage src={activeRole.avatar} alt={activeRole.name} />
                        <AvatarFallback>
                          <Bot className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    {message.role === 'user' && (
                      <User className="h-5 w-5 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="whitespace-pre-wrap break-words">
                        {message.content}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs opacity-70">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                          aria-label="复制消息"
                          title="复制消息"
                          onClick={() => copyMessage(message.content)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 max-w-[80%]">
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={activeRole.avatar} alt={activeRole.name} />
                      <AvatarFallback>
                        <Bot className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* 输入区域 */}
        <div className="flex-shrink-0 border-t p-4">
          <div className="flex space-x-2">
            <Textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`向${activeRole.name}提问...`}
              className="flex-1 min-h-[60px] max-h-[120px] resize-none"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="self-end"
              aria-label="发送消息"
              title="发送消息"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-muted-foreground">
              按 Ctrl+Enter 快速发送
            </p>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />
                {messages.length} 条消息
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
