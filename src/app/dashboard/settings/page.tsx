'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, Send, Wifi, Loader2 } from 'lucide-react';
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

  // LifeScan
  const [lifescanStatus, setLifescanStatus] = useState<{
    configured: boolean;
    connected: boolean | null;
    message: string;
  } | null>(null);
  const [lifescanTesting, setLifescanTesting] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);

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

  const fetchLifescanStatus = async (test = false) => {
    try {
      const res = await fetch(`/api/lifescan/status${test ? '?test=true' : ''}`);
      const data = await res.json();
      setLifescanStatus(data);
    } catch {
      setLifescanStatus({ configured: false, connected: false, message: 'Failed to fetch status' });
    }
  };

  useEffect(() => {
    fetchLifescanStatus();
  }, []);

  const handleTestLifescan = async () => {
    setLifescanTesting(true);
    try {
      await fetchLifescanStatus(true);
    } finally {
      setLifescanTesting(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      toast({ title: 'Error', description: 'Title and message are required', variant: 'destructive' });
      return;
    }
    setBroadcastSending(true);
    try {
      const res = await fetch('/api/lifescan/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: broadcastTitle.trim(), message: broadcastMessage.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Success', description: 'Broadcast sent to all LifeScan app users' });
        setBroadcastTitle('');
        setBroadcastMessage('');
      } else {
        throw new Error(data.error || 'Failed to send');
      }
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to send broadcast', variant: 'destructive' });
    } finally {
      setBroadcastSending(false);
    }
  };

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

      {/* LifeScan Integration */}
      <Card>
        <CardHeader>
          <CardTitle>LifeScan Integration</CardTitle>
          <CardDescription>
            Connect to LifeScan app for DTR import and push notifications. Configure LIFESCAN_API_URL and LIFESCAN_API_KEY in .env
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Connection Status</p>
              <p className="text-sm text-muted-foreground">
                {lifescanStatus?.configured
                  ? lifescanStatus.connected === true
                    ? 'Connected'
                    : lifescanStatus.connected === false
                      ? 'Connection failed'
                      : 'Configured — test to verify'
                  : 'Not configured'}
              </p>
              {lifescanStatus?.message && (
                <p className="text-xs text-muted-foreground mt-1">{lifescanStatus.message}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {lifescanStatus?.configured && (
                <Button variant="outline" size="sm" onClick={handleTestLifescan} disabled={lifescanTesting}>
                  {lifescanTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                  {lifescanTesting ? 'Testing...' : 'Test Connection'}
                </Button>
              )}
            </div>
          </div>
          <div className="border-t pt-4 space-y-3">
            <h4 className="font-medium">Send Announcement (Broadcast)</h4>
            <p className="text-sm text-muted-foreground">Send a message to all users in the LifeScan app with push notification.</p>
            <div className="space-y-2">
              <Input
                placeholder="Title (e.g., Monthly Meeting)"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
              />
              <Textarea
                placeholder="Message"
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                rows={3}
              />
              <Button onClick={handleSendBroadcast} disabled={broadcastSending || !lifescanStatus?.configured}>
                {broadcastSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {broadcastSending ? 'Sending...' : 'Send Broadcast'}
              </Button>
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
          <div className="p-4 bg-green-50 dark:bg-castleton-green/10 rounded-lg">
            <h4 className="font-semibold text-castleton-green">Cutoff Periods</h4>
            <ul className="text-sm text-dark-serpent/80 dark:text-foreground/70 mt-1 list-disc list-inside">
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
