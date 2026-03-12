'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
    collapsed?: boolean;
}

export function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
    const { theme, setTheme } = useTheme();

    return (
        <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'default'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
                'text-white/50 hover:bg-white/[0.06] hover:text-white/90 rounded-lg transition-all duration-200',
                collapsed ? 'h-8 w-8' : 'w-full justify-start'
            )}
            title={collapsed ? 'Toggle Theme' : undefined}
        >
            <div className="relative flex items-center justify-center">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </div>
            {!collapsed && <span className="ml-2 text-[11px] font-semibold">Theme</span>}
        </Button>
    );
}
