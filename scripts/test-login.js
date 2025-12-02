/**
 * 登录功能测试工具
 * 用于测试邮箱登录、Google、GitHub、Linuxdo OAuth 登录
 * 
 * 使用方法：
 * 1. 确保后端服务已启动: cd server && npm run dev
 * 2. 确保前端已启动: npm run dev
 * 3. 运行测试: node scripts/test-login.js [provider]
 * 
 * 示例：
 * node scripts/test-login.js email          # 测试邮箱登录
 * node scripts/test-login.js google         # 测试 Google OAuth
 * node scripts/test-login.js github         # 测试 GitHub OAuth
 * node scripts/test-login.js linuxdo        # 测试 Linuxdo OAuth
 * node scripts/test-login.js all            # 测试所有登录方式
 */

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const readline = require('readline');

// 配置
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8787';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PROVIDER = process.argv[2] || 'all';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

// 检查服务连接
function checkConnection(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      resolve(res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// 检查后端 API
async function checkBackend() {
  log('检查后端服务...', 'cyan');
  const isOnline = await checkConnection(`${API_BASE_URL}/api/health`);
  if (isOnline) {
    log('✅ 后端服务运行正常', 'green');
    return true;
  } else {
    log('❌ 后端服务未运行或无法访问', 'red');
    log(`   请确保后端服务已启动: cd server && npm run dev`, 'yellow');
    return false;
  }
}

// 检查前端
async function checkFrontend() {
  log('检查前端服务...', 'cyan');
  const isOnline = await checkConnection(FRONTEND_URL);
  if (isOnline) {
    log('✅ 前端服务运行正常', 'green');
    return true;
  } else {
    log('❌ 前端服务未运行或无法访问', 'red');
    log(`   请确保前端已启动: npm run dev`, 'yellow');
    return false;
  }
}

// 获取 OAuth URL
async function getOAuthUrl(provider, redirectUri) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE_URL}/api/auth/oauth/url?provider=${provider}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.url) {
            resolve(json.url);
          } else {
            reject(new Error('No OAuth URL returned'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// 测试邮箱登录
async function testEmailLogin() {
  logSection('测试邮箱登录');
  
  log('📝 邮箱登录测试步骤：', 'cyan');
  log('1. 打开浏览器访问: ' + FRONTEND_URL, 'yellow');
  log('2. 点击右上角的"登录"按钮', 'yellow');
  log('3. 在登录表单中输入邮箱和密码', 'yellow');
  log('4. 点击"登录"按钮', 'yellow');
  log('5. 检查是否成功登录（右上角显示用户信息）', 'yellow');
  log('\n💡 提示：如果没有账号，请先注册', 'cyan');
  
  // 打开浏览器
  const url = `${FRONTEND_URL}`;
  log(`\n正在打开浏览器: ${url}`, 'cyan');
  openBrowser(url);
}

// 测试 OAuth 登录
async function testOAuthLogin(provider) {
  logSection(`测试 ${provider.toUpperCase()} OAuth 登录`);
  
  try {
    // 检查后端
    if (!(await checkBackend())) {
      return;
    }
    
    // 获取 OAuth URL
    log(`获取 ${provider} OAuth 授权 URL...`, 'cyan');
    const redirectUri = `${FRONTEND_URL}/auth/callback`;
    const oauthUrl = await getOAuthUrl(provider, redirectUri);
    
    log('✅ OAuth URL 获取成功', 'green');
    log(`\n授权 URL: ${oauthUrl}`, 'blue');
    
    log('\n📝 OAuth 登录测试步骤：', 'cyan');
    log('1. 浏览器将自动打开授权页面', 'yellow');
    log('2. 在授权页面登录您的账号', 'yellow');
    log('3. 点击"授权"或"允许"按钮', 'yellow');
    log('4. 自动跳转回应用并完成登录', 'yellow');
    log('5. 检查是否成功登录（右上角显示用户信息）', 'yellow');
    
    // 打开浏览器
    log(`\n正在打开浏览器进行授权...`, 'cyan');
    openBrowser(oauthUrl);
    
    log('\n⏳ 等待授权完成...', 'cyan');
    log('完成后请检查浏览器中的登录状态', 'yellow');
    
  } catch (error) {
    log(`❌ 测试失败: ${error.message}`, 'red');
    if (error.message.includes('timeout')) {
      log('   后端服务可能未启动或响应缓慢', 'yellow');
    } else if (error.message.includes('No OAuth URL')) {
      log('   请检查环境变量配置（客户端 ID 和密钥）', 'yellow');
    }
  }
}

// 打开浏览器
function openBrowser(url) {
  const platform = process.platform;
  let command;
  
  if (platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', url];
  } else if (platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }
  
  spawn(command, args, { detached: true, stdio: 'ignore' });
}

// 主函数
async function main() {
  logSection('PromptMate 登录功能测试工具');
  
  log(`测试模式: ${PROVIDER}`, 'cyan');
  log(`后端地址: ${API_BASE_URL}`, 'cyan');
  log(`前端地址: ${FRONTEND_URL}`, 'cyan');
  
  // 检查服务
  log('\n检查服务状态...', 'cyan');
  const backendOk = await checkBackend();
  const frontendOk = await checkFrontend();
  
  if (!backendOk || !frontendOk) {
    log('\n❌ 服务检查失败，请先启动服务', 'red');
    process.exit(1);
  }
  
  // 执行测试
  if (PROVIDER === 'all') {
    log('\n开始测试所有登录方式...', 'cyan');
    await testEmailLogin();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await testOAuthLogin('google');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await testOAuthLogin('github');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await testOAuthLogin('linuxdo');
  } else if (PROVIDER === 'email') {
    await testEmailLogin();
  } else if (['google', 'github', 'linuxdo'].includes(PROVIDER)) {
    await testOAuthLogin(PROVIDER);
  } else {
    log(`❌ 未知的登录方式: ${PROVIDER}`, 'red');
    log('支持的方式: email, google, github, linuxdo, all', 'yellow');
    process.exit(1);
  }
  
  log('\n✅ 测试工具执行完成', 'green');
  log('请按照提示在浏览器中完成登录测试', 'cyan');
}

// 运行
main().catch((error) => {
  log(`\n❌ 测试工具执行失败: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

