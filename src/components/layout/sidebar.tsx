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

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    logout();
    window.location.href = '/login';
  };

  const filteredNavItems = navItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-dark-serpent text-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col text-[#FFFFF0]">

        {/* Logo Section */}
        <div className={cn(
          'flex flex-col border-b border-castleton-green/30 px-3',
          collapsed ? 'h-20 items-center justify-center' : 'pt-8 pb-3 space-y-4'
        )}>
          <div className={cn("flex flex-col items-center w-full", collapsed ? "justify-center" : "space-y-4")}>
            <div className={cn("flex items-center w-full", collapsed ? "justify-center" : "justify-between")}>
              {/* Pill-shaped logo container */}
              <div className={cn(
                "bg-white rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
                collapsed ? "w-10 h-10 p-1.5" : "w-full h-12 px-6"
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
                  onClick={() => setCollapsed(!collapsed)}
                  className="absolute right-2 top-4 text-white/60 hover:text-white hover:bg-castleton-green/20"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
            </div>

            {!collapsed && (
              <div className="flex flex-col items-center w-full pt-2">
                <p className="text-[10px] uppercase font-bold text-saffron/80 tracking-widest mb-[14px]">
                  Powered by: Lifewood PH
                </p>
                <span className="text-[28px] font-black text-saffron tracking-[0.2em] uppercase leading-none">Payroll</span>
                <div className="h-0.5 w-16 bg-saffron/40 rounded-full mt-3" />
              </div>
            )}

          </div>

          {collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="mt-2 text-white/60 hover:text-white hover:bg-castleton-green/20"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </div>


        {/* Navigation Area - Scrollable */}
        <nav className="flex-1 space-y-1 p-2 overflow-y-auto scrollbar-hide">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                  isActive
                    ? 'bg-castleton-green text-white shadow-sm'
                    : 'text-[#FFFFF0]/70 hover:bg-castleton-green/40 hover:text-[#FFFFF0]',
                  collapsed && 'justify-center'
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>



        {/* User Section - Sticky Footer */}
        <div className="mt-auto border-t border-castleton-green/30 bg-dark-serpent/80 backdrop-blur-md p-4 text-[#FFFFF0]">
          {!collapsed && user && (
            <div className="mb-4">
              <p className="text-sm font-bold truncate">{user.name}</p>
              <p className="text-[10px] text-[#FFFFF0]/60 truncate uppercase tracking-tighter">{user.email}</p>
              <span className="mt-2 inline-block rounded-full bg-saffron/20 px-2 py-0.5 text-[10px] font-bold text-saffron uppercase border border-saffron/30">
                {user.role.replace('_', ' ')}
              </span>
            </div>
          )}
          <div className={cn("flex gap-2", collapsed ? "flex-col items-center" : "items-center")}>
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              onClick={handleLogout}
              className={cn(
                'text-[#FFFFF0] hover:bg-red-500/20 hover:text-red-400 transition-all duration-300',
                !collapsed && 'flex-1 justify-center gap-2 font-bold uppercase text-[11px] border border-white/10'
              )}
              title={collapsed ? 'Logout' : undefined}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Logout</span>}
            </Button>
            <div className={cn(collapsed ? "mt-2" : "")}>
              <ThemeToggle collapsed={true} />
            </div>
          </div>

        </div>

      </div>
    </aside>
  );
}
