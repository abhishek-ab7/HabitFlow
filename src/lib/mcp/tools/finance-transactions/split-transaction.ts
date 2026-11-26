 
import { getSupabaseAdmin } from '../../supabase-admin';
import { getInsertMetadata, getUpdateMetadata } from '../../sync-helpers';

async function resolveDebtCategoryId(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  fallbackCategoryId: string
): Promise<string> {
  const { data: userCategories } = await supabase
    .from('finance_categories')
    .select('id, slug, name')
    .eq('user_id', userId)
    .is('deleted_at', null);

  const debtCat =
    (userCategories || []).find((c) => c.slug === 'emis-debt-repayment') ||
    (userCategories || []).find((c) => {
      const lower = String(c.name || '').toLowerCase();
      return lower.includes('debt') || lower.includes('emi');
    });

  return debtCat?.id || fallbackCategoryId;
}

async function upsertSplitDebtRecord(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  existing: Record<string, any>;
  cleanFriendName: string;
  friendLower: string;
  friendShare: number;
  bucketType: string;
}) {
  const { supabase, userId, existing, cleanFriendName, friendLower, friendShare, bucketType } = params;
  const { data: existingDebts } = await supabase
    .from('debt_records')
    .select('*')
    .eq('user_id', userId)
    .eq('bucket_type', bucketType)
    .eq('direction', 'lent')
    .eq('status', 'active')
    .is('deleted_at', null);

  const matchingDebt = (existingDebts || []).find(
    (d) => String(d.person_name || '').trim().toLowerCase() === friendLower
  );

  if (matchingDebt) {
    const nextPrincipal = Math.round((Number(matchingDebt.principal_amount || 0) + friendShare) * 100) / 100;
    const nextRemaining = Math.round((Number(matchingDebt.remaining_amount || 0) + friendShare) * 100) / 100;
    const { data: toppedUp } = await supabase
      .from('debt_records')
      .update({
        principal_amount: nextPrincipal,
        remaining_amount: nextRemaining,
        notes: matchingDebt.notes
          ? `${matchingDebt.notes}\nSplit: ${existing.title} (+₹${friendShare})`
          : `Split: ${existing.title} (+₹${friendShare})`,
        ...getUpdateMetadata(matchingDebt),
      })
      .eq('id', matchingDebt.id)
      .select()
      .single();
    return toppedUp;
  }

  const { data: createdDebt } = await supabase
    .from('debt_records')
    .insert({
      user_id: userId,
      person_name: cleanFriendName,
      direction: 'lent',
      bucket_type: bucketType,
      title: `Everyday Split: ${existing.title}`,
      principal_amount: friendShare,
      total_repaid_amount: 0,
      remaining_amount: friendShare,
      start_date: existing.date,
      repayment_schedule: 'flexible',
      status: 'active',
      notes: `Split from transaction "${existing.title}" on ${existing.date}`,
      ...getInsertMetadata(),
    })
    .select()
    .single();
  return createdDebt;
}

async function insertFriendShareLeg(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  existing: Record<string, any>;
  cleanFriendName: string;
  friendLower: string;
  friendShare: number;
  debtCatId: string;
  splitGroupId: string;
  existingTags: string[];
}) {
  const { existing, cleanFriendName, friendLower, friendShare } = params;
  const { data } = await params.supabase
    .from('finance_transactions')
    .insert({
      user_id: params.userId,
      title: `${cleanFriendName}'s Share: ${existing.title}`,
      merchant_name: existing.merchant_name || null,
      raw_merchant: existing.raw_merchant || null,
      amount: friendShare,
      type: 'expense',
      category_id: params.debtCatId,
      subcategory: 'Friend Split',
      account_id: existing.account_id,
      date: existing.date,
      month_key: existing.month_key || String(existing.date).slice(0, 7),
      notes: `Friend split portion for ${cleanFriendName} · ${existing.title}`,
      tags: Array.from(new Set([...params.existingTags, 'split', friendLower, 'friend-share'])),
      is_recurring: false,
      needs_review: false,
      split_group_id: params.splitGroupId,
      statement_cycle_key: existing.statement_cycle_key ?? null,
      is_credit_card_payment: false,
      ...getInsertMetadata(),
    })
    .select()
    .single();
  return data;
}

export async function splitTransactionWithFriend(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  existing: Record<string, any>,
  args: Record<string, any>
) {
  if (!args.friendName || !args.friendShareAmount) {
    return {
      error: 'Validation Error: friendName and friendShareAmount are required for split_with_friend.',
    };
  }

  const originalAmount = Number(existing.amount);
  const friendShare = Number(args.friendShareAmount);
  if (friendShare >= originalAmount) {
    return { error: 'Friend share amount must be less than the total transaction amount.' };
  }

  const cleanFriendName = String(args.friendName).trim();
  const friendLower = cleanFriendName.toLowerCase();
  const bucketType = args.friendBucketType || 'everyday_split';
  const userShare = Math.round((originalAmount - friendShare) * 100) / 100;
  const splitGroupId = existing.split_group_id || crypto.randomUUID();
  const existingTags = Array.isArray(existing.tags) ? existing.tags : [];
  const debtCatId = await resolveDebtCategoryId(supabase, userId, existing.category_id);

  const { data: updatedOriginal } = await supabase
    .from('finance_transactions')
    .update({
      amount: userShare,
      split_group_id: splitGroupId,
      tags: Array.from(new Set([...existingTags, 'split', friendLower])),
      notes: `${existing.notes ? `${existing.notes} · ` : ''}Split with ${cleanFriendName} (Your share: ₹${userShare}, ${cleanFriendName} owes: ₹${friendShare})`.trim(),
      ...getUpdateMetadata(existing),
    })
    .eq('id', existing.id)
    .select()
    .single();

  const friendTransaction = await insertFriendShareLeg({
    supabase,
    userId,
    existing,
    cleanFriendName,
    friendLower,
    friendShare,
    debtCatId,
    splitGroupId,
    existingTags,
  });

  const createdDebtRecord = await upsertSplitDebtRecord({
    supabase,
    userId,
    existing,
    cleanFriendName,
    friendLower,
    friendShare,
    bucketType,
  });

  return {
    payload: {
      action: 'split_completed',
      userShare,
      friendShare,
      splitGroupId,
      updatedTransaction: updatedOriginal,
      friendTransaction,
      createdDebtRecord,
    },
  };
}
