import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpAuthContext } from '../../auth';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getInsertMetadata, getSoftDeleteMetadata, getUpdateMetadata } from '../../sync-helpers';
import {
  authorizeMcpTool,
  logAndReturnMcpError,
  logAndReturnMcpSuccess,
  mcpError,
  mcpJson,
  pickDefinedColumns,
} from '../tool-helpers';

const CATEGORY_UPDATE_COLUMNS = [
  ['type', 'type'],
  ['monthlyBudgetLimit', 'monthly_budget_limit'],
  ['rolloverEnabled', 'rollover_enabled'],
  ['subcategories', 'subcategories'],
  ['orderIndex', 'order_index'],
  ['icon', 'icon'],
  ['color', 'color'],
] as const;

type UserId = string;
type RowId = string;

function orVal<T>(value: T | undefined | null, fallback: T): T {
  return value ?? fallback;
}

async function listFinanceCategories(userId: UserId, includeArchived?: boolean) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('finance_categories').select('*').eq('user_id', userId);
  if (!includeArchived) query = query.is('deleted_at', null).eq('is_archived', false);
  const { data, error } = await query.order('order_index');
  if (error) return mcpError(`Failed to fetch categories: ${error.message}`);
  return mcpJson({ count: (data || []).length, categories: data });
}

async function listCategorizationRules(userId: UserId, includeInactive?: boolean) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('finance_categorization_rules').select('*').eq('user_id', userId);
  if (!includeInactive) query = query.is('deleted_at', null).eq('is_active', true);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return mcpError(`Failed to fetch rules: ${error.message}`);
  return mcpJson({ count: (data || []).length, rules: data });
}

async function fetchSingleRow(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  userId: UserId,
  id: RowId
) {
  const { data } = await supabase.from(table).select('*').eq('user_id', userId).eq('id', id).single();
  return data;
}

function resolveCategorySlug(name: string, slug?: unknown): string {
  return slug ? String(slug) : name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function createFinanceCategory(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.name) return { error: 'Validation Error: name is required for create.' };
  const name = String(args.name).trim();
  const slug = resolveCategorySlug(name, args.slug);
  const { data, error } = await supabase
    .from('finance_categories')
    .insert({
      user_id: userId,
      name,
      slug,
      type: orVal(args.type, 'expense'),
      icon: orVal(args.icon, 'Tag'),
      color: orVal(args.color, '#6B7280'),
      monthly_budget_limit: orVal(args.monthlyBudgetLimit, 0),
      rollover_enabled: orVal(args.rolloverEnabled, false),
      subcategories: orVal(args.subcategories, []),
      order_index: orVal(args.orderIndex, 0),
      is_system: false,
      is_archived: false,
      ...getInsertMetadata(),
    })
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'created', category: data } };
}

function buildCategoryPatch(existing: Record<string, unknown>, args: Record<string, unknown>) {
  if (args.action === 'archive') {
    return { actionLabel: 'archived', patch: { is_archived: true, ...getSoftDeleteMetadata(existing) } };
  }
  if (args.action === 'restore') {
    return { actionLabel: 'restored', patch: { is_archived: false, deleted_at: null, ...getUpdateMetadata(existing) } };
  }
  const updates = pickDefinedColumns(args, CATEGORY_UPDATE_COLUMNS);
  if (args.name !== undefined) updates.name = String(args.name).trim();
  return { actionLabel: 'updated', patch: { ...updates, ...getUpdateMetadata(existing) } };
}

async function validateAndFetchCategory(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
) {
  if (!args.categoryId) return { error: 'Validation Error: categoryId is required.' };
  if (args.action === 'archive' && !args.confirm) {
    return { error: 'Confirmation Required: Archiving this category requires confirm: true.' };
  }
  const existing = await fetchSingleRow(supabase, 'finance_categories', userId, String(args.categoryId));
  if (!existing) return { error: 'Category not found.' };
  if (args.action === 'archive' && existing.is_system) {
    return { error: 'Forbidden: System categories cannot be deleted or archived.' };
  }
  return { existing };
}

async function mutateFinanceCategory(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  const check = await validateAndFetchCategory(supabase, userId, args);
  if (check.error || !check.existing) return { error: check.error };

  const { actionLabel, patch } = buildCategoryPatch(check.existing, args);
  const { data, error } = await supabase
    .from('finance_categories')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', String(args.categoryId))
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: actionLabel, category: data } };
}

