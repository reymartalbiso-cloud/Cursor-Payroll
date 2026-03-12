import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { VideoBackground } from '@/components/layout/video-background';
import { ThemeProvider } from '@/components/theme-provider';

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
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <VideoBackground src="https://www.pexels.com/download/video/10922866/" opacity={0.5} />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

