'use client';

import React from 'react';
import { Lock, Mail, Save, ShieldAlert, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AccountSecurityCard(params: {
  displayEmail: string;
  displayName: string;
  setDisplayName: (name: string) => void;
  onSaveDisplayName: () => void;
  onOpenPasswordModal: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-3 pb-5 border-b border-border">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0"><User className="h-4 w-4" /></div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground tracking-tight">Account &amp; Security</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your profile details and password</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-5">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">Email Address</Label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><Mail className="h-4 w-4" /></div>
            <div className="flex items-center h-10 w-full rounded-xl border border-border bg-muted/40 pl-9 pr-3 text-sm text-foreground/85 font-medium cursor-not-allowed">
              <span className="truncate">{params.displayEmail}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">Full Name</Label>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><User className="h-4 w-4" /></div>
              <Input
                value={params.displayName}
                onChange={(e) => params.setDisplayName(e.target.value)}
                placeholder="Your full name"
                className="h-10 pl-9 rounded-xl border-border bg-background focus:bg-background transition-all focus:ring-2 focus:ring-ring/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    params.onSaveDisplayName();
                  }
                }}
              />
            </div>
            <Button onClick={params.onSaveDisplayName} className="h-10 px-4 rounded-xl font-medium whitespace-nowrap shrink-0">
              <Save className="h-4 w-4 mr-1.5" /> Save
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-5 border-t border-border">
        <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-success shrink-0" />
          <span>Account credentials active</span>
        </div>
        <Button variant="outline" size="sm" onClick={params.onOpenPasswordModal} className="h-9 px-3.5 rounded-lg text-xs font-medium whitespace-nowrap">
          <Lock className="h-3.5 w-3.5 mr-1.5 text-primary" /> Change Password
        </Button>
      </div>
    </section>
  );
}
