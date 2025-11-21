// 先导入类和类型，确保在导出前已加载
import { CloudStorageManager } from './CloudStorageManager';
import type { CloudStorageManager as CloudStorageManagerType } from './CloudStorageManager';
import { WebDAVClient } from './WebDAVClient';
import { OneDriveClient } from './OneDriveClient';

// 导出类和类型 - 确保所有导入在导出前已完全加载
export { CloudStorageManager };
export { WebDAVClient };
export { OneDriveClient };
export type { SyncData } from './CloudStorageManager';

// 延迟初始化单例实例，避免模块加载时的初始化顺序问题
let _cloudStorageManagerInstance: CloudStorageManagerType | null = null;

// 获取单例实例的函数（延迟初始化）
const getCloudStorageManagerInstance = (): CloudStorageManagerType => {
  if (!_cloudStorageManagerInstance) {
    _cloudStorageManagerInstance = CloudStorageManager.getInstance();
  }
  return _cloudStorageManagerInstance;
};

// 导出单例实例（延迟初始化，使用Proxy保持API兼容性）
export const cloudStorageManager = new Proxy({} as CloudStorageManagerType, {
  get(_target, prop) {
    const instance = getCloudStorageManagerInstance();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});