/**
 * BlitzPay Phase 2Z — deterministic cash-bucket planning math (no DB, no Stripe ids).
 * Balances are internal estimates for contractor operations; Connect ledger is authoritative for funds.
 */

export type BlitzpayCashAccountType =
  | "operating"
  | "reserve"
  | "project_hold"
  | "payroll_hold"
  | "tax_hold"
  | "vendor_hold"

export type BlitzpayCashRunwayStatus = "healthy" | "watch" | "risk"

export type BlitzpayCashReserveRuleType =
  | "percent_of_collections"
  | "fixed_monthly_reserve"
  | "payroll_liability"
  | "vendor_ap_pressure"
  | "dispute_risk"
  | "tax_estimate"

export type BlitzpayCashReserveRuleInput = {
  ruleType: BlitzpayCashReserveRuleType
  basisPoints: number | null
  fixedAmountCents: number | null
  active: boolean
}

export type BlitzpayCashAccountRowInput = {
  id: string
  accountType: BlitzpayCashAccountType
  displayName: string
  status: "active" | "paused" | "archived"
  targetBalanceCents: number
  currentEstimatedBalanceCents: number
}

export type BlitzpayTreasuryLikeInput = {
  /** Treasury operating after internal reserve hold (from Connect ledger mirror). */
  treasuryOperatingCents: number
  /** Sum of pending + in_transit payout amounts (already excluded from available; do not subtract again from operating). */
  pendingPayoutTotalCents: number
}

export type BlitzpayOperatingEstimateInput = BlitzpayTreasuryLikeInput & {
  /** Customer wallet spendable credits — liability; not double-counted with invoice deposits when using invoice-only deposit overlap. */
  walletSpendableLiabilityCents: number
  /** Unapplied estimate deposits on open quotes — held for work; subtract from operating when not overlapping wallet. */
  unappliedEstimateDepositCents: number
  /**
   * Portion of wallet liability already represented in deposit totals (avoid double subtraction).
   * When unknown, pass 0.
   */
  walletDepositOverlapCents: number
}

export type BlitzpayReserveBasisInput = {
  netCollectedWindowCents: number
  payrollLiabilityCents: number
  apOpenOutstandingCents: number
  disputeExposureCents: number
}

export type BlitzpayCashRunwayInput = {
  estimatedOperatingCashCents: number
  expectedInflows7dCents: number
  expectedInflows30dCents: number
  expectedOutflows7dCents: number
  expectedOutflows30dCents: number
  reserveTargetCents: number
}

const clamp0 = (n: number) => Math.max(0, Math.round(n))

/**
 * Conservative operating cash estimate: treasury operating minus wallet liability and unapplied deposits,
 * with optional overlap so wallet credits tied to deposits are not subtracted twice.
 */
export function estimateOperatingBalance(input: BlitzpayOperatingEstimateInput): number {
  const walletNet = clamp0(input.walletSpendableLiabilityCents - clamp0(input.walletDepositOverlapCents))
  const deposits = clamp0(input.unappliedEstimateDepositCents)
  const raw = input.treasuryOperatingCents - walletNet - deposits
  return clamp0(raw)
}

function ruleContributionCents(rule: BlitzpayCashReserveRuleInput, basis: BlitzpayReserveBasisInput): number {
  if (!rule.active) return 0
  const bps = rule.basisPoints != null ? clamp0(rule.basisPoints) : 0
  const fixed = rule.fixedAmountCents != null ? clamp0(rule.fixedAmountCents) : 0
  switch (rule.ruleType) {
    case "percent_of_collections":
      return clamp0((basis.netCollectedWindowCents * bps) / 10_000)
    case "fixed_monthly_reserve":
      return fixed
    case "payroll_liability":
      if (fixed > 0 && bps <= 0) return Math.min(fixed, basis.payrollLiabilityCents)
      if (bps > 0) return clamp0((basis.payrollLiabilityCents * bps) / 10_000)
      return basis.payrollLiabilityCents
    case "vendor_ap_pressure":
      if (bps > 0) return clamp0((basis.apOpenOutstandingCents * bps) / 10_000)
      return fixed
    case "dispute_risk":
      if (bps > 0) return clamp0((basis.disputeExposureCents * bps) / 10_000)
      return fixed
    case "tax_estimate":
      if (bps > 0) return clamp0((basis.netCollectedWindowCents * bps) / 10_000)
      return fixed
    default:
      return 0
  }
}

