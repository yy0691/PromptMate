import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // 检查滚动位置，当滚动超过 300px 时显示按钮
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // 监听滚动事件
    window.addEventListener('scroll', toggleVisibility);

    // 清理函数
    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Button
      onClick={scrollToTop}
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'h-12 w-12 rounded-full shadow-lg',
        'bg-primary text-primary-foreground',
        'hover:bg-primary/90',
        'transition-all duration-300',
        'flex items-center justify-center',
        'opacity-100 hover:scale-110'
      )}
      aria-label="返回顶部"
    >
      <Icons.arrowUp className="h-5 w-5" />
    </Button>
  );
}

