const https = require('https');

// 模拟增强版更新检查功能
async function testEnhancedUpdateCheck() {
  console.log('🔧 测试增强版更新检查功能...\n');
  
  const currentVersion = '1.1.0';
  console.log(`当前版本: ${currentVersion}`);
  
  try {
    // 测试GitHub API连接（带重试机制）
    console.log('正在获取GitHub最新发布信息...');
    const latestRelease = await getLatestGitHubReleaseWithRetry();
    
    console.log('✅ 成功获取GitHub发布信息');
    console.log(`最新版本: ${latestRelease.version}`);
    console.log(`发布时间: ${latestRelease.publishedAt}`);
    
    // 版本比较
    const versionComparison = compareVersions(currentVersion, latestRelease.version);
    console.log(`\n📊 版本比较结果: ${versionComparison}`);
    
    if (versionComparison < 0) {
      console.log('🆕 发现新版本可用');
      console.log(`   当前: ${currentVersion}`);
      console.log(`   最新: ${latestRelease.version}`);
      return {
        success: true,
        hasUpdate: true,
        currentVersion: currentVersion,
        latestVersion: latestRelease.version,
        releaseInfo: latestRelease
      };
    } else if (versionComparison === 0) {
      console.log('✅ 当前已是最新版本');
      return {
        success: true,
        hasUpdate: false,
        currentVersion: currentVersion,
        latestVersion: latestRelease.version,
        releaseInfo: latestRelease
      };
    } else {
      console.log('⚠️  当前版本比发布版本更新（开发版本）');
      return {
        success: true,
        hasUpdate: false,
        currentVersion: currentVersion,
        latestVersion: latestRelease.version,
        isDevelopment: true
      };
    }
    
  } catch (error) {
    console.log('❌ 更新检查失败:', error.message);
    
    // 提供详细的错误处理
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
    }
    
    console.log('\n🛠️  错误详情:');
    console.log(`   ${errorMessage}`);
    console.log('\n💡 解决建议:');
    troubleshooting.forEach((tip, index) => {
      console.log(`   ${index + 1}. ${tip}`);
    });
    console.log(`\n🌐 手动检查: https://github.com/yy0691/PromptMate/releases/latest`);
    
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
}

// 带重试机制的GitHub API调用
async function getLatestGitHubReleaseWithRetry(retryCount = 3) {
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`   尝试第 ${attempt} 次...`);
      
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
        
        // 20秒超时
        request.setTimeout(20000, () => {
          request.destroy();
          reject(new Error('GitHub API请求超时'));
        });
        
        request.on('error', (error) => {
          reject(new Error(`GitHub API请求失败: ${error.message}`));
        });
        
        request.end();
      });
      
      console.log(`   ✅ 第 ${attempt} 次尝试成功`);
      return result;
      
    } catch (error) {
      console.log(`   ❌ 第 ${attempt} 次尝试失败: ${error.message}`);
      
      if (attempt === retryCount) {
        throw new Error(`经过${retryCount}次重试后仍然失败: ${error.message}`);
      }
      
      // 等待后重试
      const waitTime = 2000 * attempt;
      console.log(`   ⏳ 等待 ${waitTime/1000} 秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// 版本比较函数
function compareVersions(version1, version2) {
  const v1 = version1.replace(/^v/, '').split('.').map(Number);
  const v2 = version2.replace(/^v/, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const v1Part = v1[i] || 0;
    const v2Part = v2[i] || 0;
    
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  
  return 0;
}

// 运行测试
testEnhancedUpdateCheck()
  .then(result => {
    console.log('\n📋 测试结果:');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('\n💥 测试异常:', error);
  });
