import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate } from '../../config';
import {
  mapCreditCardStatementFromRow,
  mapFinanceAccountFromRow,
  mapFinanceTransactionFromRow,
} from '../../mappers';
import { computeCreditCardSummary } from '@/lib/finance/credit-card-cycles';
import { authorizeMcpTool, mcpError, mcpJson } from '../tool-helpers';

async function computeSingleCardSummary(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  card: Record<string, unknown>,
  referenceDate: string
) {
  const [{ data: txs }, { data: statements }] = await Promise.all([
    supabase
      .from('finance_transactions')
      .select('*')
      .eq('user_id', userId)
      .or(`account_id.eq.${card.id},to_account_id.eq.${card.id}`)
      .is('deleted_at', null),
    supabase
      .from('credit_card_statements')
      .select('*')
      .eq('user_id', userId)
      .eq('account_id', card.id as string)
      .is('deleted_at', null),
  ]);

  return computeCreditCardSummary({
    account: mapFinanceAccountFromRow(card),
    transactions: (txs || []).map(mapFinanceTransactionFromRow),
    persistedStatements: (statements || []).map(mapCreditCardStatementFromRow),
    referenceDate,
  });
}

export function registerGetCreditCardCyclesTool(server: McpServer) {
  server.registerTool(
    'get_credit_card_cycles',
    {
      title: 'Get Credit Card Cycles & Statements',
      description:
        'Retrieves dual-cycle credit card summaries (unbilled current spends + open billed statements, total due, grace periods, next due dates, and utilization) across all or specific cards.',
      inputSchema: {
        accountId: z.string().uuid().optional().describe('Filter by specific credit card account UUID'),
        referenceDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
          .optional()
          .describe('Reference date (defaults to today in IST)'),
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

      const referenceDate = args.referenceDate || getIstIsoDate();
      const supabase = getSupabaseAdmin();

      let query = supabase
        .from('finance_accounts')
        .select('*')
        .eq('user_id', authRes.auth.userId)
        .eq('type', 'credit_card')
        .is('deleted_at', null);

      if (args.accountId) query = query.eq('id', args.accountId);

      const { data: cards, error } = await query;
      if (error) return mcpError(`Failed to fetch cards: ${error.message}`);

      const cardSummaries = [];
      for (const card of cards || []) {
        cardSummaries.push(
          await computeSingleCardSummary(supabase, authRes.auth.userId, card, referenceDate)
        );
      }

      return mcpJson({
        referenceDateIst: referenceDate,
        count: cardSummaries.length,
        cards: cardSummaries,
      });
    }
  );
}
