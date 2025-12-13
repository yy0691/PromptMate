export interface Prompt {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  description?: string;
  images?: PromptImage[];
  // 版本管理
  version: number;
  versions?: PromptVersion[];
  // 评分功能
  rating?: number; // 1-5星评分
  ratingNotes?: string; // 评分备注
  // 翻译功能
  translatedContent?: string; // 翻译后的内容
  contentLanguage?: 'zh' | 'en'; // 原始内容语言
  translatedAt?: string; // 翻译时间戳
}

export interface PromptImage {
  id: string;
  data: string; // Base64编码的图片数据
  caption?: string; // 图片说明
}

// 提示词版本管理
export interface PromptVersion {
  id: string;
  version: number;
  title: string;
  content: string;
  description?: string;
  images?: PromptImage[];
  createdAt: string;
  changeNotes?: string; // 版本变更说明
}

// 提示词对比功能
export interface PromptComparison {
  id: string;
  promptId: string;
  promptTitle: string;
  promptVersion: number;
  createdAt: string;
  results: ComparisonResult[];
  notes?: string; // 对比备注
}

export interface ComparisonResult {
  id: string;
  modelProvider: string; // 模型提供商 (OpenAI, Anthropic, etc.)
  modelName: string; // 具体模型名称
  response: string; // AI响应内容
  responseTime: number; // 响应时间(ms)
  rating?: number; // 1-5星评分
  notes?: string; // 备注
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export type ThemeType =
  | 'light'
  | 'dark'
  | 'system'
  | 'blue'
  | 'purple'
  | 'green'
  | 'orange'
  | 'red'
  | 'midnight'
  | 'coffee'
  | 'custom';

export interface Settings {
  theme: ThemeType;
  font: string;
  fontSize: number;
  alwaysOnTop: boolean;
  shortcut: string;
  customTheme?: {
    background: string;
    foreground: string;
    primary: string;
    accent: string;
  };
  cloudStorage?: CloudStorageSettings;
  // 翻译功能
  defaultCopyLanguage?: 'original' | 'translated' | 'zh' | 'en'; // 默认复制语言
}

// 云存储配置
export interface CloudStorageSettings {
  enabled: boolean;
  provider: CloudStorageProvider;
  autoSync: boolean;
  syncInterval: number; // 分钟
  lastSyncTime?: string;
  webdav?: WebDAVConfig;
  onedrive?: OneDriveConfig;
}

export type CloudStorageProvider = 'none' | 'webdav' | 'onedrive';

// WebDAV配置（支持坚果云等）
export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  remotePath: string;
}

// OneDrive配置
export interface OneDriveConfig {
  clientId: string;
  accessToken?: string;
  refreshToken?: string;
  remotePath: string;
  expiresAt?: string;
}

// 云存储同步状态
export interface CloudSyncStatus {
  syncing: boolean;
  lastSync?: string;
  lastError?: string;
  filesCount?: number;
}

export interface RecommendedPrompt {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
}
