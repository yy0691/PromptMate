/**
 * OneDrive客户端服务
 * 使用Microsoft Graph API进行文件操作
 */

import { OneDriveConfig } from '@/types';

export class OneDriveClient {
  private config: OneDriveConfig;
  private static readonly GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
  private static readonly AUTH_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
  private static readonly TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

  constructor(config: OneDriveConfig) {
    this.config = config;
  }

  /**
   * 获取授权URL
   */
  static getAuthorizationUrl(clientId: string, redirectUri: string): string {
    const scopes = 'Files.ReadWrite offline_access';
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes,
      response_mode: 'query',
    });
    return `${OneDriveClient.AUTH_ENDPOINT}?${params.toString()}`;
  }

  /**
   * 使用授权码获取访问令牌
   */
  static async getAccessToken(
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string
  ): Promise<OneDriveTokenResponse> {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(OneDriveClient.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`获取访问令牌失败: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 刷新访问令牌
   */
  static async refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): Promise<OneDriveTokenResponse> {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(OneDriveClient.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`刷新访问令牌失败: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/me/drive');
      return response.ok;
    } catch (error) {
      console.error('OneDrive连接测试失败:', error);
      return false;
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(remotePath: string, content: string): Promise<boolean> {
    try {
      const path = this.joinPath(this.config.remotePath, remotePath);
      const url = `/me/drive/root:${path}:/content`;

      const response = await this.makeRequest(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: content,
      });

      if (!response.ok) {
        throw new Error(`上传失败: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('OneDrive上传文件失败:', error);
      throw error;
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(remotePath: string): Promise<string> {
    try {
      const path = this.joinPath(this.config.remotePath, remotePath);
      const url = `/me/drive/root:${path}:/content`;

      const response = await this.makeRequest(url);

      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.error('OneDrive下载文件失败:', error);
      throw error;
    }
  }

  /**
   * 列出目录内容
   */
  async listDirectory(remotePath: string = ''): Promise<OneDriveFile[]> {
    try {
      const path = this.joinPath(this.config.remotePath, remotePath);
      const url = path ? `/me/drive/root:${path}:/children` : '/me/drive/root/children';

      const response = await this.makeRequest(url);

      if (!response.ok) {
        throw new Error(`列出目录失败: ${response.status}`);
      }

      const data = await response.json();
      return data.value.map((item: any) => ({
        id: item.id,
        name: item.name,
        isDirectory: !!item.folder,
        size: item.size || 0,
        lastModified: item.lastModifiedDateTime,
        downloadUrl: item['@microsoft.graph.downloadUrl'],
      }));
    } catch (error) {
      console.error('OneDrive列出目录失败:', error);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(remotePath: string): Promise<boolean> {
    try {
      const path = this.joinPath(this.config.remotePath, remotePath);
      const url = `/me/drive/root:${path}`;

      const response = await this.makeRequest(url, {
        method: 'DELETE',
      });

      return response.ok;
    } catch (error) {
      console.error('OneDrive删除文件失败:', error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(remotePath: string): Promise<boolean> {
    try {
      const info = await this.getFileInfo(remotePath);
      return info !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(remotePath: string): Promise<OneDriveFile | null> {
    try {
      const path = this.joinPath(this.config.remotePath, remotePath);
      const url = `/me/drive/root:${path}`;

      const response = await this.makeRequest(url);

      if (!response.ok) {
        return null;
      }

      const item = await response.json();
      return {
        id: item.id,
        name: item.name,
        isDirectory: !!item.folder,
        size: item.size || 0,
        lastModified: item.lastModifiedDateTime,
        downloadUrl: item['@microsoft.graph.downloadUrl'],
      };
    } catch (error) {
      console.error('OneDrive获取文件信息失败:', error);
      return null;
    }
  }

  /**
   * 创建目录
   */
  async createDirectory(remotePath: string): Promise<boolean> {
    try {
      const parts = remotePath.split('/').filter(Boolean);
      const dirName = parts.pop();
      const parentPath = this.joinPath(this.config.remotePath, parts.join('/'));
      
      const url = parentPath 
        ? `/me/drive/root:${parentPath}:/children`
        : '/me/drive/root/children';

      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: dirName,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename',
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('OneDrive创建目录失败:', error);
      throw error;
    }
  }

  /**
   * 发起API请求
   */
  private async makeRequest(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    if (!this.config.accessToken) {
      throw new Error('未配置访问令牌');
    }

    // 检查令牌是否过期
    if (this.isTokenExpired()) {
      throw new Error('访问令牌已过期，请重新授权');
    }

    const url = `${OneDriveClient.GRAPH_API_BASE}${path}`;
    const headers = {
      'Authorization': `Bearer ${this.config.accessToken}`,
      ...options.headers,
    };

    return await fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * 检查令牌是否过期
   */
  private isTokenExpired(): boolean {
    if (!this.config.expiresAt) {
      return false;
    }
    return new Date(this.config.expiresAt) <= new Date();
  }

  /**
   * 拼接路径
   */
  private joinPath(...parts: string[]): string {
    const joined = parts
      .map(part => part.replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .join('/');
    return joined ? `/${joined}` : '';
  }
}

/**
 * OneDrive文件信息
 */
export interface OneDriveFile {
  id: string;
  name: string;
  isDirectory: boolean;
  size: number;
  lastModified: string;
  downloadUrl?: string;
}

/**
 * OneDrive令牌响应
 */
export interface OneDriveTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}


