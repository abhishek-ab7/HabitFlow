import { fmtInr, type QaContext } from './qa-handlers-lifeos';

const STOP_WORDS = new Set([
  'what', 'when', 'where', 'which', 'how', 'much', 'many', 'did', 'does', 'have',
  'has', 'was', 'were', 'are', 'is', 'the', 'this', 'that', 'with', 'from', 'for',
  'and', 'about', 'into', 'your', 'mine', 'spent', 'spend', 'money', 'month',
  'show', 'tell', 'give', 'please', 'list', 'all', 'current', 'total',
  'can', 'per', 'day', 'days', 'safe', 'safely', 'today', 'week', 'rest',
]);

function tokenizeQuery(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

export function tryAnswerCategorySpend(ctx: QaContext): string | null {
  const hasSpendIntent = ['spend', 'spent', 'budget', 'on ', 'how much'].some((kw) => ctx.q.includes(kw));
  if (!hasSpendIntent) return null;

  const matched = ctx.categories.find((c) => {
    const tokens = String(c.name || '').toLowerCase().split(/[\s&/]+/).filter((t) => t.length >= 3);
    return tokens.some((tok) => ctx.q.includes(tok));
  });
  if (!matched) return null;

  const budgetText =
    matched.budgetLimit > 0 ? ` against a **${fmtInr(matched.budgetLimit)}** budget` : ' (no category budget limit set)';
  const matchingTxs = ctx.recentTxs
    .filter((t) => String(t.category || '').toLowerCase() === String(matched.name || '').toLowerCase())
    .slice(0, 4);
  const txLines = matchingTxs.length
    ? `\n\nRecent entries:\n${matchingTxs.map((t) => `- ${t.date}: **${t.title}** (${fmtInr(t.amount)})`).join('\n')}`
    : '';
  return `In **${ctx.monthLabel}**, you spent **${fmtInr(matched.spent)}** on **${matched.name}** across ${matched.transactionCount || 0} transaction(s)${budgetText}.${txLines}`;
}

export function tryAnswerKeywordSearch(ctx: QaContext): string | null {
  const queryTokens = tokenizeQuery(ctx.question);
  if (queryTokens.length === 0) return null;

  const matchingTxs = ctx.recentTxs.filter((tx) => {
    const hay = `${tx.title || ''} ${tx.merchant || ''} ${(tx.tags || []).join(' ')}`.toLowerCase();
    return queryTokens.some((tok) => hay.includes(tok));
  });
  const matchingMerchants = ctx.topMerchants.filter((m) =>
    queryTokens.some((tok) => String(m.merchant || '').toLowerCase().includes(tok))
  );
  if (matchingTxs.length === 0 && matchingMerchants.length === 0) return null;

  const totalMatched =
    matchingTxs.length > 0
      ? matchingTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0)
      : matchingMerchants.reduce((sum, m) => sum + m.spent, 0);
  const lines =
    matchingTxs.length > 0
      ? matchingTxs.slice(0, 5).map((t) => `- ${t.date}: **${t.title}** — ${fmtInr(t.amount)} (${t.category})`)
      : matchingMerchants.slice(0, 4).map((m) => `- **${m.merchant}**: ${fmtInr(m.spent)} (${m.count} txns in ${m.category})`);

  return `Found ${matchingTxs.length || matchingMerchants.length} matching item(s) totaling **${fmtInr(totalMatched)}**:\n${lines.join('\n')}`;
}

export function tryAnswerAffordability(ctx: QaContext): string | null {
  if (!/\b(afford|safe(?:ly)?|daily|per\s+day|buy|left to spend|remaining budget)\b/.test(ctx.q)) return null;
  return `You have **${fmtInr(ctx.s.safeToSpendMonthly)}** safe to spend for the rest of **${ctx.monthLabel}** (**${fmtInr(ctx.s.safeToSpendDaily)}/day** across ${ctx.s.remainingDaysInMonth || 0} remaining days), backed by **${fmtInr(ctx.nw.liquidAssets)}** in liquid accounts.`;
}

