export function fmtInr(n: unknown): string {
  return `₹${Math.round(Number(n ?? 0)).toLocaleString('en-IN')}`;
}

const num = (val: unknown, fallback = 0): number => Number(val ?? fallback);
const isDefined = (val: unknown): boolean => val !== null && val !== undefined;

export interface QaContext {
  question: string;
  q: string;
  s: any;
  nw: any;
  monthLabel: string;
  categories: any[];
  accounts: any[];
  bills: any[];
  emis: any[];
  sips: any[];
  debts: any[];
  topMerchants: any[];
  recentTxs: any[];
  trailing: any[];
  anomalies: any[];
  ww: any;
  roi: any;
  trig: any;
  social: any;
  fTelemetry: any;
}

function formatSupplementLine(item: any): string {
  const proteinPart = isDefined(item.costPer25gProteinInr)
    ? ` · **${fmtInr(item.costPer25gProteinInr)}/25g protein** (Grade **${item.proteinValueGrade}**)`
    : '';
  const stockPart = isDefined(item.daysRemaining) ? ` · **${item.daysRemaining}d stock left**` : '';
  return `- **${item.name}**: **${fmtInr(item.costPerScoopInr)}/${item.unitLabel}**${proteinPart} · ${item.adherence30dPct}% adherence (${item.roiStatus})${stockPart}`;
}

export function tryAnswerSupplementRoi(ctx: QaContext): string | null {
  if (!/\b(whey|supplements?|creatine|omega|protein\s*roi|scoop|stock|restock|25g)\b/.test(ctx.q)) return null;
  const breakdown: any[] = Array.isArray(ctx.roi?.supplementBreakdown) ? ctx.roi.supplementBreakdown : [];
  if (breakdown.length === 0) {
    return 'No active supplements are tracked in your inventory yet. Add Whey, Creatine, or vitamins under **Fitness -> Supplements** to compute ₹/scoop, ₹/25g protein grade, and runout days.';
  }
  const lines = breakdown.map(formatSupplementLine);
  return `Supplement ROI & Stock Audit (monthly amortized **${fmtInr(ctx.roi.supplementMonthlyAmortizedInr)}/mo**):\n${lines.join('\n')}`;
}

function formatGymPerWorkoutText(gymCostPerWorkoutInr: unknown, workouts: number): string {
  if (isDefined(gymCostPerWorkoutInr)) return `**${fmtInr(gymCostPerWorkoutInr)}/workout**`;
  return workouts === 0 ? '**No workouts logged yet (Grade F)**' : `**${workouts} sessions logged**`;
}

function formatGymTargetText(targetCost: unknown, targetSessions: number): string {
  if (!isDefined(targetCost)) return '';
  return ` vs target **${fmtInr(targetCost)}/workout** at 4x/week (${targetSessions}/mo)`;
}

function formatGymReply(roi: any, gymSpend: number, workouts: number): string {
  const perWorkoutText = formatGymPerWorkoutText(roi?.gymCostPerWorkoutInr, workouts);
  const targetText = formatGymTargetText(roi?.targetGymCostPerWorkoutInr, num(roi?.targetWorkoutsAt4PerWeek, 16));
  const grade = roi?.gymRoiGrade ?? 'N/A';
  const combined = fmtInr(roi?.combinedMonthlyFitnessSpendInr);
  return `Your 30-day **Gym ROI** is **Grade ${grade}**: ${perWorkoutText} across **${workouts} workout(s)** on **${fmtInr(gymSpend)}** gym spend${targetText}.\nCombined Gym + Supplements spend: **${combined}/mo**.`;
}

export function tryAnswerGymRoi(ctx: QaContext): string | null {
  if (!/\b(gym|workouts?|sessions?|cost per workout)\b/.test(ctx.q)) return null;
  const gymSpend = num(ctx.roi?.gymSpend30dInr);
  const workouts = num(ctx.roi?.workouts30dCount);
  if (gymSpend === 0 && workouts === 0) {
    return 'No gym expenses or workout sessions were logged in the last 30 days. Log sessions in **Fitness -> Gym** or tag gym fees cleanly to track ₹/workout ROI.';
  }
  return formatGymReply(ctx.roi, gymSpend, workouts);
}

