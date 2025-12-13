import { useToast } from "@/hooks/use-toast";

// AI模型定义接口
export interface AIModel {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  category?: 'chat' | 'embedding' | 'vision' | 'code';
}

// AI服务配置接口
export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'custom';
}

// AI优化请求接口
export interface AIOptimizeRequest {
  content: string;
  title?: string;
  mode: 'optimize' | 'generate';
}

// AI优化响应接口
export interface AIOptimizeResponse {
  optimizedContent: string;
  explanation?: string;
  suggestions?: string[];
}

// 流式响应回调接口
export interface StreamCallback {
  onChunk: (chunk: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

// 翻译请求接口
export interface AITranslateRequest {
  content: string;
  targetLanguage: 'zh' | 'en';
  title?: string;
}

// 翻译响应接口
export interface AITranslateResponse {
  translatedContent: string;
  detectedLanguage: 'zh' | 'en';
}

// 批量翻译进度回调
export interface BatchTranslateCallback {
  onProgress: (current: number, total: number, promptId: string) => void;
  onItemComplete: (promptId: string, result: AITranslateResponse) => void;
  onError: (promptId: string, error: Error) => void;
  onComplete: (results: Map<string, AITranslateResponse>) => void;
}

// 各服务商支持的模型列表
export const AI_MODELS: Record<string, AIModel[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: '最新多模态模型，支持文本、图像、音频', contextLength: 128000 },
    { id: 'gpt-4o-2024-11-20', name: 'GPT-4o (2024-11-20)', description: '最新版本GPT-4o', contextLength: 128000 },
    { id: 'gpt-4o-2024-08-06', name: 'GPT-4o (2024-08-06)', description: '稳定版GPT-4o', contextLength: 128000 },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '轻量版GPT-4o，速度更快成本更低', contextLength: 128000 },
    { id: 'gpt-4o-mini-2024-07-18', name: 'GPT-4o Mini (2024-07-18)', description: '稳定版GPT-4o Mini', contextLength: 128000 },
    { id: 'o1-preview', name: 'o1-preview', description: '推理增强模型，适合复杂问题', contextLength: 128000 },
    { id: 'o1-mini', name: 'o1-mini', description: '轻量版推理模型', contextLength: 128000 },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '高性能GPT-4模型', contextLength: 128000 },
    { id: 'gpt-4-turbo-2024-04-09', name: 'GPT-4 Turbo (2024-04-09)', description: '稳定版GPT-4 Turbo', contextLength: 128000 },
    { id: 'gpt-4', name: 'GPT-4', description: '经典GPT-4模型', contextLength: 8192 },
    { id: 'gpt-4-0613', name: 'GPT-4 (0613)', description: '稳定版GPT-4', contextLength: 8192 },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '性价比优选模型', contextLength: 16385 },
    { id: 'gpt-3.5-turbo-0125', name: 'GPT-3.5 Turbo (0125)', description: '最新版GPT-3.5', contextLength: 16385 }
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: '最新Claude模型，推理能力强', contextLength: 200000 },
    { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet (20240620)', description: '稳定版Claude 3.5 Sonnet', contextLength: 200000 },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: '快速响应版本', contextLength: 200000 },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: '最强推理能力', contextLength: 200000 },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: '平衡性能与成本', contextLength: 200000 },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: '快速轻量版本', contextLength: 200000 },
    { id: 'claude-2.1', name: 'Claude 2.1', description: '经典Claude 2.1模型', contextLength: 200000 },
    { id: 'claude-2.0', name: 'Claude 2.0', description: '经典Claude 2.0模型', contextLength: 100000 },
    { id: 'claude-instant-1.2', name: 'Claude Instant 1.2', description: '快速响应模型', contextLength: 100000 }
  ],
  gemini: [
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (实验)', description: '最新实验版Gemini 2.0', contextLength: 1000000 },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '最新Gemini模型，支持长上下文', contextLength: 2000000 },
    { id: 'gemini-1.5-pro-002', name: 'Gemini 1.5 Pro-002', description: '改进版Gemini 1.5 Pro', contextLength: 2000000 },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: '快速版本，适合实时应用', contextLength: 1000000 },
    { id: 'gemini-1.5-flash-002', name: 'Gemini 1.5 Flash-002', description: '改进版Gemini 1.5 Flash', contextLength: 1000000 },
    { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B', description: '轻量版Flash模型', contextLength: 1000000 },
    { id: 'gemini-pro', name: 'Gemini Pro', description: '经典Gemini模型', contextLength: 32768 },
    { id: 'gemini-pro-vision', name: 'Gemini Pro Vision', description: '支持图像理解', contextLength: 16384 }
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'DeepSeek主力对话模型', contextLength: 32768 },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: '推理增强模型，类似o1', contextLength: 32768 },
    { id: 'deepseek-coder', name: 'DeepSeek Coder', description: '专业代码生成模型', contextLength: 16384 },
    { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', description: '新一代代码模型', contextLength: 32768 },
    { id: 'deepseek-math', name: 'DeepSeek Math', description: '数学专用模型', contextLength: 32768 }
  ],
  kimi: [
    { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', description: '8K上下文版本', contextLength: 8192 },
    { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', description: '32K上下文版本', contextLength: 32768 },
    { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', description: '128K长上下文版本', contextLength: 131072 }
  ],
  doubao: [
    { id: 'doubao-pro-4k', name: '豆包 Pro 4K', description: '4K上下文版本', contextLength: 4096 },
    { id: 'doubao-pro-32k', name: '豆包 Pro 32K', description: '32K上下文版本', contextLength: 32768 },
    { id: 'doubao-pro-128k', name: '豆包 Pro 128K', description: '128K长上下文版本', contextLength: 131072 }
  ],
  qwen: [
    { id: 'qwen-turbo', name: 'Qwen Turbo', description: '通义千问快速版', contextLength: 8192 },
    { id: 'qwen-plus', name: 'Qwen Plus', description: '通义千问增强版', contextLength: 32768 },
    { id: 'qwen-max', name: 'Qwen Max', description: '通义千问旗舰版', contextLength: 8192 },
    { id: 'qwen-max-longcontext', name: 'Qwen Max Long', description: '长上下文版本', contextLength: 30000 }
  ],
  baidu: [
    { id: 'ernie-4.0-8k', name: '文心一言 4.0 8K', description: '8K上下文版本', contextLength: 8192 },
    { id: 'ernie-3.5-8k', name: '文心一言 3.5 8K', description: '3.5版本', contextLength: 8192 },
    { id: 'ernie-turbo-8k', name: '文心一言 Turbo', description: '快速版本', contextLength: 8192 }
  ],
  siliconflow: [
    { id: 'deepseek-ai/DeepSeek-V2.5', name: 'DeepSeek V2.5', description: 'DeepSeek最新版本', contextLength: 32768 },
    { id: 'deepseek-ai/deepseek-llm-67b-chat', name: 'DeepSeek 67B Chat', description: 'DeepSeek 67B对话模型', contextLength: 4096 },
    { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5 7B', description: 'Qwen2.5 7B指令模型', contextLength: 32768 },
    { id: 'Qwen/Qwen2.5-14B-Instruct', name: 'Qwen2.5 14B', description: 'Qwen2.5 14B指令模型', contextLength: 32768 },
    { id: 'Qwen/Qwen2.5-32B-Instruct', name: 'Qwen2.5 32B', description: 'Qwen2.5 32B指令模型', contextLength: 32768 },
    { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5 72B', description: 'Qwen2.5 72B指令模型', contextLength: 32768 },
    { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B', description: 'Meta Llama 3.1 8B', contextLength: 128000 },
    { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B', description: 'Meta Llama 3.1 70B', contextLength: 128000 },
    { id: 'meta-llama/Meta-Llama-3.1-405B-Instruct', name: 'Llama 3.1 405B', description: 'Meta Llama 3.1 405B旗舰模型', contextLength: 128000 },
    { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B', description: 'Mistral专家混合模型', contextLength: 32768 },
    { id: 'mistralai/Mixtral-8x22B-Instruct-v0.1', name: 'Mixtral 8x22B', description: 'Mistral大型专家混合模型', contextLength: 65536 },
    { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', description: 'Google Gemma 2 9B模型', contextLength: 8192 },
    { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', description: 'Google Gemma 2 27B模型', contextLength: 8192 }
  ],
  groq: [
    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', description: '70B参数多用途模型', contextLength: 131072 },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: '8B参数快速模型', contextLength: 131072 },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Mixtral专家混合模型', contextLength: 32768 }
  ],
  perplexity: [
    { id: 'llama-3.1-sonar-large-128k-online', name: 'Sonar Large Online', description: '在线搜索增强模型', contextLength: 127072 },
    { id: 'llama-3.1-sonar-small-128k-online', name: 'Sonar Small Online', description: '轻量在线搜索模型', contextLength: 127072 },
    { id: 'llama-3.1-8b-instruct', name: 'Llama 3.1 8B', description: '基础对话模型', contextLength: 131072 }
  ],
  together: [
    { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', name: 'Llama 3.1 70B Turbo', description: '加速版70B模型', contextLength: 131072 },
    { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', name: 'Llama 3.1 8B Turbo', description: '加速版8B模型', contextLength: 131072 },
    { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B', description: 'Mistral专家混合模型', contextLength: 32768 }
  ],
  ollama: [
    { id: 'llama3.1:8b', name: 'Llama 3.1 8B', description: '本地部署8B模型', contextLength: 131072 },
    { id: 'llama3.1:70b', name: 'Llama 3.1 70B', description: '本地部署70B模型', contextLength: 131072 },
    { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', description: '本地部署Qwen模型', contextLength: 32768 },
    { id: 'deepseek-coder:6.7b', name: 'DeepSeek Coder', description: '本地代码生成模型', contextLength: 16384 }
  ],
  lmstudio: [
    { id: 'local-model', name: '本地模型', description: '请在LM Studio中加载模型', contextLength: 4096 }
  ],
  oneapi: [
    { id: 'gpt-4o', name: 'GPT-4o (代理)', description: '通过OneAPI代理的GPT-4o', contextLength: 128000 },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (代理)', description: '通过OneAPI代理的Claude', contextLength: 200000 },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (代理)', description: '通过OneAPI代理的Gemini', contextLength: 1000000 }
  ]
};

// 获取指定服务商的模型列表
export function getModelsForProvider(provider: string): AIModel[] {
  return AI_MODELS[provider] || [];
}

// 精简的提示词优化模板
const PROMPT_OPTIMIZATION_TEMPLATE = `作为提示词专家，优化以下内容：

标题：{title}
内容：{content}

要求：
1. 优化提示词结构和清晰度
2. 确保包含角色、任务、格式要求
3. 提供简要优化说明

格式：
## 优化后的提示词
[优化内容]

## 优化说明
[关键改进点]

## 建议
[1-2条实用建议]`;

// 提示词翻译模板
const PROMPT_TRANSLATION_TEMPLATE = `You are a professional translator specializing in AI prompts and technical content.

Translate the following prompt from {sourceLanguage} to {targetLanguage}.

Requirements:
1. Maintain the exact meaning and intent of the original prompt
2. Preserve any special formatting, placeholders, or variables (like {{variable}})
3. Keep technical terms accurate
4. Ensure the translation is natural and fluent in the target language
5. Only output the translated content, no explanations

Original prompt:
{content}

Translated prompt:`;

// AI服务类
export class AIService {
  private config: AIConfig | null = null;

  constructor() {
    this.loadConfig();
  }

  // 加载配置
  private loadConfig() {
    try {
      const savedConfig = localStorage.getItem('ai-config');
      if (savedConfig) {
        this.config = JSON.parse(savedConfig);
      }
    } catch (error) {
      console.error('加载AI配置失败:', error);
    }
  }

  // 保存配置
  public saveConfig(config: AIConfig) {
    this.config = config;
    localStorage.setItem('ai-config', JSON.stringify(config));
  }

  // 获取配置
  public getConfig(): AIConfig | null {
    return this.config;
  }

  // 检查是否已配置
  public isConfigured(): boolean {
    return this.config !== null && this.config.apiKey.trim() !== '';
  }

  // 测试连接
  public async testConnection(config: AIConfig): Promise<boolean> {
    const { apiKey, baseUrl, model, provider } = config;

    // 添加调试信息
    console.log('测试连接配置:', { apiKey: apiKey?.substring(0, 10) + '...', baseUrl, model, provider });

    // 构建测试请求
    let requestBody: any;
    let headers: Record<string, string>;

    switch (provider) {
      case 'openai':
        requestBody = {
          model: model || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: 'Hello, this is a test message.'
            }
          ],
          max_tokens: 10
        };
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        break;

      case 'anthropic':
        requestBody = {
          model: model || 'claude-3-sonnet-20240229',
          max_tokens: 10,
          messages: [
            {
              role: 'user',
              content: 'Hello, this is a test message.'
            }
          ]
        };
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        };
        break;

      case 'gemini':
        requestBody = {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'Hello, this is a test message.'
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 10
          }
        };
        headers = {
          'Content-Type': 'application/json'
        };
        break;

      case 'custom':
      default:
        requestBody = {
          model: model,
          messages: [
            {
              role: 'user',
              content: 'Hello, this is a test message.'
            }
          ],
          max_tokens: 10
        };
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        break;
    }

    try {
      // 构建请求URL
      let requestUrl = baseUrl;

      // 根据不同服务商构建正确的API端点
      console.log('URL构建前:', { provider, baseUrl });
      switch (provider) {
        case 'gemini':
          // 只处理真正的Gemini API
          if (baseUrl === 'https://generativelanguage.googleapis.com' ||
            baseUrl === 'https://generativelanguage.googleapis.com/') {
            requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
          } else if (baseUrl.includes('generativelanguage.googleapis.com') && !baseUrl.includes(':generateContent')) {
            // 如果是Gemini域名但URL不完整，补充路径
            const cleanUrl = baseUrl.replace(/\/$/, '');
            requestUrl = `${cleanUrl}/v1beta/models/${model}:generateContent`;
          }
          // 添加API密钥到URL参数
          const separator = requestUrl.includes('?') ? '&' : '?';
          requestUrl = `${requestUrl}${separator}key=${apiKey}`;
          break;

        case 'openai':
          // OpenAI API端点处理
          if (baseUrl === 'https://api.openai.com' || baseUrl === 'https://api.openai.com/') {
            requestUrl = 'https://api.openai.com/v1/chat/completions';
          } else if (!baseUrl.includes('/chat/completions') && !baseUrl.includes('/v1/')) {
            const cleanUrl = baseUrl.replace(/\/$/, '');
            requestUrl = `${cleanUrl}/v1/chat/completions`;
          }
          break;

        case 'anthropic':
          // Anthropic API端点处理
          if (baseUrl === 'https://api.anthropic.com' || baseUrl === 'https://api.anthropic.com/') {
            requestUrl = 'https://api.anthropic.com/v1/messages';
          } else if (!baseUrl.includes('/messages') && !baseUrl.includes('/v1/')) {
            const cleanUrl = baseUrl.replace(/\/$/, '');
            requestUrl = `${cleanUrl}/v1/messages`;
          }
          break;

        case 'custom':
        default:
          // 自定义服务商处理（如硅基流动）
          if (baseUrl === 'https://api.siliconflow.cn' || baseUrl === 'https://api.siliconflow.cn/') {
            requestUrl = 'https://api.siliconflow.cn/v1/chat/completions';
          } else if (!baseUrl.includes('/chat/completions') && !baseUrl.includes('/v1/') && baseUrl.includes('siliconflow')) {
            const cleanUrl = baseUrl.replace(/\/$/, '');
            requestUrl = `${cleanUrl}/v1/chat/completions`;
          }
          break;
      }

      console.log('URL构建后:', { requestUrl, requestBody });

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          throw new Error('API密钥无效，请检查您的API密钥是否正确');
        } else if (response.status === 403) {
          throw new Error('API访问被拒绝，请检查您的API密钥权限');
        } else if (response.status === 429) {
          throw new Error('API请求频率过高，请稍后再试');
        } else if (response.status >= 500) {
          throw new Error('AI服务暂时不可用，请稍后再试');
        } else {
          throw new Error(`API调用失败: ${response.status} ${errorText}`);
        }
      }

      const data = await response.json();

      // 检查响应是否包含预期的内容
      let hasValidResponse = false;
      switch (provider) {
        case 'openai':
        case 'custom':
          hasValidResponse = !!(data.choices?.[0]?.message?.content);
          break;
        case 'anthropic':
          hasValidResponse = !!(data.content?.[0]?.text);
          break;
        case 'gemini':
          hasValidResponse = !!(
            (Array.isArray(data?.candidates) &&
              Array.isArray(data.candidates[0]?.content?.parts) &&
              data.candidates[0].content.parts.some((p: any) => p?.text && p.text.length > 0))
          );
          break;
        default:
          hasValidResponse = !!(data.choices?.[0]?.message?.content);
          break;
      }

      return hasValidResponse;
    } catch (error) {
      console.error('连接测试失败:', error);
      return false;
    }
  }

  // 优化提示词（支持流式输出）
  public async optimizePrompt(
    request: AIOptimizeRequest,
    streamCallback?: StreamCallback
  ): Promise<AIOptimizeResponse> {
    if (!this.isConfigured()) {
      throw new Error('AI服务未配置，请先配置API密钥');
    }

    const { content, title = '', mode } = request;

    // 构建精简提示词
    const prompt = PROMPT_OPTIMIZATION_TEMPLATE
      .replace('{title}', title)
      .replace('{content}', content || '请生成一个高质量的提示词');

    try {
      const response = streamCallback
        ? await this.callAIStream(prompt, streamCallback)
        : await this.callAI(prompt);
      return this.parseResponse(response);
    } catch (error) {
      console.error('AI优化失败:', error);
      throw new Error('AI服务调用失败，请检查网络连接和API配置');
    }
  }

  // 调用AI服务（流式）
  private async callAIStream(prompt: string, callback: StreamCallback): Promise<string> {
    if (!this.config) {
      throw new Error('AI配置未找到');
    }

    const { apiKey, baseUrl, model, provider } = this.config;
    let fullResponse = '';

    try {
      const { requestBody, headers, requestUrl } = this.buildRequest(prompt, true);

      const streamHeaders: Record<string, string> = { ...headers };
      if (this.config.provider === 'gemini') {
        streamHeaders['Accept'] = 'text/event-stream';
      }

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: streamHeaders,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API调用失败: ${response.status} ${errorText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const isSSE = contentType.includes('text/event-stream');
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取流式响应');
      }

      const decoder = new TextDecoder();

      if (isSSE) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = this.extractStreamContent(parsed, provider);
                if (content) {
                  fullResponse += content;
                  callback.onChunk(content);
                }
              } catch (e) {
                // 忽略解析错误的行
              }
            }
          }
        }
      } else {
        // 非SSE，作为一次性JSON响应处理
        const text = await response.text();
        try {
          const json = JSON.parse(text);
          const content = this.extractStreamContent(json, provider) ||
            (this.config!.provider === 'gemini' ?
              (json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '')
              : (json?.choices?.[0]?.message?.content || ''));
          if (content) {
            fullResponse += content;
            callback.onChunk(content);
          }
        } catch {
          // 直接回传原文本
          if (text) {
            fullResponse += text;
            callback.onChunk(text);
          }
        }
      }

      // 如果是Gemini且未获取到任何内容，降级为非流式调用
      if (!fullResponse || fullResponse.trim().length === 0) {
        try {
          if (provider === 'gemini') {
            const fallback = await this.callAI(prompt);
            if (fallback && fallback.trim().length > 0) {
              fullResponse = fallback;
              callback.onChunk(fallback);
            }
          }
        } catch (e) {
          // 忽略降级错误，维持原逻辑
        }
      }

      callback.onComplete(fullResponse);
      return fullResponse;
    } catch (error) {
      callback.onError(error as Error);
      throw error;
    }
  }

  // 提取流式内容
  private extractStreamContent(data: any, provider: string): string {
    switch (provider) {
      case 'openai':
      case 'custom':
        return data.choices?.[0]?.delta?.content || '';
      case 'anthropic':
        return data.delta?.text || '';
      case 'gemini': {
        // Gemini SSE 可能出现两种：candidates[0].content.parts 或 candidates[0].delta.parts
        const deltaParts = data?.candidates?.[0]?.delta?.parts;
        if (Array.isArray(deltaParts)) {
          return deltaParts.map((p: any) => p?.text || '').join('');
        }
        const parts = data?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          return parts.map((p: any) => p?.text || '').join('');
        }
        return '';
      }
      default:
        return data.choices?.[0]?.delta?.content || '';
    }
  }

  // 构建请求参数
  private buildRequest(prompt: string, stream: boolean = false) {
    if (!this.config) {
      throw new Error('AI配置未找到');
    }

    const { apiKey, baseUrl, model, provider } = this.config;
    let requestBody: any;
    let headers: Record<string, string>;

    switch (provider) {
      case 'openai':
        requestBody = {
          model: model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1500,
          stream
        };
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        break;

      case 'anthropic':
        requestBody = {
          model: model || 'claude-3-sonnet-20240229',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
          stream
        };
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        };
        break;

      case 'gemini':
        requestBody = {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1500,
            temperature: 0.7
          }
        };
        headers = { 'Content-Type': 'application/json' };
        break;

      case 'custom':
      default:
        requestBody = {
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1500,
          stream
        };
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        break;
    }

    // 构建请求URL
    let requestUrl = this.buildRequestUrl(provider, baseUrl, model, apiKey);
    // Gemini 流式专用端点与头
    if (provider === 'gemini' && stream) {
      // 仅当使用官方域名时改为流式端点
      if (baseUrl === 'https://generativelanguage.googleapis.com' || baseUrl === 'https://generativelanguage.googleapis.com/' || baseUrl.includes('generativelanguage.googleapis.com')) {
        const root = baseUrl.includes('generativelanguage.googleapis.com')
          ? baseUrl.replace(/\/$/, '')
          : 'https://generativelanguage.googleapis.com';
        // 重新构造完整URL，避免遗留查询参数导致的?/&判断错误
        requestUrl = `${root}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
      }
    }

    return { requestBody, headers, requestUrl };
  }

  // 构建请求URL
  private buildRequestUrl(provider: string, baseUrl: string, model: string, apiKey: string): string {
    switch (provider) {
      case 'gemini':
        if (baseUrl === 'https://generativelanguage.googleapis.com' ||
          baseUrl === 'https://generativelanguage.googleapis.com/') {
          return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        }
        break;

      case 'openai':
        if (baseUrl === 'https://api.openai.com' || baseUrl === 'https://api.openai.com/') {
          return 'https://api.openai.com/v1/chat/completions';
        }
        break;

      case 'anthropic':
        if (baseUrl === 'https://api.anthropic.com' || baseUrl === 'https://api.anthropic.com/') {
          return 'https://api.anthropic.com/v1/messages';
        }
        break;

      case 'custom':
      default:
        if (baseUrl.includes('siliconflow')) {
          return baseUrl.replace(/\/$/, '') + '/v1/chat/completions';
        }
        break;
    }

    return baseUrl;
  }

  // 调用AI服务（非流式）
  private async callAI(prompt: string): Promise<string> {
    if (!this.config) {
      throw new Error('AI配置未找到');
    }

    const { apiKey, baseUrl, model, provider } = this.config;

    const { requestBody, headers, requestUrl } = this.buildRequest(prompt, false);

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API调用失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // 根据不同提供商解析响应
    switch (this.config!.provider) {
      case 'openai':
      case 'custom':
        return data.choices?.[0]?.message?.content || '';
      case 'anthropic':
        return data.content?.[0]?.text || '';
      case 'gemini': {
        const parts = data?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          const text = parts.map((p: any) => p?.text || '').join('');
          if (text && text.trim().length > 0) return text;
        }
        // 尝试检测安全拦截与调试信息
        const finishReason = data?.candidates?.[0]?.finishReason || data?.candidates?.[0]?.finish_reason;
        const safety = data?.candidates?.[0]?.safetyRatings || data?.promptFeedback?.safetyRatings;
        if (finishReason === 'SAFETY' || (Array.isArray(safety) && safety.length > 0)) {
          throw new Error('Gemini返回为空：可能触发了安全策略，建议调整提示词重试');
        }
        console.warn('Gemini响应未包含文本parts，原始结构：', {
          keys: Object.keys(data || {}),
          candidatesKeys: data?.candidates && Object.keys(data.candidates[0] || {})
        });
        return '';
      }
      default:
        return data.choices?.[0]?.message?.content || '';
    }
  }

  // 解析AI响应
  public parseResponse(response: string): AIOptimizeResponse {
    try {
      // 尝试解析结构化响应
      const sections = response.split('##');

      let optimizedContent = '';
      let explanation = '';
      let suggestions: string[] = [];

      sections.forEach(section => {
        const trimmed = section.trim();
        if (trimmed.startsWith('优化后的提示词')) {
          optimizedContent = trimmed.replace('优化后的提示词', '').trim();
        } else if (trimmed.startsWith('优化说明')) {
          explanation = trimmed.replace('优化说明', '').trim();
        } else if (trimmed.startsWith('建议')) {
          const suggestionText = trimmed.replace('建议', '').trim();
          suggestions = suggestionText.split('\n').filter(s => s.trim());
        }
      });

      // 如果没有找到结构化内容，使用整个响应作为优化内容
      if (!optimizedContent) {
        optimizedContent = response;
      }

      return {
        optimizedContent,
        explanation,
        suggestions
      };
    } catch (error) {
      console.error('解析AI响应失败:', error);
      return {
        optimizedContent: response,
        explanation: '解析响应时出现问题，但已获得优化结果',
        suggestions: []
      };
    }
  }

  // 检测文本语言
  private detectLanguage(text: string): 'zh' | 'en' {
    // 简单的中文检测：如果包含较多中文字符，则认为是中文
    const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const totalCharCount = text.replace(/\s/g, '').length;
    return chineseCharCount > totalCharCount * 0.3 ? 'zh' : 'en';
  }

  // 翻译提示词
  public async translatePrompt(
    request: AITranslateRequest,
    streamCallback?: StreamCallback
  ): Promise<AITranslateResponse> {
    if (!this.isConfigured()) {
      throw new Error('AI服务未配置，请先配置API密钥');
    }

    const { content, targetLanguage, title } = request;

    // 检测源语言
    const detectedLanguage = this.detectLanguage(content);

    // 如果目标语言和源语言相同，直接返回原内容
    if (detectedLanguage === targetLanguage) {
      return {
        translatedContent: content,
        detectedLanguage
      };
    }

    const sourceLanguageName = detectedLanguage === 'zh' ? 'Chinese' : 'English';
    const targetLanguageName = targetLanguage === 'zh' ? 'Chinese' : 'English';

    // 构建翻译提示词
    const prompt = PROMPT_TRANSLATION_TEMPLATE
      .replace('{sourceLanguage}', sourceLanguageName)
      .replace('{targetLanguage}', targetLanguageName)
      .replace('{content}', content);

    try {
      const response = streamCallback
        ? await this.callAIStream(prompt, streamCallback)
        : await this.callAI(prompt);

      // 清理翻译结果（去除可能的引号或多余空白）
      const translatedContent = response.trim().replace(/^["']|["']$/g, '');

      return {
        translatedContent,
        detectedLanguage
      };
    } catch (error) {
      console.error('AI翻译失败:', error);
      throw new Error('翻译失败，请检查网络连接和API配置');
    }
  }

  // 批量翻译提示词
  public async translatePromptsBatch(
    prompts: Array<{ id: string; content: string }>,
    targetLanguage: 'zh' | 'en',
    callback: BatchTranslateCallback,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const results = new Map<string, AITranslateResponse>();
    const total = prompts.length;

    for (let i = 0; i < prompts.length; i++) {
      // 检查是否被中断
      if (abortSignal?.aborted) {
        console.log('批量翻译已中断');
        break;
      }

      const prompt = prompts[i];
      callback.onProgress(i + 1, total, prompt.id);

      try {
        const result = await this.translatePrompt({
          content: prompt.content,
          targetLanguage
        });

        results.set(prompt.id, result);
        callback.onItemComplete(prompt.id, result);
      } catch (error) {
        callback.onError(prompt.id, error as Error);
      }

      // 添加小延迟以避免API限流
      if (i < prompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    callback.onComplete(results);
  }
}

// 全局AI服务实例
export const aiService = new AIService();
