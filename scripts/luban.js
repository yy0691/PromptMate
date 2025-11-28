#!/usr/bin/env node
/**
 * Luban - 项目整理工具
 * 用于整理项目中散乱的文档、测试脚本和临时文件
 */

const fs = require('fs');
const path = require('path');

// 文档分类规则
const DOC_CATEGORIES = {
  // 根目录临时文档 -> @docs/archive
  archive: [
    'CLAUDE.local.md',
    'FIX-ELECTRON-RENDERER-EVENTS.md',
    'AUTH_SETUP.md',
    'CLOUD_STORAGE_IMPLEMENTATION.md',
    'PROMPTX-README.md',
    'PROMPTX-SHOWCASE.md',
    'PROMPTX-PROJECT-SUMMARY.md',
    'PROMPTX-FINAL-DECLARATION.md',
    'PROMPTX-FILES-INDEX.md',
    'PROMPTX-DELIVERY.md',
    'PROMPTX-COMPLETION-CERTIFICATE.md',
    'README-PromptX.md',
    'QUICK-START.md',
  ],
  // 问题修复记录 -> @docs/fixes
  fixes: [
    /修复.*\.md$/,
    /Fix.*\.md$/i,
    /FIX-.*\.md$/,
  ],
  // 功能实现总结 -> @docs/features
  features: [
    /功能实现总结\.md$/,
    /功能使用指南\.md$/,
    /功能快速开始\.md$/,
    /CLOUD_STORAGE.*\.md$/i,
    /OAuth.*\.md$/i,
  ],
  // 部署相关 -> @docs/deployment
  deployment: [
    /部署.*\.md$/,
    /Vercel.*\.md$/i,
  ],
};

// 目标目录结构
const TARGET_DIRS = {
  archive: '@docs/archive',
  fixes: '@docs/fixes',
  features: '@docs/features',
  deployment: '@docs/deployment',
  dev: '@docs/dev',
  docs: 'docs',
};

/**
 * 确保目录存在
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✓ 创建目录: ${dirPath}`);
  }
}

/**
 * 检查文件是否匹配规则
 */
function matchesRule(filename, rules) {
  return rules.some(rule => {
    if (typeof rule === 'string') {
      return filename === rule;
    }
    if (rule instanceof RegExp) {
      return rule.test(filename);
    }
    return false;
  });
}

/**
 * 分类文件
 */
function categorizeFile(filename) {
  // 检查精确匹配
  for (const [category, rules] of Object.entries(DOC_CATEGORIES)) {
    if (matchesRule(filename, rules)) {
      return category;
    }
  }
  
  // 默认归档
  return 'archive';
}

/**
 * 移动文件
 */
function moveFile(srcPath, destDir, filename) {
  const destPath = path.join(destDir, filename);
  
  // 如果目标文件已存在，添加时间戳
  if (fs.existsSync(destPath)) {
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const newFilename = `${name}_${timestamp}${ext}`;
    const newDestPath = path.join(destDir, newFilename);
    fs.renameSync(srcPath, newDestPath);
    console.log(`  → ${newFilename} (已存在，重命名)`);
    return newDestPath;
  }
  
  fs.renameSync(srcPath, destPath);
  console.log(`  → ${filename}`);
  return destPath;
}

/**
 * 整理根目录的文档
 */
function organizeRootDocs() {
  const rootDir = path.resolve(__dirname, '..');
  const files = fs.readdirSync(rootDir);
  const movedFiles = [];
  
  console.log('\n📁 整理根目录文档...\n');
  
  files.forEach(file => {
    if (!file.endsWith('.md')) return;
    if (file === 'README.md' || file === 'CHANGELOG.md' || file === 'LICENSE') return;
    
    const filePath = path.join(rootDir, file);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return;
    
    const category = categorizeFile(file);
    const targetDir = path.join(rootDir, TARGET_DIRS[category] || TARGET_DIRS.archive);
    
    ensureDir(targetDir);
    
    console.log(`📄 ${file}`);
    const newPath = moveFile(filePath, targetDir, file);
    movedFiles.push({ original: file, new: newPath, category });
  });
  
  return movedFiles;
}

