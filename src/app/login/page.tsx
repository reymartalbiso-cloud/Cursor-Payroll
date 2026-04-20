'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Lock, Mail } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center transition-colors duration-300 relative">
      <div className="absolute top-5 right-5 z-10">
        <ThemeToggle collapsed={true} />
      </div>

      <div className="w-full max-w-[440px] mx-4 animate-fade-in-up">
        <Card className="shadow-2xl border-none bg-white/80 dark:bg-white/5 backdrop-blur-xl overflow-hidden relative">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-castleton-green via-castleton-green/70 to-saffron" />

          <CardHeader className="pb-2 pt-10 px-8">
            <div className="text-center space-y-2 mb-5">
              <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-br from-castleton-green via-castleton-green/80 to-saffron bg-clip-text text-transparent drop-shadow-sm">
                LifePay
              </h1>
              <p className="text-sm text-muted-foreground/80 font-medium">
                Sign in to access your account
              </p>
            </div>
            <div className="flex justify-center mb-2">
              <div className="relative w-44 h-14 transition-all duration-500 hover:scale-[1.03] opacity-80">
                <Image
                  src="/lifewood-logo.png"
                  alt="Lifewood Logo"
                  fill
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-10 pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@lifewood.com"
                    className="h-12 pl-10 border-border/60 dark:border-white/10 dark:bg-white/5 focus-visible:ring-castleton-green/40 focus-visible:border-castleton-green rounded-xl transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    className="h-12 pl-10 border-border/60 dark:border-white/10 dark:bg-white/5 focus-visible:ring-castleton-green/40 focus-visible:border-castleton-green rounded-xl transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-12 bg-castleton-green hover:bg-castleton-green/90 text-white font-semibold text-sm tracking-wide transition-all duration-300 shadow-lg shadow-castleton-green/20 hover:shadow-xl hover:shadow-castleton-green/30 rounded-xl"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Signing in...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground/60 tracking-wide">
          Powered by <span className="font-semibold text-castleton-green dark:text-saffron">Lifewood PH</span>
        </p>
      </div>
    </div>
  );
}
