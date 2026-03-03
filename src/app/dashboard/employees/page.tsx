'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { LifeScanProfile } from '@/lib/lifescan';

type SortField = 'employeeNo' | 'name' | 'department' | 'position' | 'dailyRate' | 'status';
type SortOrder = 'asc' | 'desc';

interface Employee {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  department: string;
  position: string;
  rateType: 'DAILY' | 'MONTHLY';
  monthlySalary: number;
  dailyRate: number;
  defaultKpi: number;
  sssContribution: number;
  philhealthContribution: number;
  pagibigContribution: number;
  sssLoan: number;
  pagibigLoan: number;
  otherLoans: number;
  cashAdvance: number;
  status: 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
  startDate?: string;
  notes?: string;
}

const emptyEmployee: Partial<Employee> = {
  employeeNo: '',
  firstName: '',
  lastName: '',
  middleName: '',
  department: '',
  position: '',
  rateType: 'DAILY',
  monthlySalary: 0,
  dailyRate: 0,
  defaultKpi: 0,
  sssContribution: 0,
  philhealthContribution: 0,
  pagibigContribution: 0,
  sssLoan: 0,
  pagibigLoan: 0,
  otherLoans: 0,
  cashAdvance: 0,
  status: 'ACTIVE',
  startDate: '',
  notes: '',
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sortField, setSortField] = useState<SortField>('employeeNo');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [lifeScanProfiles, setLifeScanProfiles] = useState<LifeScanProfile[]>([]);
  const { toast } = useToast();

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

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        sortField,
        sortOrder,
        ...(search && { search }),
        ...(filterDepartment && { department: filterDepartment }),
        ...(filterStatus && { status: filterStatus }),
      });
      const res = await fetch(`/api/employees?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees);
        setTotalPages(data.totalPages);
        setDepartments(data.departments);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch employees',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, search, filterDepartment, filterStatus, sortField, sortOrder, toast]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Fetch LifeScan profiles when dialog opens
  const [lifeScanLoading, setLifeScanLoading] = useState(false);
  const [lifeScanError, setLifeScanError] = useState<string | null>(null);

  useEffect(() => {
    if (isDialogOpen && !editingEmployee?.id) {
      setLifeScanLoading(true);
      setLifeScanError(null);
      fetch('/api/lifescan/employees')
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to load LifeScan');
          }
          setLifeScanProfiles(data.profiles || []);
          if (!data.configured) {
            setLifeScanError('LifeScan not configured. Add LIFESCAN_API_URL and LIFESCAN_API_KEY to .env');
          } else if ((data.profiles || []).length === 0) {
            setLifeScanError('No employees found. Ensure LifeScan has users with employee_id and DTR records.');
          }
        })
        .catch((err) => {
          console.error('Failed to fetch LifeScan profiles', err);
          setLifeScanError(err instanceof Error ? err.message : 'Failed to load LifeScan');
          setLifeScanProfiles([]);
        })
        .finally(() => setLifeScanLoading(false));
    } else {
      setLifeScanProfiles([]);
      setLifeScanError(null);
    }
  }, [isDialogOpen, editingEmployee?.id]);

  const handleLifeScanSelect = (employeeId: string) => {
    const profile = lifeScanProfiles.find(p => p.employee_id === employeeId);
    if (profile) {
      setEditingEmployee(prev => ({
        ...prev,
        employeeNo: profile.employee_id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        middleName: profile.middle_name || '',
        department: profile.department || '',
        position: profile.position || '',
      }));
    }
  };

  const handleSave = async () => {
    if (!editingEmployee) return;

    setIsSaving(true);
    try {
      const isEditing = !!editingEmployee.id;
      const url = isEditing
        ? `/api/employees/${editingEmployee.id}`
        : '/api/employees';
      const method = isEditing ? 'PUT' : 'POST';

      // Calculate dailyRate from monthlySalary (monthlySalary / 26)
      const monthlySalary = parseFloat(String(editingEmployee.monthlySalary || 0));
      const calculatedDailyRate = monthlySalary / 26;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingEmployee,
          monthlySalary: monthlySalary,
          dailyRate: calculatedDailyRate,
          defaultKpi: parseFloat(String(editingEmployee.defaultKpi || 0)),
          sssContribution: parseFloat(String(editingEmployee.sssContribution || 0)),
          philhealthContribution: parseFloat(String(editingEmployee.philhealthContribution || 0)),
          pagibigContribution: parseFloat(String(editingEmployee.pagibigContribution || 0)),
          sssLoan: parseFloat(String(editingEmployee.sssLoan || 0)),
          pagibigLoan: parseFloat(String(editingEmployee.pagibigLoan || 0)),
          otherLoans: parseFloat(String(editingEmployee.otherLoans || 0)),
          cashAdvance: parseFloat(String(editingEmployee.cashAdvance || 0)),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      toast({
        title: 'Success',
        description: isEditing ? 'Employee updated' : 'Employee created',
      });

      setIsDialogOpen(false);
      setEditingEmployee(null);
      fetchEmployees();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save employee',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    try {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      toast({ title: 'Success', description: 'Employee deleted' });
      fetchEmployees();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete employee',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'INACTIVE':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'TERMINATED':
        return <Badge variant="destructive">Terminated</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">
            Manage employee master data
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingEmployee({ ...emptyEmployee });
            setIsDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Employee
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
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
              value={filterDepartment}
              onValueChange={(v) => {
                setFilterDepartment(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
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
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="TERMINATED">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-castleton-green border-t-transparent" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('employeeNo')}>
                        Employee ID <SortIcon field="employeeNo" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('name')}>
                        Name <SortIcon field="name" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('department')}>
                        Department <SortIcon field="department" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('position')}>
                        Position <SortIcon field="position" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('dailyRate')}>
                        Daily Rate <SortIcon field="dailyRate" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" className="p-0 h-auto font-semibold hover:bg-transparent" onClick={() => handleSort('status')}>
                        Status <SortIcon field="status" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No employees found
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium">{employee.employeeNo}</TableCell>
                        <TableCell>
                          {employee.lastName}, {employee.firstName} {employee.middleName || ''}
                        </TableCell>
                        <TableCell>{employee.department}</TableCell>
                        <TableCell>{employee.position}</TableCell>
                        <TableCell>{formatCurrency(employee.dailyRate)}</TableCell>
                        <TableCell>{getStatusBadge(employee.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingEmployee(employee);
                                setIsDialogOpen(true);
                              }}
                              title="Edit Employee"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(employee.id)}
                              title="Delete Employee"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee?.id ? 'Edit Employee' : 'Add Employee'}
            </DialogTitle>
          </DialogHeader>
          {editingEmployee && (
            <div className="grid gap-4 py-4">
              {/* LifeScan Selection */}
              {!editingEmployee.id && (
                <div className="bg-muted/50 p-4 rounded-lg mb-4">
                  <Label htmlFor="lifescan-select" className="mb-2 block">Import from LifeScan</Label>
                  {lifeScanLoading ? (
                    <p className="text-sm text-muted-foreground py-2">Loading employees from LifeScan...</p>
                  ) : (
                    <>
                      <Select onValueChange={handleLifeScanSelect} disabled={lifeScanProfiles.length === 0}>
                        <SelectTrigger id="lifescan-select">
                          <SelectValue
                            placeholder={
                              lifeScanProfiles.length === 0
                                ? 'No employees available'
                                : 'Select an employee from LifeScan...'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {lifeScanProfiles.map((profile) => (
                            <SelectItem key={profile.employee_id} value={profile.employee_id}>
                              {profile.last_name}, {profile.first_name} ({profile.employee_id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {lifeScanError && (
                        <p className="text-xs text-amber-600 mt-2">{lifeScanError}</p>
                      )}
                      {!lifeScanError && lifeScanProfiles.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Selecting an employee will auto-fill the details below.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeNo">Employee ID *</Label>
                  <Input
                    id="employeeNo"
                    value={editingEmployee.employeeNo || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, employeeNo: e.target.value })
                    }
                    placeholder="EMP-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={editingEmployee.firstName || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, firstName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={editingEmployee.lastName || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, lastName: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="middleName">Middle Name</Label>
                  <Input
                    id="middleName"
                    value={editingEmployee.middleName || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, middleName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Input
                    id="department"
                    value={editingEmployee.department || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, department: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Position *</Label>
                  <Input
                    id="position"
                    value={editingEmployee.position || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, position: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthlySalary">Monthly Salary *</Label>
                  <Input
                    id="monthlySalary"
                    type="number"
                    value={editingEmployee.monthlySalary || ''}
                    onChange={(e) => {
                      const monthly = parseFloat(e.target.value) || 0;
                      setEditingEmployee({
                        ...editingEmployee,
                        monthlySalary: monthly,
                        dailyRate: monthly / 26  // Auto-calculate daily rate
                      });
                    }}
                    placeholder="e.g., 15000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dailyRate">Daily Rate (auto-calculated)</Label>
                  <Input
                    id="dailyRate"
                    type="text"
                    value={editingEmployee.monthlySalary ? (editingEmployee.monthlySalary / 26).toFixed(2) : '0.00'}
                    readOnly
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">= Monthly ÷ 26</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultKpi">Default KPI</Label>
                  <Input
                    id="defaultKpi"
                    type="number"
                    value={editingEmployee.defaultKpi || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, defaultKpi: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={editingEmployee.status || 'ACTIVE'}
                    onValueChange={(v) =>
                      setEditingEmployee({ ...editingEmployee, status: v as Employee['status'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="TERMINATED">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Government Contributions (for 16-end cutoff)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sssContribution">SSS</Label>
                    <Input
                      id="sssContribution"
                      type="number"
                      value={editingEmployee.sssContribution || ''}
                      onChange={(e) =>
                        setEditingEmployee({ ...editingEmployee, sssContribution: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="philhealthContribution">PhilHealth</Label>
                    <Input
                      id="philhealthContribution"
                      type="number"
                      value={editingEmployee.philhealthContribution || ''}
                      onChange={(e) =>
                        setEditingEmployee({ ...editingEmployee, philhealthContribution: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pagibigContribution">Pag-IBIG</Label>
                    <Input
                      id="pagibigContribution"
                      type="number"
                      value={editingEmployee.pagibigContribution || ''}
                      onChange={(e) =>
                        setEditingEmployee({ ...editingEmployee, pagibigContribution: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Loans & Deductions</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sssLoan">SSS Loan</Label>
                    <Input
                      id="sssLoan"
                      type="number"
                      value={editingEmployee.sssLoan || ''}
                      onChange={(e) =>
                        setEditingEmployee({ ...editingEmployee, sssLoan: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pagibigLoan">Pag-IBIG Loan</Label>
                    <Input
                      id="pagibigLoan"
                      type="number"
                      value={editingEmployee.pagibigLoan || ''}
                      onChange={(e) =>
                        setEditingEmployee({ ...editingEmployee, pagibigLoan: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="otherLoans">Other Loans</Label>
                    <Input
                      id="otherLoans"
                      type="number"
                      value={editingEmployee.otherLoans || ''}
                      onChange={(e) =>
                        setEditingEmployee({ ...editingEmployee, otherLoans: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cashAdvance">Cash Advance</Label>
                    <Input
                      id="cashAdvance"
                      type="number"
                      value={editingEmployee.cashAdvance || ''}
                      onChange={(e) =>
                        setEditingEmployee({ ...editingEmployee, cashAdvance: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={editingEmployee.startDate ? formatDate(editingEmployee.startDate).split('/').reverse().join('-') : ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, startDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={editingEmployee.notes || ''}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, notes: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