export function tryAnswerTriggers(ctx: QaContext): string | null {
  if (!/\b(sleep|tired|low\s*energy|trigger|stress(?:ed)?|mood|idk)\b/.test(ctx.q)) return null;
  const triggerDays = num(ctx.trig?.triggerDaysCount);
  const sleepText = isDefined(ctx.fTelemetry?.avgSleepHours14d)
    ? `14d avg sleep is **${ctx.fTelemetry.avgSleepHours14d} hrs**. `
    : '';
  if (triggerDays === 0) {
    return `${sleepText}No low-sleep (<6.5h), low-energy, missed-workout, or stressed/sad mood trigger patterns have triggered extra junk/'idk' spending in the last 30 days.`;
  }
  const mult = ctx.trig?.overallSpendMultiplier;
  const multText = isDefined(mult) ? `**${mult}x higher**` : 'concentrated';
  return `${sleepText}On your **${triggerDays} trigger day(s)** (${ctx.trig.topTriggerLabel ?? 'low-recovery'}), Junk/'idk' spend averaged **${fmtInr(ctx.trig?.triggerAvgDailySpendInr)}/day** vs **${fmtInr(ctx.trig?.baselineAvgDailySpendInr)}/day** baseline (${multText} spend, **${fmtInr(ctx.trig.totalTriggerJunkIdkSpend30dInr)}** total triggered).`;
}

function formatSwapPart(swapsRaw: unknown): string {
  const swaps: string[] = Array.isArray(swapsRaw) ? swapsRaw : [];
  return swaps.length > 0 ? `\n- Swaps to try: ${swaps.slice(0, 2).join(' | ')}` : '';
}

function formatSocialDetails(social: any) {
  const multPart = isDefined(social?.hangoutSpendMultiplier) ? ` (**${social.hangoutSpendMultiplier}x** solo food spend)` : '';
  const calSpike = num(social?.hangoutCalorieSpikeKcal);
  const spikePart = calSpike > 0 ? ` with **+${calSpike.toLocaleString('en-IN')} kcal** day spike` : '';
  return { multPart, spikePart, swapPart: formatSwapPart(social?.suggestedSwaps) };
}

export function tryAnswerSocialDiet(ctx: QaContext): string | null {
  if (!/\b(hangouts?|outings?|social\s*(?:food|spend|diet|splits?|eating)?|friend\s*splits?|diet\s*balance|swaps?)\b/.test(ctx.q)) {
    return null;
  }
  const events = num(ctx.social?.socialFoodEventCount30d);
  if (events === 0) {
    return 'No split hangout or outing food spikes detected in the last 30 days. Your social spending is well balanced with your diet targets.';
  }
  const { multPart, spikePart, swapPart } = formatSocialDetails(ctx.social);
  return `Social Spend vs. Diet Balance (30d): **${events} hangout(s)** totaling **${fmtInr(ctx.social?.socialFoodSpend30dInr)}**${multPart} and **${num(ctx.social?.socialJunkCalories30d).toLocaleString('en-IN')} junk kcal**${spikePart}.${swapPart}`;
}

function formatJunkMerchantNote(topJunkMerchant: unknown): string {
  return topJunkMerchant ? ` (top source: **${topJunkMerchant}**)` : '';
}

export function tryAnswerJunkImpact(ctx: QaContext): string | null {
  if (!/\b(junk|empty\s*(?:kcal|calories?)|calories?\s*impact|fat[- ]?loss\s*drag|cheat\s*meal|waistline)\b/.test(ctx.q)) {
    return null;
  }
  const s30 = num(ctx.ww?.spend30dInr);
  const k30 = num(ctx.ww?.emptyKcal30d);
  if (s30 === 0 && k30 === 0) {
    return 'Zero Junk Food transactions or junk meals detected in the last 30 days. Clean streak intact!';
  }
  const merchantNote = formatJunkMerchantNote(ctx.ww?.topJunkMerchant);
  return `Wallet <-> Waistline Impact:\n- Last 14 days: **${fmtInr(ctx.ww?.spend14dInr)}** junk spend & **${num(ctx.ww?.emptyKcal14d).toLocaleString('en-IN')} empty kcal**\n- Last 30 days: **${fmtInr(s30)}** junk spend, **${k30.toLocaleString('en-IN')} empty kcal** (**~${num(ctx.ww?.fatLossDragKg30d)} kg** fat-loss drag)\n- Cutting junk by 70% saves **${fmtInr(ctx.ww?.savings70PctMonthlyInr)}/mo**${merchantNote}.`;
}
