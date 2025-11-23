const { app, BrowserWindow, ipcMain, globalShortcut, Menu, dialog, Tray } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const https = require('https');
const { spawn } = require('child_process');

// SQLite数据库支持 (使用 sql.js)
const { DatabaseServiceSqlJs } = require('./database-sqljs.cjs');
let databaseService = null;
let databaseInitialized = false;

// 根据环境设置
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Configure logging (optional)
log.transports.file.level = 'info';
log.info('App starting...');

// --- Auto Updater Setup ---
autoUpdater.logger = log; // Pipe autoUpdater logs to electron-log
autoUpdater.autoDownload = false; // Disable auto download, let user confirm
autoUpdater.autoInstallOnAppQuit = true; // 应用退出时自动安装
autoUpdater.autoRunAppAfterInstall = true; // 安装后自动运行

// 配置更新服务器
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'yy0691',
  repo: 'PromptMate',
  private: false,
  requestHeaders: {
    'User-Agent': 'PromptMate-Auto-Updater'
  }
});

// GitHub API配置
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_REPO_OWNER = 'yy0691';
const GITHUB_REPO_NAME = 'PromptMate';

// 版本比较函数
function compareVersions(version1, version2) {
  try {
    // 验证版本号格式
    if (!version1 || !version2) {
      throw new Error('版本号不能为空');
    }
    
    if (typeof version1 !== 'string' || typeof version2 !== 'string') {
      throw new Error('版本号必须是字符串');
    }
    
    // 移除版本号前缀（如 'v'）
    const cleanVersion1 = version1.replace(/^[vV]/, '');
    const cleanVersion2 = version2.replace(/^[vV]/, '');
    
    // 验证版本号格式
    const versionRegex = /^\d+(\.\d+)*$/;
    if (!versionRegex.test(cleanVersion1) || !versionRegex.test(cleanVersion2)) {
      throw new Error('版本号格式无效');
    }
    
    const v1Parts = cleanVersion1.split('.').map(Number);
    const v2Parts = cleanVersion2.split('.').map(Number);
    
    // 确保两个版本号有相同的段数
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  } catch (error) {
    log.error('版本比较失败:', error);
    throw new Error(`版本比较失败: ${error.message}`);
  }
}

