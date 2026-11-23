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
export function formatSettlementShareText(
  group: FriendLedgerGroup,
  options: SettlementShareOptions = {}
): string {
  const { userUpiId, includeUpiLink = true, myName, target = 'all' } = options;

  let targetNet = 0;
  if (target === 'everyday_only') {
    targetNet = group.everydayNet;
  } else if (target === 'loans_only') {
    targetNet = group.longTermNetPosition;
  } else {
    targetNet = group.everydayNet + group.longTermNetPosition;
  }

  const lines: string[] = [];

  // Header
  lines.push(`*HabitFlow Settlement Summary: ${group.friendName}*`);
  lines.push(`Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`);
  lines.push('');

  // 1. Everyday Running Tab (if requested or all)
  if (target === 'all' || target === 'everyday_only') {
    lines.push(`*1. Everyday Splits Tab*`);
    if (group.everydayRecords.length === 0) {
      lines.push(`• Status: Settled (₹0)`);
    } else {
      if (group.everydayLentRemaining > 0) {
        lines.push(`• You owe me: ₹${group.everydayLentRemaining.toLocaleString('en-IN')}`);
      }
      if (group.everydayBorrowedRemaining > 0) {
        lines.push(`• I owe you: ₹${group.everydayBorrowedRemaining.toLocaleString('en-IN')}`);
      }
      if (group.everydayNet > 0) {
        lines.push(`• Tab Subtotal: You owe ₹${group.everydayNet.toLocaleString('en-IN')}`);
      } else if (group.everydayNet < 0) {
        lines.push(`• Tab Subtotal: I owe ₹${Math.abs(group.everydayNet).toLocaleString('en-IN')}`);
      } else {
        lines.push(`• Tab Subtotal: Even (₹0)`);
      }
    }
    lines.push('');
  }

  // 2. Long-Term Loans & EMIs (if requested or all)
  if (target === 'all' || target === 'loans_only') {
    lines.push(`*2. Long-Term Loans & EMIs*`);
    const activeLoans = (group.longTermLoans || []).filter(
      (loan) => loan.status !== 'settled' && loan.remainingAmount > 0
    );
    if (activeLoans.length === 0) {
      lines.push(`• Status: No active loans`);
    } else {
      activeLoans.forEach((loan) => {
        const dirLabel = loan.direction === 'lent' ? 'You owe' : 'I owe';
        const emiLabel = loan.isEmi && loan.totalInstallments
          ? ` (${loan.paidInstallments || 0}/${loan.totalInstallments} EMIs)`
          : '';
        lines.push(
          `• ${loan.title}: ${dirLabel} ₹${loan.remainingAmount.toLocaleString('en-IN')}${emiLabel}`
        );
      });
      if (group.longTermNetPosition > 0) {
        lines.push(`• Loan Subtotal: You owe ₹${group.longTermNetPosition.toLocaleString('en-IN')}`);
      } else if (group.longTermNetPosition < 0) {
        lines.push(`• Loan Subtotal: I owe ₹${Math.abs(group.longTermNetPosition).toLocaleString('en-IN')}`);
      } else {
        lines.push(`• Loan Subtotal: Even (₹0)`);
      }
    }
    lines.push('');
  }

  // 3. Net Settle-Up
  lines.push(`*Net Settle-Up*`);
  if (targetNet > 0) {
    lines.push(`👉 Total: You owe ₹${targetNet.toLocaleString('en-IN')} net`);
  } else if (targetNet < 0) {
    lines.push(`👉 Total: I owe you ₹${Math.abs(targetNet).toLocaleString('en-IN')} net`);
  } else {
    lines.push(`👉 Total: Everything is fully settled up (₹0)`);
  }

  // 4. UPI Payment Link if friend owes user and UPI is provided
  if (targetNet > 0 && userUpiId && validateUpiId(userUpiId) && includeUpiLink) {
    const upiUri = generateUpiPayUri({
      upiId: userUpiId,
      payeeName: myName,
      amount: targetNet,
      note: `Settlement for ${group.friendName}`,
    });
    if (upiUri) {
      lines.push('');
      lines.push(`UPI ID: ${userUpiId}`);
      lines.push(`Pay via UPI: ${upiUri}`);
    }
  }

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
