/**
 * LinuxDo Connect 服务
 * 封装 LinuxDo Connect API 调用
 * 支持身份验证、用户信息获取、内容搜索、个性化推荐和自动签到
 */

// LinuxDo Connect API 基础URL
const LINUXDO_API_BASE_URL = 'https://connect.linux.do';

export interface LinuxDoUser {
  id: number;
  username: string;
  name: string;
  avatar_template: string;
  active: boolean;
  trust_level: number;
  silenced: boolean;
  external_ids?: Record<string, any>;
  api_key?: string;
}

export interface LinuxDoSearchResult {
  topics?: Array<{
    id: number;
    title: string;
    slug: string;
    category_id: number;
    created_at: string;
    views: number;
    reply_count: number;
    like_count: number;
    excerpt: string;
    url: string;
  }>;
  posts?: Array<{
    id: number;
    topic_id: number;
    user_id: number;
    created_at: string;
    cooked: string;
    excerpt: string;
  }>;
  categories?: Array<{
    id: number;
    name: string;
    slug: string;
    description: string;
  }>;
}

export interface LinuxDoRecommendation {
  id: number;
  title: string;
  slug: string;
  category_id: number;
  created_at: string;
  views: number;
  reply_count: number;
  like_count: number;
  excerpt: string;
  url: string;
  relevance_score?: number;
}

export interface LinuxDoCheckinStatus {
  checked_in: boolean;
  checkin_date?: string;
  streak_days?: number;
  total_checkins?: number;
  last_checkin_date?: string;
}

export interface LinuxDoConfig {
  clientId: string;
  clientSecret: string;
  apiKey: string;
}

class LinuxDoService {
  private config: LinuxDoConfig | null = null;
  private baseURL: string;

  constructor() {
    this.baseURL = LINUXDO_API_BASE_URL;
    this.loadConfig();
  }

  /**
   * 从 localStorage 加载配置
   */
  private loadConfig(): void {
    try {
      const configStr = localStorage.getItem('linuxdo_config');
      if (configStr) {
        this.config = JSON.parse(configStr);
      }
    } catch (error) {
      console.error('加载 LinuxDo 配置失败:', error);
    }
  }

  /**
   * 保存配置到 localStorage
   */
  saveConfig(config: LinuxDoConfig): void {
    this.config = config;
    localStorage.setItem('linuxdo_config', JSON.stringify(config));
  }

  /**
   * 获取配置
   */
  getConfig(): LinuxDoConfig | null {
    return this.config;
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    return !!(
      this.config?.clientId &&
      this.config?.clientSecret &&
      this.config?.apiKey
    );
  }

  /**
   * 生成 Basic Auth Header
   */
  private getBasicAuthHeader(): string {
    if (!this.config) {
      throw new Error('LinuxDo 未配置，请先配置 Client ID 和 Client Secret');
    }
    const credentials = `${this.config.clientId}:${this.config.clientSecret}`;
    return `Basic ${btoa(credentials)}`;
  }

  /**
   * 构建请求头
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'PromptMate LinuxDo Plugin/1.0',
      'Authorization': this.getBasicAuthHeader(),
    };
    return headers;
  }

  /**
   * 构建请求 URL（包含 API Key）
   */
  private buildUrl(endpoint: string, params?: Record<string, string>): string {
    const url = new URL(endpoint, this.baseURL);
    if (this.config?.apiKey) {
      url.searchParams.append('api_key', this.config.apiKey);
    }
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return url.toString();
  }

