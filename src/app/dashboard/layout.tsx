'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { ChatWidget } from '@/components/ui/chat-widget';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, setUser, setLoading } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
          } else {
            router.push('/login');
          }
        } else {
          router.push('/login');
        }
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [router, setUser, setLoading]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-5 animate-fade-in">
          <div className="relative w-40 h-14">
            <Image
              src="/lifewood-logo.png"
              alt="Lifewood"
              fill
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-castleton-green/20 border-t-castleton-green" />
          <p className="text-xs text-muted-foreground tracking-wide">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen">
      {/* Mobile menu button - only visible on small screens */}
      <Button
        variant="outline"
        size="icon"
        className="fixed left-4 top-4 z-50 md:hidden h-10 w-10 rounded-lg border-dark-serpent/20 bg-background shadow-md"
        onClick={() => setSidebarMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Backdrop when sidebar is open on mobile */}
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden
          onClick={() => setSidebarMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        mobileOpen={sidebarMobileOpen}
        onMobileOpenChange={setSidebarMobileOpen}
      />
      <main
        className={cn(
          'min-h-screen p-4 pt-14 sm:p-6 md:pt-6 transition-all duration-300 min-w-0 overflow-x-hidden',
          'ml-0',
          sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-64'
        )}
      >
        {children}
      </main>
      <ChatWidget />
    </div>
  );
}
