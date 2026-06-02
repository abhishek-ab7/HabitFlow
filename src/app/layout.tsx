import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/providers/theme-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { SyncProvider } from '@/providers/sync-provider';
import { Header, ShortcutsProvider, MobileNav, AppStartupGate } from '@/components/layout';
import { ServiceWorkerRegistration, PWAInstallPrompt } from '@/components/pwa';
import { Toaster } from '@/components/ui/sonner';
import { LevelUpModal } from '@/components/gamification/LevelUpModal';
import { GamificationRulesModal } from '@/components/gamification/GamificationRulesModal';
import { PomodoroFloating } from '@/components/dashboard/premium/PomodoroFloating';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Habit Flow - Build Better Habits',
    template: '%s | Habit Flow',
  },
  description: 'A premium habit tracking and goal planning application with cloud sync to help you build better habits and achieve your goals.',
  keywords: ['habit tracker', 'goals', 'productivity', 'habits', 'self-improvement', 'habit flow'],
  authors: [{ name: 'Habit Flow' }],
  creator: 'Habit Flow',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Habit Flow',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icons/icon-512.png', type: 'image/png', sizes: '512x512' }
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#09050d' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen bg-background`}
      >
        <ThemeProvider>
          <AuthProvider>
            <SyncProvider>
              <ServiceWorkerRegistration />
              <AppStartupGate>
                <div className="relative flex min-h-screen flex-col pb-16 md:pb-0">
                  <Header />
                  <main className="flex-1">
                    {children}
                  </main>
                  <MobileNav />
                </div>
                <LevelUpModal />
                <GamificationRulesModal />
                <ShortcutsProvider />
                <Toaster richColors position="bottom-right" />
                <PomodoroFloating />
                <PWAInstallPrompt />
              </AppStartupGate>
            </SyncProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

