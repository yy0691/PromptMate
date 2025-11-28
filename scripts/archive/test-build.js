#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 测试构建脚本
class TestBuild {
  constructor() {
    this.packageJsonPath = path.join(__dirname, '../package.json');
    this.packageJson = this.loadPackageJson();
  }

  // 加载package.json
  loadPackageJson() {
    try {
      const content = fs.readFileSync(this.packageJsonPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('读取package.json失败:', error);
      process.exit(1);
    }
  }

  // 检查构建配置
  checkBuildConfig() {
    console.log('🔍 检查构建配置...');
    
    const build = this.packageJson.build;
    if (!build) {
      throw new Error('❌ 未找到build配置');
    }
    
    // 检查基本配置
    console.log('✅ 基本配置检查通过');
    console.log(`   - appId: ${build.appId}`);
    console.log(`   - productName: ${build.productName}`);
    console.log(`   - output: ${build.directories?.output}`);
    
    // 检查Windows配置
    if (build.win) {
      console.log('✅ Windows配置检查通过');
      console.log(`   - sign: ${build.win.sign}`);
      console.log(`   - targets: ${build.win.target?.length || 0} 个目标`);
    }
    
    // 检查macOS配置
    if (build.mac) {
      console.log('✅ macOS配置检查通过');
      console.log(`   - sign: ${build.mac.sign}`);
      console.log(`   - targets: ${build.mac.target?.length || 0} 个目标`);
    }
    
    // 检查文件配置
    if (build.files && build.files.length > 0) {
      console.log('✅ 文件配置检查通过');
      console.log(`   - 包含文件: ${build.files.join(', ')}`);
    }
  }

  // 检查必要文件
  checkRequiredFiles() {
    console.log('🔍 检查必要文件...');
    
    const requiredFiles = [
      'public/favicon.png',
      'public/favicon.ico',
      'public/favicon.icns',
      'src/main/main.cjs',
      'src/main/preload.cjs'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        console.log(`✅ ${file} 存在`);
      } else {
        console.warn(`⚠️  ${file} 不存在`);
      }
    }
  }

  // 测试前端构建
  testFrontendBuild() {
    console.log('🔍 测试前端构建...');
    
    try {
      execSync('npm run build', { stdio: 'inherit' });
      console.log('✅ 前端构建成功');
      
      // 检查构建产物
      const distPath = path.join(__dirname, '../dist');
      const distElectronPath = path.join(__dirname, '../dist-electron');
      
      if (fs.existsSync(distPath)) {
        console.log('✅ dist目录存在');
      }
      
      if (fs.existsSync(distElectronPath)) {
        console.log('✅ dist-electron目录存在');
      }
      
    } catch (error) {
      throw new Error(`❌ 前端构建失败: ${error.message}`);
    }
  }

  // 测试Windows构建
  testWindowsBuild() {
    console.log('🔍 测试Windows构建...');
    
    try {
      execSync('npm run dist:win', { stdio: 'inherit' });
      console.log('✅ Windows构建成功');
      
      // 检查构建产物
      const releasePath = path.join(__dirname, '../release');
      if (fs.existsSync(releasePath)) {
        const files = fs.readdirSync(releasePath);
        console.log(`✅ 找到 ${files.length} 个构建产物`);
        files.forEach(file => {
          console.log(`   - ${file}`);
        });
      }
      
    } catch (error) {
      console.error(`❌ Windows构建失败: ${error.message}`);
      return false;
    }
    
    return true;
  }

  // 测试macOS构建
  testMacOSBuild() {
    console.log('🔍 测试macOS构建...');
    
    const os = require('os').platform();
    if (os !== 'darwin') {
      console.log('⚠️  当前不是macOS系统，跳过macOS构建测试');
      return true;
    }
    
    try {
      execSync('npm run dist:mac', { stdio: 'inherit' });
      console.log('✅ macOS构建成功');
      
      // 检查构建产物
      const releasePath = path.join(__dirname, '../release');
      if (fs.existsSync(releasePath)) {
        const files = fs.readdirSync(releasePath);
        console.log(`✅ 找到 ${files.length} 个构建产物`);
        files.forEach(file => {
          console.log(`   - ${file}`);
        });
      }
      
    } catch (error) {
      console.error(`❌ macOS构建失败: ${error.message}`);
      return false;
    }
    
    return true;
  }

  // 主测试流程
  run() {
    console.log('🚀 开始构建测试...\n');
    
    try {
      // 1. 检查构建配置
      this.checkBuildConfig();
      
      // 2. 检查必要文件
      this.checkRequiredFiles();
      
      // 3. 测试前端构建
      this.testFrontendBuild();
      
      // 4. 测试Windows构建
      const windowsSuccess = this.testWindowsBuild();
      
      // 5. 测试macOS构建
      const macosSuccess = this.testMacOSBuild();
      
      console.log('\n🎉 构建测试完成!');
      console.log(`📋 Windows构建: ${windowsSuccess ? '✅ 成功' : '❌ 失败'}`);
      console.log(`📋 macOS构建: ${macosSuccess ? '✅ 成功' : '❌ 失败'}`);
      
      if (windowsSuccess && macosSuccess) {
        console.log('🎊 所有构建测试通过！');
      } else {
        console.log('⚠️  部分构建测试失败，请检查配置');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('\n❌ 构建测试失败:', error.message);
      process.exit(1);
    }
  }
}

// 命令行参数处理
function main() {
  const testBuild = new TestBuild();
  testBuild.run();
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = TestBuild; 