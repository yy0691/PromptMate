import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// 解决ESM中没有__dirname的问题
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Electron 打包需要相对路径，Web 部署需要绝对根路径，否则深链路如 /auth/callback 会去 /auth/assets 下找静态文件。
  base: mode === 'electron' ? './' : '/',
  plugins: [
    react(),
  ],
  optimizeDeps: {
    exclude: [
      'fsevents', // macOS 原生文件系统事件模块
      'chokidar', // 文件监听器（可能包含原生依赖）
      // 其他可能的原生模块
      '@parcel/watcher',
      'node-pty',
      'serialport',
    ], // 排除原生模块，不在浏览器环境中处理
    minify: 'esbuild',
    // 增加代码块大小警告限制
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      external: [
        // 将Node.js模块和Electron模块标记为外部依赖
        'fs',
        'path',
        'electron',
        'chokidar',
        'fsevents', // macOS 原生模块
        'util',
        'os',
        'stream',
        // 其他可能的原生模块
        'native-dependencies'
        // sql.js 可以在渲染进程中使用，不需要排除
      ],
      output: {
        globals: {
          // 为外部模块提供全局变量名
          'fs': 'fs',
          'path': 'path',
          'electron': 'electron',
          'chokidar': 'chokidar',
          'fsevents': 'fsevents'
        },
        // 手动分割代码块以优化加载性能
        manualChunks: {
          // React核心库
          'react-vendor': ['react', 'react-dom'],
          // 工作流相关代码（动态加载）
          'workflow-plugin': ['@reactflow/background', '@reactflow/controls', '@reactflow/core', '@reactflow/minimap', 'reactflow'],
          // 工具库
          'utils-vendor': ['i18next', 'i18next-browser-languagedetector', 'react-i18next', 'date-fns', 'clsx', 'tailwind-merge', 'class-variance-authority', 'cmdk', 'lucide-react', 'sonner', 'vaul'],
          // 图表库
          'charts-vendor': ['recharts', 'react-markdown', 'remark-gfm', 'rehype-raw', 'github-markdown-css']
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.names?.[0]?.split('.') || [];
          const ext = info[info.length - 1] || 'unknown';
          if (/\.(css)$/.test(assetInfo.names?.[0] || '')) {
            return `assets/[name].[hash].${ext}`;
          }
          return `assets/[name].[hash].${ext}`;
        },
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false, // 不锁定端口，允许自动选择
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            console.error('代理错误:', err);
            // 如果后端服务未运行，返回友好的错误信息
            if (err.code === 'ECONNREFUSED') {
              console.warn('⚠️  后端服务未运行，请执行: cd server && npm run dev');
            }
          });
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
}));
