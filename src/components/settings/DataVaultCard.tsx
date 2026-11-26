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
  Receipt,
  Users,
  CheckSquare,
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
  ALL_WORKSPACE_TABLES,
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

function countTable(tables: Record<string, any[]>, key: string) {
  return Array.isArray(tables[key]) ? tables[key].length : 0;
}

function buildRestoreCounts(tables: Record<string, any[]>) {
  return {
    habits: countTable(tables, 'habits'),
    completions: countTable(tables, 'completions'),
    tasks: countTable(tables, 'tasks'),
    goals: countTable(tables, 'goals'),
    transactions: countTable(tables, 'financeTransactions'),
    accounts: countTable(tables, 'financeAccounts'),
    debts: countTable(tables, 'debtRecords') + countTable(tables, 'debtInstallments'),
    statements: countTable(tables, 'creditCardStatements'),
  };
}

function parseV1Backup(parsed: Record<string, any>) {
  const settings = parsed.userSettings || parsed.settings;
  const tables: Record<string, any[]> = {
    habits: parsed.habits || [],
    completions: parsed.completions || [],
    goals: parsed.goals || [],
    milestones: parsed.milestones || [],
    ...(settings ? { userSettings: settings } : {}),
  };
  return {
    formatVersion: 'V1 (Legacy)',
    exportedAt: parsed.exportedAt || undefined,
    counts: buildRestoreCounts(tables),
    tables,
  };
}