// 获取GitHub最新发布版本（带重试机制）
async function getLatestGitHubRelease(retryCount = 3) {
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      log.info(`尝试获取GitHub发布信息 (第${attempt}次)`);
      
      const result = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.github.com',
          path: '/repos/yy0691/PromptMate/releases/latest',
          method: 'GET',
          headers: {
            'User-Agent': 'PromptMate-UpdateChecker'
          }
        };

        const request = https.request(options, (response) => {
          let data = '';
          
          response.on('data', (chunk) => {
            data += chunk;
          });
          
          response.on('end', () => {
            try {
              if (response.statusCode === 200) {
                const release = JSON.parse(data);
                resolve({
                  version: release.tag_name,
                  name: release.name,
                  body: release.body,
                  publishedAt: release.published_at,
                  downloadUrl: release.assets[0]?.browser_download_url
                });
              } else {
                reject(new Error(`GitHub API返回错误状态: ${response.statusCode}`));
              }
            } catch (error) {
              reject(new Error(`解析GitHub API响应失败: ${error.message}`));
            }
          });
        });
        
        // 设置超时处理（增加到20秒）
        request.setTimeout(20000, () => {
          request.destroy();
          reject(new Error('GitHub API请求超时'));
        });
        
        request.on('error', (error) => {
          reject(new Error(`GitHub API请求失败: ${error.message}`));
        });
        
        request.end();
      });
      
      log.info('成功获取GitHub发布信息');
      return result;
      
    } catch (error) {
      log.warn(`第${attempt}次尝试失败: ${error.message}`);
      
      if (attempt === retryCount) {
        throw new Error(`经过${retryCount}次重试后仍然失败: ${error.message}`);
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

// 检查更新函数
function checkForUpdates() {
  log.info('Checking for updates...');
  
  // 设置更新检查超时
  const updateTimeout = setTimeout(() => {
    log.warn('Update check timeout, skipping...');
  }, 10000); // 10秒超时
  
  autoUpdater.checkForUpdatesAndNotify()
    .then(() => {
      clearTimeout(updateTimeout);
      log.info('Update check completed');
    })
    .catch(err => {
      clearTimeout(updateTimeout);
      log.error('Error checking for updates:', err);
      // 不显示错误对话框，静默处理
    });
}

// 获取应用信息
function getAppInfo() {
  try {
    const packageJson = require('../../package.json');
    
    // 获取构建日期，优先使用package.json中的buildDate
    let buildDate = packageJson.buildDate;
    if (!buildDate) {
      // 如果没有buildDate，尝试从文件修改时间获取
      try {
        const fs = require('fs');
        const packageJsonPath = require('path').join(__dirname, '../../package.json');
        const stats = fs.statSync(packageJsonPath);
        buildDate = stats.mtime.toISOString();
      } catch (error) {
        log.warn('无法获取文件修改时间，使用当前时间:', error);
        buildDate = new Date().toISOString();
      }
    }
    
    // 验证版本号格式
    const version = app.getVersion();
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      log.warn(`应用版本号格式无效: ${version}`);
    }
    
    return {
      version: version,
      name: app.getName(),
      description: packageJson.description || 'PromptMate is a desktop application that allows you to create and manage your prompts.',
      author: packageJson.author || { name: '泺源', email: 'yuyuan3162021@163.com' },
      homepage: packageJson.homepage || `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
      repository: packageJson.repository?.url || `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
      buildDate: buildDate,
      electronVersion: process.versions.electron || '未知',
      nodeVersion: process.versions.node || '未知',
      chromeVersion: process.versions.chrome || '未知'
    };
  } catch (error) {
    log.error('获取应用信息失败:', error);
    // 返回默认信息
    return {
      version: app.getVersion() || '1.0.0',
      name: app.getName() || 'PromptMate',
      description: 'PromptMate is a desktop application that allows you to create and manage your prompts.',
      author: { name: '泺源', email: 'yuyuan3162021@163.com' },
      homepage: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
      repository: `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`,
      buildDate: new Date().toISOString(),
      electronVersion: process.versions.electron || '未知',
      nodeVersion: process.versions.node || '未知',
      chromeVersion: process.versions.chrome || '未知'
    };
  }
}

// 检查更新（增强版）
async function checkForUpdatesEnhanced() {
  try {
    log.info('开始检查更新...');
    
    // 获取当前版本
    const currentVersion = app.getVersion();
    log.info(`当前版本: ${currentVersion}`);
    
    // 验证当前版本格式
    if (!/^\d+\.\d+\.\d+$/.test(currentVersion)) {
      log.warn(`当前版本格式无效: ${currentVersion}`);
      return {
        success: false,
        hasUpdate: false,
        error: '当前版本格式无效',
        currentVersion: currentVersion
      };
    }
    
    // 获取GitHub最新发布
    let latestRelease;
    try {
      latestRelease = await getLatestGitHubRelease();
      log.info(`GitHub最新版本: ${latestRelease.version}`);
    } catch (error) {
      log.error('获取GitHub发布信息失败:', error);
      
      // 根据错误类型提供更详细的错误信息
      let errorMessage = error.message;
      let troubleshooting = [];
      
      if (error.message.includes('超时')) {
        errorMessage = '网络连接超时，请检查网络状态';
        troubleshooting = [
          '检查网络连接是否正常',
          '确认防火墙未阻止应用访问网络',
          '如使用代理，请检查代理设置',
          '稍后重试更新检查'
        ];
      } else if (error.message.includes('请求失败')) {
        errorMessage = '无法连接到GitHub服务器';
        troubleshooting = [
          '检查DNS设置是否正确',
          '确认可以访问github.com',
          '检查网络防火墙设置',
          '手动访问GitHub检查更新'
        ];
      } else if (error.message.includes('解析')) {
        errorMessage = 'GitHub API响应格式异常';
        troubleshooting = [
          'GitHub服务可能暂时不可用',
          '稍后重试更新检查',
          '手动访问GitHub检查更新'
        ];
      }
      
      return {
        success: false,
        hasUpdate: false,
        error: errorMessage,
        errorType: 'NETWORK_ERROR',
        currentVersion: currentVersion,
        troubleshooting: troubleshooting,
        manualCheckUrl: 'https://github.com/yy0691/PromptMate/releases/latest'
      };
    }
    
    // 比较版本
    const versionComparison = compareVersions(currentVersion, latestRelease.version);
    log.info(`版本比较结果: ${versionComparison} (当前: ${currentVersion}, 最新: ${latestRelease.version})`);
    
    if (versionComparison < 0) {
      // 有新版本
      const updateType = getUpdateType(currentVersion, latestRelease.version);
      log.info(`发现新版本: ${latestRelease.version}, 更新类型: ${updateType}`);
      
      return {
        success: true,
        hasUpdate: true,
        currentVersion: currentVersion,
        latestVersion: latestRelease.version,
        releaseInfo: latestRelease,
        updateType: updateType
      };
    } else if (versionComparison === 0) {
      // 版本相同
      log.info('当前已是最新版本');
      return {
        success: true,
        hasUpdate: false,
        currentVersion: currentVersion,
        latestVersion: latestRelease.version,
        releaseInfo: latestRelease
      };
    } else {
      // 当前版本比GitHub版本新（可能是开发版本）
      log.info(`当前版本 ${currentVersion} 比GitHub版本 ${latestRelease.version} 新`);
      return {
        success: true,
        hasUpdate: false,
        currentVersion: currentVersion,
        latestVersion: latestRelease.version,
        releaseInfo: latestRelease,
        isDevelopment: true
      };
    }
  } catch (error) {
    log.error('检查更新失败:', error);
    return {
      success: false,
      hasUpdate: false,
      error: error.message,
      currentVersion: app.getVersion()
    };
  }
}

// 获取更新类型
function getUpdateType(currentVersion, latestVersion) {
  const currentParts = currentVersion.split('.').map(Number);
  const latestParts = latestVersion.split('.').map(Number);
  
  if (latestParts[0] > currentParts[0]) {
    return 'major'; // 主版本更新
  } else if (latestParts[1] > currentParts[1]) {
    return 'minor'; // 次版本更新
  } else {
    return 'patch'; // 补丁更新
  }
}

// 获取自定义数据目录路径
function getCustomDataPath() {
  if (process.platform === 'win32') {
    // Windows: 从注册表读取自定义数据目录
    try {
      const { execSync } = require('child_process');
      const result = execSync('reg query "HKCU\\Software\\PromptMate" /v DataDirectory', { encoding: 'utf8', stdio: 'pipe' });
      const match = result.match(/DataDirectory\s+REG_SZ\s+(.+)/);
      if (match && match[1] && fs.existsSync(match[1].trim())) {
        return match[1].trim();
      }
    } catch (error) {
      // 如果读取失败，使用默认路径
      console.log('未找到自定义数据路径，使用默认路径');
    }
  }
  
  // 默认使用 electron 的 userData 路径
  return app.getPath('userData');
}

// 应用配置目录
const userDataPath = getCustomDataPath();
const configPath = path.join(userDataPath, 'config');
const promptsPath = path.join(configPath, 'prompts.json');
const settingsPath = path.join(configPath, 'settings.json');

// 确保配置目录存在
if (!fs.existsSync(configPath)) {
  fs.mkdirSync(configPath, { recursive: true });
}

// 主窗口实例
let mainWindow = null;
let tray = null;
let watcherProcess = null;

// 初始化SQLite数据库
async function initializeDatabase() {
  try {
    log.info('正在初始化SQLite数据库...');
    
    // 创建数据库服务实例
    databaseService = new DatabaseServiceSqlJs();
    
    // 初始化数据库
    const result = await databaseService.initialize();
    
    if (result.success) {
      databaseInitialized = true;
      log.info('SQLite数据库初始化成功');
      return { success: true };
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    log.error('SQLite数据库初始化失败:', error);
    databaseInitialized = false;
    databaseService = null;
    
    // 不让数据库错误阻止应用启动
    return { 
      success: false, 
      error: error.message,
      fallback: 'localStorage' 
    };
  }
}

// 获取数据库状态
function getDatabaseStatus() {
  return {
    initialized: databaseInitialized,
    available: databaseService !== null,
    fallbackMode: !databaseInitialized,
    status: databaseService ? databaseService.getStatus() : null
  };
}

// 监控进程管理
function isWatcherRunning() {
  return !!(watcherProcess && !watcherProcess.killed);
}

function startWatcher() {
  try {
    if (isWatcherRunning()) {
      log.info('Watcher already running');
      return;
    }
    const scriptPath = path.join(__dirname, '../../scripts/sync-watcher/watch-sync.js');
    const env = {
      ...process.env,
      PM_APP_DATA_FILE: promptsPath,
      PM_MODE: 'prompts'
      // PM_WATCH_FILE can be optionally provided by user via env or future settings
    };
    // Use Electron binary to spawn Node script for best portability
    watcherProcess = spawn(process.execPath, [scriptPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    watcherProcess.stdout.on('data', (data) => log.info(String(data).trim()));
    watcherProcess.stderr.on('data', (data) => log.warn(String(data).trim()));
    watcherProcess.on('exit', (code, signal) => {
      log.info(`Watcher exited code=${code} signal=${signal}`);
      watcherProcess = null;
      updateTrayMenu();
    });
    log.info('Watcher started');
  } catch (e) {
    log.error('Failed to start watcher:', e);
  } finally {
    updateTrayMenu();
  }
}

function stopWatcher() {
  try {
    if (!isWatcherRunning()) return;
    watcherProcess.kill();
    log.info('Watcher stopped');
  } catch (e) {
    log.error('Failed to stop watcher:', e);
  } finally {
    updateTrayMenu();
  }
}

function toggleWatcher() {
  if (isWatcherRunning()) stopWatcher(); else startWatcher();
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '../../public/favicon.ico');
    tray = new Tray(iconPath);
    tray.setToolTip('PromptMate');
    updateTrayMenu();
  } catch (e) {
    log.error('Failed to create tray:', e);
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const running = isWatcherRunning();
  const settings = getSettings();
  const context = Menu.buildFromTemplate([
    {
      label: mainWindow && mainWindow.isVisible() ? '隐藏窗口' : '显示窗口',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show();
      }
    },
    { type: 'separator' },
    {
      label: running ? '停止同步监听' : '启动同步监听',
      click: () => toggleWatcher()
    },
    {
      label: settings.watcherAutoStart ? '开机自启：开' : '开机自启：关',
      type: 'checkbox',
      checked: !!settings.watcherAutoStart,
      click: (menuItem) => {
        const s = getSettings();
        s.watcherAutoStart = !!menuItem.checked;
        saveSettings(s);
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    { label: '退出', role: 'quit' }
  ]);
  tray.setContextMenu(context);
}

// 默认设置
const defaultSettings = {
  theme: 'system',
  font: 'system-ui',
  fontSize: 14,
  alwaysOnTop: false,
  globalShortcut: 'CommandOrControl+Alt+P',
  watcherAutoStart: false
};

// 默认提示词数据
const defaultPrompts = [
  {
    id: '1',
    title: '简单翻译',
    content: '请将以下文本翻译成中文:\n\n',
    category: '翻译',
    tags: ['简体中文', '基础']
  },
  {
    id: '2',
    title: '代码解释',
    content: '请解释以下代码的功能和工作原理:\n\n',
    category: '编程',
    tags: ['代码', '解释']
  },
  {
    id: '3',
    title: '文章摘要',
    content: '请为以下文章生成一个简洁的摘要，不超过100字:\n\n',
    category: '写作',
    tags: ['摘要', '总结']
  }
];

// 创建主窗口
function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.cjs');
  console.log('Preload script path:', preloadPath);
  console.log('Preload script exists:', fs.existsSync(preloadPath));
  
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false,  // 隐藏默认窗口边框
    titleBarStyle: 'hiddenInset',
    show: false,  // 初始不显示窗口，等页面加载完成后再显示
    backgroundColor: '#ffffff',  // 设置窗口背景色为白色
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,  // 启用preload脚本
      webSecurity: false,  // 禁用web安全以支持本地MCP服务连接
      allowRunningInsecureContent: process.env.NODE_ENV === 'development',  // 仅在开发环境允许运行不安全内容
      enableRemoteModule: false,  // 禁用远程模块
      worldSafeExecuteJavaScript: true  // 启用安全的JavaScript执行
    }
  });

  // 根据环境加载应用（开发环境或生产环境）
  const isDev = process.env.NODE_ENV === 'development';
  console.log('当前环境:', isDev ? 'development' : 'production');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  if (isDev) {
    // 直接连接到开发服务器
    console.log('尝试连接到开发服务器: http://localhost:5173');
    log.info('尝试连接到开发服务器: http://localhost:5173');
    
    mainWindow.loadURL('http://localhost:5173');
    
    // 监听页面加载失败事件
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('页面加载失败:', errorCode, errorDescription, validatedURL);
      log.error('页面加载失败:', errorCode, errorDescription, validatedURL);
    });
    
    // 监听页面加载成功事件
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('页面加载成功');
      log.info('页面加载成功');
      // 页面加载完成后显示窗口
      mainWindow.show();
    });
    
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境：加载打包后的文件
    const indexPath = path.join(__dirname, '../../dist/index.html');
    console.log('生产环境加载路径:', indexPath);
    console.log('文件是否存在:', fs.existsSync(indexPath));
    
    // 检查dist目录内容
    const distDir = path.join(__dirname, '../../dist');
    console.log('dist目录是否存在:', fs.existsSync(distDir));
    if (fs.existsSync(distDir)) {
      console.log('dist目录内容:', fs.readdirSync(distDir));
    }
    
    // 检查assets目录
    const assetsDir = path.join(distDir, 'assets');
    console.log('assets目录是否存在:', fs.existsSync(assetsDir));
    if (fs.existsSync(assetsDir)) {
      console.log('assets目录内容:', fs.readdirSync(assetsDir));
    }
    
    mainWindow.loadFile(indexPath);
    
    // 生产环境不打开开发者工具
    // mainWindow.webContents.openDevTools();
    
    // 添加错误监听
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('页面加载失败:', errorCode, errorDescription);
      log.error('页面加载失败:', errorCode, errorDescription);
      
      // 如果加载失败，尝试重新加载
      setTimeout(() => {
        console.log('尝试重新加载页面...');
        mainWindow.loadFile(indexPath);
      }, 1000);
      
      // 即使加载失败也要显示窗口，避免用户看不到任何反馈
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
    });
    
    // 监听页面加载成功
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('生产环境页面加载成功');
      log.info('生产环境页面加载成功');
      // 页面加载完成后显示窗口
      mainWindow.show();
    });
    
    // 监听控制台消息
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`渲染进程控制台 [${level}]:`, message, `(${sourceId}:${line})`);
    });
  }

  // 窗口关闭事件处理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 加载设置并应用窗口置顶状态
  const settings = getSettings();
  mainWindow.setAlwaysOnTop(settings.alwaysOnTop);
  
  // 注册全局快捷键
  registerGlobalShortcut(settings.globalShortcut);
}

