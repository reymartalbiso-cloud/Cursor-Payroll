'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  FileSpreadsheet,
  Calendar,
  FileText,
  BarChart3,
  Settings,
  Home,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ClipboardCheck,
  UserCircle,
  Calculator,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useState } from 'react';
import { ThemeToggle } from './theme-toggle';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['ADMIN', 'PAYROLL_ADMIN'] },
  { href: '/dashboard/profile', label: 'My Profile', icon: UserCircle, roles: ['ADMIN', 'PAYROLL_ADMIN'] },
  { href: '/dashboard/employees', label: 'Employees', icon: Users, roles: ['ADMIN', 'PAYROLL_ADMIN'] },
  { href: '/dashboard/attendance', label: 'Attendance', icon: ClipboardList, roles: ['ADMIN', 'PAYROLL_ADMIN'] },
  { href: '/dashboard/import', label: 'Import Timesheet', icon: FileSpreadsheet, roles: ['ADMIN', 'PAYROLL_ADMIN'] },
  { href: '/dashboard/timesheet-review', label: 'Timesheet Review', icon: ClipboardCheck, roles: ['ADMIN', 'PAYROLL_ADMIN'] },
  { href: '/dashboard/payroll-runs', label: 'Payroll Runs', icon: Calendar, roles: ['ADMIN', 'PAYROLL_ADMIN'] },
  { href: '/dashboard/outsource-payroll', label: 'Outsource Payroll', icon: Calculator, roles: ['ADMIN', 'PAYROLL_ADMIN'] },
  { href: '/dashboard/payslips', label: 'Payslips', icon: FileText, roles: ['ADMIN', 'PAYROLL_ADMIN'] },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN', 'PAYROLL_ADMIN'] },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
];

type SidebarProps = {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
};

export function Sidebar({
  collapsed: controlledCollapsed,
  onCollapsedChange,
  mobileOpen = false,
  onMobileOpenChange,
}: SidebarProps = {}) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = onCollapsedChange ? (controlledCollapsed ?? false) : internalCollapsed;
  const setCollapsed = onCollapsedChange
    ? (v: boolean) => onCollapsedChange(v)
    : setInternalCollapsed;

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    logout();
    window.location.href = '/login';
  };

  const filteredNavItems = navItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  const isNavActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 h-screen bg-dark-serpent text-white transition-all duration-300 shadow-xl',
        collapsed ? 'w-[72px]' : 'w-64',
        'md:translate-x-0',
        mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
      )}
    >
      <div className="flex h-full flex-col">

        {/* Mobile close button */}
        {onMobileOpenChange && (
          <div className="flex md:hidden absolute right-3 top-3 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onMobileOpenChange(false)}
              className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Logo Section */}
        <div className={cn(
          'flex flex-col border-b border-white/[0.06] px-3',
          collapsed ? 'h-20 items-center justify-center' : 'pt-7 pb-4 space-y-3',
          onMobileOpenChange && 'max-md:pt-12'
        )}>
          <div className={cn('flex flex-col items-center w-full', collapsed ? 'justify-center' : 'space-y-3')}>
            <div className={cn('flex items-center w-full', collapsed ? 'justify-center' : 'justify-between')}>
              <div className={cn(
                'bg-white rounded-full flex items-center justify-center transition-all duration-300',
                collapsed ? 'w-10 h-10 p-1.5' : 'w-full h-11 px-5'
              )}>
                <div className="relative w-full h-full">
                  <Image
                    src="/lifewood-logo.png"
                    alt="Lifewood Logo"
                    fill
                    style={{ objectFit: 'contain' }}
                    priority
                  />
                </div>
              </div>

              {!collapsed && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCollapsed(true)}
                  className="absolute right-2 top-3 h-7 w-7 text-white/40 hover:text-white hover:bg-white/10 rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
            </div>

            {!collapsed && (
              <div className="flex flex-col items-center w-full pt-1">
                <span className="text-[22px] font-black tracking-[0.15em] leading-none bg-gradient-to-r from-saffron via-yellow-300 to-saffron bg-clip-text text-transparent">
                  LifePay
                </span>
                <p className="text-[9px] uppercase font-medium text-white/30 tracking-widest mt-1.5">
                  Lifewood PH
                </p>
              </div>
            )}
          </div>

          {collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(false)}
              className="mt-1 h-7 w-7 text-white/40 hover:text-white hover:bg-white/10 rounded-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto scrollbar-hide space-y-0.5">
          {filteredNavItems.map((item) => {
            const active = isNavActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
                  active
                    ? 'bg-castleton-green text-white shadow-md shadow-castleton-green/30'
                    : 'text-white/50 hover:text-white/90 hover:bg-white/[0.06]',
                  collapsed && 'justify-center px-0'
                )}
                title={collapsed ? item.label : undefined}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-saffron rounded-r-full" />
                )}
                <item.icon className={cn(
                  'h-[18px] w-[18px] flex-shrink-0 transition-colors',
                  active ? 'text-white' : 'text-white/40 group-hover:text-white/80'
                )} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="border-t border-white/[0.06] p-3">
          {!collapsed && user && (
            <div className="mb-3 px-1">
              <p className="text-sm font-semibold truncate text-white/90">{user.name}</p>
              <p className="text-[10px] text-white/35 truncate mt-0.5">{user.email}</p>
              <span className="mt-2 inline-block rounded-md bg-saffron/15 px-2 py-0.5 text-[10px] font-semibold text-saffron uppercase tracking-wide">
                {user.role.replace('_', ' ')}
              </span>
            </div>
          )}
          <div className={cn('flex gap-1.5', collapsed ? 'flex-col items-center' : 'items-center')}>
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              onClick={handleLogout}
              className={cn(
                'text-white/50 hover:bg-red-500/15 hover:text-red-400 transition-all duration-200 rounded-lg',
                !collapsed && 'flex-1 justify-center gap-2 text-[11px] font-semibold border border-white/[0.06]',
                collapsed && 'h-8 w-8'
              )}
              title={collapsed ? 'Logout' : undefined}
            >
              <LogOut className="h-3.5 w-3.5" />
              {!collapsed && <span>Logout</span>}
            </Button>
            <ThemeToggle collapsed={true} />
          </div>
        </div>
      </div>
    </aside>
  );
}