export function calculateReserveTargets(
  rules: BlitzpayCashReserveRuleInput[],
  basis: BlitzpayReserveBasisInput,
): { totalReserveTargetCents: number; byRule: Array<{ ruleType: BlitzpayCashReserveRuleType; cents: number }> } {
  const byRule = rules.map((r) => ({
    ruleType: r.ruleType,
    cents: ruleContributionCents(r, basis),
  }))
  const totalReserveTargetCents = byRule.reduce((s, x) => s + x.cents, 0)
  return { totalReserveTargetCents, byRule }
}

export function allocateCollectionsToCashAccounts(
  collectionCents: number,
  buckets: Array<{ accountType: BlitzpayCashAccountType; weightBps: number }>,
): Partial<Record<BlitzpayCashAccountType, number>> {
  const total = buckets.reduce((s, b) => s + Math.max(0, b.weightBps), 0)
  const out: Partial<Record<BlitzpayCashAccountType, number>> = {}
  if (total <= 0 || collectionCents <= 0) return out
  const c = clamp0(collectionCents)
  let allocated = 0
  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i]
    const w = Math.max(0, b.weightBps)
    const isLast = i === buckets.length - 1
    const share = isLast ? c - allocated : clamp0((c * w) / total)
    allocated += share
    out[b.accountType] = (out[b.accountType] ?? 0) + share
  }
  return out
}

export function releaseCashAccountAllocation<T extends { allocation_status: string }>(
  row: T,
): T & { allocation_status: string } {
  if (row.allocation_status === "reversed") return { ...row, allocation_status: "reversed" }
  return { ...row, allocation_status: "released" }
}

export type BlitzpayCashAccountSummary = {
  accounts: Array<{
    id: string | null
    accountType: BlitzpayCashAccountType
    displayName: string
    status: string
    targetBalanceCents: number
    currentEstimatedBalanceCents: number
  }>
  estimatedOperatingCashCents: number
  cashReserveTargetCents: number
  cashReserveGapCents: number
}

export function buildCashAccountSummary(input: {
  dbAccounts: BlitzpayCashAccountRowInput[]
  operatingEstimateCents: number
  reserveTargetCents: number
  /** Treasury held reserve (Connect-derived mirror), for gap vs target. */
  heldReserveCents: number
  /** Default labels when DB rows are sparse. */
  syntheticFill: boolean
}): BlitzpayCashAccountSummary {
  const reserveGap = Math.max(0, input.reserveTargetCents - clamp0(input.heldReserveCents))
  const fromDb = input.dbAccounts.map((a) => ({
    id: a.id,
    accountType: a.accountType,
    displayName: a.displayName,
    status: a.status,
    targetBalanceCents: clamp0(a.targetBalanceCents),
    currentEstimatedBalanceCents: clamp0(a.currentEstimatedBalanceCents),
  }))

  if (!input.syntheticFill || fromDb.length > 0) {
    return {
      accounts: fromDb,
      estimatedOperatingCashCents: input.operatingEstimateCents,
      cashReserveTargetCents: input.reserveTargetCents,
      cashReserveGapCents: reserveGap,
    }
  }

  const types: BlitzpayCashAccountType[] = [
    "operating",
    "reserve",
    "project_hold",
    "payroll_hold",
    "tax_hold",
    "vendor_hold",
  ]
  const labels: Record<BlitzpayCashAccountType, string> = {
    operating: "Operating cash (estimate)",
    reserve: "Reserve bucket (internal)",
    project_hold: "Project / job holds (estimate)",
    payroll_hold: "Payroll hold (estimate)",
    tax_hold: "Tax hold (estimate)",
    vendor_hold: "Vendor / AP hold (estimate)",
  }
  const synthetic = types.map((t) => ({
    id: null as string | null,
    accountType: t,
    displayName: labels[t],
    status: "active",
    targetBalanceCents: t === "reserve" ? input.reserveTargetCents : 0,
    currentEstimatedBalanceCents:
      t === "operating"
        ? input.operatingEstimateCents
        : t === "vendor_hold"
          ? Math.min(input.operatingEstimateCents, reserveGap)
          : 0,
  }))
  return {
    accounts: synthetic,
    estimatedOperatingCashCents: input.operatingEstimateCents,
    cashReserveTargetCents: input.reserveTargetCents,
    cashReserveGapCents: reserveGap,
  }
}

