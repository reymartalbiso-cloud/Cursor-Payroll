'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  FileText,
  Download,
  Lock,
  Upload,
  AlertTriangle,
  Search,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency, formatDate, debounce } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Payslip {
  id: string;
  referenceNo: string;
  employeeNo: string;
  employeeName: string;
  department: string;
  position: string;
  dailyRate: number;
  eligibleWorkdays: number;
  presentDays: number;
  absentDays: number;
  basicPay: number;
  kpi: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  govDeductionsApplied: boolean;
  isMissing: boolean;
}

interface PayrollRun {
  id: string;
  name: string;
  cutoffType: 'FIRST_HALF' | 'SECOND_HALF';
  cutoffStart: string;
  cutoffEnd: string;
  payDate: string;
  year: number;
  month: number;
  eligibleWorkdays: number;
  status: 'DRAFT' | 'REVIEWED' | 'FINALIZED';
  govDeductionMode: string;
  payslips: Payslip[];
  _count: { payslips: number; timesheetEntries: number };
}

export default function PayrollRunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingKpi, setEditingKpi] = useState<Record<string, string>>({});
  const [savingKpi, setSavingKpi] = useState<Record<string, boolean>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchPayrollRun = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/payroll-runs/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPayrollRun(data);
      } else {
        toast({
          title: 'Error',
          description: 'Payroll run not found',
          variant: 'destructive',
        });
        router.push('/dashboard/payroll-runs');
      }
    } catch (error) {
      console.error('Failed to fetch payroll run:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id, router, toast]);

  useEffect(() => {
    fetchPayrollRun();
  }, [fetchPayrollRun]);

  const handleKpiChange = (payslipId: string, value: string) => {
    setEditingKpi({ ...editingKpi, [payslipId]: value });
    debouncedSaveKpi(payslipId, value);
  };

  const saveKpi = async (payslipId: string, value: string) => {
    setSavingKpi({ ...savingKpi, [payslipId]: true });
    try {
      const res = await fetch(`/api/payslips/${payslipId}/kpi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kpi: parseFloat(value) || 0 }),
      });

      if (!res.ok) throw new Error('Failed to save KPI');

      const updated = await res.json();
      setPayrollRun((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          payslips: prev.payslips.map((p) =>
            p.id === payslipId ? { ...p, ...updated } : p
          ),
        };
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save KPI',
        variant: 'destructive',
      });
    } finally {
      setSavingKpi({ ...savingKpi, [payslipId]: false });
    }
  };

  const debouncedSaveKpi = useCallback(
    debounce((payslipId: string, value: string) => saveKpi(payslipId, value), 500),
    []
  );

  const handleFinalize = async () => {
    if (!confirm('Are you sure you want to finalize this payroll run? This action cannot be undone.')) return;

    try {
      const res = await fetch(`/api/payroll-runs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FINALIZED' }),
      });

      if (!res.ok) throw new Error('Failed to finalize');

      toast({ title: 'Success', description: 'Payroll run finalized' });
      fetchPayrollRun();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to finalize',
        variant: 'destructive',
      });
    }
  };

  const handleExportAll = async () => {
    try {
      const res = await fetch(`/api/payroll-runs/${id}/export`, {
        method: 'POST',
      });
      
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-${payrollRun?.name}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast({ title: 'Success', description: 'Export completed' });
    } catch {
      toast({
        title: 'Error',
        description: 'Export failed',
        variant: 'destructive',
      });
    }
  };

  const handleGeneratePayslips = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/payroll-runs/${id}/generate-payslips`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate payslips');
      }

      toast({
        title: 'Success',
        description: data.message || `Generated ${data.created} payslip(s)`,
      });
      fetchPayrollRun();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to generate payslips',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading || !payrollRun) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const filteredPayslips = payrollRun.payslips.filter(
    (p) =>
      p.employeeNo.toLowerCase().includes(search.toLowerCase()) ||
      p.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      p.department.toLowerCase().includes(search.toLowerCase())
  );

  const missingCount = payrollRun.payslips.filter((p) => p.isMissing).length;
  const totalGross = payrollRun.payslips.reduce((sum, p) => sum + parseFloat(String(p.grossPay)), 0);
  const totalNet = payrollRun.payslips.reduce((sum, p) => sum + parseFloat(String(p.netPay)), 0);
  const totalDeductions = payrollRun.payslips.reduce((sum, p) => sum + parseFloat(String(p.totalDeductions)), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>;
      case 'REVIEWED':
        return <Badge variant="warning">Reviewed</Badge>;
      case 'FINALIZED':
        return <Badge variant="success">Finalized</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/payroll-runs">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{payrollRun.name}</h1>
          <p className="text-muted-foreground">
            {formatDate(payrollRun.cutoffStart, 'long')} - {formatDate(payrollRun.cutoffEnd, 'long')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(payrollRun.status)}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pay Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatDate(payrollRun.payDate, 'long')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Eligible Workdays</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{payrollRun.eligibleWorkdays} days</p>
            <p className="text-xs text-muted-foreground">Mon-Sat only</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Gross Pay</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(totalGross)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalDeductions)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Net Pay</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalNet)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {missingCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-800">
                  {missingCount} employee(s) missing from timesheet import
                </p>
                <p className="text-sm text-amber-700">
                  These employees are marked as missing. You can import timesheet data or mark them as absent.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {payrollRun.cutoffType === 'SECOND_HALF' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-800">
              <strong>Government Deductions Applied:</strong> SSS, PhilHealth, and Pag-IBIG deductions
              are applied for this cutoff period (16th-end of month).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        {payrollRun.status !== 'FINALIZED' && (
          <>
            {payrollRun._count.payslips === 0 && (
              <Button onClick={handleGeneratePayslips} disabled={isGenerating}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                {isGenerating ? 'Generating...' : 'Generate Payslips'}
              </Button>
            )}
            <Button asChild variant={payrollRun._count.payslips === 0 ? 'outline' : 'default'}>
              <Link href="/dashboard/import">
                <Upload className="h-4 w-4 mr-2" />
                Import Timesheet
              </Link>
            </Button>
            <Button variant="outline" onClick={handleFinalize}>
              <Lock className="h-4 w-4 mr-2" />
              Finalize Payroll
            </Button>
          </>
        )}
        <Button variant="outline" onClick={handleExportAll}>
          <Download className="h-4 w-4 mr-2" />
          Export All PDFs
        </Button>
      </div>

      {/* Payslips Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payslips ({payrollRun._count.payslips})</CardTitle>
              <CardDescription>
                Click on a row to view detailed payslip. KPI can be edited inline.
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">Absent</TableHead>
                <TableHead className="text-right">Basic Pay</TableHead>
                <TableHead className="text-right">KPI</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead>Gov</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayslips.map((payslip) => (
                <TableRow
                  key={payslip.id}
                  className={payslip.isMissing ? 'bg-amber-50' : ''}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{payslip.employeeName}</p>
                      <p className="text-sm text-muted-foreground">{payslip.employeeNo}</p>
                    </div>
                  </TableCell>
                  <TableCell>{payslip.department}</TableCell>
                  <TableCell className="text-right">{payslip.presentDays}</TableCell>
                  <TableCell className="text-right">
                    {payslip.absentDays > 0 ? (
                      <span className="text-red-600">{payslip.absentDays}</span>
                    ) : (
                      payslip.absentDays
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(payslip.basicPay)}
                  </TableCell>
                  <TableCell className="text-right">
                    {payrollRun.status !== 'FINALIZED' ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={editingKpi[payslip.id] ?? payslip.kpi}
                          onChange={(e) => handleKpiChange(payslip.id, e.target.value)}
                          className="w-24 h-8 text-right"
                        />
                        {savingKpi[payslip.id] && (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                        )}
                      </div>
                    ) : (
                      formatCurrency(payslip.kpi)
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(payslip.grossPay)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(payslip.totalDeductions)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-600">
                    {formatCurrency(payslip.netPay)}
                  </TableCell>
                  <TableCell>
                    {payslip.govDeductionsApplied ? (
                      <Badge variant="default" className="text-xs">Yes</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/payslips/${payslip.id}`}>
                        <FileText className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
