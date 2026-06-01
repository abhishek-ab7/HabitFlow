'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Share, Plus, HelpCircle, ArrowRight, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PWAInstallPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // 1. Check if user already installed the app (cached or current standalone mode)
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    const standalone = checkStandalone();
    const isAlreadyInstalled = localStorage.getItem('habitflow_pwa_installed') === 'true';

    if (isAlreadyInstalled) {
      return;
    }

    if (standalone) {
      localStorage.setItem('habitflow_pwa_installed', 'true');
      return;
    }
    
    // 2. Check user's dismissal preference (daily reset)
    const todayStr = new Date().toISOString().split('T')[0];
    const dismissedDate = localStorage.getItem('habitflow_pwa_dismissed_date');
    const isDismissedToday = dismissedDate === todayStr;
    const isPermanentlyDismissed = localStorage.getItem('habitflow_pwa_dismissed') === 'true';

    if (isDismissedToday || isPermanentlyDismissed) {
      return;
    }

    // 3. Detect iOS Safari
    const detectIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const ios = /iphone|ipad|ipod/.test(userAgent);
      const isSafari = userAgent.includes('safari') && !userAgent.includes('crios') && !userAgent.includes('fxios');
      setIsIOS(ios);
      return ios;
    };

    const ios = detectIOS();

    // 4. Listen for beforeinstallprompt event (Android/Chrome/Edge)
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    // 5. Listen to appinstalled event to clean up UI when installed
    const handleAppInstalled = () => {
      setIsVisible(false);
      setIsStandalone(true);
      setDeferredPrompt(null);
      localStorage.setItem('habitflow_pwa_installed', 'true');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 6. Show prompt for iOS Safari users because they don't fire beforeinstallprompt
    if (ios && !standalone && !isDismissedToday && !isPermanentlyDismissed) {
      // Small timeout to not show immediately on page load
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 5000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Trigger native browser install prompt
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsVisible(false);
        localStorage.setItem('habitflow_pwa_installed', 'true');
      }
      setDeferredPrompt(null);
    } else {
      // Show manual instructions modal for iOS or unsupported browsers
      setShowInstructions(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    const todayStr = new Date().toISOString().split('T')[0];
    localStorage.setItem('habitflow_pwa_dismissed_date', todayStr);
  };

  if (!isVisible && !showInstructions) return null;

  return (
    <>
      {/* Premium Install Banner at bottom */}
      <AnimatePresence>
        {isVisible && !showInstructions && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            className="fixed bottom-20 left-4 right-4 z-[999] md:bottom-6 md:right-6 md:left-auto md:w-[420px]"
          >
            <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-background/95 p-5 shadow-2xl backdrop-blur-xl dark:border-purple-500/30">
              {/* Premium Glow effect */}
              <div className="absolute -left-16 -top-16 -z-10 h-32 w-32 rounded-full bg-purple-500/20 blur-2xl" />
              
              <div className="flex items-start gap-4">
                {/* Brand icon representation */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20">
                  <Download className="h-6 w-6" />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-foreground">
                    Install HabitFlow
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Track habits faster with a full-screen, native application experience.
                  </p>
                  
                  <div className="mt-4 flex items-center gap-2">
                    <Button 
                      onClick={handleInstallClick} 
                      size="sm" 
                      className="bg-purple-600 text-white font-bold hover:bg-purple-700 shadow-md shadow-purple-500/10"
                    >
                      Install App
                    </Button>
                    <Button 
                      onClick={handleDismiss} 
                      variant="ghost" 
                      size="sm" 
                      className="text-muted-foreground font-semibold hover:text-foreground"
                    >
                      Maybe Later
                    </Button>
                  </div>
                </div>

                <button 
                  onClick={handleDismiss}
                  className="rounded-lg p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Instructions Modal */}
      <AnimatePresence>
        {showInstructions && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInstructions(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            
            {/* Modal Panel */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-purple-500/20 bg-background p-6 shadow-2xl dark:border-purple-500/30"
            >
              <div className="absolute -right-16 -top-16 -z-10 h-32 w-32 rounded-full bg-purple-500/15 blur-2xl" />
              
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-500/10 rounded-xl">
                    <Download className="h-5 w-5 text-purple-500" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">PWA Install Instructions</h3>
                </div>
                <button 
                  onClick={() => setShowInstructions(false)}
                  className="rounded-lg p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {isIOS ? (
                /* iOS Safari instructions */
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Apple iOS Safari does not support one-tap installation. Follow these steps to add HabitFlow to your home screen:
                  </p>
                  
                  <div className="space-y-3 mt-4 text-sm">
                    <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-xl">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-background text-xs font-bold border">
                        1
                      </div>
                      <div className="flex-1 text-xs">
                        Tap the <span className="font-bold inline-flex items-center gap-1">Share <Share className="h-3.5 w-3.5 inline text-purple-500" /></span> button in the Safari toolbar.
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-xl">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-background text-xs font-bold border">
                        2
                      </div>
                      <div className="flex-1 text-xs">
                        Scroll down and select <span className="font-bold inline-flex items-center gap-1">Add to Home Screen <Plus className="h-3.5 w-3.5 inline text-purple-500 border rounded" /></span>.
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-xl">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-background text-xs font-bold border">
                        3
                      </div>
                      <div className="flex-1 text-xs">
                        Tap <span className="font-bold text-purple-500">Add</span> in the top-right corner to complete.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Android Chrome / Generic Browser instructions */
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    If the browser install prompt didn't trigger, follow these steps to add the app manually:
                  </p>

                  <div className="space-y-3 mt-4 text-sm">
                    <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-xl">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-background text-xs font-bold border">
                        1
                      </div>
                      <div className="flex-1 text-xs">
                        Tap the browser menu button (usually <span className="font-bold inline-flex items-center gap-1">⋮ <ArrowRight className="h-3 w-3 inline text-muted-foreground" /></span> in the toolbar).
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-xl">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-background text-xs font-bold border">
                        2
                      </div>
                      <div className="flex-1 text-xs">
                        Select <span className="font-bold">Add to Home screen</span> or <span className="font-bold">Install app</span>.
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-xl">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-background text-xs font-bold border">
                        3
                      </div>
                      <div className="flex-1 text-xs">
                        Confirm the prompt on the screen to pin HabitFlow.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <Button 
                  onClick={() => setShowInstructions(false)}
                  className="bg-purple-600 text-white font-bold hover:bg-purple-700"
                >
                  Got It
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
