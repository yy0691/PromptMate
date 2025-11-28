import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import './i18n'
import { SplashScreenProvider } from '@/hooks/useSplashScreenContext';

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <SplashScreenProvider>
      <App />
    </SplashScreenProvider>
  </BrowserRouter>
);
