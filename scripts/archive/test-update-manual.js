const { app } = require('electron');
const https = require('https');

// 模拟版本比较测试
function compareVersions(current, latest) {
  const parseVersion = (version) => {
    return version.replace(/^v/, '').split('.').map(num => parseInt(num, 10));
  };
  
  const currentParts = parseVersion(current);
  const latestParts = parseVersion(latest);
  
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;
    
    if (currentPart < latestPart) return -1;
    if (currentPart > latestPart) return 1;
  }
  
  return 0;
}

// 获取 GitHub 最新发布版本
async function getLatestGitHubRelease() {
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
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          resolve({
            version: release.tag_name,
            name: release.name,
            body: release.body,
            publishedAt: release.published_at,
            downloadUrl: release.assets[0]?.browser_download_url
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 手动测试更新检查
async function testUpdateCheck() {
  console.log('=== PromptMate 更新检查测试 ===\n');
  
  // 测试当前版本获取
  const currentVersion = '1.1.0'; // 模拟当前版本
  console.log(`当前版本: ${currentVersion}`);
  
  try {
    // 获取最新发布版本
    console.log('正在检查 GitHub 最新发布版本...');
    const latestRelease = await getLatestGitHubRelease();
    console.log(`最新版本: ${latestRelease.version}`);
    console.log(`发布时间: ${latestRelease.publishedAt}`);
    
    // 版本比较
    const comparison = compareVersions(currentVersion, latestRelease.version);
    console.log(`\n版本比较结果: ${comparison}`);
    
    if (comparison < 0) {
      console.log('✅ 发现新版本可用');
      console.log(`新版本: ${latestRelease.version}`);
      console.log(`发布说明: ${latestRelease.body?.substring(0, 200)}...`);
    } else if (comparison === 0) {
      console.log('ℹ️  当前已是最新版本');
    } else {
      console.log('⚠️  当前版本比发布版本更新');
    }
    
    // 测试不同版本场景
    console.log('\n=== 版本比较测试 ===');
    const testCases = [
      ['1.0.0', '1.1.0'],
      ['1.1.0', '1.1.0'],
      ['1.1.0', '1.0.0'],
      ['1.1.0', '1.2.0'],
      ['1.1.0', '2.0.0']
    ];
    
    testCases.forEach(([current, latest]) => {
      const result = compareVersions(current, latest);
      const status = result < 0 ? '需要更新' : result === 0 ? '版本相同' : '当前更新';
      console.log(`${current} vs ${latest}: ${result} (${status})`);
    });
    
  } catch (error) {
    console.error('更新检查失败:', error.message);
  }
}

// 运行测试
testUpdateCheck();
