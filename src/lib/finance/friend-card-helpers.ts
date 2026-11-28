import { formatINR } from '@/lib/stores/finance-store';

export function getNetBadgeInfo(totalNet: number) {
  if (totalNet > 0) return { tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', text: `+${formatINR(totalNet)}` };
  if (totalNet < 0) return { tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', text: `-${formatINR(Math.abs(totalNet))}` };
  return { tone: 'bg-muted text-muted-foreground', text: 'Even' };
}

export function getEverydayTabSubtitle(friendName: string, everydayNet: number): string {
  if (everydayNet > 0) return `${friendName} owes you ${formatINR(everydayNet)} net on everyday splits`;
  if (everydayNet < 0) return `You owe ${friendName} ${formatINR(Math.abs(everydayNet))} net on everyday splits`;
  return 'Everyday tab is fully settled';
}