// 注册自定义协议 promptmate:// (必须在 app.whenReady 之前)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('promptmate', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('promptmate');
}

// 处理自定义协议 URL (在 macOS 上需要特殊处理)
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleOAuthCallback(url);
});

// 处理命令行参数中的协议 URL (Windows/Linux)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // 查找协议 URL
    const url = commandLine.find(arg => arg.startsWith('promptmate://'));
    if (url) {
      handleOAuthCallback(url);
    }
    // 如果主窗口被最小化，则恢复它
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// 处理 OAuth 回调
function handleOAuthCallback(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol === 'promptmate:' && urlObj.hostname === 'oauth') {
      // 提取查询参数
      const params = new URLSearchParams(urlObj.search);
      const code = params.get('code');
      const error = params.get('error');
      const state = params.get('state');
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        // 通过 IPC 发送 OAuth 回调数据到渲染进程
        mainWindow.webContents.send('oauth-callback', {
          code,
          error,
          state,
          provider: state ? (state.includes('google') ? 'google' : 'github') : null
        });
        
        // 显示并聚焦窗口
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      } else {
        log.warn('主窗口不存在，无法处理 OAuth 回调');
      }
    }
  } catch (error) {
    log.error('处理 OAuth 回调失败:', error);
  }
}

// 初始化应用
app.whenReady().then(async () => {
  // 处理启动时的协议 URL (Windows/Linux)
  if (process.platform === 'win32' || process.platform === 'linux') {
    const url = process.argv.find(arg => arg.startsWith('promptmate://'));
    if (url) {
      handleOAuthCallback(url);
    }
  }
  
  createWindow();
  
  // 初始化数据库 (使用 sql.js)
  const dbResult = await initializeDatabase();
  if (dbResult.success) {
    log.info('应用启动：SQLite数据库模式 (sql.js)');
  } else {
    log.warn('应用启动：localStorage回退模式 -', dbResult.error);
  }
  
  // 创建系统托盘
  createTray();
  // 根据设置启动同步监听
  const s = getSettings();
  if (s.watcherAutoStart) {
    startWatcher();
  }

  // 暂时禁用自动更新检查，避免错误
  // checkForUpdates();

  // MacOS相关设置
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  
  // 设置应用菜单（可选）
  const template = [
    {
      label: 'PromptMate',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

// 应用退出前
app.on('will-quit', () => {
  // 注销全局快捷键
  globalShortcut.unregisterAll();
  stopWatcher();
  
  // 关闭数据库连接
  if (databaseService) {
    databaseService.close();
  }
});

// 应用退出处理
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 注册全局快捷键
function registerGlobalShortcut(shortcut) {
  // 先注销所有快捷键
  globalShortcut.unregisterAll();
  
  // 注册新快捷键
  globalShortcut.register(shortcut, () => {
    // 如果窗口已最小化，则恢复窗口
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    
    // 窗口获取焦点
    mainWindow.focus();
    
    // 如果窗口隐藏，则显示窗口
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
  });
}

// 获取设置
function getSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      return { ...defaultSettings, ...JSON.parse(settingsData) };
    }
    
    // 如果设置文件不存在，创建默认设置
    fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
    return defaultSettings;
  } catch (error) {
    console.error('读取设置出错:', error);
    return defaultSettings;
  }
}

// 保存设置
function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    console.error('保存设置出错:', error);
    return { success: false, error: error.message };
  }
}

