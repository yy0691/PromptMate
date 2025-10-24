import { Prompt, Category, Settings } from '../types';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import EventEmitter from 'eventemitter3';
import { watch } from 'chokidar';
import * as os from 'os';

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

export interface SyncSettings {
  enabled: boolean;
  dataPath: string; // 完整文件路径
  autoSync: boolean;
  conflictResolution: 'timestamp' | 'manual' | 'merge';
  backupEnabled: boolean;
  maxBackups: number;
  cloudProvider?: 'google' | 'dropbox' | 'onedrive' | null;
  syncInterval?: 'realtime' | 'hourly' | 'daily';
}

export class SyncManager extends EventEmitter {
  private static instance: SyncManager;
  private syncSettings: SyncSettings;
  private dataPath: string;
  private watcher: any;
  private lastKnownChecksum: string = '';
  private lastSyncTime: string | null = null;

  private constructor() {
    super();
    // 初始化默认设置
    this.syncSettings = this.getDefaultSyncSettings();
    // 尝试从磁盘加载配置
    this.loadSettingsFromDisk().catch(() => void 0);
    this.dataPath = this.syncSettings.dataPath || this.getDefaultSyncDataPath();
  }

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  // 获取默认同步设置
  private getDefaultSyncSettings(): SyncSettings {
    return {
      enabled: true,
      dataPath: this.getDefaultSyncDataPath(),
      autoSync: true,
      conflictResolution: 'timestamp',
      backupEnabled: true,
      maxBackups: 5,
      cloudProvider: null,
      syncInterval: 'hourly'
    };
  }

  // 获取应用数据根目录（不含文件名）
  private getUserDataDir(): string {
    const home = os.homedir();
    if (process.platform === 'win32') {
      return join(home, 'AppData', 'Roaming', 'PromptMate');
    } else if (process.platform === 'darwin') {
      return join(home, 'Library', 'Application Support', 'PromptMate');
    } else {
      return join(home, '.config', 'PromptMate');
    }
  }

  // 获取默认的同步数据文件路径
  private getDefaultSyncDataPath(): string {
    return join(this.getUserDataDir(), 'sync-data.json');
  }

  // 配置文件路径
  private getSettingsFilePath(): string {
    return join(this.getUserDataDir(), 'sync-settings.json');
  }

  // 根据云服务商返回建议的目录（目录，不含文件名）
  private getSuggestedCloudDir(provider: NonNullable<SyncSettings['cloudProvider']>): string {
    const home = os.homedir();
    if (process.platform === 'win32') {
      switch (provider) {
        case 'onedrive':
          return join(home, 'OneDrive', 'PromptMate');
        case 'dropbox':
          return join(home, 'Dropbox', 'Apps', 'PromptMate');
        case 'google':
          // Google Drive 桌面版可能使用独立盘符或用户目录，提供一个常见路径作为建议
          return join(home, 'Google Drive', 'PromptMate');
      }
    } else if (process.platform === 'darwin') {
      // macOS 下常见的 CloudStorage 目录
      switch (provider) {
        case 'onedrive':
          return join(home, 'Library', 'CloudStorage', 'OneDrive-Personal', 'PromptMate');
        case 'dropbox':
          return join(home, 'Library', 'CloudStorage', 'Dropbox', 'Apps', 'PromptMate');
        case 'google':
          return join(home, 'Library', 'CloudStorage', 'GoogleDrive', 'PromptMate');
      }
    } else {
      // Linux 常见路径（需用户自行调整）
      switch (provider) {
        case 'onedrive':
          return join(home, 'OneDrive', 'PromptMate');
        case 'dropbox':
          return join(home, 'Dropbox', 'Apps', 'PromptMate');
        case 'google':
          return join(home, 'GoogleDrive', 'PromptMate');
      }
    }
    return this.getUserDataDir();
  }

  // 将目录转换为文件路径（附加文件名）
  private asDataFilePath(dir: string): string {
    return dir.endsWith('.json') ? dir : join(dir, 'sync-data.json');
  }

  // 从磁盘加载配置
  private async loadSettingsFromDisk(): Promise<void> {
    try {
      const file = this.getSettingsFilePath();
      const content = await fs.readFile(file, 'utf-8');
      const saved = JSON.parse(content) as Partial<SyncSettings>;
      this.syncSettings = { ...this.getDefaultSyncSettings(), ...saved };
    } catch (_) {
      // 无配置文件时忽略
      this.syncSettings = this.getDefaultSyncSettings();
    }
  }

  // 持久化配置
  private async persistSettings(): Promise<void> {
    try {
      const file = this.getSettingsFilePath();
      await fs.mkdir(dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(this.syncSettings, null, 2), 'utf-8');
    } catch (error) {
      console.error('保存同步配置失败:', error);
    }
  }

