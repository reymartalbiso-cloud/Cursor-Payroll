'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PayrollRun {
  id: string;
  name: string;
}

interface ReportData {
  payslips: Array<{
    employeeNo: string;
    employeeName: string;
    department: string;
    presentDays: number;
    absentDays: number;
    totalLateMinutes: number;
    totalOvertimeHours: number;
    basicPay: number;
    kpi: number;
    grossPay: number;
    totalDeductions: number;
    netPay: number;
    govDeductionsApplied: boolean;
  }>;
  summary: {
    totalEmployees: number;
    totalGrossPay: number;
    totalDeductions: number;
    totalNetPay: number;
    totalAbsentDays: number;
    totalLateMinutes: number;
    totalOvertimeHours: number;
  };
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchPayrollRuns = async () => {
      try {
        const res = await fetch('/api/payroll-runs?limit=50');
        if (res.ok) {
          const data = await res.json();
          setPayrollRuns(data.payrollRuns);
        }
      } catch (error) {
        console.error('Failed to fetch payroll runs:', error);
      }
    };
    fetchPayrollRuns();
  }, []);

  const fetchReport = async (runId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/reports/payroll-summary?payrollRunId=${runId}`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRun = (runId: string) => {
    setSelectedRun(runId);
    if (runId) {
      fetchReport(runId);
    } else {
      setReportData(null);
    }
  };

  const handleExportCsv = async () => {
    if (!selectedRun) return;

    try {
      const res = await fetch(`/api/reports/payroll-summary/export?payrollRunId=${selectedRun}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const run = payrollRuns.find(r => r.id === selectedRun);
      a.download = `payroll-report-${run?.name || selectedRun}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast({ title: 'Success', description: 'Report exported' });
    } catch {
      toast({
        title: 'Error',
        description: 'Export failed',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate and export payroll reports
        </p>
      </div>

      {/* Report Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Summary Report</CardTitle>
          <CardDescription>
            Select a payroll run to view the summary report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-md">
              <Select value={selectedRun} onValueChange={handleSelectRun}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payroll run" />
                </SelectTrigger>
                <SelectContent>
                  {payrollRuns.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {run.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {reportData && (
              <Button onClick={handleExportCsv}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : reportData ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{reportData.summary.totalEmployees}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Gross Pay</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatCurrency(reportData.summary.totalGrossPay)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Deductions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(reportData.summary.totalDeductions)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Net Pay</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(reportData.summary.totalNetPay)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Attendance Summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Absent Days</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-600">
                  {reportData.summary.totalAbsentDays}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Late (minutes)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-600">
                  {reportData.summary.totalLateMinutes}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Overtime (hours)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">
                  {reportData.summary.totalOvertimeHours.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Table */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Present</TableHead>
                      <TableHead className="text-right">Absent</TableHead>
                      <TableHead className="text-right">Late (min)</TableHead>
                      <TableHead className="text-right">OT (hrs)</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                      <TableHead>Gov Ded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.payslips.map((ps, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{ps.employeeNo}</TableCell>
                        <TableCell>{ps.employeeName}</TableCell>
                        <TableCell>{ps.department}</TableCell>
                        <TableCell className="text-right">{ps.presentDays}</TableCell>
                        <TableCell className="text-right">
                          {ps.absentDays > 0 ? (
                            <span className="text-red-600">{ps.absentDays}</span>
                          ) : ps.absentDays}
                        </TableCell>
                        <TableCell className="text-right">
                          {ps.totalLateMinutes > 0 ? (
                            <span className="text-amber-600">{ps.totalLateMinutes}</span>
                          ) : ps.totalLateMinutes}
                        </TableCell>
                        <TableCell className="text-right">{ps.totalOvertimeHours}</TableCell>
                        <TableCell className="text-right">{formatCurrency(ps.grossPay)}</TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatCurrency(ps.totalDeductions)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {formatCurrency(ps.netPay)}
                        </TableCell>
                        <TableCell>
                          {ps.govDeductionsApplied ? (
                            <Badge variant="default" className="text-xs">Yes</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">No</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a payroll run to generate the report
          </CardContent>
        </Card>
      )}
    </div>
  );
}
