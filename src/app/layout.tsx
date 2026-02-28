import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { VideoBackground } from '@/components/layout/video-background';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Payroll System',
  description: 'Enterprise Payroll Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <VideoBackground src="https://www.pexels.com/download/video/10922866/" opacity={0.5} />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
