// 强制更新检查脚本 - 用于调试
const { ipcRenderer } = require('electron');

// 在开发者工具控制台中运行此函数
window.forceUpdateCheck = async function() {
  console.log('🔄 强制检查更新...');
  
  try {
    // 调用主进程的更新检查
    const result = await ipcRenderer.invoke('check-for-updates-enhanced');
    console.log('更新检查结果:', result);
    
    if (result.hasUpdate) {
      console.log('✅ 发现新版本:', result.latestVersion);
      console.log('发布信息:', result.releaseInfo);
    } else {
      console.log('ℹ️ 当前已是最新版本');
    }
  } catch (error) {
    console.error('❌ 更新检查失败:', error);
  }
};

// 模拟不同版本进行测试
window.testVersionComparison = function() {
  console.log('🧪 版本比较测试');
  
  const testCases = [
    { current: '1.0.0', latest: 'v1.1.0', expected: '需要更新' },
    { current: '1.1.0', latest: 'v1.1.0', expected: '版本相同' },
    { current: '1.2.0', latest: 'v1.1.0', expected: '当前更新' },
    { current: '1.1.0', latest: 'v2.0.0', expected: '需要更新' }
  ];
  
  testCases.forEach(test => {
    console.log(`${test.current} vs ${test.latest}: ${test.expected}`);
  });
};

console.log('🛠️ 调试工具已加载');
console.log('使用 forceUpdateCheck() 强制检查更新');
console.log('使用 testVersionComparison() 测试版本比较');
