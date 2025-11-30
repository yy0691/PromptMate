/**
 * 云存储管理器
 * 统一管理WebDAV、OneDrive等云存储服务
 */

import { CloudStorageSettings, CloudStorageProvider, CloudSyncStatus, Prompt, Category, Settings } from '@/types';
import { WebDAVClient } from './WebDAVClient';
import { OneDriveClient } from './OneDriveClient';
import { EventEmitter } from 'events';

export class CloudStorageManager extends EventEmitter {
  private static instance: CloudStorageManager;
  private settings: CloudStorageSettings | null = null;
  private webdavClient: WebDAVClient | null = null;
  private oneDriveClient: OneDriveClient | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private syncStatus: CloudSyncStatus = {
    syncing: false,
  };

  private constructor() {
    super();
  }

  public static getInstance(): CloudStorageManager {
    if (!CloudStorageManager.instance) {
      CloudStorageManager.instance = new CloudStorageManager();
    }
    return CloudStorageManager.instance;
  }

  /**
   * 初始化云存储管理器
   */
  async initialize(settings: CloudStorageSettings): Promise<void> {
    this.settings = settings;

    // 停止现有的同步定时器
    this.stopAutoSync();

    // 根据配置初始化相应的客户端
    if (settings.enabled) {
      try {
        if (settings.provider === 'webdav' && settings.webdav) {
          this.webdavClient = new WebDAVClient(settings.webdav);
          const connected = await this.webdavClient.testConnection();
          if (!connected) {
            throw new Error('WebDAV连接测试失败');
          }
        } else if (settings.provider === 'onedrive' && settings.onedrive) {
          this.oneDriveClient = new OneDriveClient(settings.onedrive);
          const connected = await this.oneDriveClient.testConnection();
          if (!connected) {
            throw new Error('OneDrive连接测试失败');
          }
        }

        // 启动自动同步
        if (settings.autoSync) {
          this.startAutoSync();
        }

        this.emit('initialized', { provider: settings.provider });
      } catch (error) {
        console.error('云存储初始化失败:', error);
        this.syncStatus.lastError = (error as Error).message;
        this.emit('error', error);
        throw error;
      }
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    if (!this.settings?.enabled) {
      return false;
    }

    try {
      if (this.settings.provider === 'webdav' && this.webdavClient) {
        return await this.webdavClient.testConnection();
      } else if (this.settings.provider === 'onedrive' && this.oneDriveClient) {
        return await this.oneDriveClient.testConnection();
      }
      return false;
    } catch (error) {
      console.error('连接测试失败:', error);
      return false;
    }
  }

  /**
   * 上传数据到云端
   */
  async uploadData(prompts: Prompt[], categories: Category[], settings: Settings): Promise<void> {
    if (!this.settings?.enabled) {
      throw new Error('云存储未启用');
    }

    try {
      this.syncStatus.syncing = true;
      this.emit('syncStart');

      const data = {
        version: '1.0.0',
        lastModified: new Date().toISOString(),
        prompts,
        categories,
        settings,
      };

      const content = JSON.stringify(data, null, 2);
      const remotePath = 'promptmate-data.json';

      if (this.settings.provider === 'webdav' && this.webdavClient) {
        await this.webdavClient.uploadFile(remotePath, content);
      } else if (this.settings.provider === 'onedrive' && this.oneDriveClient) {
        await this.oneDriveClient.uploadFile(remotePath, content);
      } else {
        throw new Error('未配置云存储客户端');
      }

      this.syncStatus.lastSync = new Date().toISOString();
      this.syncStatus.lastError = undefined;
      this.syncStatus.filesCount = 1;
      this.syncStatus.syncing = false;

      this.emit('syncComplete', this.syncStatus);
    } catch (error) {
      this.syncStatus.syncing = false;
      this.syncStatus.lastError = (error as Error).message;
      this.emit('syncError', error);
      throw error;
    }
  }

  /**
   * 从云端下载数据
   */
  async downloadData(): Promise<{ prompts: Prompt[]; categories: Category[]; settings: Settings } | null> {
    if (!this.settings?.enabled) {
      throw new Error('云存储未启用');
    }

    try {
      this.syncStatus.syncing = true;
      this.emit('syncStart');

      const remotePath = 'promptmate-data.json';
      let content: string;

      if (this.settings.provider === 'webdav' && this.webdavClient) {
        content = await this.webdavClient.downloadFile(remotePath);
      } else if (this.settings.provider === 'onedrive' && this.oneDriveClient) {
        content = await this.oneDriveClient.downloadFile(remotePath);
      } else {
        throw new Error('未配置云存储客户端');
      }

      const data = JSON.parse(content);
      
      this.syncStatus.lastSync = new Date().toISOString();
      this.syncStatus.lastError = undefined;
      this.syncStatus.syncing = false;

      this.emit('syncComplete', this.syncStatus);

      return {
        prompts: data.prompts || [],
        categories: data.categories || [],
        settings: data.settings || {},
      };
    } catch (error) {
      this.syncStatus.syncing = false;
      this.syncStatus.lastError = (error as Error).message;
      this.emit('syncError', error);
      throw error;
    }
  }

  /**
   * 检查云端是否存在数据
   */
  async hasCloudData(): Promise<boolean> {
    if (!this.settings?.enabled) {
      return false;
    }

    try {
      const remotePath = 'promptmate-data.json';

      if (this.settings.provider === 'webdav' && this.webdavClient) {
        return await this.webdavClient.fileExists(remotePath);
      } else if (this.settings.provider === 'onedrive' && this.oneDriveClient) {
        return await this.oneDriveClient.fileExists(remotePath);
      }

      return false;
    } catch (error) {
      console.error('检查云端数据失败:', error);
      return false;
    }
  }

  /**
   * 获取云端文件信息
   */
  async getCloudFileInfo(): Promise<{ lastModified: string; size: number } | null> {
    if (!this.settings?.enabled) {
      return null;
    }

    try {
      const remotePath = 'promptmate-data.json';

      if (this.settings.provider === 'webdav' && this.webdavClient) {
        const info = await this.webdavClient.getFileInfo(remotePath);
        return info ? {
          lastModified: info.lastModified,
          size: info.size,
        } : null;
      } else if (this.settings.provider === 'onedrive' && this.oneDriveClient) {
        const info = await this.oneDriveClient.getFileInfo(remotePath);
        return info ? {
          lastModified: info.lastModified,
          size: info.size,
        } : null;
      }

      return null;
    } catch (error) {
      console.error('获取云端文件信息失败:', error);
      return null;
    }
  }

  /**
   * 启动自动同步
   */
  private startAutoSync(): void {
    if (!this.settings?.autoSync || this.syncTimer) {
      return;
    }

    const intervalMs = (this.settings.syncInterval || 30) * 60 * 1000; // 转换为毫秒
    this.syncTimer = setInterval(() => {
      this.emit('autoSyncTriggered');
    }, intervalMs);
  }

  /**
   * 停止自动同步
   */
  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(): CloudSyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * 更新设置
   */
  async updateSettings(settings: CloudStorageSettings): Promise<void> {
    await this.initialize(settings);
  }

  /**
   * 禁用云存储
   */
  disable(): void {
    this.stopAutoSync();
    this.webdavClient = null;
    this.oneDriveClient = null;
    this.settings = null;
    this.syncStatus = {
      syncing: false,
    };
    this.emit('disabled');
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.stopAutoSync();
    this.removeAllListeners();
    this.webdavClient = null;
    this.oneDriveClient = null;
    this.settings = null;
  }
}

/**
 * 导出单例实例
 */
export const cloudStorageManager = CloudStorageManager.getInstance();


