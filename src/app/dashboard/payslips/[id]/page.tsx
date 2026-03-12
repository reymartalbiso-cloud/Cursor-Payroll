'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Download, Printer, Save } from 'lucide-react';
import { formatCurrency, formatDate, debounce } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PayslipDetail {
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
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
  totalOvertimeHours: number;
  basicPay: number;
  overtimePay: number;
  holidayPay: number;
  cola: number;
  kpi: number;
  otherEarnings: number;
  grossPay: number;
  absenceDeduction: number;
  lateDeduction: number;
  undertimeDeduction: number;
  sssDeduction: number;
  philhealthDeduction: number;
  pagibigDeduction: number;
  sssLoanDeduction: number;
  pagibigLoanDeduction: number;
  otherLoanDeduction: number;
  cashAdvanceDeduction: number;
  thirteenthMonthAdj: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  netPayInWords: string;
  govDeductionsApplied: boolean;
  isMissing: boolean;
  computationBreakdown: {
    basicPayFormula: string;
    absenceFormula: string;
    lateFormula: string;
    undertimeFormula: string;
    overtimeFormula: string;
    holidayNote: string;
    kpiNote: string;
    govDeductionNote: string;
    workdayRule: string;
  };
  payrollRun: {
    id: string;
    name: string;
    cutoffStart: string;
    cutoffEnd: string;
    payDate: string;
    status: string;
  };
  timesheetEntries: Array<{
    date: string;
    timeIn: string;
    timeOut: string;
    minutesLate: number;
    undertimeMinutes: number;
    isAbsent: boolean;
    isOnLeave: boolean;
    leaveType: string | null;
    overtimeHours: number;
  }>;
  settings: {
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
  };
}

