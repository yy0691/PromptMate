import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// 解决ESM中没有__dirname的问题
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // 强制加载所有环境变量文件（不依赖 mode）
    // loadEnv 只加载特定 mode 的文件，这里我们需要加载所有可能的文件
    const envProduction = loadEnv('production', process.cwd(), '');
    const envDevelopment = loadEnv('development', process.cwd(), '');
    const envElectron = loadEnv('electron', process.cwd(), '');

    // 合并所有环境变量，优先级：electron > development > production
    const env = { ...envProduction, ...envDevelopment, ...envElectron };

    // 调试输出
    console.log('🔧 Electron Build - Mode:', mode);
    console.log('📦 VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL ? '✅' : '❌');
    console.log('📦 SUPABASE_URL:', env.SUPABASE_URL ? '✅' : '❌');

    return {
        base: './', // Electron 必须使用相对路径
        plugins: [
            react(),
        ],
        resolve: {
            alias: {
                "@": resolve(__dirname, "./src"),
            },
        },
        define: {
            // 定义环境变量来帮助条件编译
            __ELECTRON__: 'true',
            // 自动映射 Supabase 环境变量，避免用户必须配置 VITE_ 前缀
            // 使用 loadEnv 加载的 env 对象，而不是 process.env
            'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL),
            'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_KEY),
        },
        optimizeDeps: {
            exclude: [
                'fsevents',
                'chokidar',
                '@parcel/watcher',
                'node-pty',
                'serialport',
            ],
        },
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            assetsInlineLimit: 4096,
            sourcemap: true,
            minify: 'esbuild',
            chunkSizeWarningLimit: 1000,
            rollupOptions: {
                external: [
                    'fs',
                    'path',
                    'electron',
                    'chokidar',
                    'fsevents',
                    'util',
                    'os',
                    'stream',
                    'native-dependencies'
                ],
                output: {
                    globals: {
                        'fs': 'fs',
                        'path': 'path',
                        'electron': 'electron',
                        'chokidar': 'chokidar',
                        'fsevents': 'fsevents'
                    },
                    manualChunks: {
                        'react-vendor': ['react', 'react-dom'],
                        'workflow-plugin': ['@reactflow/background', '@reactflow/controls', '@reactflow/core', '@reactflow/minimap', 'reactflow'],
                        'utils-vendor': ['i18next', 'i18next-browser-languagedetector', 'react-i18next', 'date-fns', 'clsx', 'tailwind-merge', 'class-variance-authority', 'cmdk', 'lucide-react', 'sonner', 'vaul'],
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
        }
    }
});
