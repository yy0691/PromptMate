import { Button } from "@/components/ui/button";
import { Moon, Sun, Pin, PinOff, Menu, Minus, Maximize2, X, User, LogOut } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { usePrompts } from "@/hooks/usePrompts";
import { useEffect, CSSProperties, useState } from "react";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/ui/icons";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";

// 定义样式接口扩展WebkitAppRegion属性
interface DraggableStyle extends CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag';
  '-webkit-app-region'?: 'drag' | 'no-drag';
}

// 检测是否为 macOS
const isMacOS = () => {
  return window.navigator.platform.toUpperCase().indexOf('MAC') >= 0;
};

// 头部组件
export function Header() {
  const { settings, toggleTheme, togglePinWindow } = useSettings();
  const { prompts, setSearchTerm } = usePrompts();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { toast } = useToast();
  const isMac = isMacOS();
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  
  // 在生产环境暂时隐藏登录功能
  const isProduction = import.meta.env.PROD;
  
  // 后门：按 Ctrl+Shift+L 可以在生产环境显示登录按钮
  const [showLoginInProd, setShowLoginInProd] = useState(false);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+L (Windows/Linux) 或 Cmd+Shift+L (Mac) 切换登录按钮显示
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setShowLoginInProd(prev => {
          const newValue = !prev;
          console.log(`[Debug] Login button ${newValue ? 'enabled' : 'disabled'} in production`);
          return newValue;
        });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 检查electronAPI是否可用
  const isElectronAPIAvailable = () => {
    return window.electronAPI && 
           typeof window.electronAPI.minimize === 'function' &&
           typeof window.electronAPI.maximize === 'function' &&
           typeof window.electronAPI.close === 'function';
  };

  // 判断是否为网页版（非Electron环境）
  const isWebVersion = !isElectronAPIAvailable();

  // 获取标题
  const getTitle = () => {
    if (prompts.length === 0) return "PromptMate";
    return `PromptMate - ${prompts.length} ${t("common.xPrompts")}`;  // X个提示词
  }; 

  // 切换侧边栏
  const toggleSidebar = () => {
    // 实现侧边栏切换逻辑
  };

  // 切换主题
  const handleToggleTheme = () => {
    toggleTheme();
  };

  // 窗口控制函数
  const handleMinimize = () => {
    try {
      if (isElectronAPIAvailable()) {
        window.electronAPI.minimize();
        console.log(t("Header.message.minimizeWindow"));
      } else {
        console.warn('electronAPI 不可用');
        toast({
          title: t("Header.message.functionUnavailable"),
          description: t("Header.message.functionUnavailableDesc"),
        });
      }
    } catch (error) {
      console.error(t("Header.message.minimizeWindowFailed"), error);
      toast({
        title: t("Header.message.operationFailed"),
        description: t("Header.message.operationFailedDesc"),
        variant: "destructive",
      });
    }
  };

  const handleMaximize = () => {
    try {
      if (isElectronAPIAvailable()) {
        window.electronAPI.maximize();
        console.log(t("Header.message.maximizeWindow"));
      } else {
        console.warn('electronAPI 不可用');
        toast({
          title: t("Header.message.functionUnavailable"),
          description: t("Header.message.functionUnavailableDesc"),
        });
      }
    } catch (error) {
      console.error(t("Header.message.maximizeWindowFailed"), error);
      toast({
        title: t("Header.message.operationFailed"),
        description: t("Header.message.maximizeWindowFailed"),
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    try {
      if (isElectronAPIAvailable()) {
        window.electronAPI.close();
        console.log(t("Header.message.closeWindow"));
      } else {
        console.warn('electronAPI 不可用');
        toast({
          title: t("Header.message.functionUnavailable"),
          description: t("Header.message.functionUnavailableDesc"),
        });
      }
    } catch (error) {
      console.error(t("Header.message.closeWindowFailed"), error);
      toast({
        title: t("Header.message.operationFailed"),
        description: t("Header.message.closeWindowFailedDesc"),
        variant: "destructive",
      });
    }
  };

  return (
        /* 头部容器 */
    <div 
      className={`flex flex-col md:flex-row items-center backdrop-blur-sm bg-background/80 border-b px-4 py-2 md:py-2 md:h-12 sticky top-0 z-10 ${
        isWebVersion ? '' : 'titlebar-drag'
      } ${
        isMac && !isWebVersion ? 'pl-20' : ''
      }`}
    >
      {/* 搜索框 */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-full max-w-2xl">
          <Input
            type="search"
            placeholder={t("Header.search.searchplaceholder")}
              className="w-full pl-10 titlebar-no-drag h-8 !text-[14px] focus-visible:ring-1 focus-visible:ring-ring/50"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Icons.search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        </div>
      </div>
      {/* 右侧按钮区域 */}
      <TooltipProvider delayDuration={100}>
        <div className="flex items-center space-x-2 mt-2 md:mt-0 md:w-1/4 justify-end">
          {/* 用户登录/菜单 - 生产环境下隐藏，但可通过 Ctrl+Shift+L 显示 */}
          {(!isProduction || showLoginInProd) && (
            <>
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="titlebar-no-drag h-9 px-3"
                    >
                      <User className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">
                        {user?.nickname || user?.email || t("Header.user.guest")}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user?.nickname || t("Header.user.noNickname")}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => logout()}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>{t("Header.user.logout")}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAuthDialogOpen(true)}
                  className="titlebar-no-drag h-9 px-3"
                >
                  <User className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{t("Header.user.login")}</span>
                </Button>
              )}
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              {/* 主题按钮 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleTheme}
                className="rounded-full titlebar-no-drag h-9 w-9"
              >
                {settings.theme === 'dark' ? (
                  <Sun className="h-4.5 w-4.5" />
                ) : (
                  <Moon className="h-4.5 w-4.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{settings.theme === 'dark' ? t("Header.button.light") : t("Header.button.dark")}</p>
            </TooltipContent>
          </Tooltip>

          {/* 窗口置顶按钮 - 仅在Electron环境显示 */}
          {!isWebVersion && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => togglePinWindow(!settings.alwaysOnTop)}
                  className={`rounded-full ${settings.alwaysOnTop ? "text-primary" : ""} titlebar-no-drag h-9 w-9`}
                >
                  {settings.alwaysOnTop ? (
                    <Pin className="h-4.5 w-4.5" />
                  ) : (
                    <PinOff className="h-4.5 w-4.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{settings.alwaysOnTop ? t("Header.button.cancelPinWindow") : t("Header.button.pinWindow")}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* 窗口控制按钮 - 仅在Electron环境且非Mac系统显示 */}
          {!isWebVersion && !isMac && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
              {/* 最小化按钮 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMinimize}
                className="rounded-full window-control-button titlebar-no-drag h-9 w-9"
              >
                <Minus className="h-4 w-4" />
              </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("Header.button.minimize")}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleMaximize}
                    className="rounded-full window-control-button titlebar-no-drag h-9 w-9"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("Header.button.maximize")}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    className="rounded-full window-control-button window-control-close titlebar-no-drag h-9 w-9"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("Header.button.close")}</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </TooltipProvider>

      {/* 登录对话框 */}
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  );
}
