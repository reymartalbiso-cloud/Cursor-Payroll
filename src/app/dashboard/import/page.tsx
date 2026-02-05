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
import { FileSpreadsheet, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
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
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [autoDetectedMapping, setAutoDetectedMapping] = useState<ColumnMapping>({});
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [selectedPayrollRun, setSelectedPayrollRun] = useState<string>('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch draft/reviewed payroll runs
  useEffect(() => {
    const fetchPayrollRuns = async () => {
      try {
        const res = await fetch('/api/payroll-runs?status=DRAFT&limit=50');
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
    const sheet = sheets.find(s => s.name === selectedSheet);
    if (sheet && (sheet as Sheet & { autoMapping?: ColumnMapping }).autoMapping) {
      const autoMap = (sheet as Sheet & { autoMapping?: ColumnMapping }).autoMapping!;
      setAutoDetectedMapping(autoMap);
      setMapping(autoMap);
    }
  }, [selectedSheet, sheets]);

  const currentSheet = sheets.find(s => s.name === selectedSheet);

  const handleValidate = async () => {
    if (!file || !selectedSheet || !selectedPayrollRun) {
      toast({
        title: 'Error',
        description: 'Please select a sheet and payroll run',
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

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sheetName', selectedSheet);
      formData.append('mapping', JSON.stringify(mapping));
      formData.append('payrollRunId', selectedPayrollRun);

      const res = await fetch('/api/import/process', {
        method: 'POST',
        body: formData,
      });

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
    if (!file || !selectedSheet || !selectedPayrollRun) return;

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sheetName', selectedSheet);
      formData.append('mapping', JSON.stringify(mapping));
      formData.append('payrollRunId', selectedPayrollRun);

      const res = await fetch('/api/import/process', {
        method: 'PUT',
        body: formData,
      });

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
          Upload an Excel timesheet to create or update payroll data
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s}
            </div>
            <span className={step >= s ? 'font-medium' : 'text-muted-foreground'}>
              {s === 1 && 'Upload File'}
              {s === 2 && 'Map Columns'}
              {s === 3 && 'Review & Import'}
            </span>
            {s < 3 && <div className="w-12 h-0.5 bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Timesheet File</CardTitle>
            <CardDescription>
              Upload an Excel file (.xlsx) containing timesheet data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <div className="space-y-2">
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-blue-600 hover:text-blue-700 font-medium">
                    Click to upload
                  </span>
                  <span className="text-muted-foreground"> or drag and drop</span>
                </Label>
                <p className="text-sm text-muted-foreground">Excel files only (.xlsx)</p>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isLoading}
                />
              </div>
              {isLoading && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <span className="text-sm text-muted-foreground">Parsing file...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Sheet & Payroll Run */}
      {step === 2 && currentSheet && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Sheet & Payroll Run</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                            {run.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Auto-Detected Columns
              </CardTitle>
              <CardDescription>
                The system automatically detected these columns from your Excel file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(autoDetectedMapping).filter(([_, value]) => value).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium text-green-800">{formatMappingKey(key)}</span>
                      <span className="text-green-600 ml-1">→ {value}</span>
                    </div>
                  </div>
                ))}
              </div>

              {Object.keys(autoDetectedMapping).length === 0 && (
                <div className="p-4 bg-amber-50 rounded-lg text-amber-800">
                  <AlertTriangle className="h-5 w-5 inline mr-2" />
                  No columns were auto-detected. Make sure your Excel headers match common names like:
                  <ul className="mt-2 list-disc list-inside text-sm">
                    <li><strong>Employee ID</strong> (required) - "Employee ID", "Emp ID", "ID", "No"</li>
                    <li><strong>Date</strong> (required)</li>
                    <li>Status, Time In, Time Out, AM-IN, AM-OUT, PM-IN, PM-OUT</li>
                    <li>OT-IN, OT-OUT</li>
                  </ul>
                </div>
              )}

              {autoDetectedMapping.employeeId && (
                <div className="mt-4 p-3 bg-green-100 rounded-lg border border-green-300">
                  <p className="text-sm text-green-800">
                    <CheckCircle className="h-4 w-4 inline mr-2" />
                    <strong>Employee ID column detected:</strong> "{autoDetectedMapping.employeeId}" will be used as the primary identifier to match employees in the masterlist.
                  </p>
                </div>
              )}

              {!autoDetectedMapping.employeeId && autoDetectedMapping.employeeName && (
                <div className="mt-4 p-3 bg-amber-100 rounded-lg border border-amber-300">
                  <p className="text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    <strong>No Employee ID column detected.</strong> Using Name column "{autoDetectedMapping.employeeName}" instead. For better accuracy, add an "Employee ID" or "ID" column to your Excel.
                  </p>
                </div>
              )}

              <div className="mt-6 p-4 bg-blue-50 rounded-lg space-y-3">
                <p className="text-sm text-blue-800 font-medium">
                  Multiple Clock-In/Out Support:
                </p>
                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                  <li>Supports <strong>AM In, AM Out, PM In, PM Out</strong> columns</li>
                  <li>Example: 8:00 AM In → 10:00 AM Out (break) → 11:00 AM In → 5:00 PM Out</li>
                  <li>Total hours = (10:00-8:00) + (17:00-11:00) = 2hrs + 6hrs = 8hrs</li>
                </ul>
                
                <p className="text-sm text-blue-800 font-medium mt-3">
                  8-5 Shift Rules (Clock in ≤ 8:10 AM):
                </p>
                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                  <li><strong>Late:</strong> 8:01-8:10 AM = late (minutes from 8:00 AM)</li>
                  <li><strong>Undertime:</strong> Leave before 5:00 PM</li>
                  <li><strong>OT:</strong> Work 1+ hour beyond 5:00 PM (6:00 PM or later)</li>
                </ul>
                
                <p className="text-sm text-blue-800 font-medium mt-3">
                  9-6 Shift Rules (Clock in after 8:10 AM):
                </p>
                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                  <li><strong>Time In:</strong> Recorded as 9:00 AM (regardless of actual clock in)</li>
                  <li><strong>Late:</strong> ≤9:05 AM not late, ≥9:06 AM late (minutes from 9:00 AM)</li>
                  <li><strong>Undertime:</strong> Leave before 6:00 PM</li>
                  <li><strong>OT:</strong> Work 1+ hour beyond 6:00 PM (7:00 PM or later)</li>
                </ul>
                
                <p className="text-sm text-blue-800 font-medium mt-3">
                  Other Rules:
                </p>
                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                  <li><strong>Absent:</strong> From Status column ("absent", "a", "awol")</li>
                  <li><strong>VL/SL:</strong> Status "VL" or "SL" = paid day</li>
                  <li><strong>Special Holiday:</strong> 30% of regular hours worked (OT not included)</li>
                  <li><strong>KPI Voiding:</strong> Late &gt;3x OR absent &gt;2x <span className="font-semibold text-blue-900">per month</span></li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>First 5 rows from the selected sheet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {currentSheet.headers.map((header) => (
                        <TableHead key={header}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentSheet.preview.map((row, i) => (
                      <TableRow key={i}>
                        {currentSheet.headers.map((header) => (
                          <TableCell key={header}>
                            {String(row[header] ?? '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={handleValidate} disabled={isLoading}>
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
              <CardTitle>Validation Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-800">Valid Rows</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600 mt-2">
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
                          These employees from masterlist are not in the imported file.
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
                        All employees in masterlist are present in the import.
                      </p>
                    )}
                  </TabsContent>
                  <TabsContent value="unrecognized" className="mt-4">
                    {validation.unrecognizedEmployees.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          These employees in the file are not found in the masterlist.
                          They will be skipped during import.
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
                        All employees in the file are recognized.
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
