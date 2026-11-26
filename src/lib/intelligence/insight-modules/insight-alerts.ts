import type {
  CrossDomainAlert,
  GymSupplementRoiInsight,
  SocialSpendDietInsight,
  TriggerPatternInsight,
  WalletWaistlineInsight,
} from '../insight-types';

const fmtInr = (n: number): string => n.toLocaleString('en-IN');

function resolveWalletSeverity(w: WalletWaistlineInsight): CrossDomainAlert['severity'] {
  if (w.spend14dInr >= 1500 || w.emptyKcal14d >= 3500) return 'critical';
  if (w.spend14dInr >= 500 || w.emptyKcal14d >= 1500) return 'warning';
  return 'info';
}

function buildWalletWaistlineAlert(w: WalletWaistlineInsight): CrossDomainAlert | null {
  const hasActivity = w.spend14dInr > 0 || w.emptyKcal14d > 0 || w.spend30dInr > 0;
  if (!hasActivity) return null;

  return {
    id: 'wallet-waistline-junk',
    pillar: 'wallet_waistline',
    severity: resolveWalletSeverity(w),
    title: `Wallet <-> Waistline: ₹${fmtInr(w.spend14dInr)} junk spend & ${fmtInr(w.emptyKcal14d)} empty kcal (14d)`,
    description: `30d total is ₹${fmtInr(w.spend30dInr)} (${fmtInr(w.emptyKcal30d)} kcal, ~${w.fatLossDragKg30d} kg fat-loss drag). Cutting junk by 70% frees ₹${fmtInr(w.savings70PctMonthlyInr)}/mo.`,
    metricBadge: `${w.fatLossDragKg30d} kg drag · Save ₹${fmtInr(w.savings70PctMonthlyInr)}/mo`,
    actionHint: w.topJunkMerchant
      ? `Watch ${w.topJunkMerchant} orders; pre-log a high-protein meal before cravings hit.`
      : 'Cut 70% of junk orders to recover monthly cash & accelerate fat loss.',
  };
}

function formatGymAlertTitle(g: GymSupplementRoiInsight): string {
  if (g.gymSpend30dInr <= 0) return `${g.workouts30dCount} workouts logged (30d)`;
  if (g.workouts30dCount > 0) {
    return `Gym ROI: ₹${g.gymCostPerWorkoutInr}/workout (${g.workouts30dCount} sessions vs target ₹${g.targetGymCostPerWorkoutInr} @ 4x/wk)`;
  }
  return `Gym ROI Grade F: ₹${g.gymSpend30dInr.toLocaleString('en-IN')} spent with 0 workouts in 30d`;
}

function formatGymMetricBadge(g: GymSupplementRoiInsight): string {
  if (g.gymCostPerWorkoutInr !== null) return `₹${g.gymCostPerWorkoutInr}/workout · Grade ${g.gymRoiGrade}`;
  if (g.primaryCostPer25gProteinInr !== null) {
    return `₹${g.primaryCostPer25gProteinInr}/25g Pro (${g.primaryProteinGrade})`;
  }
  return `${g.workouts30dCount} workouts`;
}

function resolveGymSeverity(g: GymSupplementRoiInsight, isGymUnderused: boolean, hasWastedSup: boolean): CrossDomainAlert['severity'] {
  if (g.gymSpend30dInr > 0 && g.workouts30dCount === 0) return 'critical';
  if (isGymUnderused || hasWastedSup) return 'warning';
  return 'info';
}

function formatSupplementSummary(g: GymSupplementRoiInsight): string {
  if (!g.primaryProteinName) return '';
  const proteinPart =
    g.primaryCostPer25gProteinInr !== null
      ? ` (₹${g.primaryCostPer25gProteinInr}/25g protein, Grade ${g.primaryProteinGrade})`
      : '';
  return `${g.primaryProteinName}: ₹${g.primaryCostPerScoopInr}/scoop${proteinPart}. `;
}

