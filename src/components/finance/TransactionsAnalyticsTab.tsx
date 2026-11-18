'use client';

import React, { useState } from 'react';
import {
  Search,
  Download,
  Trash2,
  Edit3,
  HeartHandshake,
  Users,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { useFinanceStore, formatINR } from '@/lib/stores/finance-store';
import type { FinanceTransaction } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface TransactionsAnalyticsTabProps {
  onEditTransaction: (tx: FinanceTransaction) => void;
}

export function TransactionsAnalyticsTab({
  onEditTransaction,
}: TransactionsAnalyticsTabProps) {
  const selectedMonth = useFinanceStore((s) => s.selectedMonth);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const commitments = useFinanceStore((s) => s.commitments);
  const debtRecords = useFinanceStore((s) => s.debtRecords);
  const filters = useFinanceStore((s) => s.filters);
  const setFilters = useFinanceStore((s) => s.setFilters);
  const resetFilters = useFinanceStore((s) => s.resetFilters);
  const getFilteredTransactions = useFinanceStore((s) => s.getFilteredTransactions);
  const getMonthlySummary = useFinanceStore((s) => s.getMonthlySummary);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);
  const exportTransactionsCsv = useFinanceStore((s) => s.exportTransactionsCsv);
  const updateCategoryBudget = useFinanceStore((s) => s.updateCategoryBudget);

  const [editingBudgetCatId, setEditingBudgetCatId] = useState<string | null>(null);
  const [newBudgetVal, setNewBudgetVal] = useState('');

  const summary = getMonthlySummary(selectedMonth);
  const filteredTransactions = getFilteredTransactions(selectedMonth);

  const categoriesMap = new Map(categories.map((c) => [c.id, c]));
  const accountsMap = new Map(accounts.map((a) => [a.id, a]));
  const commitmentsMap = new Map(commitments.map((c) => [c.id, c]));
  const debtsMap = new Map(debtRecords.map((d) => [d.id, d]));

  const chartData = summary.categoryBreakdown
    .filter((item) => item.spent > 0)
    .map((item) => ({
      name: item.category.name.split('&')[0].trim(),
      fullName: item.category.name,
      spent: item.spent,
      budget: item.budgetLimit,
      color: item.category.color,
    }));

  const handleDownloadCsv = () => {
    const csv = exportTransactionsCsv(selectedMonth);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `flowfinance-ledger-${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredTransactions.length} transactions to CSV`);
  };

  const handleSaveCategoryBudget = async (catId: string) => {
    const num = parseFloat(newBudgetVal);
    if (!isNaN(num) && num >= 0) {
      await updateCategoryBudget(catId, num);
      toast.success('Updated category monthly budget limit');
    }
    setEditingBudgetCatId(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Section: Category Envelope Budgets & Spend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Category Spend Bar Chart */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Category Spend Breakdown ({selectedMonth})
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Includes personal expenses and items ordered for Monthly Commitments
            </p>
          </div>

          {chartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
              No expenses recorded in {selectedMonth} yet.
            </div>
          ) : (
            <div className="h-64 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={92}
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                  />
                  <Tooltip
                    formatter={(value: unknown) => [
                      formatINR(Number(value) || 0),
                      'Spent',
                    ]}
                    contentStyle={{
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="spent" radius={[0, 6, 6, 0]} barSize={18}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right: Envelope Budgets with 80% Warning & 100% Exceeded Alerts */}
        <div className="lg:col-span-7 rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Category Envelope Budgets
              </h3>
              <p className="text-xs text-muted-foreground">
                Click any budget limit to customize your monthly envelope
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
            {summary.categoryBreakdown.map((item) => {
              const barPct = Math.min(100, item.percentageOfBudget);
              return (
                <div
                  key={item.category.id}
                  className="rounded-lg border border-border/70 bg-background/50 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.category.color }}
                      />
                      <span className="font-semibold text-foreground truncate">
                        {item.category.name}
                      </span>
                    </div>

                    {editingBudgetCatId === item.category.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={newBudgetVal}
                          onChange={(e) => setNewBudgetVal(e.target.value)}
                          className="w-20 h-6 px-1.5 text-xs rounded border border-input bg-background font-mono"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCategoryBudget(item.category.id)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBudgetCatId(item.category.id);
                          setNewBudgetVal(String(item.budgetLimit));
                        }}
                        className="font-mono tabular-nums text-[11px] text-muted-foreground hover:text-foreground"
                        title="Click to edit category monthly budget"
                      >
                        {formatINR(item.spent)} / {formatINR(item.budgetLimit)}
                      </button>
                    )}
                  </div>

                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      style={{
                        width: `${barPct}%`,
                        backgroundColor:
                          item.status === 'exceeded'
                            ? '#ef4444'
                            : item.status === 'warning'
                            ? '#f59e0b'
                            : item.category.color,
                      }}
                      className="h-full transition-all duration-300"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{item.transactionCount} txns</span>
                    {item.status === 'exceeded' ? (
                      <span className="text-rose-500 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Exceeded ({item.percentageOfBudget}%)
                      </span>
                    ) : item.status === 'warning' ? (
                      <span className="text-amber-500 font-semibold">
                        Near limit ({item.percentageOfBudget}%)
                      </span>
                    ) : (
                      <span>{item.percentageOfBudget}% used</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Master Transaction Ledger with Search, Multi-Filter & CSV Export */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Transactions Ledger ({filteredTransactions.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Filter by category, payment method, Mother&apos;s commitment offsets, or
              friend debt installments
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="text-xs"
            >
              Reset Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCsv}
              className="gap-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={filters.searchQuery}
              onChange={(e) => setFilters({ searchQuery: e.target.value })}
              placeholder="Search lipstick, electricity, whey, Rahul..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <select
            value={filters.categoryId}
            onChange={(e) => setFilters({ categoryId: e.target.value })}
            className="h-9 px-2.5 text-xs rounded-md border border-input bg-background"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={filters.accountId}
            onChange={(e) => setFilters({ accountId: e.target.value })}
            className="h-9 px-2.5 text-xs rounded-md border border-input bg-background"
          >
            <option value="all">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            value={filters.commitmentId}
            onChange={(e) => setFilters({ commitmentId: e.target.value })}
            className="h-9 px-2.5 text-xs rounded-md border border-input bg-background"
          >
            <option value="all">All Commitments</option>
            {commitments.map((c) => (
              <option key={c.id} value={c.id}>
                Offsets: {c.recipientName}
              </option>
            ))}
          </select>
        </div>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            No transactions match your current filters for {selectedMonth}.
          </div>
        ) : (
          <div className="divide-y divide-border/60 rounded-lg border border-border/70 overflow-hidden">
            {filteredTransactions.map((tx) => {
              const cat = categoriesMap.get(tx.categoryId);
              const acc = accountsMap.get(tx.accountId);
              const linkedComm = tx.linkedCommitmentId
                ? commitmentsMap.get(tx.linkedCommitmentId)
                : null;
              const linkedDebt = tx.linkedDebtId
                ? debtsMap.get(tx.linkedDebtId)
                : null;

              return (
                <div
                  key={tx.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-background/40 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {tx.title}
                      </span>

                      {cat && (
                        <span
                          className="text-[11px] px-2 py-0.5 rounded font-medium border"
                          style={{
                            borderColor: `${cat.color}40`,
                            color: cat.color,
                          }}
                        >
                          {cat.name}
                          {tx.subcategory ? ` • ${tx.subcategory}` : ''}
                        </span>
                      )}

                      {linkedComm && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-pink-500/15 text-pink-600 dark:text-pink-400 font-medium">
                          <HeartHandshake className="w-3 h-3" />
                          Deducted from {linkedComm.recipientName}&apos;s{' '}
                          {formatINR(linkedComm.monthlyTargetAmount)}
                        </span>
                      )}

                      {linkedDebt && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
                          <Users className="w-3 h-3" />
                          Debt Installment: {linkedDebt.personName}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{tx.date}</span>
                      {acc && <span>• Paid via {acc.name}</span>}
                      {tx.notes && <span>• {tx.notes}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span
                      className={`text-sm font-bold font-mono tabular-nums ${
                        tx.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-foreground'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatINR(tx.amount)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tx)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit transaction"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteTransaction(tx.id);
                          toast.success('Transaction deleted');
                        }}
                        className="p-1.5 rounded hover:bg-rose-500/15 text-muted-foreground hover:text-rose-500 transition-colors"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
