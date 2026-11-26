import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { calculateFriendLedgerGroups } from '@/lib/finance/shared-analytics';
import { getSupabaseAdmin } from '../../supabase-admin';
import { mapDebtRecordFromRow } from '../../mappers';
import { authorizeMcpTool, mcpError, mcpJson } from '../tool-helpers';

function filterBucketGroup(
  g: ReturnType<typeof calculateFriendLedgerGroups>[number],
  bucketType: string
) {
  if (bucketType === 'everyday_split') {
    return {
      friendKey: g.friendKey,
      friendName: g.friendName,
      contactInfo: g.contactInfo,
      everydayRecords: g.everydayRecords,
      everydayNet: g.everydayNet,
      everydayBorrowedRemaining: g.everydayBorrowedRemaining,
      everydayLentRemaining: g.everydayLentRemaining,
    };
  }
  if (bucketType === 'long_term_loan') {
    return {
      friendKey: g.friendKey,
      friendName: g.friendName,
      contactInfo: g.contactInfo,
      longTermLoans: g.longTermLoans,
      longTermNetPosition: g.longTermNetPosition,
      longTermBorrowedRemaining: g.longTermBorrowedRemaining,
      longTermLentRemaining: g.longTermLentRemaining,
    };
  }
  return g;
}

export function registerGetFriendLedgersTool(server: McpServer) {
  server.registerTool(
    'get_friend_ledgers',
    {
      title: 'Get Friend Ledgers (Isolated Everyday Tab vs Long-Term Loans)',
      description:
        'Retrieves isolated friend debt ledgers. Everyday split tabs and formal long-term loans are tracked in strictly separate buckets.',
      inputSchema: {
        personName: z.string().optional().describe('Filter by friend name'),
        bucketType: z
          .enum(['everyday_split', 'long_term_loan', 'all'])
          .optional()
          .default('all')
          .describe('Filter by bucket type'),
        includeSettled: z.boolean().optional().default(false).describe('Include settled debts'),
        includeArchived: z.boolean().optional().default(false).describe('Include archived/soft-deleted debts'),
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
      let query = supabase.from('debt_records').select('*').eq('user_id', authRes.auth.userId);
      if (!args.includeArchived) query = query.is('deleted_at', null);
      if (!args.includeSettled) query = query.neq('status', 'settled');
      if (args.personName) query = query.ilike('person_name', `%${args.personName.trim()}%`);

      const { data: debts, error } = await query;
      if (error) return mcpError(`Failed to fetch debt records: ${error.message}`);

      const mappedDebts = (debts || []).map(mapDebtRecordFromRow);
      const filteredGroups = calculateFriendLedgerGroups(mappedDebts).map((g) =>
        filterBucketGroup(g, args.bucketType)
      );

      return mcpJson({ count: filteredGroups.length, friendLedgers: filteredGroups });
    }
  );
}
