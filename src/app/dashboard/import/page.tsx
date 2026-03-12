'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSpreadsheet, AlertTriangle, CheckCircle, XCircle, DownloadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Sheet {
  name: string;
  headers: string[];
  rowCount: number;
  preview: Record<string, unknown>[];
}

interface PayrollRun {
  id: string;
  name: string;
  status: string;
  cutoffStart: string;
  cutoffEnd: string;
}

interface ColumnMapping {
  employeeId?: string;
  employeeName?: string;
  date?: string;
  timeIn?: string;
  timeOut?: string;
  amIn?: string;
  amOut?: string;
  pmIn?: string;
  pmOut?: string;
  status?: string;
  minutesLate?: string;
  undertimeMinutes?: string;
  isAbsent?: string;
  overtimeHours?: string;
  otIn?: string;
  otOut?: string;
  holidayPay?: string;
  remarks?: string;
}

interface ValidationResult {
  validRows: number;
  invalidRows: Array<{ rowIndex: number; errors: string[] }>;
  missingEmployees: string[];
  unrecognizedEmployees: Array<{ identifier: string }>;
  dateRangeValid: boolean;
  dateRangeError?: string;
  preview?: any[];
}

// Helper function to format mapping keys for display
function formatMappingKey(key: string): string {
  const labels: Record<string, string> = {
    employeeId: 'Employee ID',
    employeeName: 'Employee Name',
    date: 'Date',
    status: 'Status',
    timeIn: 'Time In',
    timeOut: 'Time Out',
    amIn: 'AM In',
    amOut: 'AM Out',
    pmIn: 'PM In',
    pmOut: 'PM Out',
    minutesLate: 'Minutes Late',
    undertimeMinutes: 'Undertime',
    isAbsent: 'Absent Flag',
    overtimeHours: 'OT Hours',
    otIn: 'OT In',
    otOut: 'OT Out',
    holidayPay: 'Holiday Pay',
    remarks: 'Remarks',
  };
  return labels[key] || key;
}

