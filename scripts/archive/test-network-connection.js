const https = require('https');

// 测试网络连接和GitHub API访问
async function testNetworkConnection() {
  console.log('🌐 测试网络连接和GitHub API访问...\n');
  
  // 测试1: 基本网络连接
  console.log('1. 测试基本网络连接...');
  try {
    await testBasicConnection();
    console.log('✅ 基本网络连接正常\n');
  } catch (error) {
    console.log('❌ 基本网络连接失败:', error.message);
    return;
  }
  
  // 测试2: GitHub API访问
  console.log('2. 测试GitHub API访问...');
  try {
    const result = await testGitHubAPI();
    console.log('✅ GitHub API访问正常');
    console.log(`   最新版本: ${result.tag_name}`);
    console.log(`   发布时间: ${result.published_at}\n`);
  } catch (error) {
    console.log('❌ GitHub API访问失败:', error.message);
    console.log('   可能原因:');
    console.log('   - 网络防火墙阻止');
    console.log('   - 代理设置问题');
    console.log('   - DNS解析失败');
    console.log('   - GitHub服务暂时不可用\n');
  }
  
  // 测试3: 不同的网络超时设置
  console.log('3. 测试不同超时设置...');
  const timeouts = [5000, 10000, 20000];
  
  for (const timeout of timeouts) {
    try {
      console.log(`   测试 ${timeout/1000}秒 超时...`);
      await testGitHubAPIWithTimeout(timeout);
      console.log(`   ✅ ${timeout/1000}秒 超时成功`);
      break;
    } catch (error) {
      console.log(`   ❌ ${timeout/1000}秒 超时失败: ${error.message}`);
    }
  }
}

// 基本网络连接测试
function testBasicConnection() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'www.google.com',
      path: '/',
      method: 'HEAD',
      timeout: 5000
    }, (res) => {
      resolve(res.statusCode);
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('连接超时'));
    });
    
    req.end();
  });
}

// GitHub API测试
function testGitHubAPI() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/yy0691/PromptMate/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'PromptMate-UpdateChecker'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        } catch (error) {
          reject(new Error(`解析响应失败: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.end();
  });
}

// 带自定义超时的GitHub API测试
function testGitHubAPIWithTimeout(timeout) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/yy0691/PromptMate/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'PromptMate-UpdateChecker'
      },
      timeout: timeout
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        } catch (error) {
          reject(new Error('解析失败'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('超时'));
    });

    req.end();
  });
}

// 运行测试
testNetworkConnection().catch(console.error);
