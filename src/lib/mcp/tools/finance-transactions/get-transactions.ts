 
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getSupabaseAdmin } from '../../supabase-admin';
import { authorizeMcpTool, mcpError, mcpJson } from '../tool-helpers';

const EQUAL_FILTER_PAIRS = [
  ['monthKey', 'month_key'],
  ['type', 'type'],
  ['categoryId', 'category_id'],
  ['accountId', 'account_id'],
  ['needsReview', 'needs_review'],
  ['splitGroupId', 'split_group_id'],
  ['statementCycleKey', 'statement_cycle_key'],
] as const;

function applyTransactionFilters(query: any, args: Record<string, any>) {
  let q = query;
  if (!args.includeDeleted) q = q.is('deleted_at', null);
  if (args.startDate) q = q.gte('date', args.startDate);
  if (args.endDate) q = q.lte('date', args.endDate);
  for (const [argKey, col] of EQUAL_FILTER_PAIRS) {
    if (args[argKey] !== undefined) q = q.eq(col, args[argKey]);
  }
  if (args.search) {
    q = q.or(`title.ilike.%${args.search}%,merchant_name.ilike.%${args.search}%,notes.ilike.%${args.search}%`);
  }
  return q;
}

export function registerGetTransactionsTool(server: McpServer) {
  server.registerTool(
    'get_transactions',
    {
      title: 'Get Transactions',
      description:
        'Query financial transactions with multi-dimensional filtering (date ranges, month, type, category, account, tags, review flags, or text search).',
      inputSchema: {
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Filter on/after date (YYYY-MM-DD)'),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Filter on/before date (YYYY-MM-DD)'),
        monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Filter by month key (YYYY-MM)'),
        type: z.enum(['expense', 'income', 'transfer', 'investment']).optional(),
        categoryId: z.string().uuid().optional(),
        accountId: z.string().uuid().optional(),
        search: z.string().optional().describe('Text search across title, merchant, and notes'),
        tag: z.string().optional(),
        needsReview: z.boolean().optional(),
        splitGroupId: z.string().uuid().optional(),
        statementCycleKey: z.string().optional(),
        includeDeleted: z.boolean().optional().default(false).describe('Include soft-deleted transactions'),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const authRes = authorizeMcpTool('habitflow:finance:read');
      if (!authRes.ok) return authRes.response;

      const supabase = getSupabaseAdmin();
      const baseQuery = supabase
        .from('finance_transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', authRes.auth.userId);
      const filteredQuery = applyTransactionFilters(baseQuery, args);

      const offset = args.offset || 0;
      const limit = args.limit || 50;
      const { data, count, error } = await filteredQuery
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) return mcpError(`Failed to fetch transactions: ${error.message}`);

      const rows = data || [];
      const filtered = args.tag
        ? rows.filter((t: Record<string, any>) => Array.isArray(t.tags) && t.tags.includes(args.tag))
        : rows;

      return mcpJson({
        totalCount: count ?? filtered.length,
        returnedCount: filtered.length,
        transactions: filtered,
      });
    }
  );
}
