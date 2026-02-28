'use client';

import { useEffect, useState } from 'react';
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
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Calendar, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: 'REGULAR' | 'SPECIAL';
  year: number;
  description?: string;
}

export default function HolidaysPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const isAdmin = user?.role === 'ADMIN';

  // Form state
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<'REGULAR' | 'SPECIAL'>('REGULAR');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchHolidays();
  }, [selectedYear]);

  const fetchHolidays = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/holidays?year=${selectedYear}`);
      if (res.ok) {
        const data = await res.json();
        setHolidays(data.holidays);
      }
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingHoliday(null);
    setName('');
    setDate('');
    setType('REGULAR');
    setDescription('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setName(holiday.name);
    setDate(holiday.date.split('T')[0]);
    setType(holiday.type);
    setDescription(holiday.description || '');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name || !date || !type) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const url = editingHoliday
        ? `/api/holidays/${editingHoliday.id}`
        : '/api/holidays';

      const res = await fetch(url, {
        method: editingHoliday ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, date, type, description }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save holiday');
      }

      toast({
        title: 'Success',
        description: `Holiday ${editingHoliday ? 'updated' : 'created'} successfully`,
      });

      setIsDialogOpen(false);
      fetchHolidays();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save holiday',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;

    try {
      const res = await fetch(`/api/holidays/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete holiday');
      }

      toast({
        title: 'Success',
        description: 'Holiday deleted successfully',
      });

      fetchHolidays();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete holiday',
        variant: 'destructive',
      });
    }
  };

  const handleLoadPhilippineHolidays = async () => {
    if (!confirm(`This will load all Philippine holidays for ${selectedYear}. Continue?`)) return;

    setIsSeeding(true);
    try {
      const res = await fetch('/api/holidays/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load holidays');
      }

      const data = await res.json();
      toast({
        title: 'Success',
        description: data.message,
      });

      fetchHolidays();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load holidays',
        variant: 'destructive',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Holidays</h1>
          <p className="text-muted-foreground">
            Manage regular and special holidays for payroll calculations
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={handleLoadPhilippineHolidays} disabled={isSeeding}>
              <Download className="h-4 w-4 mr-2" />
              {isSeeding ? 'Loading...' : `Load PH Holidays (${selectedYear})`}
            </Button>
          )}
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Holiday
          </Button>
        </div>
      </div>

      {/* Holiday Rules Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-castleton-green/10 border-castleton-green/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-blue-800 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Regular Holidays
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-700">
              Employees do not work but receive <strong>100% of their daily rate</strong> (basic pay).
            </p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-800 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Special Holidays
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700">
              Employees receive <strong>30% of hours worked</strong> (max 8 hrs, OT excluded) as holiday pay.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Year Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label>Year</Label>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Holidays Table */}
      <Card>
        <CardHeader>
          <CardTitle>Holiday List - {selectedYear}</CardTitle>
          <CardDescription>
            {holidays.length} holiday{holidays.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-castleton-green border-t-transparent" />
            </div>
          ) : holidays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No holidays configured for {selectedYear}. Click "Add Holiday" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Pay Rule</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">
                      {formatDate(holiday.date)}
                    </TableCell>
                    <TableCell>{holiday.name}</TableCell>
                    <TableCell>
                      <Badge variant={holiday.type === 'REGULAR' ? 'default' : 'secondary'}>
                        {holiday.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {holiday.type === 'REGULAR' ? (
                        <span className="text-castleton-green font-medium">100% Basic Pay</span>
                      ) : (
                        <span className="text-amber-600 font-medium">30% Daily Rate</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {holiday.description || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(holiday)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(holiday.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Holiday Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., New Year's Day"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Holiday Type *</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'REGULAR' | 'SPECIAL')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REGULAR">Regular Holiday (100% Pay)</SelectItem>
                  <SelectItem value="SPECIAL">Special Holiday (30% Pay)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., National holiday"
              />
            </div>
          </div>
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
