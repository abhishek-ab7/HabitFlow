import { getSupabaseAdmin } from '../../supabase-admin';
import { getInsertMetadata, getSoftDeleteMetadata, getUpdateMetadata } from '../../sync-helpers';
import { pickDefinedColumns } from '../tool-helpers';

const DEBT_UPDATE_COLUMNS = [
  ['contactInfo', 'contact_info'],
  ['direction', 'direction'],
  ['bucketType', 'bucket_type'],
  ['targetSettlementDate', 'target_settlement_date'],
  ['repaymentSchedule', 'repayment_schedule'],
  ['plannedMonthlyInstallment', 'planned_monthly_installment'],
  ['dueDayOfMonth', 'due_day_of_month'],
  ['color', 'color'],
  ['notes', 'notes'],
] as const;

type UserId = string;
type DateIso = string;
type PersonName = string;
type BucketType = string;

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

function buildNewDebtRow(userId: UserId, args: Record<string, any>, dateIst: DateIso) {
  const principal = Number(args.principalAmount);
  const directionPrefix = args.direction === 'lent' ? 'Lent to' : 'Borrowed from';
  return {
    user_id: userId,
    person_name: String(args.personName).trim(),
    contact_info: orVal(args.contactInfo, null),
    direction: args.direction,
    bucket_type: orVal(args.bucketType, 'everyday_split'),
    title: args.title?.trim() ?? `${directionPrefix} ${args.personName}`,
    principal_amount: principal,
    total_repaid_amount: 0,
    remaining_amount: principal,
    start_date: dateIst,
    target_settlement_date: orVal(args.targetSettlementDate, null),
    repayment_schedule: orVal(args.repaymentSchedule, 'flexible'),
    planned_monthly_installment: orVal(args.plannedMonthlyInstallment, null),
    due_day_of_month: orVal(args.dueDayOfMonth, null),
    color: orVal(args.color, '#f59e0b'),
    status: 'active',
    notes: orVal(args.notes, null),
    ...getInsertMetadata(),
  };
}

function hasRequiredDebtEntryArgs(args: Record<string, any>): boolean {
  return Boolean(args.personName && args.direction && args.principalAmount);
}

export async function createDebtEntry(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, any>,
  dateIst: DateIso
) {
  if (!hasRequiredDebtEntryArgs(args)) {
    return {
      error: 'Validation Error: personName, direction, and principalAmount are required for create_entry.',
    };
  }

  const { data, error } = await supabase
    .from('debt_records')
    .insert(buildNewDebtRow(userId, args, dateIst))
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'entry_created', debtRecord: data } };
}

async function fetchOpenBucketEntries(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  personName: PersonName,
  bucketType: BucketType
) {
  const { data } = await supabase
    .from('debt_records')
    .select('*')
    .eq('user_id', userId)
    .ilike('person_name', personName.trim())
    .eq('bucket_type', bucketType)
    .eq('status', 'active')
    .is('deleted_at', null);
  return data ?? [];
}

export async function settleDebtBucket(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, any>,
  dateIst: DateIso
) {
  if (!args.personName || !args.bucketType) {
    return { error: 'Validation Error: personName and bucketType are required for settle_bucket.' };
  }
  if (!args.confirm) {
    return {
      error: `Confirmation Required: Settling all active entries in '${args.bucketType}' for ${args.personName} requires confirm: true.`,
    };
  }

  const openEntries = await fetchOpenBucketEntries(supabase, userId, args.personName, args.bucketType);
  const settledEntries = [];
  for (const entry of openEntries) {
    const { data } = await supabase
      .from('debt_records')
      .update({
        remaining_amount: 0,
        total_repaid_amount: entry.principal_amount,
        status: 'settled',
        notes: `${entry.notes || ''} [Settled bucket on ${dateIst}]`.trim(),
        ...getUpdateMetadata(entry),
      })
      .eq('id', entry.id)
      .select()
      .single();
    if (data) settledEntries.push(data);
  }

  return {
    payload: {
      action: 'bucket_settled',
      personName: args.personName,
      bucketType: args.bucketType,
      settledCount: settledEntries.length,
      settledEntries,
    },
  };
}

export async function archiveDebtEntry(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  existing: Record<string, any>,
  args: Record<string, any>
) {
  if (!args.confirm) {
    return { error: 'Confirmation Required: Archiving debt entry requires confirm: true.' };
  }
  const { data, error } = await supabase
    .from('debt_records')
    .update({ status: 'archived', ...getSoftDeleteMetadata(existing) })
    .eq('id', args.debtId)
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'entry_archived', debtRecord: data } };
}

export async function restoreDebtEntry(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  debtId: string
) {
  const remaining = Number(existing.remaining_amount ?? existing.principal_amount ?? 0);
  const nextStatus = remaining <= 0 ? 'settled' : 'active';
  const { data, error } = await supabase
    .from('debt_records')
    .update({ deleted_at: null, status: nextStatus, ...getUpdateMetadata(existing) })
    .eq('user_id', userId)
    .eq('id', debtId)
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'entry_restored', debtRecord: data } };
}

export async function updateDebtEntry(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  existing: Record<string, any>,
  args: Record<string, any>
) {
  const updates = pickDefinedColumns(args, DEBT_UPDATE_COLUMNS);
  if (args.personName !== undefined) updates.person_name = String(args.personName).trim();
  if (args.title !== undefined) updates.title = String(args.title).trim();
  if (args.principalAmount !== undefined) {
    const nextPrincipal = Number(args.principalAmount);
    const repaid = Number(existing.total_repaid_amount || 0);
    const nextRemaining = Math.max(0, Math.round((nextPrincipal - repaid) * 100) / 100);
    updates.principal_amount = nextPrincipal;
    updates.remaining_amount = nextRemaining;
    updates.status = nextRemaining <= 0 ? 'settled' : 'active';
  }

  const { data, error } = await supabase
    .from('debt_records')
    .update({ ...updates, ...getUpdateMetadata(existing) })
    .eq('id', args.debtId)
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'entry_updated', debtRecord: data } };
}
