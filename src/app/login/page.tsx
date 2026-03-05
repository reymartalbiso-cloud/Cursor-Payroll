'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { ThemeToggle } from '@/components/layout/theme-toggle';


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setUser(data.user);
      toast({
        title: 'Welcome back!',
        description: `Logged in as ${data.user.name}`,
        variant: 'default',
      });
      router.push('/dashboard');
    } catch (error) {
      toast({
        title: 'Login failed',
        description: error instanceof Error ? error.message : 'Invalid credentials',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center transition-colors duration-300">

      <div className="absolute top-4 right-4">
        <ThemeToggle collapsed={true} />
      </div>

      <Card className="w-full max-w-md mx-4 shadow-2xl border-none bg-white/80 dark:bg-white/5 backdrop-blur-md overflow-hidden">
        <CardHeader className="space-y-6 pb-6 pt-10 px-8">
          <div className="flex justify-center mb-2 transition-all duration-500 hover:scale-[1.05]">
            <div className="relative w-64 h-20 md:w-72 md:h-24">
              <Image
                src="/lifewood-logo.png"
                alt="Lifewood Logo"
                fill
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold text-center tracking-tight text-dark-serpent dark:text-saffron">
              Payroll Management System
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground/80 font-medium">
              Authorized Personnel Access Only
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@lifewood.com"
                className="h-12 border-slate-200 dark:border-white/10 dark:bg-white/5 focus-visible:ring-castleton-green rounded-xl transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="h-12 border-slate-200 dark:border-white/10 dark:bg-white/5 focus-visible:ring-castleton-green rounded-xl transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 bg-castleton-green hover:bg-castleton-green/90 text-white font-bold text-base transition-all duration-300 shadow-lg rounded-xl"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Verifying...
                </span>
              ) : (
                'SIGN IN'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-12 text-center animate-fade-in opacity-80">
        <p className="text-[20px] uppercase font-black tracking-tight text-dark-serpent/40 dark:text-white/30">
          Powered by: <span className="text-castleton-green dark:text-saffron">Lifewood PH</span>
        </p>
      </div>
    </div>
  );
}
