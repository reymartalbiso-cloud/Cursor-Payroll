'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { 
  Search, 
  Edit, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Clock,
  UserX,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Calendar,
  FileText
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type SortField = 'date' | 'employee' | 'late' | 'undertime' | 'overtime';
type SortOrder = 'asc' | 'desc';

interface TimesheetEntry {
  id: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  minutesLate: number;
  undertimeMinutes: number;
  overtimeHours: number;
  isAbsent: boolean;
  isOnLeave: boolean;
  leaveType: string | null;
  isLateExcused: boolean;
  isAbsentExcused: boolean;
  adjustedLateMinutes: number | null;
  adjustedUndertimeMinutes: number | null;
  adjustedOvertimeHours: number | null;
  adjustmentRemarks: string | null;
  adjustedBy: string | null;
  adjustedAt: string | null;
  employee: {
    employeeNo: string;
    firstName: string;
    lastName: string;
    department: string;
  };
}

interface PayrollRun {
  id: string;
  name: string;
  cutoffStart: string;
  cutoffEnd: string;
  payDate: string;
  eligibleWorkdays: number;
  status: string;
  _count?: {
    payslips: number;
  };
}

interface Stats {
  totalEntries: number;
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
  lateCount: number;
  absentCount: number;
  excusedLateCount: number;
  excusedAbsentCount: number;
}

