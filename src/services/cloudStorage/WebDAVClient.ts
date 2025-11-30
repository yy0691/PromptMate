/**
 * WebDAV客户端服务
 * 支持坚果云、ownCloud、NextCloud等WebDAV协议的云存储服务
 */

import { WebDAVConfig } from '@/types';

export class WebDAVClient {
  private config: WebDAVConfig;

  constructor(config: WebDAVConfig) {
    this.config = config;
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(this.config.url, {
        method: 'PROPFIND',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      console.error('WebDAV连接测试失败:', error);
      return false;
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(remotePath: string, content: string): Promise<boolean> {
    try {
      const url = this.joinPath(this.config.url, this.config.remotePath, remotePath);
      
      // 确保目录存在
      await this.ensureDirectory(this.getDirectoryPath(url));

      const response = await fetch(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: content,
      });

      if (!response.ok) {
        throw new Error(`上传失败: ${response.status} ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('WebDAV上传文件失败:', error);
      throw error;
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(remotePath: string): Promise<string> {
    try {
      const url = this.joinPath(this.config.url, this.config.remotePath, remotePath);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error('WebDAV下载文件失败:', error);
      throw error;
    }
  }

  /**
   * 列出目录内容
   */
  async listDirectory(remotePath: string = ''): Promise<WebDAVFile[]> {
    try {
      const url = this.joinPath(this.config.url, this.config.remotePath, remotePath);
      
      const response = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          ...this.getHeaders(),
          'Depth': '1',
        },
      });

      if (!response.ok) {
        throw new Error(`列出目录失败: ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      return this.parseDirectoryListing(xmlText);
    } catch (error) {
      console.error('WebDAV列出目录失败:', error);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(remotePath: string): Promise<boolean> {
    try {
      const url = this.joinPath(this.config.url, this.config.remotePath, remotePath);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      return response.ok;
    } catch (error) {
      console.error('WebDAV删除文件失败:', error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(remotePath: string): Promise<boolean> {
    try {
      const url = this.joinPath(this.config.url, this.config.remotePath, remotePath);
      
      const response = await fetch(url, {
        method: 'HEAD',
        headers: this.getHeaders(),
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(remotePath: string): Promise<WebDAVFile | null> {
    try {
      const url = this.joinPath(this.config.url, this.config.remotePath, remotePath);
      
      const response = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          ...this.getHeaders(),
          'Depth': '0',
        },
      });

      if (!response.ok) {
        return null;
      }

      const xmlText = await response.text();
      const files = this.parseDirectoryListing(xmlText);
      return files.length > 0 ? files[0] : null;
    } catch (error) {
      console.error('WebDAV获取文件信息失败:', error);
      return null;
    }
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectory(dirUrl: string): Promise<void> {
    try {
      const response = await fetch(dirUrl, {
        method: 'MKCOL',
        headers: this.getHeaders(),
      });

      // 如果返回405，说明目录已存在
      if (response.status === 405 || response.ok) {
        return;
      }

      // 递归创建父目录
      const parentDir = this.getDirectoryPath(dirUrl);
      if (parentDir !== dirUrl) {
        await this.ensureDirectory(parentDir);
        await this.ensureDirectory(dirUrl);
      }
    } catch (error) {
      console.error('创建目录失败:', error);
    }
  }

  /**
   * 获取请求头
   */
  private getHeaders(): Record<string, string> {
    const auth = btoa(`${this.config.username}:${this.config.password}`);
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * 拼接路径
   */
  private joinPath(...parts: string[]): string {
    return parts
      .map(part => part.replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .join('/');
  }

  /**
   * 获取目录路径
   */
  private getDirectoryPath(path: string): string {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/');
  }

  /**
   * 解析目录列表XML
   */
  private parseDirectoryListing(xmlText: string): WebDAVFile[] {
    const files: WebDAVFile[] = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const responses = doc.getElementsByTagNameNS('DAV:', 'response');

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const href = response.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent || '';
      const propstat = response.getElementsByTagNameNS('DAV:', 'propstat')[0];
      
      if (!propstat) continue;

      const prop = propstat.getElementsByTagNameNS('DAV:', 'prop')[0];
      if (!prop) continue;

      const resourceType = prop.getElementsByTagNameNS('DAV:', 'resourcetype')[0];
      const isDirectory = resourceType?.getElementsByTagNameNS('DAV:', 'collection').length > 0;
      
      const getLastModified = prop.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]?.textContent || '';
      const getContentLength = prop.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]?.textContent || '0';
      const getContentType = prop.getElementsByTagNameNS('DAV:', 'getcontenttype')[0]?.textContent || '';

      files.push({
        path: decodeURIComponent(href),
        name: this.getFileName(href),
        isDirectory,
        size: parseInt(getContentLength, 10),
        lastModified: getLastModified ? new Date(getLastModified).toISOString() : '',
        contentType: getContentType,
      });
    }

    return files;
  }

  /**
   * 从路径获取文件名
   */
  private getFileName(path: string): string {
    const parts = decodeURIComponent(path).split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  }
}

/**
 * WebDAV文件信息
 */
export interface WebDAVFile {
  path: string;
  name: string;
  isDirectory: boolean;
  size: number;
  lastModified: string;
  contentType: string;
}

/**
 * 预定义的WebDAV服务商配置
 */
export const WebDAVProviders = {
  jianguoyun: {
    name: '坚果云',
    url: 'https://dav.jianguoyun.com/dav/',
    description: '使用坚果云账号邮箱和应用密码登录',
    helpUrl: 'https://help.jianguoyun.com/?p=2064',
  },
  custom: {
    name: '自定义WebDAV',
    url: '',
    description: '输入您自己的WebDAV服务器地址',
    helpUrl: '',
  },
};