/**
 * 整理 @docs 目录内的文档
 */
function organizeAtDocs() {
  const rootDir = path.resolve(__dirname, '..');
  const atDocsDir = path.join(rootDir, '@docs');
  
  if (!fs.existsSync(atDocsDir)) {
    console.log('\n⚠️  @docs 目录不存在，跳过\n');
    return [];
  }
  
  const files = fs.readdirSync(atDocsDir);
  const movedFiles = [];
  
  console.log('\n📁 整理 @docs 目录文档...\n');
  
  files.forEach(file => {
    if (!file.endsWith('.md')) return;
    if (file === 'ReadMe.md' || file === 'INDEX.md') return; // 保留索引文件
    
    const filePath = path.join(atDocsDir, file);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return;
    
    // 跳过已经在子目录中的文件
    if (stat.isDirectory()) return;
    
    const category = categorizeFile(file);
    const targetDir = path.join(atDocsDir, category === 'dev' ? 'dev' : (category || 'archive'));
    
    // 如果已经在目标目录，跳过
    if (path.dirname(filePath) === targetDir) return;
    
    ensureDir(targetDir);
    
    console.log(`📄 ${file}`);
    const newPath = moveFile(filePath, targetDir, file);
    movedFiles.push({ original: file, new: newPath, category });
  });
  
  return movedFiles;
}

/**
 * 生成文档索引
 */
function generateIndex(movedFiles) {
  const rootDir = path.resolve(__dirname, '..');
  const indexPath = path.join(rootDir, '@docs', 'INDEX.md');
  
  const indexContent = `# 📚 文档索引

> 本文档由 Luban 工具自动生成，最后更新时间: ${new Date().toLocaleString('zh-CN')}

## 📖 主要文档

- [README.md](../README.md) - 项目主文档
- [CHANGELOG.md](../CHANGELOG.md) - 更新日志
- [ReadMe.md](./ReadMe.md) - 版本管理与发布指南

## 📁 文档分类

### 🗄️ 归档文档 (archive/)
开发过程中产生的临时文档、历史记录等。

### 🐛 问题修复记录 (fixes/)
记录各种问题修复的详细说明。

### ✨ 功能实现 (features/)
功能实现总结、使用指南、快速开始等文档。

### 🚀 部署相关 (deployment/)
部署说明、配置指南等。

### 💻 开发文档 (dev/)
开发过程中的技术文档、API文档、数据字典等。

## 📊 整理统计

本次整理共移动 ${movedFiles.length} 个文件。

${movedFiles.some(f => f.type === 'test-script' || f.type === 'test-html' || f.type === 'test-file') ? `
## 🧪 测试脚本归档

测试脚本和临时文件已归档到 \`scripts/archive/\` 目录：

- **测试脚本**: 开发过程中使用的临时测试脚本
- **测试HTML**: 浏览器测试页面
- **临时脚本**: 修复、验证等临时脚本

**保留的脚本**:
- \`test-promptx.js\` - 在文档中被引用，保留在 scripts 目录

**归档位置**: \`scripts/archive/\`
` : ''}

## 🔧 使用 Luban 工具

运行以下命令整理项目：

\`\`\`bash
node scripts/luban.js
\`\`\`

工具会自动整理：
- 📄 Markdown 文档
- 🧪 测试脚本和临时文件
- 🌐 测试HTML文件

---

*提示: 如需手动整理，请参考上述分类规则。*
`;

  fs.writeFileSync(indexPath, indexContent, 'utf-8');
  console.log(`\n✓ 生成文档索引: ${indexPath}`);
}

/**
 * 整理测试脚本和临时文件
 */