function buildGymSupplementAlert(g: GymSupplementRoiInsight): CrossDomainAlert | null {
  if (g.gymSpend30dInr <= 0 && g.supplementBreakdown.length === 0) return null;
  const isGymUnderused = g.gymSpend30dInr > 0 && (g.workouts30dCount === 0 || g.gymRoiGrade === 'D' || g.gymRoiGrade === 'F');
  const wastedSup = g.supplementBreakdown.find((s) => s.roiStatus === 'wasted');
  const wastedNote = wastedSup ? ` Low adherence on ${wastedSup.name} (${wastedSup.adherence30dPct}%).` : '';

  return {
    id: 'gym-supplement-roi',
    pillar: 'gym_supplement_roi',
    severity: resolveGymSeverity(g, isGymUnderused, Boolean(wastedSup)),
    title: formatGymAlertTitle(g),
    description: `${formatSupplementSummary(g)}Total monthly fitness commitment: ₹${g.combinedMonthlyFitnessSpendInr.toLocaleString('en-IN')}/mo.${wastedNote}`,
    metricBadge: formatGymMetricBadge(g),
    actionHint: isGymUnderused
      ? 'Hit 4x/week sessions (16/mo) to drop your cost per workout immediately.'
      : 'Keep protein scoop cost benchmarked against eggs/paneer/soya.',
  };
}

function buildTriggerAlert(t: TriggerPatternInsight): CrossDomainAlert | null {
  if (t.triggerDaysCount <= 0 || t.totalTriggerJunkIdkSpend30dInr <= 0) return null;
  if (t.overallSpendMultiplier !== null && t.overallSpendMultiplier < 1.25) return null;

  const multText = t.overallSpendMultiplier !== null ? `${t.overallSpendMultiplier}x higher` : 'concentrated';
  const severity: CrossDomainAlert['severity'] = (t.overallSpendMultiplier ?? 3) >= 2.0 ? 'warning' : 'info';
  const metricBadge =
    t.overallSpendMultiplier !== null ? `${t.overallSpendMultiplier}x Spend Trigger` : `${t.triggerDaysCount} Trigger Days`;

  return {
    id: 'trigger-sleep-mood-spend',
    pillar: 'trigger_pattern',
    severity,
    title: `Trigger Alert: Junk/'idk' spend is ${multText} on ${t.topTriggerLabel ?? 'low-recovery'} days`,
    description: `Avg ₹${t.triggerAvgDailySpendInr}/day on trigger days (${t.triggerDaysCount}d) vs ₹${t.baselineAvgDailySpendInr}/day baseline (₹${t.totalTriggerJunkIdkSpend30dInr.toLocaleString('en-IN')} total triggered).`,
    metricBadge,
    actionHint: 'Enable Low-Energy Survival Mode on <6.5h sleep or stressed days instead of ordering comfort junk.',
  };
}

function buildSocialAlert(s: SocialSpendDietInsight): CrossDomainAlert | null {
  if (!s.hasSpike) return null;
  const multSuffix = s.hangoutSpendMultiplier ? ` (${s.hangoutSpendMultiplier}x solo meal ticket)` : '';
  return {
    id: 'social-hangout-diet-spike',
    pillar: 'social_spend_diet',
    severity: s.socialJunkCalories30d >= 1200 ? 'warning' : 'info',
    title: `Social Hangout Spike: ${s.socialFoodEventCount30d} split outings (₹${s.socialFoodSpend30dInr.toLocaleString('en-IN')})`,
    description: `Friend splits on food added ~${s.hangoutCalorieSpikeKcal} extra kcal/day${multSuffix}. Swap: ${s.suggestedSwaps[0]}`,
    metricBadge: `+${s.hangoutCalorieSpikeKcal} kcal/hangout`,
    actionHint: s.suggestedSwaps[0],
  };
}

const SEVERITY_RANK: Record<CrossDomainAlert['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function generateCrossDomainAlerts(params: {
  walletWaistline: WalletWaistlineInsight;
  gymSupplementRoi: GymSupplementRoiInsight;
  triggers: TriggerPatternInsight;
  socialSpendDiet: SocialSpendDietInsight;
}): CrossDomainAlert[] {
  const candidates = [
    buildWalletWaistlineAlert(params.walletWaistline),
    buildGymSupplementAlert(params.gymSupplementRoi),
    buildTriggerAlert(params.triggers),
    buildSocialAlert(params.socialSpendDiet),
  ];
  return candidates
    .filter((a): a is CrossDomainAlert => a !== null)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