export function tryAnswerCashflowCrunch(ctx: QaContext): string | null {
  if (!/\b(crunch|cash[- ]?flow|upcoming|next 14|next 7|due soon|obligations?|unpaid)\b/.test(ctx.q)) return null;
  const unpaidBills = Number(ctx.s.remainingUnpaidBills ?? 0);
  const unpaidEmis = Number(ctx.s.remainingUnpaidEmis ?? 0);
  const unpaidComms = Number(ctx.s.remainingUnpaidCommitments ?? 0);
  const totalUnpaid = unpaidBills + unpaidEmis + unpaidComms;
  const liquid = Number(ctx.nw.liquidAssets ?? 0);
  const crunchStatus = formatCrunchStatus(totalUnpaid, liquid);

  return `${crunchStatus}\n- Unpaid recurring bills: **${fmtInr(unpaidBills)}**\n- Unpaid EMIs: **${fmtInr(unpaidEmis)}**\n- Unpaid monthly commitments: **${fmtInr(unpaidComms)}**`;
}

function formatCrunchStatus(totalUnpaid: number, liquid: number): string {
  if (totalUnpaid === 0) return 'No unpaid fixed obligations remain for this cycle.';
  if (liquid >= totalUnpaid) {
    return `Your liquid balance (**${fmtInr(liquid)}**) comfortably covers the **${fmtInr(totalUnpaid)}** in remaining obligations.`;
  }
  return `Heads up: **${fmtInr(totalUnpaid)}** in remaining bills/EMIs exceeds your current liquid balance of **${fmtInr(liquid)}** by **${fmtInr(totalUnpaid - liquid)}**.`;
}

export function tryAnswerBills(ctx: QaContext): string | null {
  if (!/\b(subscriptions?|recurring|bills?|autopays?)\b/.test(ctx.q)) return null;
  if (ctx.bills.length === 0) {
    return 'You have no active recurring bills or subscriptions tracked yet. Add them in **Trackers** to monitor due dates and annualized costs.';
  }
  const sorted = [...ctx.bills].sort((a, b) => (b.annualized || 0) - (a.annualized || 0));
  const totalAnnual = sorted.reduce((sum, b) => sum + (b.annualized || 0), 0);
  const topList = sorted
    .slice(0, 5)
    .map((b) => `- **${b.name}**: ${fmtInr(b.amount)}/${b.cadence} (${fmtInr(b.annualized)}/yr, due day ${b.dueDay})`)
    .join('\n');
  return `Your ${ctx.bills.length} active recurring bills total **${fmtInr(totalAnnual)}/year**:\n${topList}`;
}

export function tryAnswerNetWorth(ctx: QaContext): string | null {
  if (!/\b(net worth|wealth|assets?|liabilit(?:y|ies)|accounts?|banks?|balances?|liquid|cash)\b/.test(ctx.q)) return null;
  const accLines = ctx.accounts.length
    ? ctx.accounts
        .slice(0, 6)
        .map((a) => `- **${a.name}** (${String(a.type || '').replace('_', ' ')}${a.isDefault ? ', Default' : ''}): ${fmtInr(a.balance)}`)
        .join('\n')
    : '- No active accounts found.';
  const totalAssets = (ctx.nw.liquidAssets || 0) + (ctx.nw.investmentAssets || 0);
  return `Your current **Net Worth** is **${fmtInr(ctx.nw.netWorth)}** (Assets: **${fmtInr(totalAssets)}**, Liabilities: **${fmtInr(ctx.nw.totalLiabilities)}**, Liquid cash/bank: **${fmtInr(ctx.nw.liquidAssets)}**).\n\nAccounts:\n${accLines}`;
}

export function tryAnswerDebt(ctx: QaContext): string | null {
  if (!/\b(emis?|loans?|debts?|friends?|owe|borrow(?:ed)?|lent)\b/.test(ctx.q)) return null;
  const emiLines = ctx.emis.map((e) => `- EMI **${e.name}**: ${fmtInr(e.emiAmount)}/mo (${e.remainingMonths} months left @ ${e.interestRate}%)`);
  const debtLines = ctx.debts.map((d) => `- ${d.direction === 'lent' ? 'Owed by' : 'Owe'} **${d.person}**: ${fmtInr(d.remaining)}`);
  if (emiLines.length === 0 && debtLines.length === 0) {
    return 'You have zero active EMIs or unsettled friend lend/borrow balances right now.';
  }
  return `Active debt & repayment breakdown:\n${[...emiLines, ...debtLines].join('\n')}`;
}

