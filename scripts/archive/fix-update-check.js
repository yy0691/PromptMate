// 修复更新检查功能的脚本
const https = require('https');

// 简单的更新检查测试
async function testUpdateCheck() {
  console.log('🔧 测试更新检查功能...\n');
  
  try {
    // 测试GitHub API连接
    const release = await getGitHubRelease();
    console.log('✅ GitHub API连接正常');
    console.log(`   最新版本: ${release.tag_name}`);
    console.log(`   发布时间: ${release.published_at}`);
    
    // 模拟版本比较
    const currentVersion = '1.1.0';
    const latestVersion = release.tag_name.replace('v', '');
    
    console.log(`\n📊 版本比较:`);
    console.log(`   当前版本: ${currentVersion}`);
    console.log(`   最新版本: ${latestVersion}`);
    
    if (currentVersion === latestVersion) {
      console.log('   ✅ 当前已是最新版本');
    } else {
      console.log('   🆕 发现新版本');
    }
    
    console.log('\n🎉 更新检查功能正常工作');
    
  } catch (error) {
    console.log('❌ 更新检查失败:', error.message);
    console.log('\n🛠️  可能的解决方案:');
    console.log('1. 检查网络连接');
    console.log('2. 确认防火墙设置');
    console.log('3. 检查代理配置');
    console.log('4. 稍后重试');
  }
}

// 获取GitHub发布信息
function getGitHubRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/yy0691/PromptMate/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'PromptMate-UpdateChecker'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
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

    req.on('error', (error) => {
      reject(new Error(`请求失败: ${error.message}`));
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.end();
  });
}

// 运行测试
testUpdateCheck();