function parsePlainBackupPreview(parsed: Record<string, any>) {
  if (parsed.tables && typeof parsed.tables === 'object') {
    return {
      formatVersion: parsed.version ? `V${parsed.version}` : 'V2',
      exportedAt: parsed.exportedAt || undefined,
      counts: buildRestoreCounts(parsed.tables),
      tables: parsed.tables,
    };
  }
  if (parsed.version === 1 && parsed.habits) return parseV1Backup(parsed);
  return null;
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

  const runCsvExport = async (
    exportKey: string,
    exporter: () => Promise<{ csv: string; filename: string; successMessage: string }>,
    errorMessage: string
  ) => {
    try {
      setIsExporting(exportKey);
      const { csv, filename, successMessage } = await exporter();
      downloadFile(csv, filename, 'text/csv;charset=utf-8;');
      toast.success(successMessage);
    } catch {
      toast.error(errorMessage);
    } finally {
      setIsExporting(null);
    }
  };

  // 1. Export CSV helpers
  const handleExportTransactionsCSV = () =>
    runCsvExport(
      'tx_csv',
      async () => {
        const [txs, accs, cats] = await Promise.all([
          db.financeTransactions.toArray(),
          db.financeAccounts.toArray(),
          db.financeCategories.toArray(),
        ]);
        const activeTxs = txs.filter((t) => !t.deletedAt);
        return {
          csv: exportTransactionsCSV(txs, accs, cats),
          filename: `habitflow-transactions-${getLocalIsoDate()}.csv`,
          successMessage: `Exported ${activeTxs.length} transactions to CSV`,
        };
      },
      'Failed to export transactions CSV'
    );

  const handleExportFriendsDebtCSV = () =>
    runCsvExport(
      'debt_csv',
      async () => {
        const debts = await db.debtRecords.toArray();
        const activeDebts = debts.filter((d) => !d.deletedAt);
        return {
          csv: exportFriendsDebtCSV(debts),
          filename: `habitflow-friends-debt-${getLocalIsoDate()}.csv`,
          successMessage: `Exported ${activeDebts.length} debt/split entries to CSV`,
        };
      },
      'Failed to export friends debt CSV'
    );

  const handleExportHabitsCSV = () =>
    runCsvExport(
      'habits_csv',
      async () => {
        const [habits, completions] = await Promise.all([db.habits.toArray(), db.completions.toArray()]);
        const activeHabits = habits.filter((h) => !h.archived);
        return {
          csv: exportHabitsCSV(activeHabits, completions),
          filename: `habitflow-habits-${getLocalIsoDate()}.csv`,
          successMessage: `Exported ${activeHabits.length} habits to CSV`,
        };
      },
      'Failed to export habits CSV'
    );

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
        toast.success(`Generated full ${ALL_WORKSPACE_TABLES.length}-table JSON backup`);
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
      const parsed = JSON.parse(await file.text());

      if (parsed.encrypted === true && parsed.ciphertext) {
        setPendingEncryptedPayload(parsed as EncryptedBackupPayload);
        setDecryptPassword('');
        return;
      }

      const preview = parsePlainBackupPreview(parsed);
      if (!preview) throw new Error('Unrecognized backup file format');
      setRestorePreview(preview);
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
      setPendingEncryptedPayload(null);
      setRestorePreview({
        formatVersion: 'V2 (Encrypted AES-256-GCM)',
        exportedAt: pendingEncryptedPayload.exportedAt || undefined,
        counts: buildRestoreCounts(decrypted.tables),
        tables: decrypted.tables,
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
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
            <Database className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              Data Vault &amp; Backups
            </h2>
            <p className="text-[11px] text-muted-foreground truncate">
              Encrypted snapshots &amp; CSV exports
            </p>
          </div>
        </div>
        <span
          className={cn(
            'text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 mt-0.5',
            isStoragePersistent
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
          )}
        >
          {isStoragePersistent ? 'Persistent' : 'Standard'}
        </span>
      </div>

      {/* 1. CSV Data Exports */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
            Spreadsheet Exports
          </span>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            .CSV
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportTransactionsCSV}
            disabled={isExporting !== null}
            className="w-full justify-between h-8.5 px-3 text-xs rounded-xl hover:bg-muted/50 border-border/70 transition-colors"
            title="Export all transactions to CSV"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Receipt className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground truncate">Transactions</span>
            </span>
            <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground shrink-0">
              {isExporting === 'tx_csv' ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              <span>Export</span>
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportFriendsDebtCSV}
            disabled={isExporting !== null}
            className="w-full justify-between h-8.5 px-3 text-xs rounded-xl hover:bg-muted/50 border-border/70 transition-colors"
            title="Export everyday splits & loans to CSV"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground truncate">Friends &amp; Debts</span>
            </span>
            <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground shrink-0">
              {isExporting === 'debt_csv' ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              <span>Export</span>
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportHabitsCSV}
            disabled={isExporting !== null}
            className="w-full justify-between h-8.5 px-3 text-xs rounded-xl hover:bg-muted/50 border-border/70 transition-colors"
            title="Export habits and completion logs to CSV"
          >
            <span className="flex items-center gap-2 min-w-0">
              <CheckSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground truncate">Habits &amp; Logs</span>
            </span>
            <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground shrink-0">
              {isExporting === 'habits_csv' ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              <span>Export</span>
            </span>
          </Button>
        </div>
      </div>

      {/* 2. Full Workspace Snapshot (All 20 Tables) */}
      <div className="pt-2 border-t border-border/60 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Full Database Backup
          </span>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {ALL_WORKSPACE_TABLES.length} Tables
          </span>
        </div>

        {/* Interactive Mode Toggle Banner */}
        <div
          onClick={() => setEncryptBackup(!encryptBackup)}
          className={cn(
            'flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all select-none',
            encryptBackup
              ? 'bg-emerald-500/5 border-emerald-500/30 hover:bg-emerald-500/10'
              : 'bg-muted/30 border-border/70 hover:bg-muted/50'
          )}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEncryptBackup(!encryptBackup);
            }
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                'p-1.5 rounded-lg shrink-0 transition-colors',
                encryptBackup
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {encryptBackup ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground leading-tight">
                {encryptBackup ? 'Encrypted Backup' : 'Plaintext JSON'}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
                {encryptBackup ? 'AES-256-GCM + PBKDF2' : 'Unencrypted snapshot'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pl-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              {encryptBackup ? 'Lock' : 'Plain'}
            </span>
            <div
              className={cn(
                'w-8 h-4.5 rounded-full p-0.5 transition-colors relative flex items-center',
                encryptBackup ? 'bg-primary justify-end' : 'bg-muted-foreground/30 justify-start'
              )}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-background shadow-xs transition-transform" />
            </div>
          </div>
        </div>

        {encryptBackup && (
          <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 space-y-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Your backup is client-side encrypted with AES-256-GCM. Save your passphrase carefully; it cannot be recovered.
            </p>
            <div className="flex flex-col gap-2">
              <Input
                type="password"
                placeholder="Passphrase (min 4 chars)"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="h-8 text-xs rounded-lg bg-background"
              />
              <Input
                type="password"
                placeholder="Confirm passphrase"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                className="h-8 text-xs rounded-lg bg-background"
              />
            </div>
          </div>
        )}

        {/* Action Buttons: Stacked vertically for perfect fit without overflow */}
        <div className="flex flex-col gap-2 pt-0.5">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleFullBackup}
            disabled={isExporting !== null}
            className="w-full justify-center gap-2 h-9 px-3 text-xs rounded-xl font-medium shadow-xs"
          >
            {isExporting === 'full_backup' ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Exporting Snapshot...</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>Export Database Snapshot</span>
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
              className="w-full justify-center gap-2 h-9 px-3 text-xs border-dashed rounded-xl hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-3.5 w-3.5 shrink-0" />
              <span>Restore from Backup</span>
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