export type BlitzpayCashAccountHealth = {
  runwayStatus: BlitzpayCashRunwayStatus
  warnings: string[]
  /** Deterministic guidance strings (not AI). */
  recommendations: string[]
  payrollReserveCoverageBasisPoints: number
  apReserveCoverageBasisPoints: number
}

export function buildCashRunwaySnapshot(input: BlitzpayCashRunwayInput): {
  runwayStatus: BlitzpayCashRunwayStatus
  cushion7dCents: number
  cushion30dCents: number
} {
  const cushion7d = input.estimatedOperatingCashCents + input.expectedInflows7dCents - input.expectedOutflows7dCents
  const cushion30 =
    input.estimatedOperatingCashCents + input.expectedInflows30dCents - input.expectedOutflows30dCents
  let runwayStatus: BlitzpayCashRunwayStatus = "healthy"
  if (cushion7d < 0 || input.estimatedOperatingCashCents + input.expectedInflows7dCents < input.reserveTargetCents) {
    runwayStatus = "risk"
  } else if (cushion7d < input.reserveTargetCents * 0.1 || cushion30 < 0) {
    runwayStatus = "watch"
  }
  return { runwayStatus, cushion7dCents: cushion7d, cushion30dCents: cushion30 }
}

export type BlitzpayCashPlanningDerived = {
  estimatedOperatingCashCents: number
  cashReserveTargetCents: number
  cashReserveGapCents: number
  expectedInflows7dCents: number
  expectedInflows30dCents: number
  expectedOutflows7dCents: number
  expectedOutflows30dCents: number
  cashRunwayStatus: BlitzpayCashRunwayStatus
  payrollReserveCoverageBasisPoints: number
  apReserveCoverageBasisPoints: number
}

/** Shared pure pipeline for Phase 2Z reporting + org cash APIs (no I/O). */
export function deriveBlitzpayCashPlanningMetrics(input: {
  treasuryOperatingCents: number
  heldReserveCents: number
  reserveTargetFromSettingsCents: number
  pendingPayoutTotalCents: number
  walletSpendableLiabilityCents: number
  unappliedEstimateDepositCents: number
  walletDepositOverlapCents: number
  netCollectedWindowCents: number
  payrollLiabilityCents: number
  apOpenOutstandingCents: number
  disputeExposureCents: number
  reserveRules: BlitzpayCashReserveRuleInput[]
  apDue7OpenCents: number
  apDue30OpenCents: number
  treasuryPendingPayoutTotalsCents: number
  treasuryEstimateUpcomingTransferCents: number
  recurringPlannedInflow30dCents: number
}): BlitzpayCashPlanningDerived {
  const operatingEstimate = estimateOperatingBalance({
    treasuryOperatingCents: input.treasuryOperatingCents,
    pendingPayoutTotalCents: input.pendingPayoutTotalCents,
    walletSpendableLiabilityCents: input.walletSpendableLiabilityCents,
    unappliedEstimateDepositCents: input.unappliedEstimateDepositCents,
    walletDepositOverlapCents: input.walletDepositOverlapCents,
  })
  const reserveFromRules = calculateReserveTargets(input.reserveRules, {
    netCollectedWindowCents: input.netCollectedWindowCents,
    payrollLiabilityCents: input.payrollLiabilityCents,
    apOpenOutstandingCents: input.apOpenOutstandingCents,
    disputeExposureCents: input.disputeExposureCents,
  })
  const cashReserveTargetCents = Math.max(input.reserveTargetFromSettingsCents, reserveFromRules.totalReserveTargetCents)
  const cashReserveGapCents = Math.max(0, cashReserveTargetCents - clamp0(input.heldReserveCents))

  const payoutPressure = Math.max(input.treasuryPendingPayoutTotalsCents, input.treasuryEstimateUpcomingTransferCents)
  const expectedInflows7dCents = Math.max(0, Math.round(input.recurringPlannedInflow30dCents * 0.25))
  const expectedInflows30dCents = Math.max(0, input.recurringPlannedInflow30dCents)
  const expectedOutflows7dCents = Math.max(
    0,
    Math.round(input.apDue7OpenCents + payoutPressure * 0.35 + input.payrollLiabilityCents * 0.15),
  )
  const expectedOutflows30dCents = Math.max(
    0,
    Math.round(input.apDue30OpenCents + payoutPressure + input.payrollLiabilityCents * 0.45),
  )

  const runway = buildCashRunwaySnapshot({
    estimatedOperatingCashCents: operatingEstimate,
    expectedInflows7dCents,
    expectedInflows30dCents,
    expectedOutflows7dCents,
    expectedOutflows30dCents,
    reserveTargetCents: cashReserveTargetCents,
  })
  const health = buildCashAccountHealth({
    runway,
    reserveTargetCents: cashReserveTargetCents,
    operatingEstimateCents: operatingEstimate,
    payrollLiabilityCents: input.payrollLiabilityCents,
    apOpenOutstandingCents: input.apOpenOutstandingCents,
    disputeExposureCents: input.disputeExposureCents,
    recurringInflow30dCents: input.recurringPlannedInflow30dCents,
  })
  return {
    estimatedOperatingCashCents: operatingEstimate,
    cashReserveTargetCents,
    cashReserveGapCents,
    expectedInflows7dCents,
    expectedInflows30dCents,
    expectedOutflows7dCents,
    expectedOutflows30dCents,
    cashRunwayStatus: runway.runwayStatus,
    payrollReserveCoverageBasisPoints: health.payrollReserveCoverageBasisPoints,
    apReserveCoverageBasisPoints: health.apReserveCoverageBasisPoints,
  }
}

