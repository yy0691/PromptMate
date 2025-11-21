#!/usr/bin/env node

/**
 * PromptMate 浏览器扩展自动化发布脚本
 * 用于自动化构建、打包和发布流程
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function execCommand(command, description) {
  log(`${description}...`, 'blue');
  try {
    execSync(command, { stdio: 'inherit', cwd: __dirname + '/..' });
    log(`✅ ${description}完成`, 'green');
  } catch (error) {
    log(`❌ ${description}失败`, 'red');
    process.exit(1);
  }
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    log(`❌ 读取文件失败: ${filePath}`, 'red');
    process.exit(1);
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    log(`✅ 更新文件: ${filePath}`, 'green');
  } catch (error) {
    log(`❌ 写入文件失败: ${filePath}`, 'red');
    process.exit(1);
  }
}

function updateVersion(type = 'patch') {
  log('🔄 更新版本号...', 'yellow');
  
  // 读取 package.json
  const packagePath = path.join(__dirname, '..', 'package.json');
  const manifestPath = path.join(__dirname, '..', 'manifest.json');
  
  const packageJson = readJsonFile(packagePath);
  const manifest = readJsonFile(manifestPath);
  
  // 解析当前版本
  const currentVersion = packageJson.version;
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  let newVersion;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
  
  // 更新版本号
  packageJson.version = newVersion;
  manifest.version = newVersion;
  
  writeJsonFile(packagePath, packageJson);
  writeJsonFile(manifestPath, manifest);
  
  log(`📈 版本更新: ${currentVersion} → ${newVersion}`, 'cyan');
  return newVersion;
}

function validateBuild() {
  log('🔍 验证构建结果...', 'yellow');
  
  const requiredFiles = [
    'dist/manifest.json',
    'dist/background.js',
    'dist/content.js',
    'dist/popup.html',
    'dist/popup.js',
    'dist/sidepanel.html',
    'dist/sidepanel.js',
    'dist/options.html',
    'dist/options.js',
    'dist/icons/icon-16.png',
    'dist/icons/icon-32.png',
    'dist/icons/icon-48.png',
    'dist/icons/icon-128.png',
    'dist/_locales/zh_CN/messages.json',
    'dist/_locales/en/messages.json'
  ];
  
  const missingFiles = [];
  
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    log('❌ 构建验证失败，缺少以下文件:', 'red');
    missingFiles.forEach(file => log(`  - ${file}`, 'red'));
    process.exit(1);
  }
  
  log('✅ 构建验证通过', 'green');
}

function generateBuildInfo() {
  log('📋 生成构建信息...', 'yellow');
  
  const packageJson = readJsonFile(path.join(__dirname, '..', 'package.json'));
  const buildInfo = {
    version: packageJson.version,
    buildTime: new Date().toISOString(),
    buildType: 'production',
    platform: 'browser-extension',
    files: []
  };
  
  // 获取dist目录文件列表
  function getFiles(dir, relativePath = '') {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const relativeFilePath = path.join(relativePath, file);
      
      if (fs.statSync(fullPath).isDirectory()) {
        getFiles(fullPath, relativeFilePath);
      } else {
        const stats = fs.statSync(fullPath);
        buildInfo.files.push({
          path: relativeFilePath.replace(/\\/g, '/'),
          size: stats.size,
          modified: stats.mtime.toISOString()
        });
      }
    });
  }
  
  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    getFiles(distPath);
  }
  
  // 保存构建信息
  const buildInfoPath = path.join(__dirname, '..', 'dist', 'build-info.json');
  writeJsonFile(buildInfoPath, buildInfo);
  
  log(`✅ 构建信息已保存到 build-info.json`, 'green');
  
  // 显示构建统计
  const totalSize = buildInfo.files.reduce((sum, file) => sum + file.size, 0);
  log(`📊 构建统计:`, 'cyan');
  log(`  - 文件数量: ${buildInfo.files.length}`, 'cyan');
  log(`  - 总大小: ${(totalSize / 1024).toFixed(2)} KB`, 'cyan');
  log(`  - 版本: ${buildInfo.version}`, 'cyan');
}

function createZip() {
  log('📦 创建ZIP包...', 'yellow');
  
  const packageJson = readJsonFile(path.join(__dirname, '..', 'package.json'));
  const version = packageJson.version;
  const zipName = `promptmate-extension-v${version}.zip`;
  
  // 删除旧的zip文件
  const oldZipPath = path.join(__dirname, '..', 'promptmate-extension.zip');
  if (fs.existsSync(oldZipPath)) {
    fs.unlinkSync(oldZipPath);
  }
  
  // 创建新的zip文件
  try {
    execSync(`powershell Compress-Archive -Path dist/* -DestinationPath ${zipName} -Force`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    log(`✅ ZIP包创建成功: ${zipName}`, 'green');
  } catch (error) {
    log('❌ ZIP包创建失败', 'red');
    process.exit(1);
  }
  
  // 显示文件大小
  const zipPath = path.join(__dirname, '..', zipName);
  if (fs.existsSync(zipPath)) {
    const stats = fs.statSync(zipPath);
    log(`📁 ZIP文件大小: ${(stats.size / 1024).toFixed(2)} KB`, 'cyan');
  }
  
  return zipName;
}

function showSummary(version, zipName) {
  log('\n🎉 发布准备完成!', 'green');
  log('='.repeat(50), 'cyan');
  log(`📦 扩展版本: ${version}`, 'cyan');
  log(`📁 打包文件: ${zipName}`, 'cyan');
  log(`📂 构建目录: dist/`, 'cyan');
  log('='.repeat(50), 'cyan');
  
  log('\n📋 下一步操作:', 'yellow');
  log('1. 测试扩展功能:', 'white');
  log('   - 打开 chrome://extensions/', 'white');
  log('   - 启用开发者模式', 'white');
  log('   - 加载 dist/ 文件夹', 'white');
  
  log('\n2. 发布到 Chrome Web Store:', 'white');
  log('   - 访问 Chrome Web Store 开发者控制台', 'white');
  log('   - 上传 ' + zipName, 'white');
  log('   - 填写发布信息并提交审核', 'white');
  
  log('\n3. 备份发布文件:', 'white');
  log('   - 将 ' + zipName + ' 保存到发布目录', 'white');
  log('   - 更新版本管理记录', 'white');
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const versionType = args[0] || 'patch';
  
  log('🚀 开始构建 PromptMate 浏览器扩展...', 'magenta');
  log(`📝 版本类型: ${versionType}`, 'cyan');
  
  try {
    // 1. 更新版本号
    const newVersion = updateVersion(versionType);
    
    // 2. 清理旧文件
    execCommand('npm run clean', '清理旧文件');
    
    // 3. 构建项目
    execCommand('npm run build', '构建项目');
    
    // 4. 验证构建
    validateBuild();
    
    // 5. 生成构建信息
    generateBuildInfo();
    
    // 6. 创建ZIP包
    const zipName = createZip();
    
    // 7. 显示总结
    showSummary(newVersion, zipName);
    
  } catch (error) {
    log(`❌ 发布过程失败: ${error.message}`, 'red');
    process.exit(1);
  }
}

// 处理命令行参数
if (require.main === module) {
  main();
}

module.exports = {
  updateVersion,
  validateBuild,
  generateBuildInfo,
  createZip
};












