/**
 * 模板市场服务
 * 封装模板市场相关的API调用
 */

// API基础URL配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

export interface MarketplacePrompt {
  id: string;
  user_id: string;
  title: string;
  content: string;
  description?: string;
  category: string;
  tags: string[];
  status: 'pending' | 'approved' | 'rejected';
  view_count: number;
  download_count: number;
  review_comment?: string;
  created_at: string;
  updated_at: string;
  // 关联的用户信息（可选）
  user?: {
    id: string;
    nickname?: string;
    email?: string;
  };
}

export interface MarketplacePromptListResponse {
  data: MarketplacePrompt[];
}

export interface CreateMarketplacePromptRequest {
  title: string;
  content: string;
  description?: string;
  category: string;
  tags: string[];
}

class MarketplaceService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * 获取访问令牌
   */
  private getAuthHeader(): Record<string, string> {
    const token = localStorage.getItem('promptmate_auth_tokens');
    if (token) {
      try {
        const tokens = JSON.parse(token);
        if (tokens.access_token) {
          return {
            'Authorization': `Bearer ${tokens.access_token}`,
          };
        }
      } catch {
        // 忽略解析错误
      }
    }
    return {};
  }

  /**
   * 获取市场提示词列表
   */
  async listPrompts(params?: {
    search?: string;
    category?: string;
    tag?: string;
    user_id?: string;
    order_by?: string;
    ascending?: boolean;
  }): Promise<MarketplacePrompt[]> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.category) queryParams.append('category', params.category);
    if (params?.tag) queryParams.append('tag', params.tag);
    if (params?.user_id) queryParams.append('user_id', params.user_id);
    if (params?.order_by) queryParams.append('order_by', params.order_by);
    if (params?.ascending !== undefined) queryParams.append('ascending', params.ascending.toString());

    const response = await fetch(`${this.baseURL}/api/marketplace/prompts?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '获取提示词列表失败' }));
      throw new Error(error.message || '获取提示词列表失败');
    }

    const data: MarketplacePromptListResponse = await response.json();
    return data.data;
  }

  /**
   * 获取单个提示词详情
   */
  async getPrompt(id: string): Promise<MarketplacePrompt> {
    const response = await fetch(`${this.baseURL}/api/marketplace/prompts/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '获取提示词失败' }));
      throw new Error(error.message || '获取提示词失败');
    }

    return response.json();
  }

  /**
   * 上传提示词到市场
   */
  async createPrompt(data: CreateMarketplacePromptRequest): Promise<MarketplacePrompt> {
    const response = await fetch(`${this.baseURL}/api/marketplace/prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '上传提示词失败' }));
      throw new Error(error.message || '上传提示词失败');
    }

    return response.json();
  }

  /**
   * 更新提示词
   */
  async updatePrompt(id: string, data: Partial<CreateMarketplacePromptRequest>): Promise<MarketplacePrompt> {
    const response = await fetch(`${this.baseURL}/api/marketplace/prompts/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '更新提示词失败' }));
      throw new Error(error.message || '更新提示词失败');
    }

    return response.json();
  }

  /**
   * 删除提示词
   */
  async deletePrompt(id: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/marketplace/prompts/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '删除提示词失败' }));
      throw new Error(error.message || '删除提示词失败');
    }
  }

  /**
   * 审核提示词（仅管理员）
   */
  async reviewPrompt(id: string, status: 'approved' | 'rejected', comment?: string): Promise<MarketplacePrompt> {
    const response = await fetch(`${this.baseURL}/api/marketplace/prompts/${id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify({ status, review_comment: comment }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '审核失败' }));
      throw new Error(error.message || '审核失败');
    }

    return response.json();
  }

  /**
   * 下载提示词（增加下载计数）
   */
  async downloadPrompt(id: string): Promise<MarketplacePrompt> {
    const response = await fetch(`${this.baseURL}/api/marketplace/prompts/${id}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '下载提示词失败' }));
      throw new Error(error.message || '下载提示词失败');
    }

    return response.json();
  }
}

export const marketplaceService = new MarketplaceService();









