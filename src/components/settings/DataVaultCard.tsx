'use client';

import React, { useState, useRef } from 'react';
import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert,
  Loader2,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import {
  exportTransactionsCSV,
  exportFriendsDebtCSV,
  exportHabitsCSV,
  generateFullDatabaseSnapshot,
  restoreDatabaseSnapshot,
  downloadFile,
} from '@/lib/vault/export-helpers';
import {
  encryptBackupData,
  decryptBackupData,
  type EncryptedBackupPayload,
} from '@/lib/vault/backup-crypto';
import { getLocalIsoDate } from '@/lib/finance/credit-card-cycles';
import { cn } from '@/lib/utils';

interface RestorePreviewData {
  formatVersion: string | number;
  exportedAt?: string;
  counts: {
    habits: number;
    completions: number;
    tasks: number;
    goals: number;
    transactions: number;
    accounts: number;
    debts: number;
    statements: number;
  };
  tables: Record<string, any[]>;
}

interface DataVaultCardProps {
  isStoragePersistent: boolean | null;
  hasDuplicates: boolean;
  duplicateCounts: { habits: number; goals: number };
  handleCleanupDuplicates: () => Promise<void>;
  isCleaning: boolean;
}

export function DataVaultCard({
  isStoragePersistent,
  hasDuplicates,
  duplicateCounts,
  handleCleanupDuplicates,
  isCleaning,
}: DataVaultCardProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [encryptBackup, setEncryptBackup] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');

  // Restore state
  const [pendingEncryptedPayload, setPendingEncryptedPayload] =
    useState<EncryptedBackupPayload | null>(null);
  const [decryptPassword, setDecryptPassword] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [restorePreview, setRestorePreview] = useState<RestorePreviewData | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Export CSV helpers
  const handleExportTransactionsCSV = async () => {
    try {
      setIsExporting('tx_csv');
      const [txs, accs, cats] = await Promise.all([
        db.financeTransactions.toArray(),
        db.financeAccounts.toArray(),
        db.financeCategories.toArray(),
      ]);
      const activeTxs = txs.filter((t) => !t.deletedAt);
      const csv = exportTransactionsCSV(txs, accs, cats);
      downloadFile(
        csv,
        `habitflow-transactions-${getLocalIsoDate()}.csv`,
        'text/csv;charset=utf-8;'
      );
      toast.success(`Exported ${activeTxs.length} transactions to CSV`);
    } catch {
      toast.error('Failed to export transactions CSV');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportFriendsDebtCSV = async () => {
    try {
      setIsExporting('debt_csv');
      const debts = await db.debtRecords.toArray();
      const activeDebts = debts.filter((d) => !d.deletedAt);
      const csv = exportFriendsDebtCSV(debts);
      downloadFile(
        csv,
        `habitflow-friends-debt-${getLocalIsoDate()}.csv`,
        'text/csv;charset=utf-8;'
      );
      toast.success(`Exported ${activeDebts.length} debt/split entries to CSV`);
    } catch {
      toast.error('Failed to export friends debt CSV');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportHabitsCSV = async () => {
    try {
      setIsExporting('habits_csv');
      const [habits, completions] = await Promise.all([
        db.habits.toArray(),
        db.completions.toArray(),
      ]);
      const activeHabits = habits.filter((h) => !h.archived);
      const csv = exportHabitsCSV(activeHabits, completions);
      downloadFile(
        csv,
        `habitflow-habits-${getLocalIsoDate()}.csv`,
        'text/csv;charset=utf-8;'
      );
      toast.success(`Exported ${activeHabits.length} habits to CSV`);
    } catch {
      toast.error('Failed to export habits CSV');
    } finally {
      setIsExporting(null);
    }
  };

  // 2. Full JSON Backup (All 20 Tables)
  const handleFullBackup = async () => {
    if (encryptBackup) {
      if (!passphrase || passphrase.length < 4) {
        toast.error('Passphrase must be at least 4 characters');
        return;
      }
      if (passphrase !== confirmPassphrase) {
        toast.error('Passphrases do not match');
        return;
      }
    }

    try {
      setIsExporting('full_backup');
      const snapshot = await generateFullDatabaseSnapshot();

      const dateStr = getLocalIsoDate();
      if (encryptBackup) {
        const encrypted = await encryptBackupData(snapshot, passphrase);
        downloadFile(
          JSON.stringify(encrypted, null, 2),
          `habitflow-backup-encrypted-${dateStr}.json`,
          'application/json'
        );
        toast.success('Generated encrypted AES-256-GCM full backup');
      } else {
        const payload = {
          version: 2,
          encrypted: false,
          exportedAt: new Date().toISOString(),
          tables: snapshot,
        };
        downloadFile(
          JSON.stringify(payload, null, 2),
          `habitflow-backup-${dateStr}.json`,
          'application/json'
        );
        toast.success('Generated full 20-table JSON backup');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create database backup');
    } finally {
      setIsExporting(null);
    }
  };

  // 3. Restore handler: Validate & preview before write
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (parsed.encrypted === true && parsed.ciphertext) {
        // Encrypted backup detected -> open passphrase modal
        setPendingEncryptedPayload(parsed as EncryptedBackupPayload);
        setDecryptPassword('');
      } else if (parsed.tables && typeof parsed.tables === 'object') {
        // V2 plain backup -> preview before write
        const tables = parsed.tables;
        setRestorePreview({
          formatVersion: parsed.version ? `V${parsed.version}` : 'V2',
          exportedAt: parsed.exportedAt || undefined,
          counts: {
            habits: (tables.habits || []).length,
            completions: (tables.completions || []).length,
            tasks: (tables.tasks || []).length,
            goals: (tables.goals || []).length,
            transactions: (tables.financeTransactions || []).length,
            accounts: (tables.financeAccounts || []).length,
            debts: (tables.debtRecords || []).length + (tables.debtInstallments || []).length,
            statements: (tables.creditCardStatements || []).length,
          },
          tables,
        });
      } else if (parsed.version === 1 && parsed.habits) {
        // Legacy V1 backup fallback -> preview before write (preserving userSettings on V1 restores)
        const tables: Record<string, any[]> = {
          habits: parsed.habits || [],
          completions: parsed.completions || [],
          goals: parsed.goals || [],
          milestones: parsed.milestones || [],
        };
        if (parsed.userSettings || parsed.settings) {
          tables.userSettings = parsed.userSettings || parsed.settings || [];
        }
        setRestorePreview({
          formatVersion: 'V1 (Legacy)',
          exportedAt: parsed.exportedAt || undefined,
          counts: {
            habits: (tables.habits || []).length,
            completions: (tables.completions || []).length,
            tasks: 0,
            goals: (tables.goals || []).length,
            transactions: 0,
            accounts: 0,
            debts: 0,
            statements: 0,
          },
          tables,
        });
      } else {
        throw new Error('Unrecognized backup file format');
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not parse backup file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingEncryptedPayload) return;

    try {
      setIsDecrypting(true);
      const decrypted = await decryptBackupData(pendingEncryptedPayload, decryptPassword);
      const tables = decrypted.tables;
      setPendingEncryptedPayload(null);
      setRestorePreview({
        formatVersion: 'V2 (Encrypted AES-256-GCM)',
        exportedAt: pendingEncryptedPayload.exportedAt || undefined,
        counts: {
          habits: (tables.habits || []).length,
          completions: (tables.completions || []).length,
          tasks: (tables.tasks || []).length,
          goals: (tables.goals || []).length,
          transactions: (tables.financeTransactions || []).length,
          accounts: (tables.financeAccounts || []).length,
          debts: (tables.debtRecords || []).length + (tables.debtInstallments || []).length,
          statements: (tables.creditCardStatements || []).length,
        },
        tables,
      });
    } catch (err: any) {
      toast.error(err.message || 'Decryption failed');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restorePreview) return;
    try {
      setIsRestoring(true);
      const result = await restoreDatabaseSnapshot(restorePreview.tables);
      toast.success(
        `Restored ${result.totalRecords} records across ${result.restoredTables} tables. Refreshing...`
      );
      setRestorePreview(null);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast.error(err.message || 'Restore failed');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <Database className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              Data Vault &amp; Full Backups
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Encrypted snapshots, CSV spreadsheets &amp; all 20 Dexie tables
            </p>
          </div>
        </div>
        <span
          className={cn(
            'text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap shrink-0',
            isStoragePersistent ? 'bg-success/12 text-success' : 'bg-warning/12 text-warning'
          )}
        >
          {isStoragePersistent ? 'Persistent Storage' : 'Standard'}
        </span>
      </div>

      {/* 1. CSV Data Exports */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
          One-Click CSV Spreadsheets (Formula-Injection Safe)
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportTransactionsCSV}
            disabled={isExporting !== null}
            className="w-full justify-center gap-1.5 h-9 px-2 text-xs rounded-xl"
            title="Export all transactions to CSV"
          >
            {isExporting === 'tx_csv' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Transactions CSV</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportFriendsDebtCSV}
            disabled={isExporting !== null}
            className="w-full justify-center gap-1.5 h-9 px-2 text-xs rounded-xl"
            title="Export everyday splits & loans to CSV"
          >
            {isExporting === 'debt_csv' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Friends Debt CSV</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportHabitsCSV}
            disabled={isExporting !== null}
            className="w-full justify-center gap-1.5 h-9 px-2 text-xs rounded-xl"
            title="Export habits and completion logs to CSV"
          >
            {isExporting === 'habits_csv' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Habits CSV</span>
          </Button>
        </div>
      </div>

      {/* 2. Full Workspace Snapshot (All 20 Tables) */}
      <div className="pt-2 border-t border-border/60 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Full Database Snapshot (All 20 Tables)
          </Label>
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={encryptBackup}
              onChange={(e) => setEncryptBackup(e.target.checked)}
              className="rounded border-input text-primary focus:ring-primary"
            />
            {encryptBackup ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <Lock className="w-3 h-3" /> Encrypted (AES-256)
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Unlock className="w-3 h-3" /> Plain JSON
              </span>
            )}
          </label>
        </div>

        {encryptBackup && (
          <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Your backup will be encrypted in your browser using PBKDF2 + AES-256-GCM.
              We cannot recover your data if you forget this passphrase.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                type="password"
                placeholder="Passphrase (min 4 chars)"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="h-8 text-xs rounded-lg"
              />
              <Input
                type="password"
                placeholder="Confirm passphrase"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                className="h-8 text-xs rounded-lg"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleFullBackup}
            disabled={isExporting !== null}
            className="w-full justify-center gap-1.5 h-9 px-3 text-xs rounded-xl font-semibold shadow-xs"
          >
            {isExporting === 'full_backup' ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Exporting Snapshot...</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>Download Full JSON Backup</span>
              </>
            )}
          </Button>

          <div className="relative w-full">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelected}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-center gap-1.5 h-9 px-3 text-xs border-dashed rounded-xl whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5 shrink-0" />
              <span>Restore from JSON Backup</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Duplicate Cleanup Notification if any */}
      {hasDuplicates && (
        <div className="p-3 bg-warning/10 rounded-xl border border-warning/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-warning min-w-0">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {duplicateCounts.habits + duplicateCounts.goals} duplicates found
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCleanupDuplicates}
            disabled={isCleaning}
            className="h-7 px-2.5 text-xs bg-warning/15 hover:bg-warning/25 text-warning whitespace-nowrap shrink-0 rounded-lg"
          >
            Fix Now
          </Button>
        </div>
      )}

      {/* Decryption Prompt Dialog when restoring encrypted backup */}
      <Dialog
        open={!!pendingEncryptedPayload}
        onOpenChange={(open) => !open && setPendingEncryptedPayload(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold">
              <KeyRound className="w-4 h-4 text-primary" />
              Enter Backup Passphrase
            </DialogTitle>
            <DialogDescription className="text-xs">
              This backup was encrypted with AES-256-GCM on{' '}
              {pendingEncryptedPayload
                ? new Date(pendingEncryptedPayload.exportedAt).toLocaleDateString()
                : ''}
              . Enter the passphrase used during export to decrypt and restore.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmDecrypt} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="decrypt-pass-in" className="text-xs">
                Passphrase
              </Label>
              <Input
                id="decrypt-pass-in"
                type="password"
                value={decryptPassword}
                onChange={(e) => setDecryptPassword(e.target.value)}
                placeholder="Enter passphrase"
                required
                className="rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPendingEncryptedPayload(null)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isDecrypting}
                className="rounded-xl text-xs gap-1.5"
              >
                {isDecrypting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Decrypting...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Decrypt &amp; Restore
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={!!restorePreview} onOpenChange={(open) => !open && setRestorePreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              Confirm Database Restore
            </DialogTitle>
            <DialogDescription>
              Review the backup details before restoring. Records will be safely merged into your local workspace.
            </DialogDescription>
          </DialogHeader>

          {restorePreview && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format Version:</span>
                  <span className="font-semibold text-foreground">{restorePreview.formatVersion}</span>
                </div>
                {restorePreview.exportedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Exported At:</span>
                    <span className="font-mono text-foreground">
                      {new Date(restorePreview.exportedAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-foreground block">Record Counts:</span>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div className="p-2 rounded-lg bg-background border border-border flex justify-between">
                    <span className="text-muted-foreground">Habits:</span>
                    <span className="font-bold">{restorePreview.counts.habits}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border flex justify-between">
                    <span className="text-muted-foreground">Completions:</span>
                    <span className="font-bold">{restorePreview.counts.completions}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border flex justify-between">
                    <span className="text-muted-foreground">Tasks:</span>
                    <span className="font-bold">{restorePreview.counts.tasks}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border flex justify-between">
                    <span className="text-muted-foreground">Goals:</span>
                    <span className="font-bold">{restorePreview.counts.goals}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border flex justify-between">
                    <span className="text-muted-foreground">Transactions:</span>
                    <span className="font-bold">{restorePreview.counts.transactions}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border flex justify-between">
                    <span className="text-muted-foreground">Accounts:</span>
                    <span className="font-bold">{restorePreview.counts.accounts}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border flex justify-between">
                    <span className="text-muted-foreground">Debts &amp; Splits:</span>
                    <span className="font-bold">{restorePreview.counts.debts}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border flex justify-between">
                    <span className="text-muted-foreground">CC Statements:</span>
                    <span className="font-bold">{restorePreview.counts.statements}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRestoring}
              onClick={() => setRestorePreview(null)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isRestoring}
              onClick={handleExecuteRestore}
              className="rounded-xl text-xs gap-1.5"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Confirm &amp; Restore
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
