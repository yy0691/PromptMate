import { useEffect, useState, lazy, Suspense, useCallback } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useSettings } from "@/hooks/useSettings";
// import { ThemeProvider } from "@/components/ThemeProvider"; // 移除ThemeProvider，避免与useSettings冲突
// import { Index } from "@/pages/Index"; // Remove direct import
import { Header } from "@/components/Header";
import { PromptsProvider } from "@/hooks/usePrompts";
import { AppViewProvider, useAppView } from "@/hooks/useAppView";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/toaster";
import { Icons } from "@/components/ui/icons"; // Import Icons for fallback
import ErrorBoundary from "@/components/ErrorBoundary";
import NotFoundPage from "@/components/NotFoundPage";
import SplashScreen from "@/components/SplashScreen";
import { useSplashScreen } from "@/hooks/useSplashScreen";
import { useSplashScreenContext } from "@/hooks/useSplashScreenContext";
// Import conditional workflow view
import { ConditionalWorkflowView } from "@/components/ConditionalWorkflowView";
import { PromptXView } from "@/components/promptx/PromptXView";
import { MarketplaceView } from "@/views/MarketplaceView";
import { AuthCallback } from "@/pages/AuthCallback";

// Lazy load the Index component (handle named export)
const Index = lazy(() => 
  import("@/pages/Index")
    .then(module => ({ default: module.Index }))
    .catch(error => {
      console.error('Failed to load Index component:', error);
      return { default: () => <NotFoundPage error="Failed to load main page" /> };
    })
);

function AppContent() {
  const { currentView } = useAppView();
  const { setAppReady } = useSplashScreenContext();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const isDev = import.meta.env.DEV;

  // 当切换到需要侧边栏的视图时，确保侧边栏是打开的
  useEffect(() => {
    if (currentView === 'promptx' || currentView === 'marketplace' || currentView === 'workflows') {
      setSidebarOpen(true);
    }
  }, [currentView]);
  
  // 启动页面管理
  const { 
    showSplash, 
    isLoading, 
    progress, 
    currentTask, 
    tasks 
  } = useSplashScreen({
    onComplete: () => {
      console.log('启动页面完成');
    }
  });

  useEffect(() => {
    requestAnimationFrame(() => {
      setAppReady();
    });
  }, [setAppReady]);

  // 切换侧边栏显示状态 (Memoized with useCallback)
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []); // Empty dependency array as it doesn't depend on any props/state from App scope

  // 根据当前视图渲染不同的组件
  const renderCurrentView = () => {
    switch (currentView) {
      case 'workflows':
        return <ConditionalWorkflowView />;
      case 'promptx':
        return <PromptXView sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />;
      case 'marketplace':
        return <MarketplaceView onToggleSidebar={toggleSidebar} />;
      case 'prompts':
      default:
        return (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Icons.fileText className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
            <Index sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          </Suspense>
        );
    }
  };

  // 如果显示启动页面，则只显示启动页面
  if (showSplash) {
    return (
      <SplashScreen 
        isLoading={isLoading}
        progress={progress}
        currentTask={currentTask}
        tasks={tasks}
      />
    );
  }

  // OAuth 回调路由不显示 Header
  if (location.pathname === '/auth/callback') {
    return (
      <>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
        <Toaster />
      </>
    );
  }

  return (
    <main className="h-screen flex flex-col overflow-hidden" data-testid="main-app">
      <Header />
      <div className="flex-1 flex min-h-0 overflow-hidden app-content">
        <Routes>
          <Route path="/" element={renderCurrentView()} />
          <Route path="*" element={renderCurrentView()} />
        </Routes>
      </div>
      <Toaster />
    </main>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppViewProvider>
          <ErrorBoundary>
            <PromptsProvider>
              <ErrorBoundary>
                <AppContent />
              </ErrorBoundary>
            </PromptsProvider>
          </ErrorBoundary>
        </AppViewProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

