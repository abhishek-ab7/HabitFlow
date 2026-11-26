import {
  tryAnswerGymRoi,
  tryAnswerJunkImpact,
  tryAnswerSocialDiet,
  tryAnswerSupplementRoi,
  tryAnswerTriggers,
  type QaContext,
} from './qa-handlers-lifeos';
import {
  buildSnapshotFallback,
  tryAnswerAffordability,
  tryAnswerAnomalies,
  tryAnswerBills,
  tryAnswerBreakdown,
  tryAnswerCashflowCrunch,
  tryAnswerCategorySpend,
  tryAnswerDebt,
  tryAnswerKeywordSearch,
  tryAnswerNetWorth,
  tryAnswerRecent,
  tryAnswerSips,
  tryAnswerTrends,
} from './qa-handlers-core';

const asArray = (val: unknown): any[] => (Array.isArray(val) ? val : []);
const asObj = (val: unknown): any => (val && typeof val === 'object' ? val : {});

function buildLifeOsSubContext(context: any) {
  const lifeOs = asObj(context?.lifeOs);
  const cd = asObj(lifeOs.crossDomain);
  return {
    ww: asObj(cd.walletWaistline),
    roi: asObj(cd.gymSupplementRoi),
    trig: asObj(cd.triggers),
    social: asObj(cd.socialSpendDiet),
    fTelemetry: asObj(lifeOs.fitnessTelemetry),
  };
}

function buildFinanceCollections(context: any) {
  const c = asObj(context);
  return {
    categories: asArray(c.categories),
    accounts: asArray(c.accounts),
    bills: asArray(c.recurringBills),
    emis: asArray(c.activeEmis),
    sips: asArray(c.activeSips),
    debts: asArray(c.openFriendDebts),
    topMerchants: asArray(c.topMerchants),
    recentTxs: asArray(c.recentTransactions),
    trailing: asArray(c.trailingMonths),
    anomalies: asArray(c.anomalies),
  };
}

function buildQaContext(question: string, context: any): QaContext {
  return {
    question,
    q: question.toLowerCase(),
    s: asObj(context?.monthlySummary),
    nw: asObj(context?.netWorth),
    monthLabel: context?.selectedMonth ?? 'this month',
    ...buildFinanceCollections(context),
    ...buildLifeOsSubContext(context),
  };
}

const QA_HANDLERS: Array<(ctx: QaContext) => string | null> = [
  tryAnswerSupplementRoi,
  tryAnswerGymRoi,
  tryAnswerTriggers,
  tryAnswerSocialDiet,
  tryAnswerJunkImpact,
  tryAnswerCategorySpend,
  tryAnswerKeywordSearch,
  tryAnswerAffordability,
  tryAnswerCashflowCrunch,
  tryAnswerBills,
  tryAnswerNetWorth,
  tryAnswerDebt,
  tryAnswerSips,
  tryAnswerAnomalies,
  tryAnswerTrends,
  tryAnswerBreakdown,
  tryAnswerRecent,
];

export function buildDeterministicFinanceAnswer(question: string, context: any): string {
  const ctx = buildQaContext(question, context);
  for (const handler of QA_HANDLERS) {
    const answer = handler(ctx);
    if (answer !== null) return answer;
  }
  return buildSnapshotFallback(ctx);
}