  // 初始化同步管理器
  async initialize(): Promise<void> {
    try {
      // 使用配置中的 dataPath
      this.dataPath = this.syncSettings.dataPath || this.getDefaultSyncDataPath();

      // 确保数据目录存在
      await fs.mkdir(join(this.dataPath, '..'), { recursive: true });

      // 启动文件监听
      if (this.syncSettings.enabled && this.syncSettings.autoSync) {
        this.startFileWatcher();
      }

      this.emit('initialized');
    } catch (error) {
      console.error('同步管理器初始化失败:', error);
      this.emit('error', error);
    }
  }

  // 启动文件监听器
  private startFileWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
    }

    this.watcher = watch(this.dataPath, {
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on('change', async () => {
      try {
        const data = await this.readSyncData();
        if (data && data.syncMetadata.source === 'extension') {
          // 检测到扩展端的数据变更
          const newChecksum = this.calculateChecksum(data);
          if (newChecksum !== this.lastKnownChecksum) {
            this.lastKnownChecksum = newChecksum;
            this.emit('dataChanged', data);
          }
        }
      } catch (error) {
        console.error('文件监听处理失败:', error);
      }
    });

    this.watcher.on('error', (error: Error) => {
      console.error('文件监听器错误:', error);
      this.emit('error', error);
    });
  }

  // 停止文件监听器
  private stopFileWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  // 读取同步数据
  async readSyncData(): Promise<SyncData | null> {
    try {
      const content = await fs.readFile(this.dataPath, 'utf-8');
      const data = JSON.parse(content) as SyncData;

      // 验证数据完整性
      if (this.validateSyncData(data)) {
        return data;
      } else {
        console.warn('同步数据格式无效');
        return null;
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // 文件不存在，返回null
        return null;
      }
      console.error('读取同步数据失败:', error);
      throw error;
    }
  }

  // 写入同步数据
  async writeSyncData(prompts: Prompt[], categories: Category[], settings: Settings): Promise<void> {
    try {
      const syncData: SyncData = {
        version: '1.0.0',
        lastModified: new Date().toISOString(),
        prompts,
        categories,
        settings,
        syncMetadata: {
          source: 'desktop',
          checksum: ''
        }
      };

      // 计算校验和
      syncData.syncMetadata.checksum = this.calculateChecksum(syncData);
      this.lastKnownChecksum = syncData.syncMetadata.checksum;

      // 备份现有数据
      if (this.syncSettings.backupEnabled) {
        await this.createBackup();
      }

      // 写入数据
      const content = JSON.stringify(syncData, null, 2);
      await fs.writeFile(this.dataPath, content, 'utf-8');

      this.lastSyncTime = new Date().toISOString();
      this.emit('dataSynced', syncData);
    } catch (error) {
      console.error('写入同步数据失败:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // 创建数据备份
  private async createBackup(): Promise<void> {
    try {
      const backupDir = join(this.dataPath, '..', 'backups');
      await fs.mkdir(backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = join(backupDir, `sync-data-${timestamp}.json`);

      // 复制当前数据文件
      try {
        await fs.copyFile(this.dataPath, backupPath);
      } catch (error) {
        // 如果源文件不存在，跳过备份
        if ((error as any).code !== 'ENOENT') {
          throw error;
        }
      }

      // 清理旧备份
      await this.cleanupOldBackups(backupDir);
    } catch (error) {
      console.error('创建备份失败:', error);
    }
  }

  // 清理旧备份文件
  private async cleanupOldBackups(backupDir: string): Promise<void> {
    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter(file => file.startsWith('sync-data-') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: join(backupDir, file)
        }))
        .sort((a, b) => b.name.localeCompare(a.name)); // 按时间倒序

      // 删除超出限制的备份文件
      if (backupFiles.length > this.syncSettings.maxBackups) {
        const filesToDelete = backupFiles.slice(this.syncSettings.maxBackups);
        for (const file of filesToDelete) {
          await fs.unlink(file.path);
        }
      }
    } catch (error) {
      console.error('清理备份文件失败:', error);
    }
  }

  // 验证同步数据格式
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

  // 计算数据校验和
  private calculateChecksum(data: SyncData): string {
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

  // 检测数据冲突
  async detectConflict(localData: SyncData, remoteData: SyncData): Promise<boolean> {
    // 比较校验和
    if (localData.syncMetadata.checksum === remoteData.syncMetadata.checksum) {
      return false;
    }

    // 比较修改时间
    const localTime = new Date(localData.lastModified).getTime();
    const remoteTime = new Date(remoteData.lastModified).getTime();

    // 如果时间差小于1秒，认为是冲突
    return Math.abs(localTime - remoteTime) < 1000;
  }

  // 解决数据冲突
  async resolveConflict(localData: SyncData, remoteData: SyncData): Promise<SyncData> {
    switch (this.syncSettings.conflictResolution) {
      case 'timestamp':
        return this.resolveByTimestamp(localData, remoteData);
      case 'merge':
        return this.mergeData(localData, remoteData);
      case 'manual':
        // 触发手动解决事件
        this.emit('conflictDetected', { localData, remoteData });
        throw new Error('需要手动解决冲突');
      default:
        return localData;
    }
  }

  // 按时间戳解决冲突
  private resolveByTimestamp(localData: SyncData, remoteData: SyncData): SyncData {
    const localTime = new Date(localData.lastModified).getTime();
    const remoteTime = new Date(remoteData.lastModified).getTime();

    return localTime > remoteTime ? localData : remoteData;
  }

  // 智能合并数据
  private mergeData(localData: SyncData, remoteData: SyncData): SyncData {
    // 合并提示词（以ID为准，保留最新的）
    const mergedPrompts = new Map<string, Prompt>();

    [...localData.prompts, ...remoteData.prompts].forEach(prompt => {
      const existing = mergedPrompts.get(prompt.id);
      if (!existing || new Date(prompt.updatedAt) > new Date(existing.updatedAt)) {
        mergedPrompts.set(prompt.id, prompt);
      }
    });

    // 合并分类
    const mergedCategories = new Map<string, Category>();
    [...localData.categories, ...remoteData.categories].forEach(category => {
      mergedCategories.set(category.id, category);
    });

    // 设置使用最新的
    const settings = new Date(localData.lastModified) > new Date(remoteData.lastModified)
      ? localData.settings
      : remoteData.settings;

    const mergedData: SyncData = {
      version: '1.0.0',
      lastModified: new Date().toISOString(),
      prompts: Array.from(mergedPrompts.values()),
      categories: Array.from(mergedCategories.values()),
      settings,
      syncMetadata: {
        source: 'desktop',
        checksum: ''
      }
    };

    mergedData.syncMetadata.checksum = this.calculateChecksum(mergedData);
    return mergedData;
  }

  // 获取同步状态
  getSyncStatus(): { enabled: boolean; lastSync: string | null; hasConflicts: boolean } {
    return {
      enabled: this.syncSettings.enabled,
      lastSync: this.lastSyncTime,
      hasConflicts: false // TODO: 实现冲突状态跟踪
    };
  }

  // 获取当前同步设置
  getSyncSettings(): SyncSettings {
    return { ...this.syncSettings };
  }

  // 更新同步设置
  updateSyncSettings(settings: Partial<SyncSettings>): void {
    const prev = { ...this.syncSettings };
    // 处理云服务商到路径的映射
    if (settings.cloudProvider && settings.cloudProvider !== this.syncSettings.cloudProvider) {
      const suggestedDir = this.getSuggestedCloudDir(settings.cloudProvider);
      settings.dataPath = this.asDataFilePath(suggestedDir);
    }

    this.syncSettings = { ...this.syncSettings, ...settings };

    // 如果 dataPath 变化，更新内部路径并重启观察
    if (settings.dataPath && settings.dataPath !== this.dataPath) {
      this.dataPath = settings.dataPath;
      // 确保目录存在
      fs.mkdir(join(this.dataPath, '..'), { recursive: true }).catch(() => void 0);
      // 重启监听器
      this.stopFileWatcher();
      if (this.syncSettings.enabled && this.syncSettings.autoSync) {
        this.startFileWatcher();
      }
    }

    // 根据 enabled/autoSync 的变化决定是否监听
    const enabledChanged = settings.enabled !== undefined && settings.enabled !== prev.enabled;
    const autoChanged = settings.autoSync !== undefined && settings.autoSync !== prev.autoSync;
    if (enabledChanged || autoChanged) {
      if (this.syncSettings.enabled && this.syncSettings.autoSync) {
        this.startFileWatcher();
      } else {
        this.stopFileWatcher();
      }
    }

    // 持久化到磁盘
    this.persistSettings();

    this.emit('settingsChanged', this.syncSettings);
  }

  // 手动触发同步
  async manualSync(prompts: Prompt[], categories: Category[], settings: Settings): Promise<void> {
    await this.writeSyncData(prompts, categories, settings);
  }

  // 销毁同步管理器
  destroy(): void {
    this.stopFileWatcher();
    this.removeAllListeners();
  }
}