export function tryAnswerSips(ctx: QaContext): string | null {
  if (!/\b(sips?|invest(?:ed|ments?|ing)?|mutual(?:\s+funds?)?|corpus|portfolios?)\b/.test(ctx.q)) return null;
  if (ctx.sips.length === 0 && !ctx.s.totalInvested) {
    return 'No active SIP plans or investment entries are recorded for this period yet.';
  }
  const sipLines = ctx.sips
    .slice(0, 5)
    .map((sp) => `- **${sp.name}**: ${fmtInr(sp.monthlyAmount)}/mo (Invested ${fmtInr(sp.totalInvested)} · Value ${fmtInr(sp.currentValue)})`)
    .join('\n');
  return `This month you invested **${fmtInr(ctx.s.totalInvested)}** (total investment assets: **${fmtInr(ctx.nw.investmentAssets)}**).${sipLines ? `\n\nActive SIPs:\n${sipLines}` : ''}`;
}

export function tryAnswerAnomalies(ctx: QaContext): string | null {
  if (!/\b(anomal(?:y|ies)|spikes?|warnings?|alerts?|unusual|review|inbox)\b/.test(ctx.q)) return null;
  if (ctx.anomalies.length === 0 && !ctx.s.needsReviewCount) {
    return `No unusual spending spikes or pending review items detected for **${ctx.monthLabel}**.`;
  }
  const alertLines = ctx.anomalies.map((a) => `- **${a.title}**: ${a.description}`);
  if (ctx.s.needsReviewCount > 0) {
    alertLines.push(`- **${ctx.s.needsReviewCount} transaction(s)** waiting in the Review Inbox.`);
  }
  return `Alerts & items needing attention:\n${alertLines.join('\n')}`;
}

export function tryAnswerTrends(ctx: QaContext): string | null {
  if (!/\b(last month|previous|compare|trends?|vs|income|salary|save|savings?(?:\s+rate)?)\b/.test(ctx.q)) return null;
  const trendLines = ctx.trailing
    .map((m) => `- **${m.monthKey}**: Spent ${fmtInr(m.spent)} · Income ${fmtInr(m.income)} · Invested ${fmtInr(m.invested)}`)
    .join('\n');
  return `For **${ctx.monthLabel}**, your income is **${fmtInr(ctx.s.totalIncome)}**, spending is **${fmtInr(ctx.s.totalSpent)}**, and savings rate is **${ctx.s.savingsRatePct || 0}%**.\n\nTrailing 3-month trend:\n${trendLines || '- Not enough historical months yet.'}`;
}

function getTopSpendingCategories(categories: any[], limit: number) {
  return [...categories]
    .filter((c) => (c.spent || 0) > 0)
    .sort((a, b) => (b.spent || 0) - (a.spent || 0))
    .slice(0, limit);
}

function formatCategoryLines(categories: any[], limit: number, emptyMsg: string): string {
  const topCats = getTopSpendingCategories(categories, limit);
  if (topCats.length === 0) return emptyMsg;
  return topCats.map((c) => `- **${c.name}**: ${fmtInr(c.spent)} (${c.transactionCount} txns)`).join('\n');
}

export function tryAnswerBreakdown(ctx: QaContext): string | null {
  if (!/\b(where|most|top|biggest|highest|breakdown|categor(?:y|ies)|merchants?)\b/.test(ctx.q)) return null;
  const catBlock = formatCategoryLines(ctx.categories, 4, '- No category spending logged yet this month.');
  const merchBlock = ctx.topMerchants.length
    ? `\n\nTop merchants:\n${ctx.topMerchants.slice(0, 3).map((m) => `- **${m.merchant}**: ${fmtInr(m.spent)} (${m.count}x)`).join('\n')}`
    : '';
  return `Here is where your spending went in **${ctx.monthLabel}** (total **${fmtInr(ctx.s.totalSpent)}**):\n${catBlock}${merchBlock}`;
}

export function tryAnswerRecent(ctx: QaContext): string | null {
  if (!/\b(recent|latest|last|transactions|entries|history)\b/.test(ctx.q)) return null;
  if (ctx.recentTxs.length === 0) return `No transactions recorded for **${ctx.monthLabel}** yet.`;
  return `Latest entries:\n${ctx.recentTxs.slice(0, 5).map((t) => `- ${t.date}: **${t.title}** — ${fmtInr(t.amount)} (${t.category})`).join('\n')}`;
}

export function buildSnapshotFallback(ctx: QaContext): string {
  const catSummary = formatCategoryLines(ctx.categories, 3, '- No expenses logged yet this month.');
  return `For **${ctx.monthLabel}**, you've spent **${fmtInr(ctx.s.totalSpent)}** against **${fmtInr(ctx.s.totalIncome)}** income (savings rate **${ctx.s.savingsRatePct || 0}%**), with a net worth of **${fmtInr(ctx.nw.netWorth)}**.\n\nTop spending categories:\n${catSummary}`;
}
