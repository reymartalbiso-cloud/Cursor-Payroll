'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Calendar, DollarSign, FileSpreadsheet, ArrowRight, TrendingUp, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  pendingPayrollRuns: number;
  thisMonthPayslips: number;
  totalNetPay: number;
}

const statConfig = [
  {
    key: 'totalEmployees' as const,
    label: 'Total Employees',
    subLabel: (s: DashboardStats) => `${s.activeEmployees} active`,
    icon: Users,
    accent: 'from-castleton-green to-castleton-green/70',
    iconBg: 'bg-castleton-green/10 text-castleton-green',
  },
  {
    key: 'pendingPayrollRuns' as const,
    label: 'Pending Payroll',
    subLabel: () => 'Awaiting finalization',
    icon: Clock,
    accent: 'from-saffron to-earth-yellow',
    iconBg: 'bg-saffron/10 text-saffron',
  },
  {
    key: 'thisMonthPayslips' as const,
    label: 'Payslips This Month',
    subLabel: () => 'Generated payslips',
    icon: FileText,
    accent: 'from-castleton-green/80 to-castleton-green/50',
    iconBg: 'bg-castleton-green/10 text-castleton-green',
  },
  {
    key: 'totalNetPay' as const,
    label: 'Total Net Pay',
    subLabel: () => 'This month',
    icon: TrendingUp,
    accent: 'from-saffron/90 to-earth-yellow/70',
    iconBg: 'bg-saffron/10 text-saffron',
    format: true,
  },
];

const quickActions = [
  {
    href: '/dashboard/import',
    icon: FileSpreadsheet,
    title: 'Import Timesheet',
    description: 'Upload an Excel timesheet to create a new payroll run',
  },
  {
    href: '/dashboard/payroll-runs',
    icon: Calendar,
    title: 'Manage Payroll Runs',
    description: 'Review, finalize, and manage payroll runs',
  },
  {
    href: '/dashboard/employees',
    icon: Users,
    title: 'Employee Directory',
    description: 'Add, edit, or view employee master data',
  },
];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold tracking-tight text-dark-serpent dark:text-white">
          {getGreeting()}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s an overview of your payroll system.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statConfig.map((stat, i) => {
          const Icon = stat.icon;
          const value = stats?.[stat.key] ?? 0;
          return (
            <Card
              key={stat.key}
              className={`animate-fade-in-up stagger-${i + 1} relative overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow duration-300`}
            >
              <div className={`absolute top-0 left-0 h-1 w-full bg-gradient-to-r ${stat.accent}`} />
              <CardContent className="pt-6 pb-5 px-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-bold mt-2 text-dark-serpent dark:text-white">
                      {isLoading ? (
                        <span className="inline-block h-8 w-20 rounded-md bg-muted animate-pulse" />
                      ) : (
                        stat.format ? formatCurrency(value) : value
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats ? stat.subLabel(stats) : '\u00A0'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.iconBg}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-dark-serpent dark:text-white mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card
                key={action.href}
                className="group border-border/50 hover:border-castleton-green/30 hover:shadow-lg transition-all duration-300 cursor-pointer"
                onClick={() => window.location.href = action.href}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-xl bg-castleton-green/10 text-castleton-green group-hover:bg-castleton-green group-hover:text-white transition-colors duration-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-castleton-green group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                  <CardTitle className="text-base mt-3">{action.title}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {action.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payroll Rules */}
      <div>
        <h2 className="text-lg font-semibold text-dark-serpent dark:text-white mb-4">Payroll Rules</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/50">
            <CardContent className="pt-5 pb-5">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-1 rounded-full bg-castleton-green" />
                <div>
                  <h4 className="text-sm font-semibold text-dark-serpent dark:text-white">Workdays</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Monday to Saturday only. Sundays are excluded from all calculations including absences and deductions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="pt-5 pb-5">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-1 rounded-full bg-saffron" />
                <div>
                  <h4 className="text-sm font-semibold text-dark-serpent dark:text-white">Government Deductions</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    SSS, PhilHealth, and Pag-IBIG are applied only for the 16th to end-of-month cutoff period.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="pt-5 pb-5">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-1 rounded-full bg-castleton-green" />
                <div>
                  <h4 className="text-sm font-semibold text-dark-serpent dark:text-white">Cutoff Periods</h4>
                  <ul className="text-xs text-muted-foreground mt-1 leading-relaxed space-y-0.5">
                    <li>First Half: 1st &ndash; 15th of the month</li>
                    <li>Second Half: 16th &ndash; end of month</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="pt-5 pb-5">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-1 rounded-full bg-saffron" />
                <div>
                  <h4 className="text-sm font-semibold text-dark-serpent dark:text-white">KPI</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    KPI amounts can be edited per employee per payroll run. Changes are logged for audit purposes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
