/**
 * 云同步服务
 * 处理提示词和配置的云端同步
 */

import { authService } from './authService';
import { Prompt, Category, Settings } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:8787');

export interface SyncEvent {
  entity_type: 'prompt' | 'collection' | 'settings';
  entity_id: string;
  operation: 'UPSERT' | 'DELETE';
  record?: any;
  updated_at?: string;
}

export interface SyncResponse {
  synced_event_ids: number[];
  next_cursor: number | null;
}

export interface PullSyncResponse {
  events: any[];
  next_cursor: number | null;
}

class SyncService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * 获取访问令牌
   */
  private getAccessToken(): string | null {
    const tokensStr = localStorage.getItem('promptmate_auth_tokens');
    if (tokensStr) {
      try {
        const tokens = JSON.parse(tokensStr);
        return tokens.access_token || null;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * 推送同步事件（上传数据到云端）
   */
  async pushSync(events: SyncEvent[], deviceId?: string): Promise<SyncResponse> {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new Error('未登录，无法同步');
    }

    const response = await fetch(`${this.baseURL}/api/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...(deviceId && { 'X-Device-Id': deviceId }),
      },
      body: JSON.stringify({
        events,
        device_id: deviceId || this.getDeviceId(),
        app_version: import.meta.env.VITE_APP_VERSION || '1.0.0',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '同步失败' }));
      throw new Error(error.message || '同步失败');
    }

    return response.json();
  }

  /**
   * 拉取同步事件（从云端下载数据）
   */
  async pullSync(cursor?: number): Promise<PullSyncResponse> {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new Error('未登录，无法同步');
    }

    const params = new URLSearchParams();
    if (cursor) {
      params.append('cursor', cursor.toString());
    }

    const response = await fetch(`${this.baseURL}/api/sync/pull?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '拉取同步数据失败' }));
      throw new Error(error.message || '拉取同步数据失败');
    }

    return response.json();
  }

  /**
   * 同步提示词
   */
  async syncPrompts(prompts: Prompt[]): Promise<void> {
    const events: SyncEvent[] = prompts.map(prompt => ({
      entity_type: 'prompt',
      entity_id: prompt.id,
      operation: 'UPSERT',
      record: {
        collection_id: prompt.categoryId || '',
        title: prompt.title,
        content_ciphertext: prompt.content, // 实际应该加密
        content_nonce: '', // 实际应该生成nonce
        tags: prompt.tags || [],
        created_at: prompt.createdAt,
        updated_at: prompt.updatedAt || new Date().toISOString(),
      },
      updated_at: prompt.updatedAt || new Date().toISOString(),
    }));

    await this.pushSync(events);
  }

  /**
   * 同步分类
   */
  async syncCategories(categories: Category[]): Promise<void> {
    const events: SyncEvent[] = categories.map(category => ({
      entity_type: 'collection',
      entity_id: category.id,
      operation: 'UPSERT',
      record: {
        title: category.name,
        description: category.description || null,
        created_at: category.createdAt,
        updated_at: category.updatedAt || new Date().toISOString(),
      },
      updated_at: category.updatedAt || new Date().toISOString(),
    }));

    await this.pushSync(events);
  }

  /**
   * 获取设备ID
   */
  private getDeviceId(): string {
    let deviceId = localStorage.getItem('promptmate_device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('promptmate_device_id', deviceId);
    }
    return deviceId;
  }
}

export const syncService = new SyncService();

