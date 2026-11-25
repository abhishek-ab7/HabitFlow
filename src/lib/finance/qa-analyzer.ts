function fmt(n: unknown): string {
  return `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
}

function tokenizeQuery(question: string): string[] {
  const stopWords = new Set([
    'what', 'when', 'where', 'which', 'how', 'much', 'many', 'did', 'does', 'have',
    'has', 'was', 'were', 'are', 'is', 'the', 'this', 'that', 'with', 'from', 'for',
    'and', 'about', 'into', 'your', 'mine', 'spent', 'spend', 'money', 'month',
    'show', 'tell', 'give', 'please', 'list', 'all', 'current', 'total',
    'can', 'per', 'day', 'days', 'safe', 'safely', 'today', 'week', 'rest',
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
  const lifeOs = context?.lifeOs || {};
  const cd = lifeOs?.crossDomain || {};
  const ww = cd?.walletWaistline || {};
  const roi = cd?.gymSupplementRoi || {};
  const trig = cd?.triggers || {};
  const social = cd?.socialSpendDiet || {};
  const fTelemetry = lifeOs?.fitnessTelemetry || {};

  // Life OS 0A. Supplement / Whey / Protein ROI
  if (/\b(whey|supplements?|creatine|omega|protein\s*roi|scoop|stock|restock|25g)\b/.test(q)) {
    const breakdown: any[] = Array.isArray(roi?.supplementBreakdown) ? roi.supplementBreakdown : [];
    if (breakdown.length === 0) {
      return 'No active supplements are tracked in your inventory yet. Add Whey, Creatine, or vitamins under **Fitness -> Supplements** to compute ₹/scoop, ₹/25g protein grade, and runout days.';
    }
    const lines = breakdown.map((item) => {
      const proteinPart =
        item.costPer25gProteinInr !== null && item.costPer25gProteinInr !== undefined
          ? ` · **${fmt(item.costPer25gProteinInr)}/25g protein** (Grade **${item.proteinValueGrade}**)`
          : '';
      const stockPart =
        item.daysRemaining !== null && item.daysRemaining !== undefined
          ? ` · **${item.daysRemaining}d stock left**`
          : '';
      return `- **${item.name}**: **${fmt(item.costPerScoopInr)}/${item.unitLabel}**${proteinPart} · ${item.adherence30dPct}% adherence (${item.roiStatus})${stockPart}`;
    });
    return `Supplement ROI & Stock Audit (monthly amortized **${fmt(roi.supplementMonthlyAmortizedInr)}/mo**):\n${lines.join('\n')}`;
  }

  // Life OS 0B. Gym ROI & Cost per Workout
  if (/\b(gym|workouts?|sessions?|cost per workout)\b/.test(q)) {
    const gymSpend = Number(roi?.gymSpend30dInr || 0);
    const workouts = Number(roi?.workouts30dCount || 0);
    const targetSessions = Number(roi?.targetWorkoutsAt4PerWeek || 16);
    if (gymSpend === 0 && workouts === 0) {
      return 'No gym expenses or workout sessions were logged in the last 30 days. Log sessions in **Fitness -> Gym** or tag gym fees cleanly to track ₹/workout ROI.';
    }
    const perWorkoutText =
      roi?.gymCostPerWorkoutInr !== null && roi?.gymCostPerWorkoutInr !== undefined
        ? `**${fmt(roi.gymCostPerWorkoutInr)}/workout**`
        : workouts === 0
          ? '**No workouts logged yet (Grade F)**'
          : `**${workouts} sessions logged**`;
    const targetText =
      roi?.targetGymCostPerWorkoutInr !== null && roi?.targetGymCostPerWorkoutInr !== undefined
        ? ` vs target **${fmt(roi.targetGymCostPerWorkoutInr)}/workout** at 4x/week (${targetSessions}/mo)`
        : '';
    return `Your 30-day **Gym ROI** is **Grade ${roi.gymRoiGrade || 'N/A'}**: ${perWorkoutText} across **${workouts} workout(s)** on **${fmt(gymSpend)}** gym spend${targetText}.\nCombined Gym + Supplements spend: **${fmt(roi.combinedMonthlyFitnessSpendInr)}/mo**.`;
  }

  // Life OS 0C. Sleep / Mood / Missed Workout Spending Triggers (check before generic junk so "sleep trigger junk" routes here)
  if (/\b(sleep|tired|low\s*energy|trigger|stress(?:ed)?|mood|idk)\b/.test(q)) {
    const triggerDays = Number(trig?.triggerDaysCount || 0);
    const triggerAvg = Number(trig?.triggerAvgDailySpendInr || 0);
    const baseAvg = Number(trig?.baselineAvgDailySpendInr || 0);
    const mult = trig?.overallSpendMultiplier;
    const sleepText =
      fTelemetry?.avgSleepHours14d !== null && fTelemetry?.avgSleepHours14d !== undefined
        ? `14d avg sleep is **${fTelemetry.avgSleepHours14d} hrs**. `
        : '';
    if (triggerDays === 0) {
      return `${sleepText}No low-sleep (<6.5h), low-energy, missed-workout, or stressed/sad mood trigger patterns have triggered extra junk/'idk' spending in the last 30 days.`;
    }
    const multText = mult !== null && mult !== undefined ? `**${mult}x higher**` : 'concentrated';
    return `${sleepText}On your **${triggerDays} trigger day(s)** (${trig.topTriggerLabel || 'low-recovery'}), Junk/'idk' spend averaged **${fmt(triggerAvg)}/day** vs **${fmt(baseAvg)}/day** baseline (${multText} spend, **${fmt(trig.totalTriggerJunkIdkSpend30dInr)}** total triggered).`;
  }

  // Life OS 0D. Social Hangouts / Outings vs. Diet Balance
  if (
    /\b(hangouts?|outings?|social\s*(?:food|spend|diet|splits?|eating)?|friend\s*splits?|diet\s*balance|swaps?)\b/.test(
      q
    )
  ) {
    const events = Number(social?.socialFoodEventCount30d || 0);
    const spend30 = Number(social?.socialFoodSpend30dInr || 0);
    const junkKcal30 = Number(social?.socialJunkCalories30d || 0);
    const calSpike = Number(social?.hangoutCalorieSpikeKcal || 0);
    const mult = social?.hangoutSpendMultiplier;
    const swaps: string[] = Array.isArray(social?.suggestedSwaps) ? social.suggestedSwaps : [];
    if (events === 0) {
      return 'No split hangout or outing food spikes detected in the last 30 days. Your social spending is well balanced with your diet targets.';
    }
    const multPart =
      mult !== null && mult !== undefined ? ` (**${mult}x** solo food spend)` : '';
    const spikePart =
      calSpike > 0 ? ` with **+${calSpike.toLocaleString('en-IN')} kcal** day spike` : '';
    const swapPart =
      swaps.length > 0 ? `\n- Swaps to try: ${swaps.slice(0, 2).join(' | ')}` : '';
    return `Social Spend vs. Diet Balance (30d): **${events} hangout(s)** totaling **${fmt(spend30)}**${multPart} and **${junkKcal30.toLocaleString('en-IN')} junk kcal**${spikePart}.${swapPart}`;
  }

  // Life OS 0E. Junk Food Cost, Empty Calories & Fat-Loss Drag
  if (
    /\b(junk|empty\s*(?:kcal|calories?)|calories?\s*impact|fat[- ]?loss\s*drag|cheat\s*meal|waistline)\b/.test(
      q
    )
  ) {
    const s14 = Number(ww?.spend14dInr || 0);
    const s30 = Number(ww?.spend30dInr || 0);
    const k14 = Number(ww?.emptyKcal14d || 0);
    const k30 = Number(ww?.emptyKcal30d || 0);
    const drag30 = Number(ww?.fatLossDragKg30d || 0);
    const save70 = Number(ww?.savings70PctMonthlyInr || 0);
    if (s30 === 0 && k30 === 0) {
      return 'Zero Junk Food transactions or junk meals detected in the last 30 days. Clean streak intact!';
    }
    return `Wallet <-> Waistline Impact:\n- Last 14 days: **${fmt(s14)}** junk spend & **${k14.toLocaleString('en-IN')} empty kcal**\n- Last 30 days: **${fmt(s30)}** junk spend, **${k30.toLocaleString('en-IN')} empty kcal** (**~${drag30} kg** fat-loss drag)\n- Cutting junk by 70% saves **${fmt(save70)}/mo**${ww?.topJunkMerchant ? ` (top source: **${ww.topJunkMerchant}**)` : ''}.`;
  }

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
  if (/\b(afford|safe(?:ly)?|daily|per\s+day|buy|left to spend|remaining budget)\b/.test(q)) {
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
