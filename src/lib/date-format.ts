/**
 * Human-friendly date, month, and ordinal formatting helpers used across
 * HabitFlow (Dashboard, Finance, Friends Ledger, Bill Calendar, Analytics).
 */

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats an ISO date string ("2026-11-23" or full ISO timestamp) into a clean
 * human label: "Today", "Yesterday", "Tomorrow", "22 Nov", or "22 Nov 2025".
 */
function parseDateParts(dateInput: string | Date): { y: number; m: number; d: number } | string {
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return '';
    return { y: dateInput.getFullYear(), m: dateInput.getMonth() + 1, d: dateInput.getDate() };
  }
  const raw = String(dateInput).trim();
  const datePart = raw.includes('T') ? raw.slice(0, 10) : raw;
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return { y: parseInt(match[1], 10), m: parseInt(match[2], 10), d: parseInt(match[3], 10) };
  }
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return raw;
  return { y: parsed.getFullYear(), m: parsed.getMonth() + 1, d: parsed.getDate() };
}

function getRelativeDayLabel(normalizedYmd: string, now: Date): string | null {
  if (normalizedYmd === toLocalYmd(now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (normalizedYmd === toLocalYmd(yesterday)) return 'Yesterday';
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (normalizedYmd === toLocalYmd(tomorrow)) return 'Tomorrow';
  return null;
}

export function formatHumanDate(
  dateInput?: string | Date | null,
  options?: { includeYear?: boolean }
): string {
  if (!dateInput) return '';
  const parts = parseDateParts(dateInput);
  if (typeof parts === 'string') return parts;

  const { y, m, d } = parts;
  const normalizedYmd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const now = new Date();
  const relative = getRelativeDayLabel(normalizedYmd, now);
  if (relative) return relative;

  const monthLabel = SHORT_MONTHS[m - 1] || '';
  if (!monthLabel) return normalizedYmd;
  return options?.includeYear || y !== now.getFullYear() ? `${d} ${monthLabel} ${y}` : `${d} ${monthLabel}`;
}

/**
 * Formats a month key ("2026-11") into "Nov 2026".
 */
export function formatMonthYear(monthKey?: string | null): string {
  if (!monthKey) return '';
  const match = String(monthKey).trim().match(/^(\d{4})-(\d{2})/);
  if (!match) return String(monthKey);
  const year = parseInt(match[1], 10);
  const monthIdx = parseInt(match[2], 10) - 1;
  const monthLabel = SHORT_MONTHS[monthIdx];
  if (!monthLabel) return String(monthKey);
  return `${monthLabel} ${year}`;
}

/**
 * Formats a day-of-month integer (1..31) with its English ordinal suffix:
 * 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 15 -> "15th", 21 -> "21st".
 */
const ORDINAL_SUFFIXES = ['th', 'st', 'nd', 'rd'] as const;

export function formatOrdinalDay(day?: number | null): string {
  const num = Number(day);
  if (day == null || isNaN(num)) return '';
  const n = Math.floor(Math.abs(num));
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${ORDINAL_SUFFIXES[n % 10] ?? 'th'}`;
}

/**
 * Formats a recurring due day into "Due 15th".
 */
export function formatDueDay(day?: number | null): string {
  const ord = formatOrdinalDay(day);
  return ord ? `Due ${ord}` : '';
}
