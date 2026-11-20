function fmt(n: unknown): string {
  return `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
}

function tokenizeQuery(question: string): string[] {
  const stopWords = new Set([
    'what', 'when', 'where', 'which', 'how', 'much', 'many', 'did', 'does', 'have',
    'has', 'was', 'were', 'are', 'is', 'the', 'this', 'that', 'with', 'from', 'for',
    'and', 'about', 'into', 'your', 'mine', 'spent', 'spend', 'money', 'month',
    'show', 'tell', 'give', 'please', 'list', 'all', 'current', 'total',
  ]);
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));
}

export function buildDeterministicFinanceAnswer(question: string, context: any): string {
  const q = question.toLowerCase();
  const s = context?.monthlySummary || {};
  const nw = context?.netWorth || {};
  const monthLabel = context?.selectedMonth || 'this month';
  const categories: any[] = Array.isArray(context?.categories) ? context.categories : [];
  const accounts: any[] = Array.isArray(context?.accounts) ? context.accounts : [];
  const bills: any[] = Array.isArray(context?.recurringBills) ? context.recurringBills : [];
  const emis: any[] = Array.isArray(context?.activeEmis) ? context.activeEmis : [];
  const sips: any[] = Array.isArray(context?.activeSips) ? context.activeSips : [];
  const debts: any[] = Array.isArray(context?.openFriendDebts) ? context.openFriendDebts : [];
  const topMerchants: any[] = Array.isArray(context?.topMerchants) ? context.topMerchants : [];
  const recentTxs: any[] = Array.isArray(context?.recentTransactions) ? context.recentTransactions : [];
  const trailing: any[] = Array.isArray(context?.trailingMonths) ? context.trailingMonths : [];
  const anomalies: any[] = Array.isArray(context?.anomalies) ? context.anomalies : [];

  // 1. Specific category match in user question
  const matchedCategory = categories.find((c) => {
    const tokens = String(c.name || '')
      .toLowerCase()
      .split(/[\s&/]+/)
      .filter((t) => t.length >= 3);
    return tokens.some((tok) => q.includes(tok));
  });

  if (
    matchedCategory &&
    (q.includes('spend') ||
      q.includes('spent') ||
      q.includes('budget') ||
      q.includes('on ') ||
      q.includes('how much'))
  ) {
    const budgetText =
      matchedCategory.budgetLimit > 0
        ? ` against a **${fmt(matchedCategory.budgetLimit)}** budget`
        : ' (no category budget limit set)';
    const matchingTxs = recentTxs
      .filter(
        (t) =>
          String(t.category || '').toLowerCase() ===
          String(matchedCategory.name || '').toLowerCase()
      )
      .slice(0, 4);
    const txLines = matchingTxs.length
      ? `\n\nRecent entries:\n${matchingTxs
          .map((t) => `- ${t.date}: **${t.title}** (${fmt(t.amount)})`)
          .join('\n')}`
      : '';
    return `In **${monthLabel}**, you spent **${fmt(matchedCategory.spent)}** on **${
      matchedCategory.name
    }** across ${matchedCategory.transactionCount || 0} transaction(s)${budgetText}.${txLines}`;
  }

  // 2. Keyword match against merchants / transaction titles
  const queryTokens = tokenizeQuery(question);
  if (queryTokens.length > 0) {
    const matchingTxs = recentTxs.filter((tx) => {
      const hay = `${tx.title || ''} ${tx.merchant || ''} ${(tx.tags || []).join(' ')}`.toLowerCase();
      return queryTokens.some((tok) => hay.includes(tok));
    });
    const matchingMerchants = topMerchants.filter((m) =>
      queryTokens.some((tok) => String(m.merchant || '').toLowerCase().includes(tok))
    );
    if (matchingTxs.length > 0 || matchingMerchants.length > 0) {
      const totalMatched = matchingTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const lines = (matchingTxs.length > 0 ? matchingTxs.slice(0, 5) : []).map(
        (t) => `- ${t.date}: **${t.title}** — ${fmt(t.amount)} (${t.category})`
      );
      if (lines.length === 0) {
        for (const m of matchingMerchants.slice(0, 4)) {
          lines.push(`- **${m.merchant}**: ${fmt(m.spent)} (${m.count} txns in ${m.category})`);
        }
      }
      return `Found ${matchingTxs.length || matchingMerchants.length} matching item(s) totaling **${fmt(
        matchingTxs.length > 0
          ? totalMatched
          : matchingMerchants.reduce((sum, m) => sum + m.spent, 0)
      )}**:\n${lines.join('\n')}`;
    }
  }

  // 3. Affordability / Safe-to-Spend
  if (/\b(afford|safe|daily|buy|left to spend|remaining budget)\b/.test(q)) {
    return `You have **${fmt(s.safeToSpendMonthly)}** safe to spend for the rest of **${monthLabel}** (**${fmt(
      s.safeToSpendDaily
    )}/day** across ${s.remainingDaysInMonth || 0} remaining days), backed by **${fmt(
      nw.liquidAssets
    )}** in liquid accounts.`;
  }

  // 4. Cashflow crunch & upcoming obligations (check before generic bills)
  if (/\b(crunch|cash[- ]?flow|upcoming|next 14|next 7|due soon|obligations?|unpaid)\b/.test(q)) {
    const unpaidBills = Number(s.remainingUnpaidBills || 0);
    const unpaidEmis = Number(s.remainingUnpaidEmis || 0);
    const unpaidComms = Number(s.remainingUnpaidCommitments || 0);
    const totalUnpaid = unpaidBills + unpaidEmis + unpaidComms;
    const liquid = Number(nw.liquidAssets || 0);
    const crunchStatus =
      totalUnpaid === 0
        ? 'No unpaid fixed obligations remain for this cycle.'
        : liquid >= totalUnpaid
        ? `Your liquid balance (**${fmt(liquid)}**) comfortably covers the **${fmt(
            totalUnpaid
          )}** in remaining obligations.`
        : `Heads up: **${fmt(totalUnpaid)}** in remaining bills/EMIs exceeds your current liquid balance of **${fmt(
            liquid
          )}** by **${fmt(totalUnpaid - liquid)}**.`;

    return `${crunchStatus}\n- Unpaid recurring bills: **${fmt(
      unpaidBills
    )}**\n- Unpaid EMIs: **${fmt(unpaidEmis)}**\n- Unpaid monthly commitments: **${fmt(
      unpaidComms
    )}**`;
  }

  // 5. Subscriptions & recurring bills
  if (/\b(subscriptions?|recurring|bills?|autopays?)\b/.test(q)) {
    if (bills.length === 0) {
      return 'You have no active recurring bills or subscriptions tracked yet. Add them in **Trackers** to monitor due dates and annualized costs.';
    }
    const sorted = [...bills].sort((a, b) => (b.annualized || 0) - (a.annualized || 0));
    const totalAnnual = sorted.reduce((sum, b) => sum + (b.annualized || 0), 0);
    const topList = sorted
      .slice(0, 5)
      .map(
        (b) =>
          `- **${b.name}**: ${fmt(b.amount)}/${b.cadence} (${fmt(b.annualized)}/yr, due day ${b.dueDay})`
      )
      .join('\n');
    return `Your ${bills.length} active recurring bills total **${fmt(totalAnnual)}/year**:\n${topList}`;
  }

  // 6. Net worth, accounts & balances
  if (/\b(net worth|wealth|assets?|liabilit(?:y|ies)|accounts?|banks?|balances?|liquid|cash)\b/.test(q)) {
    const accLines = accounts.length
      ? accounts
          .slice(0, 6)
          .map(
            (a) =>
              `- **${a.name}** (${String(a.type || '').replace('_', ' ')}${
                a.isDefault ? ', Default' : ''
              }): ${fmt(a.balance)}`
          )
          .join('\n')
      : '- No active accounts found.';
    return `Your current **Net Worth** is **${fmt(nw.netWorth)}** (Assets: **${fmt(
      (nw.liquidAssets || 0) + (nw.investmentAssets || 0)
    )}**, Liabilities: **${fmt(nw.totalLiabilities)}**, Liquid cash/bank: **${fmt(
      nw.liquidAssets
    )}**).\n\nAccounts:\n${accLines}`;
  }

  // 7. EMIs, Loans & Friend Debts
  if (/\b(emis?|loans?|debts?|friends?|owe|borrow(?:ed)?|lent)\b/.test(q)) {
    const emiLines = emis.map(
      (e) =>
        `- EMI **${e.name}**: ${fmt(e.emiAmount)}/mo (${e.remainingMonths} months left @ ${e.interestRate}%)`
    );
    const debtLines = debts.map(
      (d) => `- ${d.direction === 'lent' ? 'Owed by' : 'Owe'} **${d.person}**: ${fmt(d.remaining)}`
    );
    if (emiLines.length === 0 && debtLines.length === 0) {
      return 'You have zero active EMIs or unsettled friend lend/borrow balances right now.';
    }
    return `Active debt & repayment breakdown:\n${[...emiLines, ...debtLines].join('\n')}`;
  }

  // 8. SIPs & Investments
  if (/\b(sips?|invest(?:ed|ments?|ing)?|mutual(?:\s+funds?)?|corpus|portfolios?)\b/.test(q)) {
    if (sips.length === 0 && !s.totalInvested) {
      return 'No active SIP plans or investment entries are recorded for this period yet.';
    }
    const sipLines = sips
      .slice(0, 5)
      .map(
        (sp) =>
          `- **${sp.name}**: ${fmt(sp.monthlyAmount)}/mo (Invested ${fmt(
            sp.totalInvested
          )} · Value ${fmt(sp.currentValue)})`
      )
      .join('\n');
    return `This month you invested **${fmt(s.totalInvested)}** (total investment assets: **${fmt(
      nw.investmentAssets
    )}**).${sipLines ? `\n\nActive SIPs:\n${sipLines}` : ''}`;
  }

  // 9. Anomalies, Spikes & Review Inbox
  if (/\b(anomal(?:y|ies)|spikes?|warnings?|alerts?|unusual|review|inbox)\b/.test(q)) {
    if (anomalies.length === 0 && !s.needsReviewCount) {
      return `No unusual spending spikes or pending review items detected for **${monthLabel}**.`;
    }
    const alertLines = anomalies.map((a) => `- **${a.title}**: ${a.description}`);
    if (s.needsReviewCount > 0) {
      alertLines.push(`- **${s.needsReviewCount} transaction(s)** waiting in the Review Inbox.`);
    }
    return `Alerts & items needing attention:\n${alertLines.join('\n')}`;
  }

  // 10. Month-over-month comparison, income & savings rate
  if (/\b(last month|previous|compare|trends?|vs|income|salary|save|savings?(?:\s+rate)?)\b/.test(q)) {
    const trendLines = trailing
      .map(
        (m) =>
          `- **${m.monthKey}**: Spent ${fmt(m.spent)} · Income ${fmt(m.income)} · Invested ${fmt(m.invested)}`
      )
      .join('\n');
    return `For **${monthLabel}**, your income is **${fmt(s.totalIncome)}**, spending is **${fmt(
      s.totalSpent
    )}**, and savings rate is **${
      s.savingsRatePct || 0
    }%**.\n\nTrailing 3-month trend:\n${trendLines || '- Not enough historical months yet.'}`;
  }

  // 11. Where did money go / top categories & merchants
  if (/\b(where|most|top|biggest|highest|breakdown|categor(?:y|ies)|merchants?)\b/.test(q)) {
    const topCats = [...categories]
      .filter((c) => (c.spent || 0) > 0)
      .sort((a, b) => (b.spent || 0) - (a.spent || 0))
      .slice(0, 4);
    const catBlock = topCats.length
      ? topCats.map((c) => `- **${c.name}**: ${fmt(c.spent)} (${c.transactionCount} txns)`).join('\n')
      : '- No category spending logged yet this month.';
    const merchBlock = topMerchants.length
      ? `\n\nTop merchants:\n${topMerchants
          .slice(0, 3)
          .map((m) => `- **${m.merchant}**: ${fmt(m.spent)} (${m.count}x)`)
          .join('\n')}`
      : '';
    return `Here is where your spending went in **${monthLabel}** (total **${fmt(
      s.totalSpent
    )}**):\n${catBlock}${merchBlock}`;
  }

  // 12. Recent transactions list
  if (/\b(recent|latest|last|transactions|entries|history)\b/.test(q)) {
    if (recentTxs.length === 0) {
      return `No transactions recorded for **${monthLabel}** yet.`;
    }
    return `Latest entries:\n${recentTxs
      .slice(0, 5)
      .map((t) => `- ${t.date}: **${t.title}** — ${fmt(t.amount)} (${t.category})`)
      .join('\n')}`;
  }

  // Fallback general snapshot (only when none of the targeted intents above match)
  const topCats = [...categories]
    .filter((c) => (c.spent || 0) > 0)
    .sort((a, b) => (b.spent || 0) - (a.spent || 0))
    .slice(0, 3);
  const catSummary = topCats.length
    ? topCats.map((c) => `- **${c.name}**: ${fmt(c.spent)} (${c.transactionCount} txns)`).join('\n')
    : '- No expenses logged yet this month.';

  return `For **${monthLabel}**, you've spent **${fmt(s.totalSpent)}** against **${fmt(
    s.totalIncome
  )}** income (savings rate **${s.savingsRatePct || 0}%**), with a net worth of **${fmt(
    nw.netWorth
  )}**.\n\nTop spending categories:\n${catSummary}`;
}
