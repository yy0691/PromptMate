# 📦 测试脚本和临时文件归档

本目录存放开发过程中产生的测试脚本、临时脚本和测试文件。

## 📁 目录结构

```
archive/
├── browser-extension/     # 浏览器扩展测试文件
│   ├── test.js
│   ├── test.ts
│   ├── test-category.html
│   └── test-i18n.html
├── test-*.js              # 各种测试脚本
├── fix-*.js               # 修复相关临时脚本
├── verify-*.js            # 验证相关脚本
├── force-*.js             # 强制操作脚本
├── start-*.bat            # 临时启动脚本
└── test-*.html            # 测试HTML页面
```

## 🧪 测试脚本说明

### 更新检查相关
- `test-update-check.js` - 更新检查功能测试
- `test-enhanced-update-check.js` - 增强版更新检查测试
- `test-update-manual.js` - 手动更新检查测试
- `test-network-connection.js` - 网络连接测试
- `fix-update-check.js` - 更新检查修复脚本
- `force-update-check.js` - 强制更新检查脚本
- `verify-update-fix.js` - 验证更新修复脚本

### 功能测试
- `test-oauth.js` - OAuth 功能测试
- `test-app.js` - 应用构建测试
- `test-build.js` - 构建流程测试
- `test-promptx.html` - PromptX 功能测试页面

### 临时脚本
- `start-promptx.bat` - PromptX 临时启动脚本

### 浏览器扩展测试
- `browser-extension/test.js` - 基础测试脚本
- `browser-extension/test.ts` - TypeScript 测试脚本
- `browser-extension/test-category.html` - 分类功能测试
- `browser-extension/test-i18n.html` - 国际化测试

## 📝 说明

这些文件是开发过程中产生的临时测试和调试脚本，已归档保存。

**保留的脚本**（仍在 scripts 根目录）：
- `test-promptx.js` - 在文档中被引用，保留使用

## 🔧 如何恢复

如果需要使用这些脚本，可以：
1. 从本目录复制到 scripts 根目录
2. 或直接在本目录运行（注意路径问题）

---

*归档时间: 2025-11-28*  
*整理工具: Luban*

