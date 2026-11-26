import type { FriendLedgerGroup } from '@/lib/types';

/**
 * Validates standard Indian UPI VPA (e.g., username@okhdfcbank, 9876543210@paytm)
 */
export function validateUpiId(upiId: string): boolean {
  if (!upiId || typeof upiId !== 'string') return false;
  const trimmed = upiId.trim();
  // Standard UPI ID pattern: 2-256 chars alphanumeric + dot, dash, underscore followed by @ and handle
  const upiPattern = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9.\-_]{2,64}$/;
  return upiPattern.test(trimmed);
}

export interface UpiUriOptions {
  upiId: string;
  payeeName?: string;
  amount?: number;
  note?: string;
}

/**
 * Generates an RFC-compliant upi://pay deep link for mobile settlement.
 */
export function generateUpiPayUri(options: UpiUriOptions): string {
  if (!validateUpiId(options.upiId)) {
    return '';
  }
  const params = new URLSearchParams();
  params.set('pa', options.upiId.trim());
  if (options.payeeName) {
    params.set('pn', options.payeeName.trim());
  }
  if (typeof options.amount === 'number' && options.amount > 0) {
    params.set('am', options.amount.toFixed(2));
  }
  params.set('cu', 'INR');
  if (options.note) {
    params.set('tn', options.note.trim());
  }

  return `upi://pay?${params.toString()}`;
}

export interface SettlementShareOptions {
  userUpiId?: string;
  includeUpiLink?: boolean;
  myName?: string;
  target?: 'all' | 'everyday_only' | 'loans_only';
}

/**
 * Formats a clean, readable text summary isolating Everyday Tab and Long-Term Loans.
 */
function appendEverydayTabLines(lines: string[], group: FriendLedgerGroup) {
  lines.push(`*1. Everyday Splits Tab*`);
  if (group.everydayRecords.length === 0) {
    lines.push(`• Status: Settled (₹0)`);
  } else {
    if (group.everydayLentRemaining > 0) lines.push(`• You owe me: ₹${group.everydayLentRemaining.toLocaleString('en-IN')}`);
    if (group.everydayBorrowedRemaining > 0) lines.push(`• I owe you: ₹${group.everydayBorrowedRemaining.toLocaleString('en-IN')}`);
    const subtotal =
      group.everydayNet > 0
        ? `You owe ₹${group.everydayNet.toLocaleString('en-IN')}`
        : group.everydayNet < 0
          ? `I owe ₹${Math.abs(group.everydayNet).toLocaleString('en-IN')}`
          : 'Even (₹0)';
    lines.push(`• Tab Subtotal: ${subtotal}`);
  }
  lines.push('');
}

function formatLoanLine(loan: NonNullable<FriendLedgerGroup['longTermLoans']>[number]): string {
  const dirLabel = loan.direction === 'lent' ? 'You owe' : 'I owe';
  const emiLabel =
    loan.isEmi && loan.totalInstallments ? ` (${loan.paidInstallments || 0}/${loan.totalInstallments} EMIs)` : '';
  return `• ${loan.title}: ${dirLabel} ₹${loan.remainingAmount.toLocaleString('en-IN')}${emiLabel}`;
}

function appendLoansTabLines(lines: string[], group: FriendLedgerGroup) {
  lines.push(`*2. Long-Term Loans & EMIs*`);
  const activeLoans = (group.longTermLoans || []).filter((l) => l.status !== 'settled' && l.remainingAmount > 0);
  if (activeLoans.length === 0) {
    lines.push(`• Status: No active loans`, '');
    return;
  }
  activeLoans.forEach((loan) => lines.push(formatLoanLine(loan)));
  const subtotal =
    group.longTermNetPosition > 0
      ? `You owe ₹${group.longTermNetPosition.toLocaleString('en-IN')}`
      : group.longTermNetPosition < 0
        ? `I owe ₹${Math.abs(group.longTermNetPosition).toLocaleString('en-IN')}`
        : 'Even (₹0)';
  lines.push(`• Loan Subtotal: ${subtotal}`, '');
}

function appendNetSettleUpLines(lines: string[], targetNet: number) {
  lines.push(`*Net Settle-Up*`);
  if (targetNet > 0) lines.push(`👉 Total: You owe ₹${targetNet.toLocaleString('en-IN')} net`);
  else if (targetNet < 0) lines.push(`👉 Total: I owe you ₹${Math.abs(targetNet).toLocaleString('en-IN')} net`);
  else lines.push(`👉 Total: Everything is fully settled up (₹0)`);
}

function resolveTargetNet(group: FriendLedgerGroup, target: SettlementShareOptions['target']): number {
  if (target === 'everyday_only') return group.everydayNet;
  if (target === 'loans_only') return group.longTermNetPosition;
  return group.everydayNet + group.longTermNetPosition;
}

function appendUpiPaymentLines(params: {
  lines: string[];
  targetNet: number;
  options: SettlementShareOptions;
  friendName: string;
}): void {
  const { lines, targetNet, options, friendName } = params;
  const { userUpiId, includeUpiLink = true, myName } = options;
  if (targetNet <= 0 || !includeUpiLink) return;
  if (!userUpiId || !validateUpiId(userUpiId)) return;
  const upiUri = generateUpiPayUri({
    upiId: userUpiId,
    payeeName: myName,
    amount: targetNet,
    note: `Settlement for ${friendName}`,
  });
  if (upiUri) lines.push('', `UPI ID: ${userUpiId}`, `Pay via UPI: ${upiUri}`);
}

export function formatSettlementShareText(
  group: FriendLedgerGroup,
  options: SettlementShareOptions = {}
): string {
  const target = options.target ?? 'all';
  const targetNet = resolveTargetNet(group, target);
  const dateLabel = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const lines: string[] = [`*HabitFlow Settlement Summary: ${group.friendName}*`, `Date: ${dateLabel}`, ''];

  if (target !== 'loans_only') appendEverydayTabLines(lines, group);
  if (target !== 'everyday_only') appendLoansTabLines(lines, group);
  appendNetSettleUpLines(lines, targetNet);
  appendUpiPaymentLines({ lines, targetNet, options, friendName: group.friendName });
  return lines.join('\n');
}

/**
 * Generates direct WhatsApp share URL
 */
export function generateWhatsAppShareUrl(text: string, phone?: string): string {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

const UPI_STORAGE_KEY = 'habitflow_user_upi_id';

export function getSavedUpiId(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(UPI_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setSavedUpiId(upiId: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (upiId && validateUpiId(upiId)) {
      localStorage.setItem(UPI_STORAGE_KEY, upiId.trim());
    } else if (!upiId) {
      localStorage.removeItem(UPI_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in private mode
  }
}