function organizeTestScripts() {
  const rootDir = path.resolve(__dirname, '..');
  const scriptsDir = path.join(rootDir, 'scripts');
  const archiveDir = path.join(scriptsDir, 'archive');
  const movedFiles = [];
  
  if (!fs.existsSync(scriptsDir)) {
    return movedFiles;
  }
  
  console.log('\n📁 整理测试脚本和临时文件...\n');
  ensureDir(archiveDir);
  
  // 测试脚本模式
  const testPatterns = [
    /^test-.*\.js$/i,
    /^test-.*\.ts$/i,
    /^fix-.*\.js$/i,
    /^verify-.*\.js$/i,
    /^force-.*\.js$/i,
    /^start-promptx\.bat$/i,
  ];
  
  // 需要保留的脚本（在文档中被引用或仍在使用）
  const keepScripts = [
    'test-promptx.js', // 在文档中被引用
  ];
  
  const files = fs.readdirSync(scriptsDir);
  
  files.forEach(file => {
    // 跳过目录和保留的脚本
    const filePath = path.join(scriptsDir, file);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return;
    if (keepScripts.includes(file)) return;
    
    // 检查是否匹配测试脚本模式
    const isTestScript = testPatterns.some(pattern => pattern.test(file));
    
    if (isTestScript) {
      console.log(`📜 ${file}`);
      const newPath = moveFile(filePath, archiveDir, file);
      movedFiles.push({ original: file, new: newPath, type: 'test-script' });
    }
  });
  
  return movedFiles;
}

/**
 * 整理根目录的测试文件
 */
function organizeRootTestFiles() {
  const rootDir = path.resolve(__dirname, '..');
  const archiveDir = path.join(rootDir, 'scripts', 'archive');
  const movedFiles = [];
  
  console.log('\n📁 整理根目录测试文件...\n');
  ensureDir(archiveDir);
  
  const testFiles = [
    'test-promptx.html',
  ];
  
  testFiles.forEach(file => {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        console.log(`🌐 ${file}`);
        const newPath = moveFile(filePath, archiveDir, file);
        movedFiles.push({ original: file, new: newPath, type: 'test-html' });
      }
    }
  });
  
  return movedFiles;
}

/**
 * 整理 browser-extension 中的测试文件
 */
function organizeBrowserExtensionTests() {
  const rootDir = path.resolve(__dirname, '..');
  const beDir = path.join(rootDir, 'browser-extension');
  const archiveDir = path.join(rootDir, 'scripts', 'archive', 'browser-extension');
  const movedFiles = [];
  
  if (!fs.existsSync(beDir)) {
    return movedFiles;
  }
  
  console.log('\n📁 整理 browser-extension 测试文件...\n');
  ensureDir(archiveDir);
  
  const testFiles = [
    'test.js',
    'test.ts',
    'test-category.html',
    'test-i18n.html',
  ];
  
  testFiles.forEach(file => {
    const filePath = path.join(beDir, file);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        console.log(`🌐 browser-extension/${file}`);
        const newPath = moveFile(filePath, archiveDir, file);
        movedFiles.push({ original: `browser-extension/${file}`, new: newPath, type: 'test-file' });
      }
    }
  });
  
  return movedFiles;
}

/**
 * 主函数
 */
function main() {
  console.log('🔧 Luban 项目整理工具启动...\n');
  console.log('='.repeat(50));
  
  const rootMoved = organizeRootDocs();
  const atDocsMoved = organizeAtDocs();
  const testScriptsMoved = organizeTestScripts();
  const rootTestMoved = organizeRootTestFiles();
  const beTestMoved = organizeBrowserExtensionTests();
  
  const allMoved = [
    ...rootMoved,
    ...atDocsMoved,
    ...testScriptsMoved,
    ...rootTestMoved,
    ...beTestMoved,
  ];
  
  if (allMoved.length > 0) {
    generateIndex(allMoved);
    console.log('\n' + '='.repeat(50));
    console.log(`\n✅ 整理完成！共移动 ${allMoved.length} 个文件\n`);
    console.log(`   - 文档文件: ${rootMoved.length + atDocsMoved.length} 个`);
    console.log(`   - 测试脚本: ${testScriptsMoved.length} 个`);
    console.log(`   - 测试文件: ${rootTestMoved.length + beTestMoved.length} 个`);
  } else {
    console.log('\n' + '='.repeat(50));
    console.log('\n✅ 没有需要整理的文件\n');
  }
}

// 运行
if (require.main === module) {
  main();
}

module.exports = {
  main,
  categorizeFile,
  organizeRootDocs,
  organizeAtDocs,
  organizeTestScripts,
  organizeRootTestFiles,
  organizeBrowserExtensionTests,
};

