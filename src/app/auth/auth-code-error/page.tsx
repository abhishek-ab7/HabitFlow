'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Suspense } from 'react';

function AuthCodeErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 mb-6">
        <AlertCircle className="h-10 w-10 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
      <p className="text-muted-foreground mb-6 max-w-md">
        {error ? (
          <span className="block font-mono text-xs bg-muted p-2 rounded mt-2 text-destructive">
            {error}
          </span>
        ) : (
          'There was a problem with the authentication link. This can happen if the link expired or was already used.'
        )}
      </p>
      <Button asChild>
        <Link href="/login">Try again</Link>
      </Button>
    </motion.div>
  );
}

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={<div>Loading...</div>}>
        <AuthCodeErrorContent />
      </Suspense>
    </div>
  );
}
