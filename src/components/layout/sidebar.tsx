'use client';

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
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className={cn(
          'flex h-16 items-center border-b border-castleton-green/30 px-4',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          {!collapsed && (
            <span className="text-xl font-bold text-saffron">Payroll</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-white/60 hover:text-white hover:bg-castleton-green/20"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
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
                    : 'text-white/70 hover:bg-castleton-green/40 hover:text-white',
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

        {/* User section */}
        <div className="border-t border-slate-700 p-4">
          {!collapsed && user && (
            <div className="mb-3">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-white/50 truncate">{user.email}</p>
              <span className="mt-1 inline-block rounded-full bg-saffron/20 px-2 py-0.5 text-xs text-saffron">
                {user.role.replace('_', ' ')}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'default'}
            onClick={handleLogout}
            className={cn(
              'text-white/70 hover:bg-castleton-green/40 hover:text-white',
              !collapsed && 'w-full justify-start'
            )}
            title={collapsed ? 'Logout' : undefined}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="ml-2">Logout</span>}
          </Button>
          {!collapsed && (
            <div className="mt-4 text-center">
              <p className="text-[15px] text-saffron uppercase tracking-widest font-medium">
                Powered by: Lifewood ph
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