// 获取提示词
function getPrompts() {
  try {
    if (fs.existsSync(promptsPath)) {
      const promptsData = fs.readFileSync(promptsPath, 'utf8');
      return { prompts: JSON.parse(promptsData) };
    }
    
    // 如果提示词文件不存在，创建默认提示词
    fs.writeFileSync(promptsPath, JSON.stringify(defaultPrompts, null, 2));
    return { prompts: defaultPrompts };
  } catch (error) {
    console.error('读取提示词出错:', error);
    return { prompts: defaultPrompts };
  }
}

// 保存提示词
function savePrompts(promptsData) {
  try {
    fs.writeFileSync(promptsPath, JSON.stringify(promptsData.prompts, null, 2));
    return { success: true };
  } catch (error) {
    console.error('保存提示词出错:', error);
    return { success: false, error: error.message };
  }
}

// 注册IPC通信
ipcMain.handle('get-settings', () => getSettings());
ipcMain.handle('save-settings', (_, settings) => {
  const result = saveSettings(settings);
  
  // 如果设置成功并包含alwaysOnTop属性，则更新窗口置顶状态
  if (result.success && settings.alwaysOnTop !== undefined && mainWindow) {
    mainWindow.setAlwaysOnTop(settings.alwaysOnTop);
  }
  
  // 如果设置成功并包含globalShortcut属性，则更新全局快捷键
  if (result.success && settings.globalShortcut && settings.globalShortcut !== getSettings().globalShortcut) {
    registerGlobalShortcut(settings.globalShortcut);
  }
  
  return result;
});

