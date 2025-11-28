/**
 * OAuth 登录测试工具
 * 用于测试 Google、GitHub、LinuxDo 等 OAuth 提供商的登录功能
 * 
 * 使用方法：
 * 1. 确保后端服务已启动: cd server && npm run dev
 * 2. 确保前端已启动: npm run dev
 * 3. 运行测试: node scripts/test-oauth.js [provider]
 * 
 * 示例：
 * node scripts/test-oauth.js google
 * node scripts/test-oauth.js github
 * node scripts/test-oauth.js linuxdo
 */

const https = require('https');
const http = require('http');
const { spawn } = require('child_process');

// 配置
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8787';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PROVIDER = process.argv[2] || 'google';

console.log('='.repeat(60));
console.log('PromptMate OAuth 登录测试工具');
console.log('='.repeat(60));
console.log(`API 地址: ${API_BASE_URL}`);
console.log(`前端地址: ${FRONTEND_URL}`);
console.log(`测试提供商: ${PROVIDER}`);
console.log('='.repeat(60));

/**
 * 测试后端连接
 */
async function testBackendConnection() {
  console.log('\n[1/5] 测试后端连接...');
  
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE_URL);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request({
      hostname: url.hostname,
      port: url.port,
      path: '/api/auth/oauth/url?provider=' + PROVIDER + '&redirect_uri=' + encodeURIComponent(FRONTEND_URL + '/auth/callback'),
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✓ 后端连接成功');
          try {
            const json = JSON.parse(data);
            console.log('✓ OAuth URL 获取成功');
            console.log('  URL:', json.url);
            resolve(json.url);
          } catch (error) {
            console.error('✗ 解析响应失败:', error.message);
            reject(error);
          }
        } else {
          console.error('✗ 后端返回错误:', res.statusCode);
          console.error('  响应:', data);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('✗ 后端连接失败:', error.message);
      console.error('\n请确保后端服务已启动:');
      console.error('  cd server && npm run dev');
      reject(error);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    
    req.end();
  });
}

/**
 * 测试前端连接
 */
async function testFrontendConnection() {
  console.log('\n[2/5] 测试前端连接...');
  
  return new Promise((resolve, reject) => {
    const url = new URL(FRONTEND_URL);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request({
      hostname: url.hostname,
      port: url.port,
      path: '/',
      method: 'GET'
    }, (res) => {
      if (res.statusCode === 200) {
        console.log('✓ 前端连接成功');
        resolve();
      } else {
        console.error('✗ 前端返回错误:', res.statusCode);
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    });
    
    req.on('error', (error) => {
      console.error('✗ 前端连接失败:', error.message);
      console.error('\n请确保前端已启动:');
      console.error('  npm run dev');
      reject(error);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    
    req.end();
  });
}

/**
 * 检查环境配置
 */
function checkEnvironmentConfig() {
  console.log('\n[3/5] 检查环境配置...');
  
  const fs = require('fs');
  const path = require('path');
  
  // 检查后端环境配置
  const serverEnvPath = path.join(__dirname, '../server/.env');
  if (!fs.existsSync(serverEnvPath)) {
    console.warn('⚠ 后端环境配置文件不存在: server/.env');
    console.warn('  请复制 server/env.template 为 server/.env 并配置');
    return false;
  } else {
    console.log('✓ 后端环境配置文件存在');
  }
  
  // 检查前端环境配置
  const frontendEnvPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(frontendEnvPath)) {
    console.warn('⚠ 前端环境配置文件不存在: .env.local');
    console.warn('  请复制 env.template 为 .env.local 并配置');
    return false;
  } else {
    console.log('✓ 前端环境配置文件存在');
  }
  
  return true;
}

/**
 * 打印测试说明
 */
function printTestInstructions(oauthUrl) {
  console.log('\n[4/5] OAuth 登录测试步骤:');
  console.log('─'.repeat(60));
  console.log('1. 在浏览器中打开前端页面:');
  console.log(`   ${FRONTEND_URL}`);
  console.log('');
  console.log('2. 点击登录按钮，选择 ' + PROVIDER.toUpperCase() + ' 登录');
  console.log('');
  console.log('3. 或者直接访问 OAuth 授权 URL:');
  console.log(`   ${oauthUrl}`);
  console.log('');
  console.log('4. 完成授权后，应该会重定向到:');
  console.log(`   ${FRONTEND_URL}/auth/callback?code=...`);
  console.log('');
  console.log('5. 检查浏览器控制台和网络请求，确认登录成功');
  console.log('─'.repeat(60));
}

/**
 * 自动打开浏览器
 */
function openBrowser(url) {
  console.log('\n[5/5] 打开浏览器...');
  
  const platform = process.platform;
  let command;
  
  if (platform === 'win32') {
    command = 'start';
  } else if (platform === 'darwin') {
    command = 'open';
  } else {
    command = 'xdg-open';
  }
  
  try {
    spawn(command, [url], { shell: true, detached: true });
    console.log('✓ 浏览器已打开');
  } catch (error) {
    console.error('✗ 无法自动打开浏览器:', error.message);
    console.log('请手动打开:', url);
  }
}

/**
 * 主测试流程
 */
async function main() {
  try {
    // 检查环境配置
    const configOk = checkEnvironmentConfig();
    if (!configOk) {
      console.log('\n⚠ 环境配置不完整，测试可能失败');
      console.log('按 Ctrl+C 退出，或等待 5 秒继续...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // 测试后端连接
    const oauthUrl = await testBackendConnection();
    
    // 测试前端连接
    await testFrontendConnection();
    
    // 打印测试说明
    printTestInstructions(oauthUrl);
    
    // 询问是否打开浏览器
    console.log('\n是否自动打开浏览器进行测试？(将在 3 秒后自动打开)');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 打开浏览器
    openBrowser(FRONTEND_URL);
    
    console.log('\n' + '='.repeat(60));
    console.log('测试准备完成！请在浏览器中完成 OAuth 登录流程');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n✗ 测试失败:', error.message);
    console.log('\n故障排查建议:');
    console.log('1. 确保后端服务已启动: cd server && npm run dev');
    console.log('2. 确保前端已启动: npm run dev');
    console.log('3. 检查环境配置文件是否正确配置');
    console.log('4. 检查 Supabase 配置是否正确');
    console.log('5. 检查网络连接');
    process.exit(1);
  }
}

// 运行测试
main();


