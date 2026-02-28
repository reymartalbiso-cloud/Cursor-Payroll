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
import { Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Settings {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  gov_deduction_mode: string;
  standard_daily_hours: string;
  currency: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings>({
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    gov_deduction_mode: 'fixed_per_cutoff',
    standard_daily_hours: '8',
    currency: 'PHP',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings({ ...settings, ...data });
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast({ title: 'Success', description: 'Settings saved' });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-castleton-green border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure system settings and company information
        </p>
      </div>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>
            This information will appear on payslips and reports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_email">Company Email</Label>
              <Input
                id="company_email"
                type="email"
                value={settings.company_email}
                onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_address">Company Address</Label>
            <Input
              id="company_address"
              value={settings.company_address}
              onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_phone">Company Phone</Label>
            <Input
              id="company_phone"
              value={settings.company_phone}
              onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Payroll Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Calculation Settings</CardTitle>
          <CardDescription>
            Configure how payroll calculations are performed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gov_deduction_mode">Government Deduction Mode</Label>
              <Select
                value={settings.gov_deduction_mode}
                onValueChange={(v) => setSettings({ ...settings, gov_deduction_mode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_per_cutoff">Fixed Per Cutoff (Full Amount)</SelectItem>
                  <SelectItem value="prorated_by_days">Prorated by Days Present</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Government deductions (SSS, PhilHealth, Pag-IBIG) are only applied for 16-end of month cutoff.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={settings.currency}
                onValueChange={(v) => setSettings({ ...settings, currency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHP">PHP - Philippine Peso</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="standard_daily_hours">Standard Daily Hours</Label>
              <Input
                id="standard_daily_hours"
                type="number"
                value={settings.standard_daily_hours}
                onChange={(e) => setSettings({ ...settings, standard_daily_hours: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Used for calculating hourly rate and late deductions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workday Rules Info */}
      <Card>
        <CardHeader>
          <CardTitle>System Rules</CardTitle>
          <CardDescription>
            These rules are built into the system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-saffron/10 rounded-lg">
            <h4 className="font-semibold text-blue-900">Workday Calculation</h4>
            <p className="text-sm text-blue-700 mt-1">
              Workdays are calculated as Monday through Saturday only. Sundays are automatically
              excluded from all calculations including absences, deductions, and eligible days.
            </p>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg">
            <h4 className="font-semibold text-amber-900">Government Deductions</h4>
            <p className="text-sm text-amber-700 mt-1">
              SSS, PhilHealth, and Pag-IBIG deductions are ONLY applied for the 16th to end of month
              cutoff period. The 1st-15th cutoff will have zero government deductions.
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-semibold text-castleton-green">Cutoff Periods</h4>
            <ul className="text-sm text-dark-serpent/80 mt-1 list-disc list-inside">
              <li>First Half: 1st - 15th of the month</li>
              <li>Second Half: 16th - end of month (28/29/30/31 depending on month)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
