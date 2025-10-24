/**
 * 云存储管理器
 * 统一管理不同云存储服务的接口
 */
import EventEmitter from 'eventemitter3';
import { 
  CloudStorageSettings, 
  CloudSyncStatus, 
  CloudFileInfo, 
  Prompt, 
  Category, 
  Settings, 
  CloudStorageProvider 
} from '../../types';
import { WebDAVClient } from './WebDAVClient';
import { OneDriveClient } from './OneDriveClient';

export interface SyncData {
  version: string;
  lastModified: string;
  prompts: Prompt[];
  categories: Category[];
  settings: Settings;
  syncMetadata: {
    source: 'desktop' | 'extension';
    checksum: string;
  };
}

export class CloudStorageManager extends EventEmitter {
  private static instance: CloudStorageManager;
  private settings: CloudStorageSettings;
  private webdavClient?: WebDAVClient;
  private onedriveClient?: OneDriveClient;
  private syncTimer?: NodeJS.Timeout;
  private status: CloudSyncStatus;

  private constructor() {
    super();
    this.settings = this.getDefaultSettings();
    this.status = {
      syncing: false,
      lastSync: undefined,
      lastError: undefined,
      filesCount: 0
    };
    
    // 从 localStorage 加载配置
    this.loadSettings();
  }

  public static getInstance(): CloudStorageManager {
    if (!CloudStorageManager.instance) {
      CloudStorageManager.instance = new CloudStorageManager();
    }
    return CloudStorageManager.instance;
  }

  /**
   * 获取默认设置
   */
  private getDefaultSettings(): CloudStorageSettings {
    return {
      enabled: false,
      provider: 'none',
      autoSync: false,
      syncInterval: 60, // 60分钟
      lastSyncTime: undefined,
      webdav: undefined,
      onedrive: undefined
    };
  }

  /**
   * 从 localStorage 加载设置
   */
  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('cloudStorageSettings');
      if (saved) {
        this.settings = { ...this.getDefaultSettings(), ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('加载云存储设置失败:', error);
    }
  }

  /**
   * 保存设置到 localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem('cloudStorageSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('保存云存储设置失败:', error);
    }
  }

  /**
   * 初始化管理器
   */
  async initialize(settings?: Partial<CloudStorageSettings>): Promise<void> {
    try {
      if (settings) {
        await this.updateSettings(settings);
      }

      // 初始化对应的客户端
      await this.initializeClient();

      // 启动自动同步
      if (this.settings.enabled && this.settings.autoSync) {
        this.startAutoSync();
      }

      this.emit('initialized');
    } catch (error) {
      console.error('云存储管理器初始化失败:', error);
      this.status.lastError = error instanceof Error ? error.message : '初始化失败';
      this.emit('error', error);
    }
  }

  /**
   * 初始化客户端
   */
  private async initializeClient(): Promise<void> {
    switch (this.settings.provider) {
      case 'webdav':
        if (this.settings.webdav) {
          this.webdavClient = new WebDAVClient({
            url: this.settings.webdav.url,
            username: this.settings.webdav.username,
            password: this.settings.webdav.password
          });
        }
        break;
      
      case 'onedrive':
        if (this.settings.onedrive) {
          this.onedriveClient = new OneDriveClient({
            clientId: this.settings.onedrive.clientId,
            accessToken: this.settings.onedrive.accessToken,
            refreshToken: this.settings.onedrive.refreshToken,
            expiresAt: this.settings.onedrive.expiresAt
          });
        }
        break;
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      switch (this.settings.provider) {
        case 'webdav':
          return this.webdavClient ? await this.webdavClient.testConnection() : false;
        
        case 'onedrive':
          return this.onedriveClient ? await this.onedriveClient.testConnection() : false;
        
        default:
          return false;
      }
    } catch (error) {
      console.error('测试连接失败:', error);
      return false;
    }
  }

  /**
   * 上传数据
   */
  async uploadData(prompts: Prompt[], categories: Category[], settings: Settings): Promise<void> {
    if (!this.settings.enabled || this.settings.provider === 'none') {
      throw new Error('云存储未启用或未配置');
    }

    try {
      this.status.syncing = true;
      this.emit('syncStart');

      const syncData: SyncData = {
        version: '1.0.0',
        lastModified: new Date().toISOString(),
        prompts,
        categories,
        settings,
        syncMetadata: {
          source: 'desktop',
          checksum: this.calculateChecksum({ prompts, categories, settings })
        }
      };

      const content = JSON.stringify(syncData, null, 2);
      const remotePath = this.getRemotePath();

      switch (this.settings.provider) {
        case 'webdav':
          if (!this.webdavClient) throw new Error('WebDAV客户端未初始化');
          await this.webdavClient.uploadFile(remotePath, content);
          break;
        
        case 'onedrive':
          if (!this.onedriveClient) throw new Error('OneDrive客户端未初始化');
          await this.onedriveClient.uploadFile(remotePath, content);
          break;
        
        default:
          throw new Error('不支持的云存储提供商');
      }

      this.status.syncing = false;
      this.status.lastSync = new Date().toISOString();
      this.status.lastError = undefined;
      this.settings.lastSyncTime = this.status.lastSync;
      
      this.saveSettings();
      this.emit('syncComplete', this.status);
    } catch (error) {
      this.status.syncing = false;
      this.status.lastError = error instanceof Error ? error.message : '上传失败';
      this.emit('syncError', error);
      throw error;
    }
  }

