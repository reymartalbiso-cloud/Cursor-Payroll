'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Calendar, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  pendingPayrollRuns: number;
  thisMonthPayslips: number;
  totalNetPay: number;
}

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name}!
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats?.totalEmployees || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeEmployees || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payroll Runs</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats?.pendingPayrollRuns || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting finalization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payslips This Month</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : stats?.thisMonthPayslips || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Generated payslips
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Net Pay</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : formatCurrency(stats?.totalNetPay || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/dashboard/import'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              Import Timesheet
            </CardTitle>
            <CardDescription>
              Upload an Excel timesheet to create a new payroll run
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/dashboard/payroll-runs'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              Manage Payroll Runs
            </CardTitle>
            <CardDescription>
              View and manage payroll runs, review and finalize payslips
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/dashboard/employees'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              Employee Management
            </CardTitle>
            <CardDescription>
              Add, edit, or view employee master data
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Workday Rules Info */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Calculation Rules</CardTitle>
          <CardDescription>Important information about payroll processing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900">Workdays</h4>
              <p className="text-sm text-blue-700 mt-1">
                Monday to Saturday only. Sundays are excluded from all calculations including absences and deductions.
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <h4 className="font-semibold text-amber-900">Government Deductions</h4>
              <p className="text-sm text-amber-700 mt-1">
                SSS, PhilHealth, and Pag-IBIG are applied ONLY for the 16-end of month cutoff period.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-semibold text-green-900">Cutoff Periods</h4>
              <ul className="text-sm text-green-700 mt-1 list-disc list-inside">
                <li>First Half: 1st - 15th of the month</li>
                <li>Second Half: 16th - end of month (28/29/30/31)</li>
              </ul>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-semibold text-purple-900">KPI</h4>
              <p className="text-sm text-purple-700 mt-1">
                KPI amounts can be edited per employee per payroll run. Changes are logged for audit purposes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