export default function TimesheetReviewPage() {
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [expandedPayrollRun, setExpandedPayrollRun] = useState<string | null>(null);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [search, setSearch] = useState('');
  const [filterLate, setFilterLate] = useState('all');
  const [filterAbsent, setFilterAbsent] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();

  // Fetch payroll runs
  useEffect(() => {
    const fetchPayrollRuns = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/payroll-runs?limit=100');
        if (res.ok) {
          const data = await res.json();
          setPayrollRuns(data.payrollRuns || []);
        }
      } catch (error) {
        console.error('Failed to fetch payroll runs:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPayrollRuns();
  }, []);

  // Fetch timesheet entries when a payroll run is expanded
  const fetchEntries = useCallback(async (payrollRunId: string) => {
    setIsLoadingEntries(true);
    try {
      const params = new URLSearchParams({
        payrollRunId,
        page: page.toString(),
        limit: '50',
        sortField,
        sortOrder,
        ...(search && { search }),
        ...(filterLate !== 'all' && { filterLate }),
        ...(filterAbsent !== 'all' && { filterAbsent }),
      });
      
      const res = await fetch(`/api/timesheet-entries?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setTotalPages(data.totalPages || 1);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Failed to fetch entries:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch timesheet entries',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingEntries(false);
    }
  }, [page, search, filterLate, filterAbsent, sortField, sortOrder, toast]);

  // Fetch entries when expanded payroll run changes or filters change
  useEffect(() => {
    if (expandedPayrollRun) {
      fetchEntries(expandedPayrollRun);
    }
  }, [expandedPayrollRun, fetchEntries]);

  const handleToggleExpand = (payrollRunId: string) => {
    if (expandedPayrollRun === payrollRunId) {
      setExpandedPayrollRun(null);
      setEntries([]);
      setStats(null);
    } else {
      setExpandedPayrollRun(payrollRunId);
      setPage(1);
      setSearch('');
      setFilterLate('all');
      setFilterAbsent('all');
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const handleEdit = (entry: TimesheetEntry) => {
    setEditingEntry({
      ...entry,
      adjustedLateMinutes: entry.adjustedLateMinutes,
      adjustedUndertimeMinutes: entry.adjustedUndertimeMinutes,
      adjustedOvertimeHours: entry.adjustedOvertimeHours,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    
    setIsSaving(true);
    try {
      const res = await fetch(`/api/timesheet-entries/${editingEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLateExcused: editingEntry.isLateExcused,
          isAbsentExcused: editingEntry.isAbsentExcused,
          adjustedLateMinutes: editingEntry.adjustedLateMinutes,
          adjustedUndertimeMinutes: editingEntry.adjustedUndertimeMinutes,
          adjustedOvertimeHours: editingEntry.adjustedOvertimeHours,
          adjustmentRemarks: editingEntry.adjustmentRemarks,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save');
      }

      toast({
        title: 'Success',
        description: 'Timesheet entry updated',
      });

      setIsEditDialogOpen(false);
      setEditingEntry(null);
      if (expandedPayrollRun) {
        fetchEntries(expandedPayrollRun);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save changes',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (time: string | null) => {
    return time || '-';
  };

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

  const getStatusBadge = (entry: TimesheetEntry) => {
    if (entry.isAbsent) {
      return entry.isAbsentExcused 
        ? <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Absent (Excused)</Badge>
        : <Badge variant="destructive">Absent</Badge>;
    }
    if (entry.isOnLeave) {
      return <Badge variant="secondary">{entry.leaveType || 'Leave'}</Badge>;
    }
    return <Badge variant="success">Present</Badge>;
  };

  const getPayrollRunStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>;
      case 'FINALIZED':
        return <Badge variant="success">Finalized</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Timesheet Review</h1>
        <p className="text-muted-foreground">
          Review and adjust timesheet entries after import
        </p>
      </div>

      {/* Payroll Runs List */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : payrollRuns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payroll runs found. Create a payroll run and import timesheet data first.
            </div>
          ) : (
            <div className="space-y-4">
              {payrollRuns.map((run) => (
                <div key={run.id} className="border rounded-lg">
                  {/* Payroll Run Header */}
                  <div className="flex items-center justify-between p-4 bg-muted/30">
                    <div className="flex items-center gap-6">
                      <div>
                        <h3 className="font-semibold">{run.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(run.cutoffStart)} - {formatDate(run.cutoffEnd)}
                        </p>
                      </div>
                      <div className="hidden md:flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Pay: {formatDate(run.payDate)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{run.eligibleWorkdays} days</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{run._count?.payslips || 0} payslips</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getPayrollRunStatusBadge(run.status)}
                      <Button
                        variant={expandedPayrollRun === run.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleToggleExpand(run.id)}
                      >
                        {expandedPayrollRun === run.id ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Show
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedPayrollRun === run.id && (
                    <div className="p-4 border-t">
                      {/* Filters */}
                      <div className="flex flex-wrap gap-4 mb-4">
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
                          value={filterLate}
                          onValueChange={(v) => {
                            setFilterLate(v);
                            setPage(1);
                          }}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Filter Late" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="late">Late Only</SelectItem>
                            <SelectItem value="excused">Excused Only</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Select
                          value={filterAbsent}
                          onValueChange={(v) => {
                            setFilterAbsent(v);
                            setPage(1);
                          }}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Filter Absent" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="absent">Absent Only</SelectItem>
                            <SelectItem value="excused">Excused Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Stats Summary */}
                      {stats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          <div className="bg-orange-50 p-3 rounded-lg flex items-center gap-2">
                            <Clock className="h-5 w-5 text-orange-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Late</p>
                              <p className="font-semibold">{stats.lateCount} <span className="text-xs font-normal text-green-600">({stats.excusedLateCount} excused)</span></p>
                            </div>
                          </div>
                          
                          <div className="bg-red-50 p-3 rounded-lg flex items-center gap-2">
                            <UserX className="h-5 w-5 text-red-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Absent</p>
                              <p className="font-semibold">{stats.absentCount} <span className="text-xs font-normal text-green-600">({stats.excusedAbsentCount} excused)</span></p>
                            </div>
                          </div>
                          
                          <div className="bg-yellow-50 p-3 rounded-lg flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-yellow-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Total Late Mins</p>
                              <p className="font-semibold">{stats.totalLateMinutes}</p>
                            </div>
                          </div>
                          
                          <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-blue-500" />
                            <div>
                              <p className="text-xs text-muted-foreground">Total Entries</p>
                              <p className="font-semibold">{stats.totalEntries}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Entries Table */}
                      {isLoadingEntries ? (
                        <div className="flex justify-center py-8">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                        </div>
                      ) : (
                        <>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>
                                  <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('employee')}>
                                    Employee <SortIcon field="employee" />
                                  </Button>
                                </TableHead>
                                <TableHead>
                                  <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('date')}>
                                    Date <SortIcon field="date" />
                                  </Button>
                                </TableHead>
                                <TableHead>Time In</TableHead>
                                <TableHead>Time Out</TableHead>
                                <TableHead>
                                  <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('late')}>
                                    Late <SortIcon field="late" />
                                  </Button>
                                </TableHead>
                                <TableHead>
                                  <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('undertime')}>
                                    UT <SortIcon field="undertime" />
                                  </Button>
                                </TableHead>
                                <TableHead>
                                  <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('overtime')}>
                                    OT (h:mm) <SortIcon field="overtime" />
                                  </Button>
                                </TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {entries.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                    No entries found
                                  </TableCell>
                                </TableRow>
                              ) : (
                                entries.map((entry) => (
                                  <TableRow key={entry.id} className={entry.isLateExcused || entry.isAbsentExcused ? 'bg-yellow-50' : ''}>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium">{entry.employee.lastName}, {entry.employee.firstName}</p>
                                        <p className="text-xs text-muted-foreground">{entry.employee.employeeNo}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell>{formatDate(entry.date)}</TableCell>
                                    <TableCell>{formatTime(entry.timeIn)}</TableCell>
                                    <TableCell>{formatTime(entry.timeOut)}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1">
                                        {entry.adjustedLateMinutes !== null ? (
                                          <span className="text-blue-600" title={`Original: ${entry.minutesLate}`}>
                                            {entry.adjustedLateMinutes}*
                                          </span>
                                        ) : (
                                          entry.minutesLate > 0 ? (
                                            <span className="text-orange-600">{entry.minutesLate}</span>
                                          ) : '-'
                                        )}
                                        {entry.isLateExcused && (
                                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">E</Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {entry.adjustedUndertimeMinutes !== null ? (
                                        <span className="text-blue-600">{entry.adjustedUndertimeMinutes}*</span>
                                      ) : (
                                        entry.undertimeMinutes > 0 ? entry.undertimeMinutes : '-'
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {entry.adjustedOvertimeHours !== null ? (
                                        <span className="text-blue-600">{formatOvertimeHours(entry.adjustedOvertimeHours)}*</span>
                                      ) : (
                                        formatOvertimeHours(entry.overtimeHours)
                                      )}
                                    </TableCell>
                                    <TableCell>{getStatusBadge(entry)}</TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEdit(entry)}
                                        title="Edit Entry"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>

                          {/* Pagination */}
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
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Timesheet Entry</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="font-medium">{editingEntry.employee.lastName}, {editingEntry.employee.firstName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(editingEntry.date)} | {formatTime(editingEntry.timeIn)} - {formatTime(editingEntry.timeOut)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isLateExcused"
                      checked={editingEntry.isLateExcused}
                      onCheckedChange={(checked) =>
                        setEditingEntry({ ...editingEntry, isLateExcused: checked as boolean })
                      }
                    />
                    <Label htmlFor="isLateExcused">Excuse Late (won&apos;t affect KPI)</Label>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isAbsentExcused"
                      checked={editingEntry.isAbsentExcused}
                      onCheckedChange={(checked) =>
                        setEditingEntry({ ...editingEntry, isAbsentExcused: checked as boolean })
                      }
                    />
                    <Label htmlFor="isAbsentExcused">Excuse Absent (won&apos;t affect KPI)</Label>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Override Calculated Values (leave empty to use original)</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adjustedLateMinutes">Late Minutes</Label>
                    <Input
                      id="adjustedLateMinutes"
                      type="number"
                      placeholder={`Original: ${editingEntry.minutesLate}`}
                      value={editingEntry.adjustedLateMinutes ?? ''}
                      onChange={(e) =>
                        setEditingEntry({
                          ...editingEntry,
                          adjustedLateMinutes: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="adjustedUndertimeMinutes">Undertime Mins</Label>
                    <Input
                      id="adjustedUndertimeMinutes"
                      type="number"
                      placeholder={`Original: ${editingEntry.undertimeMinutes}`}
                      value={editingEntry.adjustedUndertimeMinutes ?? ''}
                      onChange={(e) =>
                        setEditingEntry({
                          ...editingEntry,
                          adjustedUndertimeMinutes: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="adjustedOvertimeHours">OT (decimal hrs)</Label>
                    <Input
                      id="adjustedOvertimeHours"
                      type="number"
                      step="0.01"
                      placeholder={`Original: ${formatOvertimeHours(editingEntry.overtimeHours)}`}
                      value={editingEntry.adjustedOvertimeHours ?? ''}
                      onChange={(e) =>
                        setEditingEntry({
                          ...editingEntry,
                          adjustedOvertimeHours: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">e.g., 1.5 = 1:30</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjustmentRemarks">Remarks</Label>
                <Textarea
                  id="adjustmentRemarks"
                  placeholder="e.g., Approved by Manager, Medical emergency, etc."
                  value={editingEntry.adjustmentRemarks || ''}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, adjustmentRemarks: e.target.value })
                  }
                />
              </div>

              {editingEntry.adjustedBy && (
                <p className="text-xs text-muted-foreground">
                  Last adjusted by {editingEntry.adjustedBy} on {formatDate(editingEntry.adjustedAt || '')}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
