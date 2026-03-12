'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Sidebar } from '@/components/layout/sidebar';
import { ChatWidget } from '@/components/ui/chat-widget';
import { useAuthStore } from '@/stores/auth-store';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, setUser, setLoading } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
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
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 min-h-screen p-6 transition-all duration-300">
        {children}
      </main>
      <ChatWidget />
    </div>
  );
}
