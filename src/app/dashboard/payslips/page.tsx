'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, Download, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Payslip {
  id: string;
  referenceNo: string;
  employeeNo: string;
  employeeName: string;
  department: string;
  netPay: number;
  govDeductionsApplied: boolean;
  payrollRun: {
    id: string;
    name: string;
    cutoffStart: string;
    cutoffEnd: string;
    payDate: string;
    status: string;
  };
}

interface PayrollRun {
  id: string;
  name: string;
}

export default function PayslipsPage() {
  const { toast } = useToast();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPayrollRun, setSelectedPayrollRun] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPayslips = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
        ...(selectedPayrollRun && { payrollRunId: selectedPayrollRun }),
      });
      const res = await fetch(`/api/payslips?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPayslips(data.payslips);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch payslips:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, selectedPayrollRun]);

  const fetchPayrollRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/payroll-runs?limit=50');
      if (res.ok) {
        const data = await res.json();
        setPayrollRuns(data.payrollRuns);
      }
    } catch (error) {
      console.error('Failed to fetch payroll runs:', error);
    }
  }, []);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  useEffect(() => {
    fetchPayrollRuns();
  }, [fetchPayrollRuns]);

  const handleDownload = async (id: string, refNo: string) => {
    try {
      const res = await fetch(`/api/payslips/${id}/pdf`);
      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${refNo}.pdf`;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payslips</h1>
        <p className="text-muted-foreground">
          View and manage all payslips
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>
            <Select
              value={selectedPayrollRun}
              onValueChange={(v) => {
                setSelectedPayrollRun(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="All Payroll Runs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payroll Runs</SelectItem>
                {payrollRuns.map((run) => (
                  <SelectItem key={run.id} value={run.id}>
                    {run.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payslip List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Payroll Period</TableHead>
                    <TableHead>Pay Date</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Gov Ded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No payslips found
                      </TableCell>
                    </TableRow>
                  ) : (
                    payslips.map((payslip) => (
                      <TableRow key={payslip.id}>
                        <TableCell className="font-mono text-sm">
                          {payslip.referenceNo}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payslip.employeeName}</p>
                            <p className="text-sm text-muted-foreground">{payslip.employeeNo}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatDate(payslip.payrollRun.cutoffStart)} -{' '}
                          {formatDate(payslip.payrollRun.cutoffEnd)}
                        </TableCell>
                        <TableCell>{formatDate(payslip.payrollRun.payDate)}</TableCell>
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
                          {payslip.payrollRun.status === 'FINALIZED' ? (
                            <Badge variant="success">Final</Badge>
                          ) : (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/dashboard/payslips/${payslip.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(payslip.id, payslip.referenceNo)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
