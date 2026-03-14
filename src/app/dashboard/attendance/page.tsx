'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, UserX, AlertTriangle, Users, ArrowUpDown, ArrowUp, ArrowDown, Search, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const YEARS_OPTIONS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

export default function AttendanceSummaryPage() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [totals, setTotals] = useState<AttendanceTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState<number[]>(() => [new Date().getMonth() + 1]);
  const [selectedYears, setSelectedYears] = useState<number[]>(() => [new Date().getFullYear()]);
  const [sortField, setSortField] = useState<SortField>('employeeNo');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [search, setSearch] = useState('');
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const monthRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fetchAttendance = useCallback(async () => {
    if (selectedMonths.length === 0 || selectedYears.length === 0) return;
    setIsLoading(true);
    try {
      const monthsParam = selectedMonths.length === 12 ? 'all' : selectedMonths.join(',');
      const yearsParam = selectedYears.length === YEARS_OPTIONS.length ? 'all' : selectedYears.join(',');
      const res = await fetch(
        `/api/attendance-summary?months=${encodeURIComponent(monthsParam)}&years=${encodeURIComponent(yearsParam)}`
      );
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
  }, [selectedMonths, selectedYears, toast]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (monthRef.current && !monthRef.current.contains(e.target as Node)) setMonthDropdownOpen(false);
      if (yearRef.current && !yearRef.current.contains(e.target as Node)) setYearDropdownOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 ml-1" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

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

  const searchLower = search.trim().toLowerCase();
  const filteredAttendance = searchLower
    ? sortedAttendance.filter(
        (record) =>
          record.employeeNo.toLowerCase().includes(searchLower) ||
          record.employeeName.toLowerCase().includes(searchLower)
      )
    : sortedAttendance;

  // Smart summary: when searching, cards show totals for filtered employee(s) only; otherwise show all for selected month/year
  const isFiltered = searchLower.length > 0;
  const displayTotals: AttendanceTotals = isFiltered
    ? {
        totalEmployees: filteredAttendance.length,
        employeesWithData: filteredAttendance.filter((a) => a.hasData).length,
        totalLateOccurrences: filteredAttendance.reduce((s, a) => s + a.lateCount, 0),
        totalAbsences: filteredAttendance.reduce((s, a) => s + a.absentCount, 0),
        totalLateMinutes: filteredAttendance.reduce((s, a) => s + a.totalLateMinutes, 0),
        kpiVoidedCount: filteredAttendance.filter((a) => a.kpiVoided).length,
      }
    : (totals ?? {
        totalEmployees: 0,
        employeesWithData: 0,
        totalLateOccurrences: 0,
        totalAbsences: 0,
        totalLateMinutes: 0,
        kpiVoidedCount: 0,
      });

  const isSingleEmployee = isFiltered && filteredAttendance.length === 1;
  const employeeLabel = isSingleEmployee ? 'employee' : 'employees';

  const periodLabel =
    selectedMonths.length === 0 || selectedYears.length === 0
      ? 'selected period'
      : selectedMonths.length === 12 && selectedYears.length === YEARS_OPTIONS.length
        ? 'all months, all years'
        : selectedMonths.length === 12
          ? `all months, ${selectedYears.slice().sort((a, b) => b - a).join(', ')}`
          : selectedYears.length === YEARS_OPTIONS.length
            ? `${selectedMonths.slice().sort((a, b) => a - b).map((m) => MONTHS[m - 1]).join(', ')} (all years)`
            : `${selectedMonths.slice().sort((a, b) => a - b).map((m) => MONTHS[m - 1]).join(', ')} ${selectedYears.slice().sort((a, b) => b - a).join(', ')}`;

  const summaryCards = [
    {
      label: isFiltered ? `Employees (filtered)` : 'Total Employees',
      value: displayTotals.totalEmployees,
      sub: isFiltered && displayTotals.totalEmployees > 0 ? `for ${periodLabel}` : null,
      icon: Users,
      iconBg: 'bg-castleton-green/10 text-castleton-green',
    },
    {
      label: 'Late Occurrences',
      value: displayTotals.totalLateOccurrences,
      sub: `${displayTotals.totalLateMinutes} mins total`,
      icon: Clock,
      iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-500/10',
    },
    {
      label: 'Total Absences',
      value: displayTotals.totalAbsences,
      sub: isFiltered ? `for selected ${employeeLabel}` : null,
      icon: UserX,
      iconBg: 'bg-red-100 text-red-600 dark:bg-red-500/10',
    },
    {
      label: 'KPI Voided',
      value: displayTotals.kpiVoidedCount,
      sub: employeeLabel,
      icon: AlertTriangle,
      iconBg: 'bg-purple-100 text-purple-600 dark:bg-purple-500/10',
    },
  ];

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Attendance Summary</h1>
        <p className="text-sm text-muted-foreground">
          View late and absence records for all employees
        </p>
      </div>

      {/* Filters - raise stacking context when dropdowns open so they appear above summary cards */}
      <div className={cn('relative', (monthDropdownOpen || yearDropdownOpen) && 'z-[100]')}>
        <Card>
          <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1 relative" ref={monthRef}>
              <label className="text-sm font-medium">Month</label>
              <Button
                type="button"
                variant="outline"
                className="w-[160px] justify-between font-normal"
                onClick={() => setMonthDropdownOpen((o) => !o)}
              >
                <span className="truncate">
                  {selectedMonths.length === 0
                    ? 'Select months'
                    : selectedMonths.length === 12
                      ? 'All months'
                      : selectedMonths
                          .slice()
                          .sort((a, b) => a - b)
                          .map((m) => MONTHS[m - 1])
                          .join(', ')}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
              {monthDropdownOpen && (
                <div className="absolute top-full left-0 z-50 mt-1 w-[200px] rounded-md border bg-popover p-2 shadow-md">
                  <label className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent">
                    <Checkbox
                      checked={selectedMonths.length === 12}
                      onCheckedChange={(checked) => {
                        setSelectedMonths(checked ? [...ALL_MONTHS] : []);
                      }}
                    />
                    All months
                  </label>
                  <div className="my-1 border-t" />
                  {MONTHS.map((m, i) => {
                    const monthNum = i + 1;
                    return (
                      <label
                        key={monthNum}
                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
                      >
                        <Checkbox
                          checked={selectedMonths.includes(monthNum)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const next = [...selectedMonths, monthNum].sort((a, b) => a - b);
                              setSelectedMonths(next.length === 12 ? [...ALL_MONTHS] : next);
                            } else {
                              setSelectedMonths(selectedMonths.filter((n) => n !== monthNum));
                            }
                          }}
                        />
                        {m}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-1 relative" ref={yearRef}>
              <label className="text-sm font-medium">Year</label>
              <Button
                type="button"
                variant="outline"
                className="w-[160px] justify-between font-normal"
                onClick={() => setYearDropdownOpen((o) => !o)}
              >
                <span className="truncate">
                  {selectedYears.length === 0
                    ? 'Select years'
                    : selectedYears.length === YEARS_OPTIONS.length
                      ? 'All years'
                      : selectedYears
                          .slice()
                          .sort((a, b) => b - a)
                          .join(', ')}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
              {yearDropdownOpen && (
                <div className="absolute top-full left-0 z-50 mt-1 w-[200px] rounded-md border bg-popover p-2 shadow-md max-h-[280px] overflow-y-auto">
                  <label className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent">
                    <Checkbox
                      checked={selectedYears.length === YEARS_OPTIONS.length}
                      onCheckedChange={(checked) => {
                        setSelectedYears(checked ? [...YEARS_OPTIONS] : []);
                      }}
                    />
                    All years
                  </label>
                  <div className="my-1 border-t" />
                  {YEARS_OPTIONS.map((y) => (
                    <label
                      key={y}
                      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
                    >
                      <Checkbox
                        checked={selectedYears.includes(y)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            const next = [...selectedYears, y].sort((a, b) => b - a);
                            setSelectedYears(next.length === YEARS_OPTIONS.length ? [...YEARS_OPTIONS] : next);
                          } else {
                            setSelectedYears(selectedYears.filter((n) => n !== y));
                          }
                        }}
                      />
                      {y}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-[200px] max-w-md space-y-1">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or Employee ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label}>
                <CardContent className="pt-5 pb-4 px-4 sm:px-6">
                  <div className="flex flex-col gap-3">
                    <div className={`p-2 rounded-lg w-fit ${card.iconBg}`}>
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{card.label}</p>
                      <p className="text-xl sm:text-2xl font-bold mt-0.5">{card.value}</p>
                      {card.sub && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{card.sub}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">
            Employee Attendance for {selectedMonths.length === 0 || selectedYears.length === 0 ? 'Select month(s) and year(s)' : periodLabel}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Late &gt; 3 times OR Absent &gt; 2 times = KPI Voided
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-castleton-green border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">
                      <Button variant="ghost" className="p-0 h-auto font-semibold text-xs hover:bg-transparent hover:text-foreground" onClick={() => handleSort('employeeNo')}>
                        Employee ID <SortIcon field="employeeNo" />
                      </Button>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      <Button variant="ghost" className="p-0 h-auto font-semibold text-xs hover:bg-transparent hover:text-foreground" onClick={() => handleSort('employeeName')}>
                        Name <SortIcon field="employeeName" />
                      </Button>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      <Button variant="ghost" className="p-0 h-auto font-semibold text-xs hover:bg-transparent hover:text-foreground" onClick={() => handleSort('department')}>
                        Department <SortIcon field="department" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      <Button variant="ghost" className="p-0 h-auto font-semibold text-xs hover:bg-transparent hover:text-foreground" onClick={() => handleSort('lateCount')}>
                        Late <SortIcon field="lateCount" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      <Button variant="ghost" className="p-0 h-auto font-semibold text-xs hover:bg-transparent hover:text-foreground" onClick={() => handleSort('totalLateMinutes')}>
                        Late Mins <SortIcon field="totalLateMinutes" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">
                      <Button variant="ghost" className="p-0 h-auto font-semibold text-xs hover:bg-transparent hover:text-foreground" onClick={() => handleSort('absentCount')}>
                        Absent <SortIcon field="absentCount" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap">KPI Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {attendance.length === 0
                          ? 'No attendance data found for this period'
                          : 'No employees match your search'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAttendance.map((record) => (
                      <TableRow key={record.employeeId} className={record.kpiVoided ? 'bg-red-50 dark:bg-red-500/5' : ''}>
                        <TableCell className="font-medium whitespace-nowrap">{record.employeeNo}</TableCell>
                        <TableCell className="whitespace-nowrap">{record.employeeName}</TableCell>
                        <TableCell className="whitespace-nowrap">{record.department}</TableCell>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