async function updateExistingRule(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>,
  baseFields: Record<string, unknown>
) {
  const existing = await fetchSingleRow(supabase, 'finance_categorization_rules', userId, String(args.ruleId));
  const { data, error } = await supabase
    .from('finance_categorization_rules')
    .update({
      ...baseFields,
      default_tags: args.defaultTags ?? existing?.default_tags ?? [],
      deleted_at: null,
      ...getUpdateMetadata(existing),
    })
    .eq('user_id', userId)
    .eq('id', String(args.ruleId))
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function insertNewRule(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>,
  baseFields: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('finance_categorization_rules')
    .insert({
      user_id: userId,
      ...baseFields,
      default_tags: orVal(args.defaultTags, []),
      ...getInsertMetadata(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function buildRuleBaseFields(args: Record<string, unknown>) {
  const cleanPattern = String(args.rulePattern).trim();
  return {
    match_pattern: cleanPattern,
    clean_merchant_name: args.cleanMerchantName ? String(args.cleanMerchantName).trim() : cleanPattern,
    category_id: args.categoryId,
    subcategory: orVal(args.ruleSubcategory, null),
    is_active: true,
  };
}

async function upsertCategorizationRule(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.rulePattern || !args.categoryId) {
    return { error: 'Validation Error: rulePattern and categoryId are required for upsert_rule.' };
  }

  const baseFields = buildRuleBaseFields(args);
  const rule = args.ruleId
    ? await updateExistingRule(supabase, userId, args, baseFields)
    : await insertNewRule(supabase, userId, args, baseFields);
  return { payload: { action: 'rule_saved', rule } };
}

async function deleteRuleRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  ruleId: RowId,
  existing: Record<string, unknown>
) {
  const { error } = await supabase
    .from('finance_categorization_rules')
    .update({ is_active: false, ...getSoftDeleteMetadata(existing) })
    .eq('user_id', userId)
    .eq('id', ruleId);
  if (error) throw error;
  return { payload: { action: 'rule_deleted', ruleId } };
}

async function mutateCategorizationRule(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: UserId,
  args: Record<string, unknown>
): Promise<{ error?: string; payload?: unknown }> {
  if (!args.ruleId) return { error: `Validation Error: ruleId is required for ${args.action}.` };
  if (args.action === 'delete_rule' && !args.confirm) {
    return { error: 'Confirmation Required: confirm: true required.' };
  }

  const ruleId = String(args.ruleId);
  const existing = await fetchSingleRow(supabase, 'finance_categorization_rules', userId, ruleId);
  if (!existing) return { error: 'Categorization rule not found.' };
  if (args.action === 'delete_rule') return deleteRuleRecord(supabase, userId, ruleId, existing);

  const { data, error } = await supabase
    .from('finance_categorization_rules')
    .update({ is_active: true, deleted_at: null, ...getUpdateMetadata(existing) })
    .eq('user_id', userId)
    .eq('id', ruleId)
    .select()
    .single();
  if (error) throw error;
  return { payload: { action: 'rule_restored', rule: data } };
}

const CATEGORY_WRITE_HANDLERS: Record<
  string,
  (supabase: ReturnType<typeof getSupabaseAdmin>, userId: UserId, args: Record<string, unknown>) => Promise<{ error?: string; payload?: unknown }>
> = {
  create: createFinanceCategory,
  update: mutateFinanceCategory,
  archive: mutateFinanceCategory,
  restore: mutateFinanceCategory,
  upsert_rule: upsertCategorizationRule,
  delete_rule: mutateCategorizationRule,
  restore_rule: mutateCategorizationRule,
};

async function handleManageCategoryWrite(auth: McpAuthContext, args: Record<string, unknown>) {
  const startMs = Date.now();
  const handler = CATEGORY_WRITE_HANDLERS[String(args.action)];
  if (!handler) return mcpError(`Unknown action: ${args.action}`);

  try {
    const outcome = await handler(getSupabaseAdmin(), auth.userId, args);
    if (outcome.error) return mcpError(outcome.error);
    return logAndReturnMcpSuccess({
      auth,
      toolName: 'manage_finance_category',
      action: String(args.action),
      input: args,
      startMs,
      payload: outcome.payload,
    });
  } catch (error) {
    return logAndReturnMcpError({
      auth,
      toolName: 'manage_finance_category',
      action: String(args.action),
      input: args,
      startMs,
      error,
      prefix: 'Failed to manage category',
    });
  }
}

export function registerManageFinanceCategoryTool(server: McpServer) {
  server.registerTool(
    'manage_finance_category',
    {
      title: 'Manage Finance Category & Rules',
      description:
        'List, create, update, archive, or restore expense/income categories, and manage automatic merchant categorization rules.',
      inputSchema: {
        action: z
          .enum(['list', 'create', 'update', 'archive', 'restore', 'list_rules', 'upsert_rule', 'delete_rule', 'restore_rule'])
          .describe('Action to perform'),
        categoryId: z.string().uuid().optional().describe('Category UUID (required for update, archive, restore)'),
        name: z.string().min(1).max(100).optional().describe('Category name'),
        slug: z.string().optional().describe('Unique category slug'),
        type: z.enum(['expense', 'income', 'both']).optional().describe('Category flow type'),
        monthlyBudgetLimit: z.number().min(0).optional().describe('Default monthly budget limit for this category'),
        rolloverEnabled: z.boolean().optional().describe('Whether unspent budget rolls over to next month'),
        subcategories: z.array(z.string()).optional().describe('Subcategories list'),
        orderIndex: z.number().int().optional().describe('Display sort order index'),
        icon: z.string().optional(),
        color: z.string().optional(),
        includeArchived: z.boolean().optional().default(false).describe('Include archived/deleted categories when listing'),
        includeInactive: z.boolean().optional().default(false).describe('Include deleted/inactive rules when listing rules'),
        rulePattern: z.string().optional().describe('Merchant matching pattern string'),
        cleanMerchantName: z.string().optional().describe('Clean normalized merchant name'),
        ruleMatchType: z.enum(['contains', 'exact', 'starts_with', 'regex']).optional(),
        ruleSubcategory: z.string().optional(),
        defaultTags: z.array(z.string()).optional().describe('Default tags applied by this rule'),
        ruleId: z.string().uuid().optional(),
        confirm: z.boolean().optional().describe('Confirmation flag required for destructive actions like archive or delete_rule'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      if (args.action === 'list' || args.action === 'list_rules') {
        const authRes = authorizeMcpTool('habitflow:finance:read');
        if (!authRes.ok) return authRes.response;
        return args.action === 'list'
          ? listFinanceCategories(authRes.auth.userId, args.includeArchived)
          : listCategorizationRules(authRes.auth.userId, args.includeInactive);
      }
      const authRes = authorizeMcpTool('habitflow:finance:write');
      if (!authRes.ok) return authRes.response;
      return handleManageCategoryWrite(authRes.auth, args);
    }
  );
}
