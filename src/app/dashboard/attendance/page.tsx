'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Button } from '@/components/ui/button';
import { Clock, UserX, AlertTriangle, Users, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AttendanceRecord {
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  department: string;
  position: string;
  lateCount: number;
  absentCount: number;
  totalLateMinutes: number;
  kpiVoided: boolean;
  kpiVoidReason: string | null;
  hasData: boolean;
}

interface AttendanceTotals {
  totalEmployees: number;
  employeesWithData: number;
  totalLateOccurrences: number;
  totalAbsences: number;
  totalLateMinutes: number;
  kpiVoidedCount: number;
}

type SortField = 'employeeNo' | 'employeeName' | 'department' | 'lateCount' | 'absentCount' | 'totalLateMinutes';
type SortOrder = 'asc' | 'desc';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AttendanceSummaryPage() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [totals, setTotals] = useState<AttendanceTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [sortField, setSortField] = useState<SortField>('employeeNo');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const { toast } = useToast();

  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/attendance-summary?year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setAttendance(data.attendanceSummary);
        setTotals(data.totals);
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch attendance summary',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [year, month, toast]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Sort attendance data
  const sortedAttendance = [...attendance].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'employeeNo':
        comparison = a.employeeNo.localeCompare(b.employeeNo);
        break;
      case 'employeeName':
        comparison = a.employeeName.localeCompare(b.employeeName);
        break;
      case 'department':
        comparison = a.department.localeCompare(b.department);
        break;
      case 'lateCount':
        comparison = a.lateCount - b.lateCount;
        break;
      case 'absentCount':
        comparison = a.absentCount - b.absentCount;
        break;
      case 'totalLateMinutes':
        comparison = a.totalLateMinutes - b.totalLateMinutes;
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance Summary</h1>
        <p className="text-muted-foreground">
          View late and absence records for all employees
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Month</label>
              <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={(i + 1).toString()}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Year</label>
              <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger className="w-[120px]">
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
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Employees</p>
                  <p className="text-2xl font-bold">{totals.totalEmployees}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Late Occurrences</p>
                  <p className="text-2xl font-bold">{totals.totalLateOccurrences}</p>
                  <p className="text-xs text-muted-foreground">{totals.totalLateMinutes} mins total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <UserX className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Absences</p>
                  <p className="text-2xl font-bold">{totals.totalAbsences}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">KPI Voided</p>
                  <p className="text-2xl font-bold">{totals.kpiVoidedCount}</p>
                  <p className="text-xs text-muted-foreground">employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Attendance for {MONTHS[month - 1]} {year}</CardTitle>
          <CardDescription>
            Late &gt; 3 times OR Absent &gt; 2 times = KPI Voided
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('employeeNo')}>
                      Employee ID <SortIcon field="employeeNo" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('employeeName')}>
                      Name <SortIcon field="employeeName" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('department')}>
                      Department <SortIcon field="department" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('lateCount')}>
                      Late Count <SortIcon field="lateCount" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('totalLateMinutes')}>
                      Late Minutes <SortIcon field="totalLateMinutes" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('absentCount')}>
                      Absent Count <SortIcon field="absentCount" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">KPI Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAttendance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No attendance data found for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedAttendance.map((record) => (
                    <TableRow key={record.employeeId} className={record.kpiVoided ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium">{record.employeeNo}</TableCell>
                      <TableCell>{record.employeeName}</TableCell>
                      <TableCell>{record.department}</TableCell>
                      <TableCell className="text-center">
                        <span className={record.lateCount > 3 ? 'text-red-600 font-semibold' : ''}>
                          {record.lateCount}
                          {record.lateCount > 3 && <span className="text-xs ml-1">(max 3)</span>}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{record.totalLateMinutes}</TableCell>
                      <TableCell className="text-center">
                        <span className={record.absentCount > 2 ? 'text-red-600 font-semibold' : ''}>
                          {record.absentCount}
                          {record.absentCount > 2 && <span className="text-xs ml-1">(max 2)</span>}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {!record.hasData ? (
                          <Badge variant="secondary">No Data</Badge>
                        ) : record.kpiVoided ? (
                          <Badge variant="destructive" title={record.kpiVoidReason || ''}>
                            Voided
                          </Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
