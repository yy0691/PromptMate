// 验证更新检查修复的测试脚本
console.log('🔧 验证更新检查功能修复...\n');

// 模拟前端检查逻辑
function simulateFrontendCheck() {
  console.log('1. 模拟前端检查 window.electronAPI...');
  
  // 模拟 electronAPI 对象
  const mockElectronAPI = {
    checkForUpdates: () => Promise.resolve({
      success: true,
      hasUpdate: false,
      currentVersion: '1.1.0',
      latestVersion: 'v1.1.0'
    }),
    getAppInfo: () => Promise.resolve({
      version: '1.1.0',
      name: 'PromptMate'
    })
  };
  
  // 检查 checkForUpdates 是否为函数
  if (typeof mockElectronAPI.checkForUpdates === 'function') {
    console.log('   ✅ checkForUpdates 方法可用');
  } else {
    console.log('   ❌ checkForUpdates 方法不可用');
    return false;
  }
  
  // 检查 getAppInfo 是否为函数
  if (typeof mockElectronAPI.getAppInfo === 'function') {
    console.log('   ✅ getAppInfo 方法可用');
  } else {
    console.log('   ❌ getAppInfo 方法不可用');
    return false;
  }
  
  return true;
}

// 验证 preload.js 修复
function verifyPreloadFix() {
  console.log('2. 验证 preload.js 修复...');
  
  const fs = require('fs');
  const path = require('path');
  
  try {
    const preloadPath = path.join(__dirname, '..', 'src', 'main', 'preload.cjs');
    const preloadContent = fs.readFileSync(preloadPath, 'utf8');
    
    // 检查是否包含 checkForUpdates
    if (preloadContent.includes('checkForUpdates: () => ipcRenderer.invoke(\'check-for-updates\')')) {
      console.log('   ✅ checkForUpdates 方法已正确暴露');
    } else {
      console.log('   ❌ checkForUpdates 方法未正确暴露');
      return false;
    }
    
    // 检查是否包含 getAppInfo
    if (preloadContent.includes('getAppInfo: () => ipcRenderer.invoke(\'get-app-info\')')) {
      console.log('   ✅ getAppInfo 方法已正确暴露');
    } else {
      console.log('   ❌ getAppInfo 方法未正确暴露');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log('   ❌ 读取 preload.js 文件失败:', error.message);
    return false;
  }
}

// 验证主进程 IPC 处理器
function verifyMainProcessHandlers() {
  console.log('3. 验证主进程 IPC 处理器...');
  
  const fs = require('fs');
  const path = require('path');
  
  try {
    const mainPath = path.join(__dirname, '..', 'src', 'main', 'main.cjs');
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    
    // 检查 check-for-updates 处理器
    if (mainContent.includes('ipcMain.handle(\'check-for-updates\'')) {
      console.log('   ✅ check-for-updates IPC 处理器存在');
    } else {
      console.log('   ❌ check-for-updates IPC 处理器缺失');
      return false;
    }
    
    // 检查 get-app-info 处理器
    if (mainContent.includes('ipcMain.handle(\'get-app-info\'')) {
      console.log('   ✅ get-app-info IPC 处理器存在');
    } else {
      console.log('   ❌ get-app-info IPC 处理器缺失');
      return false;
    }
    
    // 检查 checkForUpdatesEnhanced 函数
    if (mainContent.includes('async function checkForUpdatesEnhanced()')) {
      console.log('   ✅ checkForUpdatesEnhanced 函数存在');
    } else {
      console.log('   ❌ checkForUpdatesEnhanced 函数缺失');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log('   ❌ 读取 main.cjs 文件失败:', error.message);
    return false;
  }
}

// 运行所有验证
async function runVerification() {
  const results = [
    simulateFrontendCheck(),
    verifyPreloadFix(),
    verifyMainProcessHandlers()
  ];
  
  const allPassed = results.every(result => result === true);
  
  console.log('\n📋 验证结果:');
  if (allPassed) {
    console.log('🎉 所有检查通过！更新检查功能应该可以正常工作了。');
    console.log('\n📝 修复总结:');
    console.log('- ✅ 在 preload.js 中添加了 checkForUpdates 和 getAppInfo 方法');
    console.log('- ✅ 主进程中的 IPC 处理器完整');
    console.log('- ✅ 增强版更新检查函数存在');
    console.log('\n🚀 请重启应用测试更新检查功能');
  } else {
    console.log('❌ 部分检查失败，请检查上述错误信息');
  }
}

runVerification();
