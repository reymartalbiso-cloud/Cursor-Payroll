'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Trash2, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
  _count: { payslips: number };
}

export default function PayrollRunsPage() {
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  
  const [newRun, setNewRun] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    cutoffType: 'FIRST_HALF' as 'FIRST_HALF' | 'SECOND_HALF',
    payDate: '',
  });

  const { toast } = useToast();

  const fetchPayrollRuns = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(filterYear && { year: filterYear }),
        ...(filterStatus && { status: filterStatus }),
      });
      const res = await fetch(`/api/payroll-runs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPayrollRuns(data.payrollRuns);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch payroll runs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, filterYear, filterStatus]);

  useEffect(() => {
    fetchPayrollRuns();
  }, [fetchPayrollRuns]);

  const handleCreate = async () => {
    if (!newRun.payDate) {
      toast({
        title: 'Error',
        description: 'Please select a pay date',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/payroll-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRun),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create');
      }

      toast({ title: 'Success', description: 'Payroll run created' });
      setIsDialogOpen(false);
      fetchPayrollRuns();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payroll run?')) return;

    try {
      const res = await fetch(`/api/payroll-runs/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      toast({ title: 'Success', description: 'Payroll run deleted' });
      fetchPayrollRuns();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  const handleFinalize = async (id: string) => {
    if (!confirm('Are you sure you want to finalize this payroll run? This action cannot be undone.')) return;

    try {
      const res = await fetch(`/api/payroll-runs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FINALIZED' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to finalize');
      }

      toast({ title: 'Success', description: 'Payroll run finalized' });
      fetchPayrollRuns();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to finalize',
        variant: 'destructive',
      });
    }
  };

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

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Runs</h1>
          <p className="text-muted-foreground">
            Manage payroll runs per cutoff period
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Payroll Run
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select
              value={filterYear}
              onValueChange={(v) => {
                setFilterYear(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterStatus}
              onValueChange={(v) => {
                setFilterStatus(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="REVIEWED">Reviewed</SelectItem>
                <SelectItem value="FINALIZED">Finalized</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Run List</CardTitle>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Cutoff Period</TableHead>
                    <TableHead>Pay Date</TableHead>
                    <TableHead>Workdays</TableHead>
                    <TableHead>Payslips</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRuns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No payroll runs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    payrollRuns.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="font-medium">{run.name}</TableCell>
                        <TableCell>
                          {formatDate(run.cutoffStart)} - {formatDate(run.cutoffEnd)}
                        </TableCell>
                        <TableCell>{formatDate(run.payDate)}</TableCell>
                        <TableCell>{run.eligibleWorkdays} days</TableCell>
                        <TableCell>{run._count.payslips}</TableCell>
                        <TableCell>{getStatusBadge(run.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/dashboard/payroll-runs/${run.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {run.status !== 'FINALIZED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleFinalize(run.id)}
                                title="Finalize"
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                            )}
                            {/* Allow delete for non-finalized OR finalized with 0 payslips */}
                            {(run.status !== 'FINALIZED' || run._count.payslips === 0) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(run.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
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

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payroll Run</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Select
                  value={newRun.year.toString()}
                  onValueChange={(v) => setNewRun({ ...newRun, year: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Month</Label>
                <Select
                  value={newRun.month.toString()}
                  onValueChange={(v) => setNewRun({ ...newRun, month: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m, i) => (
                      <SelectItem key={i} value={(i + 1).toString()}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cutoff Type</Label>
              <Select
                value={newRun.cutoffType}
                onValueChange={(v) =>
                  setNewRun({ ...newRun, cutoffType: v as 'FIRST_HALF' | 'SECOND_HALF' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIRST_HALF">1st - 15th (First Half)</SelectItem>
                  <SelectItem value="SECOND_HALF">16th - End of Month (Second Half)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pay Date</Label>
              <Input
                type="date"
                value={newRun.payDate}
                onChange={(e) => setNewRun({ ...newRun, payDate: e.target.value })}
              />
            </div>
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> Government deductions (SSS, PhilHealth, Pag-IBIG) will only
                be applied for the 16th-end of month cutoff.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
