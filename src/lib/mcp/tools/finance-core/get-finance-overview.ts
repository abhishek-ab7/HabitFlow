import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getSupabaseAdmin } from '../../supabase-admin';
import { getIstIsoDate, getIstMonthKey } from '../../config';
import {
  mapCreditCardStatementFromRow,
  mapDebtInstallmentFromRow,
  mapDebtRecordFromRow,
  mapEmiTrackerFromRow,
  mapFinanceAccountFromRow,
  mapFinanceBudgetFromRow,
  mapFinanceCategoryFromRow,
  mapFinanceRecurringBillFromRow,
  mapFinanceSipPlanFromRow,
  mapFinanceTransactionFromRow,
  mapMonthlyCommitmentFromRow,
} from '../../mappers';
import {
  calculateMonthlySummary,
  calculateNetWorthSummary,
  calculateUpcomingFinancialObligations,
} from '@/lib/finance/shared-analytics';
import { buildCashFlowForecast } from '@/lib/finance/forecast';
import { detectSpendingAnomalies } from '@/lib/finance/anomalies';
import { authorizeMcpTool, mcpJson } from '../tool-helpers';

type UserId = string;
type MonthKey = string;
type IsoDate = string;

async function fetchOverviewRawData(userId: UserId) {
  const supabase = getSupabaseAdmin();
  const tables = [
    'finance_accounts',
    'finance_transactions',
    'finance_categories',
    'finance_budgets',
    'monthly_commitments',
    'emi_trackers',
    'debt_records',
    'debt_installments',
    'finance_recurring_bills',
    'finance_sip_plans',
    'credit_card_statements',
  ] as const;

  const results = await Promise.all(
    tables.map((t) => supabase.from(t).select('*').eq('user_id', userId).is('deleted_at', null))
  );
  return results.map((r) => (r.data ?? []) as Record<string, unknown>[]);
}

function mapOverviewEntities(raw: Record<string, unknown>[][]) {
  return {
    accounts: raw[0].map(mapFinanceAccountFromRow),
    transactions: raw[1].map(mapFinanceTransactionFromRow),
    categories: raw[2].map(mapFinanceCategoryFromRow),
    budgets: raw[3].map(mapFinanceBudgetFromRow),
    commitments: raw[4].map(mapMonthlyCommitmentFromRow),
    emiTrackers: raw[5].map(mapEmiTrackerFromRow),
    debtRecords: raw[6].map(mapDebtRecordFromRow),
    debtInstallments: raw[7].map(mapDebtInstallmentFromRow),
    recurringBills: raw[8].map(mapFinanceRecurringBillFromRow),
    sipPlans: raw[9].map(mapFinanceSipPlanFromRow),
    creditCardStatements: raw[10].map(mapCreditCardStatementFromRow),
  };
}

type OverviewEntities = ReturnType<typeof mapOverviewEntities>;

function buildOverviewResult(params: {
  entities: OverviewEntities;
  monthKey: MonthKey;
  referenceDate: IsoDate;
  includeForecast?: boolean;
  includeAnomalies?: boolean;
}) {
  const { entities, monthKey, referenceDate } = params;
  const summary = calculateMonthlySummary({ ...entities, monthKey, referenceDate });
  const netWorth = calculateNetWorthSummary(entities);
  const upcomingObligations = calculateUpcomingFinancialObligations({
    ...entities,
    currentDate: referenceDate,
    withinDays: 7,
  });

  const forecast = params.includeForecast
    ? buildCashFlowForecast({ ...entities, horizonDays: 30, referenceDate })
    : null;

  const anomalies = params.includeAnomalies
    ? detectSpendingAnomalies({
        selectedMonth: monthKey,
        ...entities,
        upcomingObligations7d: upcomingObligations,
      })
    : null;

  return {
    monthKey,
    referenceDateIst: referenceDate,
    summary,
    netWorth,
    upcomingObligations,
    forecast,
    anomalies,
  };
}

export function registerGetFinanceOverviewTool(server: McpServer) {
  server.registerTool(
    'get_finance_overview',
    {
      title: 'Get Finance Overview',
      description:
        'Retrieves monthly income, expenses, investments, net savings, budget pace, category breakdown, net worth, and upcoming obligations.',
      inputSchema: {
        monthKey: z
          .string()
          .regex(/^\d{4}-\d{2}$/, 'Must be YYYY-MM')
          .optional()
          .describe('Target month (defaults to current month in IST)'),
        includeForecast: z.boolean().optional().default(false).describe('Include 30-day cash flow runway projection'),
        includeAnomalies: z.boolean().optional().default(false).describe('Include detected spending anomalies'),
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

      const raw = await fetchOverviewRawData(authRes.auth.userId);
      const entities = mapOverviewEntities(raw);
      return mcpJson(
        buildOverviewResult({
          entities,
          monthKey: args.monthKey || getIstMonthKey(),
          referenceDate: getIstIsoDate(),
          includeForecast: args.includeForecast,
          includeAnomalies: args.includeAnomalies,
        })
      );
    }
  );
}
