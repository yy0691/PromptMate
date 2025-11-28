#!/usr/bin/env node

/**
 * 更新检查功能测试脚本
 * 用于测试GitHub API调用和版本比较功能
 */

const https = require('https');

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
    console.error('版本比较失败:', error);
    throw new Error(`版本比较失败: ${error.message}`);
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

// 获取GitHub最新发布版本
async function getLatestGitHubRelease() {
  return new Promise((resolve, reject) => {
    const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
    
    console.log(`🔍 正在检查GitHub发布: ${url}`);
    
    // 设置请求超时
    const request = https.get(url, {
      headers: {
        'User-Agent': 'PromptMate-Update-Checker-Test',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 10000 // 10秒超时
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const release = JSON.parse(data);
            
            // 验证版本号格式
            const version = release.tag_name.replace('v', '');
            if (!/^\d+\.\d+\.\d+$/.test(version)) {
              reject(new Error('无效的版本号格式'));
              return;
            }
            
            console.log(`✅ 获取到GitHub发布信息:`);
            console.log(`   版本: ${version}`);
            console.log(`   名称: ${release.name || release.tag_name}`);
            console.log(`   发布时间: ${release.published_at}`);
            console.log(`   发布链接: ${release.html_url}`);
            
            resolve({
              version: version,
              name: release.name || release.tag_name,
              body: release.body || '',
              published_at: release.published_at,
              html_url: release.html_url,
              assets: release.assets || []
            });
          } else if (res.statusCode === 404) {
            reject(new Error('未找到发布版本'));
          } else if (res.statusCode === 403) {
            reject(new Error('GitHub API访问受限，可能达到请求限制'));
          } else {
            reject(new Error(`GitHub API返回状态码: ${res.statusCode}`));
          }
        } catch (error) {
          reject(new Error(`解析GitHub响应失败: ${error.message}`));
        }
      });
    });
    
    // 设置超时处理
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('GitHub API请求超时'));
    });
    
    request.on('error', (error) => {
      reject(new Error(`GitHub API请求失败: ${error.message}`));
    });
  });
}

// 检查更新（增强版）
async function checkForUpdatesEnhanced(currentVersion) {
  try {
    console.log(`🔧 开始检查更新...`);
    console.log(`📦 当前版本: ${currentVersion}`);
    
    // 验证当前版本格式
    if (!/^\d+\.\d+\.\d+$/.test(currentVersion)) {
      console.warn(`⚠️  警告: 当前版本格式无效: ${currentVersion}`);
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
      console.log(`🚀 GitHub最新版本: ${latestRelease.version}`);
    } catch (error) {
      console.error(`❌ 获取GitHub发布信息失败: ${error.message}`);
      return {
        success: false,
        hasUpdate: false,
        error: `获取GitHub发布信息失败: ${error.message}`,
        currentVersion: currentVersion
      };
    }
    
    // 比较版本
    const versionComparison = compareVersions(currentVersion, latestRelease.version);
    console.log(`📊 版本比较结果: ${versionComparison} (当前: ${currentVersion}, 最新: ${latestRelease.version})`);
    
    if (versionComparison < 0) {
      // 有新版本
      const updateType = getUpdateType(currentVersion, latestRelease.version);
      console.log(`🎉 发现新版本: ${latestRelease.version}, 更新类型: ${updateType}`);
      
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
      console.log(`✅ 当前已是最新版本`);
      return {
        success: true,
        hasUpdate: false,
        currentVersion: currentVersion,
        latestVersion: latestRelease.version,
        releaseInfo: latestRelease
      };
    } else {
      // 当前版本比GitHub版本新（可能是开发版本）
      console.log(`🔬 当前版本 ${currentVersion} 比GitHub版本 ${latestRelease.version} 新`);
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
    console.error(`❌ 检查更新失败: ${error.message}`);
    return {
      success: false,
      hasUpdate: false,
      error: error.message,
      currentVersion: currentVersion
    };
  }
}

// 测试版本比较
function testVersionComparison() {
  console.log('\n🧪 测试版本比较功能...');
  
  const testCases = [
    ['1.0.0', '1.0.1'],
    ['1.0.1', '1.0.0'],
    ['1.0.0', '1.0.0'],
    ['1.0.0', '1.1.0'],
    ['1.1.0', '2.0.0'],
    ['2.0.0', '1.9.9'],
    ['1.0.0', 'v1.0.1'],
    ['v1.0.0', '1.0.1']
  ];
  
  testCases.forEach(([v1, v2]) => {
    try {
      const result = compareVersions(v1, v2);
      let comparison = '';
      if (result < 0) comparison = '<';
      else if (result > 0) comparison = '>';
      else comparison = '=';
      
      console.log(`   ${v1} ${comparison} ${v2}`);
    } catch (error) {
      console.log(`   ❌ ${v1} vs ${v2}: ${error.message}`);
    }
  });
}

// 主函数
async function main() {
  console.log('🚀 PromptMate 更新检查测试工具\n');
  
  // 测试版本比较
  testVersionComparison();
  
  // 获取当前版本
  const currentVersion = process.argv[2] || '1.0.14';
  console.log(`\n🔍 测试更新检查 (当前版本: ${currentVersion})...`);
  
  try {
    const result = await checkForUpdatesEnhanced(currentVersion);
    
    console.log('\n📋 更新检查结果:');
    console.log(`   成功: ${result.success}`);
    console.log(`   有更新: ${result.hasUpdate}`);
    
    if (result.success) {
      if (result.hasUpdate) {
        console.log(`   当前版本: ${result.currentVersion}`);
        console.log(`   最新版本: ${result.latestVersion}`);
        console.log(`   更新类型: ${result.updateType}`);
        console.log(`   发布名称: ${result.releaseInfo.name}`);
        console.log(`   发布时间: ${result.releaseInfo.published_at}`);
        console.log(`   发布链接: ${result.releaseInfo.html_url}`);
      } else {
        console.log(`   当前版本: ${result.currentVersion}`);
        console.log(`   最新版本: ${result.latestVersion}`);
        if (result.isDevelopment) {
          console.log(`   💡 当前版本比GitHub版本新，可能是开发版本`);
        }
      }
    } else {
      console.log(`   错误: ${result.error}`);
    }
    
  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  compareVersions,
  getUpdateType,
  getLatestGitHubRelease,
  checkForUpdatesEnhanced
}; 