export default function ImportTimesheetPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [importMode, setImportMode] = useState<'excel' | 'lifescan'>('excel'); // 'excel' or 'lifescan'

  // Excel State
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [autoDetectedMapping, setAutoDetectedMapping] = useState<ColumnMapping>({});

  // Common State
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedPayrollRun, setSelectedPayrollRun] = useState<string>('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch draft/reviewed payroll runs
  useEffect(() => {
    const fetchPayrollRuns = async () => {
      try {
        const res = await fetch('/api/payroll-runs?status=DRAFT,REVIEWED,FINALIZED&limit=50');
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/import/parse', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to parse file');
      }

      const data = await res.json();
      setSheets(data.sheets);

      // Auto-select first sheet and use auto-detected mapping
      if (data.sheets.length >= 1) {
        setSelectedSheet(data.sheets[0].name);
        if (data.sheets[0].autoMapping) {
          setAutoDetectedMapping(data.sheets[0].autoMapping);
          setMapping(data.sheets[0].autoMapping);
        }
      }
      setStep(2);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to parse file',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update mapping when sheet changes
  useEffect(() => {
    if (importMode === 'excel') {
      const sheet = sheets.find(s => s.name === selectedSheet);
      if (sheet && (sheet as Sheet & { autoMapping?: ColumnMapping }).autoMapping) {
        const autoMap = (sheet as Sheet & { autoMapping?: ColumnMapping }).autoMapping!;
        setAutoDetectedMapping(autoMap);
        setMapping(autoMap);
      }
    }
  }, [selectedSheet, sheets, importMode]);

  const currentSheet = sheets.find(s => s.name === selectedSheet);

  const handleValidate = async () => {
    if (!selectedPayrollRun) {
      toast({
        title: 'Error',
        description: 'Please select a payroll run',
        variant: 'destructive',
      });
      return;
    }

    if (importMode === 'excel') {
      if (!file || !selectedSheet) {
        toast({
          title: 'Error',
          description: 'Please select a sheet',
          variant: 'destructive',
        });
        return;
      }

      if (!mapping.employeeId && !mapping.employeeName) {
        toast({
          title: 'Error',
          description: 'Could not detect Employee ID column. Please ensure your Excel has an "Employee ID", "Emp ID", "ID", or "No" column.',
          variant: 'destructive',
        });
        return;
      }

      if (!mapping.date) {
        toast({
          title: 'Error',
          description: 'Could not detect Date column. Please ensure your Excel has a "Date" column.',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      let res;
      if (importMode === 'excel') {
        const formData = new FormData();
        formData.append('file', file!);
        formData.append('sheetName', selectedSheet);
        formData.append('mapping', JSON.stringify(mapping));
        formData.append('payrollRunId', selectedPayrollRun);

        res = await fetch('/api/import/process', {
          method: 'POST',
          body: formData,
        });
      } else {
        // LifeScan API
        res = await fetch('/api/import/lifescan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payrollRunId: selectedPayrollRun }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Validation failed');
      }

      const data = await res.json();
      setValidation(data);
      setStep(3);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Validation failed',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedPayrollRun) return;

    if (importMode === 'excel' && (!file || !selectedSheet)) return;

    setIsProcessing(true);

    try {
      let res;
      if (importMode === 'excel') {
        const formData = new FormData();
        formData.append('file', file!);
        formData.append('sheetName', selectedSheet);
        formData.append('mapping', JSON.stringify(mapping));
        formData.append('payrollRunId', selectedPayrollRun);

        res = await fetch('/api/import/process', {
          method: 'PUT',
          body: formData,
        });
      } else {
        // LifeScan API
        res = await fetch('/api/import/lifescan', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payrollRunId: selectedPayrollRun }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Import failed');
      }

      const data = await res.json();

      toast({
        title: 'Import Successful',
        description: `Imported ${data.imported} employee records`,
      });

      router.push(`/dashboard/payroll-runs/${selectedPayrollRun}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Import failed',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Timesheet</h1>
        <p className="text-muted-foreground">
          Import timesheet data from Excel or pull directly from LifeScan API
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= s
                ? 'bg-castleton-green text-white'
                : 'bg-gray-200 text-gray-500'
                }`}
            >
              {s}
            </div>
            <span className={step >= s ? 'font-medium' : 'text-muted-foreground'}>
              {s === 1 && 'Select Mode'}
              {s === 2 && 'Configure'}
              {s === 3 && 'Review & Import'}
            </span>
            {s < 3 && <div className="w-12 h-0.5 bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: Mode Selection */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            className={`cursor-pointer transition-all hover:border-castleton-green/60 hover:shadow-md ${importMode === 'excel' ? 'border-castleton-green ring-2 ring-castleton-green/10' : ''}`}
            onClick={() => setImportMode('excel')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-6 w-6 text-castleton-green" />
                Excel Upload
              </CardTitle>
              <CardDescription>
                Upload a manually prepared Excel timesheet (.xlsx)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-500">
                Use this if you have a local file with attendance logs. Supports column mapping.
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:border-castleton-green/60 hover:shadow-md ${importMode === 'lifescan' ? 'border-castleton-green ring-2 ring-castleton-green/10' : ''}`}
            onClick={() => setImportMode('lifescan')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DownloadCloud className="h-6 w-6 text-castleton-green" />
                LifeScan API
              </CardTitle>
              <CardDescription>
                Pull attendance data directly from LifeScan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-500">
                Automatically fetches data for the selected payroll period. Requires API connection.
              </div>
            </CardContent>
          </Card>

          <div className="md:col-span-2 flex justify-end">
            <Button onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import Configuration ({importMode === 'excel' ? 'Excel' : 'LifeScan'})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payroll Run</Label>
                  <Select value={selectedPayrollRun || '__none__'} onValueChange={(v) => setSelectedPayrollRun(v === '__none__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payroll run" />
                    </SelectTrigger>
                    <SelectContent>
                      {payrollRuns.length === 0 ? (
                        <SelectItem value="__empty__" disabled>No draft payroll runs</SelectItem>
                      ) : (
                        payrollRuns.filter(r => r.id).map((run) => (
                          <SelectItem key={run.id} value={run.id}>
                            {run.name} {run.status !== 'DRAFT' && `(${run.status.charAt(0) + run.status.slice(1).toLowerCase()})`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {importMode === 'excel' && (
                  <div className="space-y-2">
                    {file ? (
                      <div className="space-y-2">
                        <Label>Selected File</Label>
                        <div className="flex items-center justify-between p-2 border rounded-md">
                          <span className="text-sm truncate">{file.name}</span>
                          <Button variant="ghost" size="sm" onClick={() => { setFile(null); setSheets([]); }}>Change</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="file-upload" className="cursor-pointer">
                          <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center hover:bg-gray-50 transition-colors">
                            <span className="text-castleton-green font-medium">Click to upload Excel</span>
                          </div>
                        </Label>
                        <Input
                          id="file-upload"
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleFileChange}
                          className="hidden"
                          disabled={isLoading}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {importMode === 'excel' && file && sheets.length > 0 && (
                <div className="space-y-4 mt-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Excel Sheet</Label>
                    <Select value={selectedSheet || '__none__'} onValueChange={(v) => setSelectedSheet(v === '__none__' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sheet" />
                      </SelectTrigger>
                      <SelectContent>
                        {sheets.filter(s => s.name && s.name.trim() !== '').map((sheet) => (
                          <SelectItem key={sheet.name} value={sheet.name}>
                            {sheet.name} ({sheet.rowCount} rows)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Auto-detected columns feedback */}
                  {Object.keys(autoDetectedMapping).length > 0 && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-castleton-green font-medium flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {Object.keys(autoDetectedMapping).length} columns auto-detected
                      </p>
                    </div>
                  )}
                </div>
              )}

              {importMode === 'lifescan' && (
                <div className="p-4 bg-castleton-green/10 rounded-lg border border-castleton-green/20">
                  <h4 className="font-semibold text-castleton-green mb-2">Timesheet Rules Applied</h4>
                  <ul className="text-sm space-y-1 text-dark-serpent/80 dark:text-foreground/70">
                    <li>Will fetch all attendance records for the selected payroll period.</li>
                    <li>Matches employees by <strong>Employee ID</strong>.</li>
                    <li>Automatically calculates Late, Undertime, and OT based on shift time (8-5 vs 9-6).</li>
                  </ul>
                </div>
              )}

            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={handleValidate} disabled={isLoading || !selectedPayrollRun || (importMode === 'excel' && !file)}>
              {isLoading ? 'Validating...' : 'Validate & Continue'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Import */}
      {step === 3 && validation && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Validation Results ({importMode === 'excel' ? 'Excel' : 'LifeScan'})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-castleton-green" />
                    <span className="font-semibold text-castleton-green">Valid Rows</span>
                  </div>
                  <p className="text-2xl font-bold text-castleton-green mt-2">
                    {validation.validRows}
                  </p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="font-semibold text-red-800">Invalid Rows</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600 mt-2">
                    {validation.invalidRows.length}
                  </p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <span className="font-semibold text-amber-800">Missing</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-600 mt-2">
                    {validation.missingEmployees.length}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-purple-600" />
                    <span className="font-semibold text-purple-800">Unrecognized</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600 mt-2">
                    {validation.unrecognizedEmployees.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warnings */}
          {(validation.missingEmployees.length > 0 ||
            validation.unrecognizedEmployees.length > 0 ||
            validation.invalidRows.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Warnings & Issues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="missing">
                    <TabsList>
                      <TabsTrigger value="missing">
                        Missing ({validation.missingEmployees.length})
                      </TabsTrigger>
                      <TabsTrigger value="unrecognized">
                        Unrecognized ({validation.unrecognizedEmployees.length})
                      </TabsTrigger>
                      <TabsTrigger value="invalid">
                        Invalid ({validation.invalidRows.length})
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="missing" className="mt-4">
                      {validation.missingEmployees.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            These employees from masterlist are not in the validated data.
                            They will be marked as missing in the payroll.
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {validation.missingEmployees.map((empNo) => (
                              <Badge key={empNo} variant="outline">
                                {empNo}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          All employees in masterlist are present.
                        </p>
                      )}
                    </TabsContent>
                    <TabsContent value="unrecognized" className="mt-4">
                      {validation.unrecognizedEmployees.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            These employees in the file/API are not found in the masterlist.
                            They will be skipped.
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {validation.unrecognizedEmployees.map((emp, i) => (
                              <Badge key={i} variant="destructive">
                                {emp.identifier}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          All employees are recognized.
                        </p>
                      )}
                    </TabsContent>
                    <TabsContent value="invalid" className="mt-4">
                      {validation.invalidRows.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Row</TableHead>
                              <TableHead>Errors</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {validation.invalidRows.slice(0, 10).map((row, i) => (
                              <TableRow key={i}>
                                <TableCell>{row.rowIndex}</TableCell>
                                <TableCell className="text-red-600">
                                  {row.errors.join(', ')}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No invalid rows found.
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

          {/* LifeScan Preview if available */}
          {validation.preview && validation.preview.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Data Preview</CardTitle>
                <CardDescription>First 5 records to be imported</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Time In</TableHead>
                        <TableHead>Time Out</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Late</TableHead>
                        <TableHead>UT</TableHead>
                        <TableHead>OT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validation.preview.map((row: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                          <TableCell>{row.employeeName}</TableCell>
                          <TableCell>{row.timeIn || '-'}</TableCell>
                          <TableCell>{row.timeOut || '-'}</TableCell>
                          <TableCell>{row.hoursWorked?.toFixed(2) || '0'}</TableCell>
                          <TableCell>{row.minutesLate || '0'}</TableCell>
                          <TableCell>{row.undertimeMinutes || '0'}</TableCell>
                          <TableCell>{row.overtimeHours?.toFixed(2) || '0'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              onClick={handleImport}
              disabled={isProcessing || validation.validRows === 0}
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Importing...
                </span>
              ) : (
                `Import ${validation.validRows} Records`
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
