import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/providers/theme-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { SyncProvider } from '@/providers/sync-provider';
import { Header, ShortcutsProvider, MobileNav, AppStartupGate } from '@/components/layout';
import { ServiceWorkerRegistration, PWAInstallPrompt } from '@/components/pwa';
import { Toaster } from '@/components/ui/sonner';
import { PomodoroFloating } from '@/components/dashboard/premium/PomodoroFloating';
import { QuickCaptureModal } from '@/components/quick-capture/QuickCaptureModal';
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
    { media: '(prefers-color-scheme: light)', color: '#f8fafb' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0d0e' },
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
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var r=document.documentElement;var t=localStorage.getItem('theme')||'system';if(t==='auto')t='system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);r.classList.toggle('dark',d);r.classList.toggle('light',!d);var ct=localStorage.getItem('habitflow_color_theme');if(ct&&ct!=='obsidian-mint'&&['warm-stone-forest','monochrome-cobalt','nordic-amber','sandstone-terracotta','deep-sea-cyan'].indexOf(ct)!==-1){r.setAttribute('data-theme',ct);}else{r.removeAttribute('data-theme');}var ao=localStorage.getItem('habitflow_accent_override');if(!ao){var la=localStorage.getItem('habitflow_accent');if(la&&la!=='mint'){ao=la;}}if(ao&&ao!=='theme'&&['mint','forest','cobalt','amber','terracotta','cyan','ink'].indexOf(ao)!==-1){r.setAttribute('data-accent',ao);}else{r.removeAttribute('data-accent');}}catch(_){}})();`}
        </Script>
        <Script id="extension-fetch-guard" strategy="beforeInteractive">
          {`(function(){try{var desc=Object.getOwnPropertyDescriptor(window,'fetch')||Object.getOwnPropertyDescriptor(Window.prototype,'fetch');if(desc&&desc.get&&!desc.set&&desc.configurable){var og=desc.get,ov=null;Object.defineProperty(window,'fetch',{configurable:true,enumerable:desc.enumerable!==false,get:function(){return ov!==null?ov:og.call(window);},set:function(v){ov=v;}});}window.addEventListener('error',function(e){if(e&&typeof e.filename==='string'&&e.filename.indexOf('chrome-extension://')===0&&typeof e.message==='string'&&e.message.indexOf('Cannot set property fetch')!==-1){e.preventDefault();}},true);}catch(_){}})();`}
        </Script>
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
                <ShortcutsProvider />
                <Toaster richColors position="bottom-right" />
                <PomodoroFloating />
                <QuickCaptureModal />
                <PWAInstallPrompt />
              </AppStartupGate>
            </SyncProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

