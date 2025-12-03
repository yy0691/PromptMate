/**
 * 测试所有注册的 API 接口
 * 用法: node scripts/test-all-api.js [baseUrl]
 * 例如: node scripts/test-all-api.js http://localhost:8787
 *       node scripts/test-all-api.js https://prompt.luoyuanai.cn
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// 从 registerRoutes.ts 中提取的路由定义
const routes = [
  // 健康检查和测试端点
  { method: 'GET', path: '/api/health', requireAuth: false },
  { method: 'GET', path: '/api/test', requireAuth: false },
  
  // 认证相关（需要特殊处理，不在这里测试）
  { method: 'POST', path: '/api/auth/register/email', requireAuth: false },
  { method: 'POST', path: '/api/auth/login/email', requireAuth: false },
  { method: 'GET', path: '/api/auth/oauth/url', requireAuth: false, query: { provider: 'google', redirect_uri: 'https://prompt.luoyuanai.cn/auth/callback' } },
  { method: 'POST', path: '/api/auth/oauth/callback', requireAuth: false },
  { method: 'POST', path: '/api/auth/token/refresh', requireAuth: false },
  { method: 'POST', path: '/api/auth/logout', requireAuth: true },
  
  // 用户资料（需要认证）
  { method: 'GET', path: '/api/profile', requireAuth: true },
  { method: 'PATCH', path: '/api/profile', requireAuth: true },
  
  // 提示词管理（需要认证）
  { method: 'GET', path: '/api/prompts', requireAuth: true },
  { method: 'POST', path: '/api/prompts', requireAuth: true },
  { method: 'PATCH', path: '/api/prompts/:id', requireAuth: true, skip: true }, // 跳过，需要 ID
  { method: 'DELETE', path: '/api/prompts/:id', requireAuth: true, skip: true }, // 跳过，需要 ID
  
  // 集合管理（需要认证）
  { method: 'GET', path: '/api/prompt-collections', requireAuth: true },
  { method: 'POST', path: '/api/prompt-collections', requireAuth: true },
  { method: 'PATCH', path: '/api/prompt-collections/:id', requireAuth: true, skip: true }, // 跳过，需要 ID
  { method: 'DELETE', path: '/api/prompt-collections/:id', requireAuth: true, skip: true }, // 跳过，需要 ID
  
  // 同步（需要认证）
  { method: 'GET', path: '/api/sync/pull', requireAuth: true },
  { method: 'POST', path: '/api/sync/push', requireAuth: true },
  
  // 设备心跳（需要认证）
  { method: 'POST', path: '/api/devices/heartbeat', requireAuth: true },
  
  // 安全审计日志
  { method: 'GET', path: '/api/security/audit-logs', requireAuth: false },
  
  // 模板市场
  { method: 'GET', path: '/api/marketplace/prompts', requireAuth: false },
  { method: 'GET', path: '/api/marketplace/prompts/:id', requireAuth: false, skip: true }, // 跳过，需要 ID
  { method: 'POST', path: '/api/marketplace/prompts', requireAuth: true },
  { method: 'PATCH', path: '/api/marketplace/prompts/:id', requireAuth: true, skip: true }, // 跳过，需要 ID
  { method: 'DELETE', path: '/api/marketplace/prompts/:id', requireAuth: true, skip: true }, // 跳过，需要 ID
  { method: 'POST', path: '/api/marketplace/prompts/:id/review', requireAuth: true, skip: true }, // 跳过，需要 ID
  { method: 'POST', path: '/api/marketplace/prompts/:id/download', requireAuth: false, skip: true }, // 跳过，需要 ID
];

// 测试令牌（如果需要）
let testToken = process.env.TEST_TOKEN || '';

function makeRequest(baseUrl, route) {
  return new Promise((resolve, reject) => {
    const url = new URL(route.path, baseUrl);
    
    // 添加查询参数
    if (route.query) {
      Object.entries(route.query).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    
    const options = {
      method: route.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'API-Test-Script/1.0',
      },
    };
    
    // 如果需要认证，添加 Authorization header
    if (route.requireAuth && testToken) {
      options.headers['Authorization'] = `Bearer ${testToken}`;
    }
    
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          body: data,
          route: route.path,
          method: route.method,
        });
      });
    });
    
    req.on('error', (error) => {
      reject({
        error: error.message,
        route: route.path,
        method: route.method,
      });
    });
    
    // 发送请求体（如果需要）
    if (route.method !== 'GET' && route.method !== 'DELETE') {
      const body = route.body || {};
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function testAllRoutes(baseUrl) {
  console.log(`\n🧪 开始测试所有 API 接口`);
  console.log(`📍 基础 URL: ${baseUrl}\n`);
  console.log('='.repeat(80));
  
  const results = {
    success: [],
    failed: [],
    skipped: [],
    errors: [],
  };
  
  for (const route of routes) {
    if (route.skip) {
      results.skipped.push(route);
      console.log(`⏭️  [SKIP] ${route.method.padEnd(6)} ${route.path}`);
      continue;
    }
    
    try {
      const result = await makeRequest(baseUrl, route);
      const status = result.status;
      const statusIcon = status >= 200 && status < 300 ? '✅' : status === 401 ? '🔒' : status === 404 ? '❌' : '⚠️';
      
      console.log(`${statusIcon} [${status.toString().padStart(3)}] ${route.method.padEnd(6)} ${route.path}`);
      
      if (status >= 200 && status < 300) {
        results.success.push(result);
      } else if (status === 401 && route.requireAuth) {
        // 401 对于需要认证的路由是预期的
        results.success.push(result);
        console.log(`    └─ 需要认证（预期行为）`);
      } else if (status === 404) {
        results.failed.push(result);
        console.log(`    └─ ❌ 路由未找到`);
      } else {
        results.failed.push(result);
        console.log(`    └─ ⚠️  状态码: ${status}`);
      }
      
      // 显示响应体（如果很短）
      if (result.body && result.body.length < 200) {
        try {
          const json = JSON.parse(result.body);
          console.log(`    └─ 响应: ${JSON.stringify(json).substring(0, 100)}`);
        } catch (e) {
          console.log(`    └─ 响应: ${result.body.substring(0, 100)}`);
        }
      }
    } catch (error) {
      results.errors.push({ route, error });
      console.log(`❌ [ERR] ${route.method.padEnd(6)} ${route.path}`);
      console.log(`    └─ 错误: ${error.error || error.message}`);
    }
    
    // 添加小延迟，避免请求过快
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 测试结果汇总:');
  console.log(`   ✅ 成功: ${results.success.length}`);
  console.log(`   ❌ 失败: ${results.failed.length}`);
  console.log(`   ⏭️  跳过: ${results.skipped.length}`);
  console.log(`   🔥 错误: ${results.errors.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ 失败的请求:');
    results.failed.forEach(r => {
      console.log(`   ${r.method} ${r.route} - ${r.status} ${r.statusText}`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log('\n🔥 请求错误:');
    results.errors.forEach(({ route, error }) => {
      console.log(`   ${route.method} ${route.path} - ${error.error || error.message}`);
    });
  }
  
  console.log('\n');
  
  return results;
}

// 主函数
const baseUrl = process.argv[2] || 'https://prompt.luoyuanai.cn';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
用法: node scripts/test-all-api.js [baseUrl] [--token=TOKEN]

参数:
  baseUrl     API 基础 URL（默认: https://prompt.luoyuanai.cn）
             例如: http://localhost:8787
                    https://prompt.luoyuanai.cn

环境变量:
  TEST_TOKEN  测试用的认证令牌（可选）

示例:
  node scripts/test-all-api.js
  node scripts/test-all-api.js http://localhost:8787
  node scripts/test-all-api.js https://prompt.luoyuanai.cn
  TEST_TOKEN=your_token node scripts/test-all-api.js
  `);
  process.exit(0);
}

// 从命令行参数中提取 token
const tokenArg = process.argv.find(arg => arg.startsWith('--token='));
if (tokenArg) {
  testToken = tokenArg.split('=')[1];
}

testAllRoutes(baseUrl)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('测试失败:', error);
    process.exit(1);
  });