  /**
   * 验证 API Key
   */
  async verifyApiKey(): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('LinuxDo 未配置');
    }

    try {
      const response = await fetch(this.buildUrl('/api/key'), {
        method: 'GET',
        headers: this.getHeaders(),
      });

      return response.ok;
    } catch (error) {
      console.error('验证 API Key 失败:', error);
      return false;
    }
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(actionType: 'info' | 'verify' | 'profile' | 'activity' = 'info'): Promise<LinuxDoUser> {
    if (!this.isConfigured()) {
      throw new Error('LinuxDo 未配置');
    }

    const params: Record<string, string> = {
      action_type: actionType,
    };

    const response = await fetch(this.buildUrl('/api/user', params), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '获取用户信息失败' }));
      throw new Error(error.message || '获取用户信息失败');
    }

    return response.json();
  }

  /**
   * 搜索内容
   */
  async searchContent(params: {
    search_query: string;
    search_type?: 'all' | 'topics' | 'posts' | 'categories';
    category_filter?: string;
    limit?: number;
    sort_by?: 'relevance' | 'date' | 'views' | 'replies';
  }): Promise<LinuxDoSearchResult> {
    if (!this.isConfigured()) {
      throw new Error('LinuxDo 未配置');
    }

    if (!params.search_query) {
      throw new Error('搜索关键词不能为空');
    }

    const queryParams: Record<string, string> = {
      search_query: params.search_query,
    };

    if (params.search_type) {
      queryParams.search_type = params.search_type;
    }
    if (params.category_filter) {
      queryParams.category_filter = params.category_filter;
    }
    if (params.limit) {
      queryParams.limit = params.limit.toString();
    }
    if (params.sort_by) {
      queryParams.sort_by = params.sort_by;
    }

    const response = await fetch(this.buildUrl('/api/search', queryParams), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '搜索失败' }));
      throw new Error(error.message || '搜索失败');
    }

    return response.json();
  }

  /**
   * 获取个性化推荐
   */
  async getRecommendations(params?: {
    recommendation_type?: string;
    category_preference?: string;
    limit?: number;
    time_range?: string;
  }): Promise<LinuxDoRecommendation[]> {
    if (!this.isConfigured()) {
      throw new Error('LinuxDo 未配置');
    }

    const queryParams: Record<string, string> = {};
    if (params?.recommendation_type) {
      queryParams.recommendation_type = params.recommendation_type;
    }
    if (params?.category_preference) {
      queryParams.category_preference = params.category_preference;
    }
    if (params?.limit) {
      queryParams.limit = params.limit.toString();
    }
    if (params?.time_range) {
      queryParams.time_range = params.time_range;
    }

    const response = await fetch(this.buildUrl('/api/recommendations', queryParams), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '获取推荐失败' }));
      throw new Error(error.message || '获取推荐失败');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : data.recommendations || [];
  }

  /**
   * 执行签到
   */
  async checkIn(params?: {
    auto_activity?: boolean;
    notification_enabled?: boolean;
  }): Promise<LinuxDoCheckinStatus> {
    if (!this.isConfigured()) {
      throw new Error('LinuxDo 未配置');
    }

    const body: Record<string, any> = {
      action_type: 'checkin',
    };

    if (params?.auto_activity !== undefined) {
      body.auto_activity = params.auto_activity;
    }
    if (params?.notification_enabled !== undefined) {
      body.notification_enabled = params.notification_enabled;
    }

    const response = await fetch(this.buildUrl('/api/checkin'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '签到失败' }));
      throw new Error(error.message || '签到失败');
    }

    return response.json();
  }

  /**
   * 获取签到状态
   */
  async getCheckinStatus(daysToCheck?: number): Promise<LinuxDoCheckinStatus> {
    if (!this.isConfigured()) {
      throw new Error('LinuxDo 未配置');
    }

    const queryParams: Record<string, string> = {
      action_type: 'status',
    };

    if (daysToCheck) {
      queryParams.days_to_check = daysToCheck.toString();
    }

    const response = await fetch(this.buildUrl('/api/checkin', queryParams), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '获取签到状态失败' }));
      throw new Error(error.message || '获取签到状态失败');
    }

    return response.json();
  }

  /**
   * 获取签到历史
   */
  async getCheckinHistory(daysToCheck: number = 7): Promise<LinuxDoCheckinStatus> {
    if (!this.isConfigured()) {
      throw new Error('LinuxDo 未配置');
    }

    const queryParams: Record<string, string> = {
      action_type: 'history',
      days_to_check: daysToCheck.toString(),
    };

    const response = await fetch(this.buildUrl('/api/checkin', queryParams), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '获取签到历史失败' }));
      throw new Error(error.message || '获取签到历史失败');
    }

    return response.json();
  }

  /**
   * 获取连续签到天数
   */
  async getCheckinStreak(): Promise<{ streak_days: number }> {
    if (!this.isConfigured()) {
      throw new Error('LinuxDo 未配置');
    }

    const queryParams: Record<string, string> = {
      action_type: 'streak',
    };

    const response = await fetch(this.buildUrl('/api/checkin', queryParams), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '获取连续签到天数失败' }));
      throw new Error(error.message || '获取连续签到天数失败');
    }

    return response.json();
  }
}

export const linuxdoService = new LinuxDoService();

