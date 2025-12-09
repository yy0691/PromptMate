import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import './i18n'
import { SplashScreenProvider } from '@/hooks/useSplashScreenContext';

// 根据环境选择路由
const Router = window.electronAPI ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")!).render(
  <Router>
    <SplashScreenProvider>
      <App />
    </SplashScreenProvider>
  </Router>
);