export function buildCashAccountHealth(input: {
  runway: ReturnType<typeof buildCashRunwaySnapshot>
  reserveTargetCents: number
  operatingEstimateCents: number
  payrollLiabilityCents: number
  apOpenOutstandingCents: number
  disputeExposureCents: number
  recurringInflow30dCents: number
}): BlitzpayCashAccountHealth {
  const warnings: string[] = []
  const recommendations: string[] = []
  if (input.runway.runwayStatus === "risk") {
    warnings.push("Cash runway is tight — upcoming obligations may exceed available operating cash plus near-term inflows.")
  } else if (input.runway.runwayStatus === "watch") {
    warnings.push("Cash runway deserves attention — cushion is thin relative to reserves and obligations.")
  }
  const reserveGap = Math.max(0, input.reserveTargetCents - input.operatingEstimateCents)
  if (reserveGap > 0 && input.apOpenOutstandingCents > input.operatingEstimateCents) {
    recommendations.push("Hold additional cash before approving vendor payouts.")
  }
  if (input.recurringInflow30dCents >= input.apOpenOutstandingCents && input.apOpenOutstandingCents > 0) {
    recommendations.push("Expected collections cover upcoming AP obligations.")
  }
  if (input.payrollLiabilityCents > input.operatingEstimateCents * 0.35 && input.payrollLiabilityCents > 0) {
    recommendations.push("Payroll reserve is below recommended target relative to operating cash.")
  }
  if (input.disputeExposureCents > 250_000) {
    recommendations.push("Dispute exposure is increasing; consider raising reserve target.")
  }
  if (input.recurringInflow30dCents > input.payrollLiabilityCents && input.recurringInflow30dCents > 0) {
    recommendations.push("Upcoming membership renewals improve cash-flow confidence.")
  }
  const payrollReserveCoverageBasisPoints =
    input.payrollLiabilityCents <= 0
      ? 10_000
      : clamp0(Math.min(10_000, (input.operatingEstimateCents * 10_000) / input.payrollLiabilityCents))
  const apReserveCoverageBasisPoints =
    input.apOpenOutstandingCents <= 0
      ? 10_000
      : clamp0(Math.min(10_000, (input.operatingEstimateCents * 10_000) / input.apOpenOutstandingCents))

  return {
    runwayStatus: input.runway.runwayStatus,
    warnings,
    recommendations,
    payrollReserveCoverageBasisPoints,
    apReserveCoverageBasisPoints,
  }
}
