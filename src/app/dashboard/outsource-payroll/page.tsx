'use client';

import { useState, useEffect } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Calculator,
  FileSpreadsheet,
  Trash2,
  Download,
  Save,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_PAYMENT_BASIS = [
  { value: 'EFFECTIVE_HOUR', label: 'Per Effective Hour' },
  { value: 'PER_UNIT', label: 'Per Unit' },
  { value: 'PER_DAY', label: 'Per Day' },
  { value: 'PER_PIECE', label: 'Per Piece' },
];

const STORAGE_KEY = 'outsource-custom-payment-basis';

function loadCustomPaymentBasis(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCustomPaymentBasis(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

interface OutsourceProject {
  id: string;
  name: string;
  rate: string;
  paymentBasis: string;
  description?: string | null;
  _count?: { payrollRequests: number };
}

interface CalculatedEntry {
  operatorName: string;
  output: number;
  calculatedPay: number;
}

interface PayrollRequest {
  id: string;
  requestName: string;
  totalAmount: string;
  status: string;
  createdAt: string;
  _count?: { entries: number };
}

export default function OutsourcePayrollPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<OutsourceProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isCalculateDialogOpen, setIsCalculateDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProject, setSelectedProject] = useState<OutsourceProject | null>(null);
  const [projectRequests, setProjectRequests] = useState<PayrollRequest[]>([]);

  // Project form
  const [projectName, setProjectName] = useState('');
  const [projectRate, setProjectRate] = useState('');
  const [projectBasis, setProjectBasis] = useState('EFFECTIVE_HOUR');
  const [projectDescription, setProjectDescription] = useState('');
  const [editingProject, setEditingProject] = useState<OutsourceProject | null>(null);
  const [customPaymentBasis, setCustomPaymentBasis] = useState<string[]>(loadCustomPaymentBasis);
  const [newBasisInput, setNewBasisInput] = useState('');
  const [isAddingBasis, setIsAddingBasis] = useState(false);

  // Calculate form
  const [requestName, setRequestName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [calculatedEntries, setCalculatedEntries] = useState<CalculatedEntry[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    setCustomPaymentBasis(loadCustomPaymentBasis);
  }, [isProjectDialogOpen]);

  const allPaymentBasisOptions = (() => {
    const customs = [...customPaymentBasis];
    if (projectBasis && !DEFAULT_PAYMENT_BASIS.some((o) => o.value === projectBasis) && !customs.includes(projectBasis)) {
      customs.push(projectBasis);
    }
    return [...DEFAULT_PAYMENT_BASIS, ...customs.map((b) => ({ value: b, label: b }))];
  })();

  const handleAddPaymentBasis = () => {
    const trimmed = newBasisInput.trim();
    if (!trimmed) return;
    const exists = [...DEFAULT_PAYMENT_BASIS, ...customPaymentBasis].some(
      (o) => (typeof o === 'string' ? o : o.value.toLowerCase()) === trimmed.toLowerCase()
    );
    if (exists) {
      toast({ title: 'Already exists', description: 'This payment basis already exists', variant: 'destructive' });
      return;
    }
    const updated = [...customPaymentBasis, trimmed];
    setCustomPaymentBasis(updated);
    saveCustomPaymentBasis(updated);
    setProjectBasis(trimmed);
    setNewBasisInput('');
    setIsAddingBasis(false);
    toast({ title: 'Added', description: `"${trimmed}" added to payment basis` });
  };

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/outsource-projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load projects',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openAddProject = () => {
    setEditingProject(null);
    setProjectName('');
    setProjectRate('');
    setProjectBasis('EFFECTIVE_HOUR');
    setProjectDescription('');
    setNewBasisInput('');
    setIsAddingBasis(false);
    setIsProjectDialogOpen(true);
  };

  const openEditProject = (project: OutsourceProject) => {
    setEditingProject(project);
    setProjectName(project.name);
    setProjectRate(project.rate);
    setProjectBasis(project.paymentBasis);
    setProjectDescription(project.description || '');
    setNewBasisInput('');
    setIsAddingBasis(false);
    setIsProjectDialogOpen(true);
  };

  const handleSaveProject = async () => {
    if (!projectName.trim() || !projectRate || parseFloat(projectRate) <= 0) {
      toast({
        title: 'Error',
        description: 'Name and rate are required. Rate must be greater than 0.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const url = editingProject
        ? `/api/outsource-projects/${editingProject.id}`
        : '/api/outsource-projects';
      const res = await fetch(url, {
        method: editingProject ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          rate: parseFloat(projectRate),
          paymentBasis: projectBasis,
          description: projectDescription.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save project');
      }

      toast({ title: 'Success', description: 'Project saved successfully' });
      setIsProjectDialogOpen(false);
      fetchProjects();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Delete this project? All associated payroll requests will also be deleted.'))
      return;
    try {
      const res = await fetch(`/api/outsource-projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Success', description: 'Project deleted' });
        fetchProjects();
        if (selectedProject?.id === id) {
          setSelectedProject(null);
          setProjectRequests([]);
        }
      } else {
        throw new Error('Delete failed');
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete project', variant: 'destructive' });
    }
  };

  const openCalculate = (project: OutsourceProject) => {
    setSelectedProject(project);
    setRequestName('');
    setFile(null);
    setCalculatedEntries([]);
    setTotalAmount(0);
    setProjectRequests([]);
    setIsCalculateDialogOpen(true);

    // Fetch existing requests for this project
    fetch(`/api/outsource-projects/${project.id}`)
      .then((res) => res.ok && res.json())
      .then((data) => data?.project?.payrollRequests && setProjectRequests(data.project.payrollRequests))
      .catch(() => { });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      setFile(f);
    } else if (f) {
      toast({
        title: 'Invalid file',
        description: 'Please upload an Excel file (.xlsx or .xls)',
        variant: 'destructive',
      });
    }
  };

  const handleCalculate = async () => {
    if (!selectedProject || !file) {
      toast({
        title: 'Error',
        description: 'Please select an Excel file',
        variant: 'destructive',
      });
      return;
    }

    setIsCalculating(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('requestName', requestName || `Import ${new Date().toLocaleDateString()}`);

      const res = await fetch(`/api/outsource-projects/${selectedProject.id}/calculate`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to calculate');
      }

      const data = await res.json();
      setCalculatedEntries(data.entries);
      setTotalAmount(data.totalAmount);
      setRequestName(data.requestName);
      toast({ title: 'Success', description: `Calculated ${data.entries.length} operators` });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Calculation failed',
        variant: 'destructive',
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSaveRequest = async () => {
    if (!selectedProject || calculatedEntries.length === 0) {
      toast({
        title: 'Error',
        description: 'Run calculation first and ensure entries exist',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/outsource-projects/${selectedProject.id}/save-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          requestName: requestName || `Request ${new Date().toISOString().slice(0, 10)}`,
          entries: calculatedEntries,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      toast({ title: 'Success', description: 'Payroll request saved' });
      const data = await res.json();
      setProjectRequests((prev) => [{ ...data.payrollRequest, _count: { entries: calculatedEntries.length } }, ...prev]);
      setCalculatedEntries([]);
      setTotalAmount(0);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (calculatedEntries.length === 0) return;
    const csv = [
      'Operator Name,Output,Calculated Pay (PHP)',
      ...calculatedEntries.map(
        (e) => `${e.operatorName},${e.output},${e.calculatedPay.toFixed(2)}`
      ),
      `,,Total: ${totalAmount.toFixed(2)}`,
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `outsource-payroll-${selectedProject?.name || 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'File downloaded' });
  };

  const handleExportRequestExcel = async (requestId: string, requestName: string) => {
    try {
      const res = await fetch(`/api/outsource-requests/${requestId}/export`);

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Outsource-${selectedProject?.name || 'export'}-${requestName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast({ title: 'Success', description: 'Excel exported' });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to export Excel',
        variant: 'destructive',
      });
    }
  };

  const formatBasis = (basis: string) =>
    DEFAULT_PAYMENT_BASIS.find((o) => o.value === basis)?.label || basis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Outsource Operator Payroll</h1>
        <p className="text-muted-foreground">
          Output-based payment calculation for operators and outsource employees. Independent from internal employee payroll.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Projects</CardTitle>
            <CardDescription>
              Add projects with rate and payment basis. Import Excel to calculate operator payments.
            </CardDescription>
          </div>
          <Button onClick={openAddProject}>
            <Plus className="h-4 w-4 mr-2" />
            Add Project
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-castleton-green border-t-transparent" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No projects yet. Click &quot;Add Project&quot; to create one.</p>
              <p className="text-sm mt-2">
                Set a rate (e.g., 600 pesos) and payment basis (e.g., per effective hour), then import Excel with operator names and output.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card key={project.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        <CardDescription>
                          ₱{Number(project.rate).toLocaleString()} / {formatBasis(project.paymentBasis)}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">
                        {project._count?.payrollRequests ?? 0} requests
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {project.description && (
                      <p className="text-sm text-muted-foreground">{project.description}</p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={() => openCalculate(project)}>
                        <Calculator className="h-4 w-4 mr-1" />
                        Calculate
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEditProject(project)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteProject(project.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Project Dialog */}
      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'Add Project'}</DialogTitle>
            <DialogDescription>
              Set the rate and payment basis for this outsource project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Data Entry Project A"
              />
            </div>
            <div>
              <Label htmlFor="project-rate">Rate (PHP) *</Label>
              <Input
                id="project-rate"
                type="number"
                min="0"
                step="0.01"
                value={projectRate}
                onChange={(e) => setProjectRate(e.target.value)}
                placeholder="e.g., 600"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Amount paid per unit (e.g., 600 pesos per effective hour)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-basis">Payment Basis</Label>
              <Select
                value={projectBasis && allPaymentBasisOptions.some((o) => o.value === projectBasis) ? projectBasis : undefined}
                onValueChange={(v) => (v === '__add__' ? setIsAddingBasis(true) : setProjectBasis(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment basis" />
                </SelectTrigger>
                <SelectContent>
                  {allPaymentBasisOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="__add__" className="text-castleton-green font-medium">
                    <Plus className="inline h-4 w-4 mr-1" />
                    Add payment basis
                  </SelectItem>
                </SelectContent>
              </Select>
              {isAddingBasis && (
                <div className="flex gap-2 pt-2">
                  <Input
                    placeholder="e.g., Per Batch, Per Task"
                    value={newBasisInput}
                    onChange={(e) => setNewBasisInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPaymentBasis()}
                  />
                  <Button type="button" size="sm" onClick={handleAddPaymentBasis} disabled={!newBasisInput.trim()}>
                    Add
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setIsAddingBasis(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="project-desc">Description (optional)</Label>
              <Input
                id="project-desc"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Brief description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProjectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProject} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calculate / Import Dialog */}
      <Dialog open={isCalculateDialogOpen} onOpenChange={setIsCalculateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Calculate Payroll - {selectedProject?.name}
            </DialogTitle>
            <DialogDescription>
              Upload Excel with Employee Name and Output columns. Auto-detects columns like &quot;Employee Name&quot;, &quot;Output&quot;, &quot;Effective Hours&quot;, etc.&nbsp;
              <a href="/api/outsource-projects/template" download className="text-castleton-green underline font-medium">Download template</a>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-castleton-green/10 rounded-lg border border-castleton-green/20">
              <p className="text-sm font-medium text-castleton-green">Rate: ₱{selectedProject?.rate} per {formatBasis(selectedProject?.paymentBasis || 'EFFECTIVE_HOUR').toLowerCase()}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Request Name (optional)</Label>
                <Input
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                  placeholder="e.g., January 2025"
                />
              </div>
              <div>
                <Label>Excel File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {file && (
                    <span className="text-sm text-muted-foreground truncate">{file.name}</span>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handleCalculate}
              disabled={!file || isCalculating}
            >
              {isCalculating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Calculating...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Import & Calculate
                </>
              )}
            </Button>

            {calculatedEntries.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Results ({calculatedEntries.length} operators)</h4>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleExportExcel}>
                      <Download className="h-4 w-4 mr-1" />
                      Export CSV
                    </Button>
                    <Button size="sm" onClick={handleSaveRequest} disabled={isSaving}>
                      <Save className="h-4 w-4 mr-1" />
                      {isSaving ? 'Saving...' : 'Save Request'}
                    </Button>
                  </div>
                </div>
                <p className="text-lg font-bold text-castleton-green">
                  Total: ₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
                <div className="border rounded-lg overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operator Name</TableHead>
                        <TableHead className="text-right">Output</TableHead>
                        <TableHead className="text-right">Pay (PHP)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculatedEntries.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell>{e.operatorName}</TableCell>
                          <TableCell className="text-right">{e.output}</TableCell>
                          <TableCell className="text-right font-medium">
                            {e.calculatedPay.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {projectRequests.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Saved Requests</h4>
                <div className="space-y-2 max-h-32 overflow-auto">
                  {projectRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-2 border rounded-lg text-sm"
                    >
                      <span>{req.requestName}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          ₱{Number(req.totalAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleExportRequestExcel(req.id, req.requestName)}
                          title="Export to Excel"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
