const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 开始测试构建的应用...');

// 检查构建文件是否存在
const exePath = path.join(__dirname, '../release/PromptMate-1.0.11-x64.exe');
const unpackedPath = path.join(__dirname, '../release/win-unpacked/PromptMate.exe');

console.log('📁 检查构建文件...');
console.log('EXE文件路径:', exePath);
console.log('EXE文件存在:', fs.existsSync(exePath));

console.log('📦 解压目录路径:', unpackedPath);
console.log('解压目录存在:', fs.existsSync(unpackedPath));

// 检查dist目录
const distPath = path.join(__dirname, '../dist');
console.log('📂 dist目录存在:', fs.existsSync(distPath));
if (fs.existsSync(distPath)) {
  console.log('dist目录内容:', fs.readdirSync(distPath));
  
  const assetsPath = path.join(distPath, 'assets');
  if (fs.existsSync(assetsPath)) {
    console.log('assets目录内容:', fs.readdirSync(assetsPath));
  }
}

// 检查dist-electron目录
const distElectronPath = path.join(__dirname, '../dist-electron');
console.log('🔧 dist-electron目录存在:', fs.existsSync(distElectronPath));
if (fs.existsSync(distElectronPath)) {
  console.log('dist-electron目录内容:', fs.readdirSync(distElectronPath));
  
  const mainPath = path.join(distElectronPath, 'main');
  if (fs.existsSync(mainPath)) {
    console.log('main目录内容:', fs.readdirSync(mainPath));
  }
}

console.log('\n✅ 文件检查完成');
console.log('\n💡 建议:');
console.log('1. 运行应用: start release\\PromptMate-1.0.11-x64.exe');
console.log('2. 检查控制台输出是否有错误信息');
console.log('3. 如果仍有问题，可以临时启用开发者工具进行调试'); 