ipcMain.handle('get-prompts', () => getPrompts());
ipcMain.handle('save-prompts', (_, promptsData) => savePrompts(promptsData));

ipcMain.on('toggle-pin-window', (_, shouldPin) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(shouldPin);
    
    // 更新设置
    const settings = getSettings();
    settings.alwaysOnTop = shouldPin;
    saveSettings(settings);
  }
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// 打开外部链接
ipcMain.on('open-external', (_, url) => {
  const { shell } = require('electron');
  shell.openExternal(url);
});

// 导出/导入数据
ipcMain.handle('export-data', async (_, { filePath }) => {
  try {
    const settings = getSettings();
    const { prompts } = getPrompts();
    const exportData = { settings, prompts };
    
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
    return { success: true };
  } catch (error) {
    console.error('导出数据出错:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-data', async (_, { filePath }) => {
  try {
    const importData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (importData.settings) {
      saveSettings(importData.settings);
      
      // 更新窗口置顶状态
      if (mainWindow && importData.settings.alwaysOnTop !== undefined) {
        mainWindow.setAlwaysOnTop(importData.settings.alwaysOnTop);
      }
      
      // 更新全局快捷键
      if (importData.settings.globalShortcut) {
        registerGlobalShortcut(importData.settings.globalShortcut);
      }
    }
    
    if (importData.prompts) {
      savePrompts({ prompts: importData.prompts });
    }
    
    return { success: true };
  } catch (error) {
    console.error('导入数据出错:', error);
    return { success: false, error: error.message };
  }
});

// 添加数据库状态相关IPC
ipcMain.handle('get-database-status', () => {
  return getDatabaseStatus();
});

ipcMain.handle('initialize-database', async () => {
  if (databaseInitialized) {
    return { success: true, message: '数据库已初始化' };
  }
  return await initializeDatabase();
});

// 数据库操作IPC处理程序
ipcMain.handle('db-get-all-prompts', async () => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    return { success: true, data: databaseService.getAllPrompts() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-prompt-by-id', async (_, id) => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    return { success: true, data: databaseService.getPromptById(id) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-create-prompt', async (_, prompt) => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    return { success: true, data: databaseService.createPrompt(prompt) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-update-prompt', async (_, id, updates) => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    return { success: true, data: databaseService.updatePrompt(id, updates) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-delete-prompt', async (_, id) => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    return { success: true, data: databaseService.deletePrompt(id) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-all-categories', async () => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    return { success: true, data: databaseService.getAllCategories() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-create-category', async (_, category) => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    return { success: true, data: databaseService.createCategory(category) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-update-category-language', async (_, language) => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    databaseService.updateCategoryLanguage(language);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-update-prompts-language', async (_, language) => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    databaseService.updatePromptsLanguage(language);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-all-tags', async () => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    return { success: true, data: databaseService.getAllTags() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-tags-by-category', async (_, categoryId) => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    return { success: true, data: databaseService.getTagsByCategory(categoryId) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-all-settings', async () => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    return { success: true, data: databaseService.getAllSettings() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-set-setting', async (_, key, value) => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    databaseService.setSetting(key, value);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-migrate-from-localstorage', async (_, data) => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    return await databaseService.migrateFromLocalStorage(data);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-migration-status', async () => {
  try {
    if (!databaseService) return { success: true, data: 'pending' };
    return { success: true, data: databaseService.getMigrationStatus() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 数据库重置相关IPC处理程序
ipcMain.handle('db-clear-all-data', async () => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    databaseService.clearAllData();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-reset-to-defaults', async (_, language = 'zh-CN') => {
  try {
    if (!databaseService) throw new Error('数据库服务未初始化');
    databaseService.resetToDefaults(language);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 添加应用信息和更新检查相关IPC
ipcMain.handle('get-app-info', () => {
  return getAppInfo();
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await checkForUpdatesEnhanced();
    return result;
  } catch (error) {
    console.error('检查更新出错:', error);
    log.error('Update check failed:', error);
    return {
      success: false,
      hasUpdate: false,
      error: `更新检查失败: ${error.message}`,
      errorType: 'NETWORK_ERROR',
      currentVersion: app.getVersion(),
      troubleshooting: [
        '请检查网络连接',
        '确认防火墙未阻止应用访问网络',
        '如使用代理，请检查代理设置',
        '稍后重试或手动访问 GitHub 检查更新'
      ]
    };
  }
});

// 开始下载更新
ipcMain.handle('download-update', async () => {
  try {
    log.info('开始下载更新...');
    
    // 先检查是否有可用更新
    const updateResult = await checkForUpdatesEnhanced();
    if (!updateResult.success || !updateResult.hasUpdate) {
      return {
        success: false,
        error: '没有可用更新'
      };
    }
    
    // 找到对应平台的下载链接
    const platform = process.platform;
    const arch = process.arch;
    const assets = updateResult.releaseInfo.assets;
    
    let downloadUrl = null;
    let fileName = null;
    
    if (platform === 'win32') {
      // Windows平台
      const winAsset = assets.find(asset => 
        asset.name.includes(`${updateResult.latestVersion}-x64.exe`) ||
        asset.name.includes(`${updateResult.latestVersion}.exe`)
      );
      if (winAsset) {
        downloadUrl = winAsset.browser_download_url;
        fileName = winAsset.name;
      }
    } else if (platform === 'darwin') {
      // macOS平台
      const macAsset = assets.find(asset => 
        asset.name.includes(`${updateResult.latestVersion}.dmg`)
      );
      if (macAsset) {
        downloadUrl = macAsset.browser_download_url;
        fileName = macAsset.name;
      }
    } else if (platform === 'linux') {
      // Linux平台
      const linuxAsset = assets.find(asset => 
        asset.name.includes(`${updateResult.latestVersion}.AppImage`) ||
        asset.name.includes(`${updateResult.latestVersion}.deb`)
      );
      if (linuxAsset) {
        downloadUrl = linuxAsset.browser_download_url;
        fileName = linuxAsset.name;
      }
    }
    
    if (!downloadUrl) {
      return {
        success: false,
        error: `未找到适用于 ${platform} ${arch} 的安装包`
      };
    }
    
    // 打开下载链接
    log.info(`打开下载链接: ${downloadUrl}`);
    const { shell } = require('electron');
    await shell.openExternal(downloadUrl);
    
    return {
      success: true,
      message: '已打开下载链接',
      version: updateResult.latestVersion,
      downloadUrl: downloadUrl,
      fileName: fileName
    };
  } catch (error) {
    log.error('下载更新失败:', error);
    return {
      success: false,
      error: `下载更新失败: ${error.message}`
    };
  }
});

// --- Auto Updater Event Listeners ---

// Fired when an update is found
autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info);
  
  // 智能更新策略：检查更新类型
  const currentVersion = app.getVersion();
  const updateType = getUpdateType(currentVersion, info.version);
  
  let message = '';
  let autoDownload = false;
  
  switch (updateType) {
    case 'major':
      message = `发现重要更新 v${info.version}！包含新功能和重要改进。建议立即更新。`;
      autoDownload = false; // 主要更新需要用户确认
      break;
    case 'minor':
      message = `发现功能更新 v${info.version}！添加了新功能。`;
      autoDownload = true; // 功能更新可以自动下载
      break;
    case 'patch':
      message = `发现补丁更新 v${info.version}！修复了一些问题。`;
      autoDownload = true; // 补丁更新自动下载
      break;
  }
  
  if (autoDownload) {
    // 静默下载，不打扰用户
    log.info('自动下载更新:', info.version);
    autoUpdater.downloadUpdate();
    
    // 只在系统托盘显示通知
    if (tray) {
      tray.displayBalloon({
        title: 'PromptMate 更新',
        content: `正在下载 v${info.version}，将在下次启动时安装`,
        icon: path.join(__dirname, '../../public/favicon.ico')
      });
    }
  } else {
    // 检查是否为跳过的版本
    const settings = getSettings();
    if (settings.skippedVersions && settings.skippedVersions.includes(info.version)) {
      log.info('用户已跳过版本:', info.version);
      return;
    }
    
    // 询问用户是否下载
    dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['立即更新', '稍后提醒', '跳过此版本'],
      defaultId: 0,
      title: 'PromptMate 更新',
      message: message,
      detail: '更新将在后台下载，并在下次启动时自动安装。'
    }).then(result => {
      if (result.response === 0) {
        log.info('用户选择立即更新');
        autoUpdater.downloadUpdate();
      } else if (result.response === 1) {
        log.info('用户选择稍后提醒');
        // 30分钟后再次提醒
        setTimeout(() => {
          checkForUpdates();
        }, 30 * 60 * 1000);
      } else {
        log.info('用户跳过此版本');
        // 将此版本加入跳过列表
        const settings = getSettings();
        if (!settings.skippedVersions) {
          settings.skippedVersions = [];
        }
        settings.skippedVersions.push(info.version);
        saveSettings(settings);
      }
    });
  }
});

// Fired when an update is not available
autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available.', info);
  // Optionally notify the user, or just log it
});

// Fired on update download progress
autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
  log.info(log_message);
  // You can send progress to the renderer process if you want to display it
  // mainWindow.webContents.send('update-progress', progressObj);
});

// Fired when an update has been downloaded
autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info);
  
  // 检查是否为自动下载的更新
  const currentVersion = app.getVersion();
  const updateType = getUpdateType(currentVersion, info.version);
  const isAutoUpdate = updateType === 'minor' || updateType === 'patch';
  
  if (isAutoUpdate) {
    // 自动下载的更新，只显示托盘通知
    if (tray) {
      tray.displayBalloon({
        title: 'PromptMate 更新',
        content: `v${info.version} 已下载完成，将在下次启动时自动安装`,
        icon: path.join(__dirname, '../../public/favicon.ico')
      });
    }
    
    // 设置标记，在应用退出时自动安装
    app.once('before-quit', () => {
      autoUpdater.quitAndInstall();
    });
  } else {
    // 用户主动选择的更新，询问是否立即重启
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '更新已下载',
      message: `v${info.version} 已下载完成！`,
      detail: '您可以选择立即重启安装，或稍后在关闭应用时自动安装。',
      buttons: ['立即重启安装', '下次启动时安装'],
      defaultId: 1
    }).then(result => {
      if (result.response === 0) {
        log.info('用户选择立即重启安装');
        autoUpdater.quitAndInstall();
      } else {
        log.info('用户选择下次启动时安装');
        // 设置标记，在应用退出时自动安装
        app.once('before-quit', () => {
          autoUpdater.quitAndInstall();
        });
      }
    });
  }
});

// Fired when there is an error during the update process
autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater:', err);
  dialog.showErrorBox('更新出错', `检查或下载更新时遇到错误: ${err.message}`);
}); 