import { Suspense } from 'react';
import { SettingsPageContent } from '@/components/settings';

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="container px-4 py-8 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto" />
          <div className="h-4 w-32 bg-muted rounded mx-auto" />
          <span className="text-muted-foreground">Loading Profile...</span>
        </div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