  /**
   * 下载数据
   */
  async downloadData(): Promise<SyncData | null> {
    if (!this.settings.enabled || this.settings.provider === 'none') {
      throw new Error('云存储未启用或未配置');
    }

    try {
      this.status.syncing = true;
      this.emit('syncStart');

      const remotePath = this.getRemotePath();
      let content: string;

      switch (this.settings.provider) {
        case 'webdav':
          if (!this.webdavClient) throw new Error('WebDAV客户端未初始化');
          content = await this.webdavClient.downloadFile(remotePath);
          break;
        
        case 'onedrive':
          if (!this.onedriveClient) throw new Error('OneDrive客户端未初始化');
          content = await this.onedriveClient.downloadFile(remotePath);
          break;
        
        default:
          throw new Error('不支持的云存储提供商');
      }

      const syncData: SyncData = JSON.parse(content);
      
      // 验证数据格式
      if (!this.validateSyncData(syncData)) {
        throw new Error('云端数据格式无效');
      }

      this.status.syncing = false;
      this.status.lastSync = new Date().toISOString();
      this.status.lastError = undefined;
      this.settings.lastSyncTime = this.status.lastSync;
      
      this.saveSettings();
      this.emit('syncComplete', this.status);
      
      return syncData;
    } catch (error) {
      this.status.syncing = false;
      this.status.lastError = error instanceof Error ? error.message : '下载失败';
      this.emit('syncError', error);
      throw error;
    }
  }

  /**
   * 检查云端是否有数据
   */
  async hasCloudData(): Promise<boolean> {
    if (!this.settings.enabled || this.settings.provider === 'none') {
      return false;
    }

    try {
      const remotePath = this.getRemotePath();

      switch (this.settings.provider) {
        case 'webdav':
          return this.webdavClient ? await this.webdavClient.fileExists(remotePath) : false;
        
        case 'onedrive':
          return this.onedriveClient ? await this.onedriveClient.fileExists(remotePath) : false;
        
        default:
          return false;
      }
    } catch (error) {
      console.error('检查云端数据失败:', error);
      return false;
    }
  }

  /**
   * 获取云端文件信息
   */
  async getCloudFileInfo(): Promise<CloudFileInfo | null> {
    if (!this.settings.enabled || this.settings.provider === 'none') {
      return null;
    }

    try {
      const remotePath = this.getRemotePath();

      switch (this.settings.provider) {
        case 'webdav':
          return this.webdavClient ? await this.webdavClient.getFileInfo(remotePath) : null;
        
        case 'onedrive':
          return this.onedriveClient ? await this.onedriveClient.getFileInfo(remotePath) : null;
        
        default:
          return null;
      }
    } catch (error) {
      console.error('获取云端文件信息失败:', error);
      return null;
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(): CloudSyncStatus {
    return { ...this.status };
  }

  /**
   * 更新设置
   */
  async updateSettings(newSettings: Partial<CloudStorageSettings>): Promise<void> {
    const oldProvider = this.settings.provider;
    this.settings = { ...this.settings, ...newSettings };
    
    // 如果提供商发生变化，需要重新初始化客户端
    if (oldProvider !== this.settings.provider) {
      await this.initializeClient();
    }
    
    // 更新自动同步
    if (this.settings.enabled && this.settings.autoSync) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
    
    this.saveSettings();
    this.emit('settingsChanged', this.settings);
  }

  /**
   * 启动自动同步
   */
  private startAutoSync(): void {
    this.stopAutoSync();
    
    if (this.settings.syncInterval > 0) {
      const intervalMs = this.settings.syncInterval * 60 * 1000; // 转换为毫秒
      this.syncTimer = setInterval(() => {
        this.emit('autoSyncTriggered');
      }, intervalMs);
    }
  }

  /**
   * 停止自动同步
   */
  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * 获取远程文件路径
   */
  private getRemotePath(): string {
    switch (this.settings.provider) {
      case 'webdav':
        return this.settings.webdav?.remotePath || '/promptmate-data.json';
      
      case 'onedrive':
        return this.settings.onedrive?.remotePath || '/PromptMate/promptmate-data.json';
      
      default:
        return '/promptmate-data.json';
    }
  }

  /**
   * 验证同步数据格式
   */
  private validateSyncData(data: any): data is SyncData {
    return (
      data &&
      typeof data.version === 'string' &&
      typeof data.lastModified === 'string' &&
      Array.isArray(data.prompts) &&
      Array.isArray(data.categories) &&
      typeof data.settings === 'object' &&
      data.syncMetadata &&
      typeof data.syncMetadata.source === 'string' &&
      typeof data.syncMetadata.checksum === 'string'
    );
  }

  /**
   * 计算数据校验和
   */
  private calculateChecksum(data: { prompts: Prompt[]; categories: Category[]; settings: Settings }): string {
    const content = JSON.stringify({
      prompts: data.prompts,
      categories: data.categories,
      settings: data.settings
    });

    // 简单的校验和算法
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(16);
  }

  /**
   * 获取 OneDrive 授权 URL
   */
  getOneDriveAuthUrl(redirectUri: string = 'http://localhost:3000/auth/callback'): string {
    if (!this.settings.onedrive?.clientId) {
      throw new Error('OneDrive Client ID 未配置');
    }

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${this.settings.onedrive.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('Files.ReadWrite')}&response_mode=query`;
  }

  /**
   * 处理 OneDrive 授权回调
   */
  async handleOneDriveCallback(code: string, redirectUri: string = 'http://localhost:3000/auth/callback'): Promise<void> {
    if (!this.onedriveClient) {
      throw new Error('OneDrive客户端未初始化');
    }

    const tokens = await this.onedriveClient.getAccessToken(code, redirectUri);
    
    // 更新设置中的令牌信息
    await this.updateSettings({
      onedrive: {
        ...this.settings.onedrive,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt
      }
    });
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.stopAutoSync();
    this.removeAllListeners();
    this.emit('disabled');
  }
}