export default function PayslipDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;
  const printRef = useRef<HTMLDivElement>(null);

  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [kpiValue, setKpiValue] = useState<string>('');
  const [isSavingKpi, setIsSavingKpi] = useState(false);

  // Format decimal hours to hours:minutes format (e.g., 1.0166 -> "1:01")
  const formatOvertimeHours = (hours: number | null | undefined): string => {
    const numHours = Number(hours);
    if (hours === null || hours === undefined || isNaN(numHours) || numHours === 0) return '-';
    const totalMinutes = Math.round(numHours * 60);
    if (totalMinutes === 0) return '-';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  const fetchPayslip = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/payslips/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPayslip(data);
        setKpiValue(String(data.kpi));
      } else {
        toast({
          title: 'Error',
          description: 'Payslip not found',
          variant: 'destructive',
        });
        router.back();
      }
    } catch (error) {
      console.error('Failed to fetch payslip:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id, router, toast]);

  useEffect(() => {
    fetchPayslip();
  }, [fetchPayslip]);

  const saveKpi = async () => {
    if (!payslip || payslip.payrollRun.status === 'FINALIZED') return;

    setIsSavingKpi(true);
    try {
      const res = await fetch(`/api/payslips/${id}/kpi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kpi: parseFloat(kpiValue) || 0 }),
      });

      if (!res.ok) throw new Error('Failed to save');

      const updated = await res.json();
      setPayslip((prev) => prev ? { ...prev, ...updated } : prev);
      toast({ title: 'Success', description: 'KPI saved' });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save KPI',
        variant: 'destructive',
      });
    } finally {
      setIsSavingKpi(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await fetch(`/api/payslips/${id}/pdf`);
      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${payslip?.referenceNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch {
      toast({
        title: 'Error',
        description: 'Download failed',
        variant: 'destructive',
      });
    }
  };

  if (isLoading || !payslip) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-castleton-green border-t-transparent" />
      </div>
    );
  }

  const isFinalized = payslip.payrollRun.status === 'FINALIZED';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 no-print">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Payslip Details</h1>
          <p className="text-muted-foreground">Reference: {payslip.referenceNo}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleDownloadPdf}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Printable Payslip */}
      <div ref={printRef} className="print:p-8">
        <Card className="border-2">
          <CardContent className="p-8">
            {/* Header */}
            <div className="text-center mb-6 border-b pb-4">
              <h2 className="text-2xl font-bold">{payslip.settings.companyName}</h2>
              <p className="text-sm text-muted-foreground">{payslip.settings.companyAddress}</p>
              <p className="text-sm text-muted-foreground">
                {payslip.settings.companyPhone} | {payslip.settings.companyEmail}
              </p>
              <h3 className="text-xl font-semibold mt-4">PAYSLIP</h3>
            </div>

            {/* Employee Info */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Employee Name:</span>
                  <span className="font-medium">{payslip.employeeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Employee ID:</span>
                  <span className="font-medium">{payslip.employeeNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Department:</span>
                  <span className="font-medium">{payslip.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Position:</span>
                  <span className="font-medium">{payslip.position}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference No:</span>
                  <span className="font-medium">{payslip.referenceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pay Period:</span>
                  <span className="font-medium">
                    {formatDate(payslip.payrollRun.cutoffStart)} - {formatDate(payslip.payrollRun.cutoffEnd)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pay Date:</span>
                  <span className="font-medium">{formatDate(payslip.payrollRun.payDate, 'long')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Daily Rate:</span>
                  <span className="font-medium">{formatCurrency(payslip.dailyRate)}</span>
                </div>
              </div>
            </div>

            {/* Attendance Summary */}
            <div className="bg-muted/50 p-4 rounded-lg mb-6">
              <p className="text-sm font-medium mb-2">Attendance Summary (Workdays: Monday-Saturday, Sundays excluded)</p>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{payslip.eligibleWorkdays}</p>
                  <p className="text-xs text-muted-foreground">Eligible Days</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{payslip.presentDays}</p>
                  <p className="text-xs text-muted-foreground">Present</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{payslip.absentDays}</p>
                  <p className="text-xs text-muted-foreground">Absent</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{payslip.totalLateMinutes}</p>
                  <p className="text-xs text-muted-foreground">Late (mins)</p>
                </div>
              </div>
            </div>

            {/* Earnings & Deductions */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Earnings */}
              <div>
                <h4 className="font-semibold mb-3 bg-green-100 p-2 rounded">EARNINGS</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead className="text-right">AMOUNT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Basic Pay</TableCell>
                      <TableCell className="text-right">{formatCurrency(payslip.basicPay)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Holiday</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(String(payslip.holidayPay)) > 0
                          ? formatCurrency(payslip.holidayPay)
                          : '-'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Overtime</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(String(payslip.overtimePay)) > 0
                          ? formatCurrency(payslip.overtimePay)
                          : '-'}
                      </TableCell>
                    </TableRow>
                    {parseFloat(String(payslip.cola)) > 0 && (
                      <TableRow>
                        <TableCell>COLA</TableCell>
                        <TableCell className="text-right">{formatCurrency(payslip.cola)}</TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell className="font-medium">COLA (KPI)</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(payslip.kpi)}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold">Gross Pay</TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatCurrency(payslip.grossPay)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Deductions */}
              <div>
                <h4 className="font-semibold mb-3 bg-red-100 p-2 rounded">DEDUCTIONS</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead className="text-right">AMOUNT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Absences</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(String(payslip.absenceDeduction)) > 0
                          ? formatCurrency(payslip.absenceDeduction)
                          : '-'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Undertime/Late</TableCell>
                      <TableCell className="text-right">
                        {(parseFloat(String(payslip.lateDeduction)) + parseFloat(String(payslip.undertimeDeduction))) > 0
                          ? formatCurrency(parseFloat(String(payslip.lateDeduction)) + parseFloat(String(payslip.undertimeDeduction)))
                          : '-'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Withholding Tax</TableCell>
                      <TableCell className="text-right">-</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>SSS</TableCell>
                      <TableCell className="text-right">
                        {payslip.govDeductionsApplied && parseFloat(String(payslip.sssDeduction)) > 0
                          ? formatCurrency(payslip.sssDeduction)
                          : '-'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Philhealth</TableCell>
                      <TableCell className="text-right">
                        {payslip.govDeductionsApplied && parseFloat(String(payslip.philhealthDeduction)) > 0
                          ? formatCurrency(payslip.philhealthDeduction)
                          : '-'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Pag-ibig</TableCell>
                      <TableCell className="text-right">
                        {payslip.govDeductionsApplied && parseFloat(String(payslip.pagibigDeduction)) > 0
                          ? formatCurrency(payslip.pagibigDeduction)
                          : '-'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Pag-ibig Loan</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(String(payslip.pagibigLoanDeduction)) > 0
                          ? formatCurrency(payslip.pagibigLoanDeduction)
                          : '-'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>SSS Salary Loan</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(String(payslip.sssLoanDeduction)) > 0
                          ? formatCurrency(payslip.sssLoanDeduction)
                          : '-'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Cash Advances</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(String(payslip.cashAdvanceDeduction)) > 0
                          ? formatCurrency(payslip.cashAdvanceDeduction)
                          : '-'}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold">Total Deductions</TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {formatCurrency(payslip.totalDeductions)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Net Pay */}
            <div className="bg-castleton-green/10 p-6 rounded-lg text-center mb-6">
              <p className="text-sm text-muted-foreground">NET PAY</p>
              <p className="text-4xl font-bold text-castleton-green">{formatCurrency(payslip.netPay)}</p>
              <p className="text-sm mt-2 italic">{payslip.netPayInWords}</p>
            </div>

            {/* Gov deductions note */}
            {!payslip.govDeductionsApplied && (
              <p className="text-xs text-muted-foreground text-center mb-6">
                * Government deductions (SSS, PhilHealth, Pag-IBIG) are applied only for the 16th-end of month cutoff.
              </p>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-8 mt-8 pt-8 border-t">
              <div className="text-center">
                <div className="border-b border-black mb-2 h-12"></div>
                <p className="text-sm">Prepared by</p>
              </div>
              <div className="text-center">
                <div className="border-b border-black mb-2 h-12"></div>
                <p className="text-sm">Approved by</p>
              </div>
              <div className="text-center">
                <div className="border-b border-black mb-2 h-12"></div>
                <p className="text-sm">Received by</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Edit & Computation Breakdown (no-print) */}
      <div className="no-print space-y-6">
        {/* KPI Edit */}
        {!isFinalized && (
          <Card>
            <CardHeader>
              <CardTitle>Edit KPI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kpi">KPI Amount</Label>
                  <Input
                    id="kpi"
                    type="number"
                    value={kpiValue}
                    onChange={(e) => setKpiValue(e.target.value)}
                    className="w-48"
                  />
                </div>
                <Button onClick={saveKpi} disabled={isSavingKpi}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSavingKpi ? 'Saving...' : 'Save KPI'}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Changing KPI will automatically recalculate Gross Pay and Net Pay.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Computation Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Computation Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-muted rounded">
                <p className="font-medium">Workday Rule</p>
                <p className="text-muted-foreground">{payslip.computationBreakdown?.workdayRule}</p>
              </div>
              <div className="p-3 bg-muted rounded">
                <p className="font-medium">Basic Pay</p>
                <p className="text-muted-foreground">{payslip.computationBreakdown?.basicPayFormula}</p>
              </div>
              <div className="p-3 bg-muted rounded">
                <p className="font-medium">Absence Deduction</p>
                <p className="text-muted-foreground">{payslip.computationBreakdown?.absenceFormula}</p>
              </div>
              <div className="p-3 bg-muted rounded">
                <p className="font-medium">Late Deduction</p>
                <p className="text-muted-foreground">{payslip.computationBreakdown?.lateFormula}</p>
              </div>
              <div className="p-3 bg-muted rounded">
                <p className="font-medium">Undertime Deduction</p>
                <p className="text-muted-foreground">{payslip.computationBreakdown?.undertimeFormula}</p>
              </div>
              <div className="p-3 bg-muted rounded">
                <p className="font-medium">Overtime</p>
                <p className="text-muted-foreground">{payslip.computationBreakdown?.overtimeFormula}</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-castleton-green/10 rounded">
                <p className="font-medium text-castleton-green">Holiday Pay & Leaves</p>
                <p className="text-dark-serpent/80 dark:text-foreground/70">{payslip.computationBreakdown?.holidayNote}</p>
              </div>
              <div className="p-3 bg-saffron/10 rounded">
                <p className="font-medium text-castleton-green">KPI Status</p>
                <p className="text-dark-serpent/80 dark:text-foreground/70">
                  {payslip.computationBreakdown?.kpiNote}</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-saffron/10 rounded">
                <p className="font-medium text-amber-800 dark:text-saffron">Government Deductions</p>
                <p className="text-amber-700 dark:text-foreground/70">{payslip.computationBreakdown?.govDeductionNote}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timesheet Entries */}
        {payslip.timesheetEntries.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Timesheet Entries</CardTitle>
              <Link href={`/dashboard/timesheet-review?payrollRunId=${payslip.payrollRun.id}`}>
                <Button variant="outline" size="sm">
                  Edit Entries
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Time Out</TableHead>
                    <TableHead>Late (mins)</TableHead>
                    <TableHead>UT (mins)</TableHead>
                    <TableHead>OT (h:mm)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslip.timesheetEntries.map((entry, i) => {
                    const date = new Date(entry.date);
                    const dayName = date.toLocaleDateString('en-PH', { weekday: 'short' });
                    return (
                      <TableRow key={i}>
                        <TableCell>{formatDate(entry.date)}</TableCell>
                        <TableCell>{dayName}</TableCell>
                        <TableCell>{entry.timeIn || '-'}</TableCell>
                        <TableCell>{entry.timeOut || '-'}</TableCell>
                        <TableCell>
                          {entry.minutesLate > 0 ? (
                            <span className="text-amber-600">{entry.minutesLate}</span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.undertimeMinutes > 0 ? (
                            <span className="text-orange-600">{entry.undertimeMinutes}</span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {formatOvertimeHours(entry.overtimeHours)}
                        </TableCell>
                        <TableCell>
                          {entry.isAbsent ? (
                            <Badge variant="destructive">Absent</Badge>
                          ) : entry.leaveType === 'SPECIAL_HOLIDAY' ? (
                            <Badge variant="secondary">Special Holiday</Badge>
                          ) : entry.leaveType === 'REGULAR_HOLIDAY' ? (
                            <Badge variant="secondary">Regular Holiday</Badge>
                          ) : entry.leaveType === 'VL' ? (
                            <Badge variant="outline">VL</Badge>
                          ) : entry.leaveType === 'SL' ? (
                            <Badge variant="outline">SL</Badge>
                          ) : entry.leaveType === 'OFFSET' ? (
                            <Badge variant="outline">Offset</Badge>
                          ) : (
                            <Badge variant="success">Present</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
