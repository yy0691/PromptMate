import { createContext, useContext, useState, ReactNode } from "react";

export type AppView = 'prompts' | 'workflows' | 'promptx' | 'marketplace';

interface AppViewContextType {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
}

const AppViewContext = createContext<AppViewContextType | undefined>(undefined);

export function AppViewProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<AppView>('prompts');

  const value: AppViewContextType = {
    currentView,
    setCurrentView
  };

  return (
    <AppViewContext.Provider value={value}>
      {children}
    </AppViewContext.Provider>
  );
}

export function useAppView() {
  const context = useContext(AppViewContext);
  if (context === undefined) {
    throw new Error('useAppView must be used within an AppViewProvider');
  }
  return context;
}