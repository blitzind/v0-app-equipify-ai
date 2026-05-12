/**
 * Phase 4A — bounded deterministic scores for reporting snapshot (0–100 integers).
 * Uses integer ratio math on cents / counts; advisory only, not authoritative accounting.
 */

export type BlitzpayPhase4aScoreInput = {
  cashRunwayStatus: "healthy" | "watch" | "risk"
  cashReserveGapCents: number
  estimatedOperatingCashCents: number
  expectedInflows7dCents: number
  expectedInflows30dCents: number
  expectedOutflows30dCents: number
  treasuryFailedPayoutCount30d: number
  treasuryPendingPayoutTotalsCents: number
  treasuryEstimateUpcomingTransferCents: number
  inventoryMarginHealthScore: number
  failedPaymentRate: number
  delinquencyRate: number
  collectionSuccessRate: number
  estimatedRecoverableOverdueCents: number
  accountsReceivableCents: number
  payrollLiabilityCents: number
  estimatedPayrollBurdenCents: number
  procurementTreasuryImpactScore: number
  payableAgingHealthScore: number
  inventoryTurnoverScore: number
  vendorConcentrationRisk: number
  trialBalanceHealthy: boolean
  unreconciledBatchCount: number
  openDisputesAmountCents: number
  netCollectedCents: number
  blitzpayChurnRiskScore0to100: number
  financingRiskScore: number
}

export type BlitzpayPhase4aReportingScores = {
  aiFinancialRiskScore: number
  treasuryPressureScore: number
  marginRiskScore: number
  collectionsOptimizationScore: number
  payrollPressureScore: number
  procurementEfficiencyScore: number
  vendorConcentrationRiskScore: number
  aiInsightCoverageRate: number
}

function clamp0to100(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function ratioPercent(numerator: number, denominator: number): number {
  const d = Math.max(1, Math.abs(Math.round(denominator)))
  const num = Math.max(0, Math.round(numerator))
  return clamp0to100(Math.floor((num * 100) / d))
}

export function computeTreasuryPressureScore0to100(m: BlitzpayPhase4aScoreInput): number {
  let s = 0
  if (m.cashRunwayStatus === "risk") s += 42
  else if (m.cashRunwayStatus === "watch") s += 22

  const denom = Math.max(1, m.estimatedOperatingCashCents + m.expectedInflows30dCents)
  s += Math.floor(ratioPercent(m.cashReserveGapCents, denom) * 0.38)
  s += Math.min(22, m.treasuryFailedPayoutCount30d * 4)
  const payoutStack = m.treasuryPendingPayoutTotalsCents + m.treasuryEstimateUpcomingTransferCents
  s += Math.floor(ratioPercent(payoutStack, denom) * 0.28)
  const flowStress = ratioPercent(m.expectedOutflows30dCents, m.expectedInflows30dCents + 1)
  s += Math.floor(flowStress * 0.12)
  return clamp0to100(s)
}

export function computeMarginRiskScore0to100(m: BlitzpayPhase4aScoreInput): number {
  const inv = 100 - clamp0to100(m.inventoryMarginHealthScore)
  const disp = ratioPercent(m.openDisputesAmountCents, Math.max(1, m.netCollectedCents + 1))
  return clamp0to100(Math.floor(inv * 0.62 + disp * 0.38))
}

export function computeCollectionsOptimizationScore0to100(m: BlitzpayPhase4aScoreInput): number {
  const room = 100 - clamp0to100(m.collectionSuccessRate)
  const del = clamp0to100(Math.floor(m.delinquencyRate * 2))
  const fail = clamp0to100(Math.floor(m.failedPaymentRate * 3))
  const overdue = ratioPercent(m.estimatedRecoverableOverdueCents, Math.max(1, m.accountsReceivableCents + 1))
  return clamp0to100(Math.floor(room * 0.34 + del * 0.24 + fail * 0.22 + overdue * 0.2))
}

export function computePayrollPressureScore0to100(m: BlitzpayPhase4aScoreInput): number {
  const liab = Math.max(0, Math.round(m.payrollLiabilityCents)) + Math.max(0, Math.round(m.estimatedPayrollBurdenCents))
  const denom = Math.max(1, Math.round(m.estimatedOperatingCashCents) + Math.round(m.expectedInflows7dCents))
  return ratioPercent(liab, denom)
}

/** Higher = healthier / more efficient procurement planning (inverse of stress). */
export function computeProcurementEfficiencyScore0to100(m: BlitzpayPhase4aScoreInput): number {
  const procStress = clamp0to100(m.procurementTreasuryImpactScore)
  const payableWeak = 100 - clamp0to100(m.payableAgingHealthScore)
  const turnWeak = 100 - clamp0to100(m.inventoryTurnoverScore)
  const stress = clamp0to100(Math.floor(procStress * 0.42 + payableWeak * 0.35 + turnWeak * 0.23))
  return 100 - stress
}

export function computeVendorConcentrationRiskScore0to100(m: BlitzpayPhase4aScoreInput): number {
  return clamp0to100(m.vendorConcentrationRisk)
}

export function computeAiInsightCoverageRate0to100(m: BlitzpayPhase4aScoreInput): number {
  let hit = 0
  const total = 10
  if (m.expectedInflows30dCents > 0 || m.expectedOutflows30dCents > 0) hit++
  if (m.accountsReceivableCents > 0 || m.estimatedRecoverableOverdueCents > 0) hit++
  if (m.payrollLiabilityCents > 0 || m.estimatedPayrollBurdenCents > 0) hit++
  if (m.procurementTreasuryImpactScore > 0 || m.inventoryMarginHealthScore > 0) hit++
  if (m.vendorConcentrationRisk > 0) hit++
  if (m.financingRiskScore > 0) hit++
  if (m.blitzpayChurnRiskScore0to100 > 0) hit++
  if (!m.trialBalanceHealthy || m.unreconciledBatchCount > 0) hit++
  if (m.netCollectedCents > 0) hit++
  if (m.collectionSuccessRate > 0 || m.failedPaymentRate > 0) hit++
  return clamp0to100(Math.floor((hit * 100) / total))
}

export function computeAiFinancialRiskScore0to100(scores: {
  treasuryPressureScore: number
  marginRiskScore: number
  collectionsOptimizationScore: number
  payrollPressureScore: number
  vendorConcentrationRiskScore: number
  procurementStressScore: number
  financingRiskScore: number
  churnRisk: number
}): number {
  const fin = clamp0to100(scores.financingRiskScore)
  const churn = clamp0to100(scores.churnRisk)
  const proc = clamp0to100(scores.procurementStressScore)
  return clamp0to100(
    Math.max(
      scores.treasuryPressureScore,
      scores.marginRiskScore,
      scores.collectionsOptimizationScore,
      scores.payrollPressureScore,
      scores.vendorConcentrationRiskScore,
      proc,
      Math.floor(fin * 0.85),
      Math.floor(churn * 0.75),
    ),
  )
}

export function computeBlitzpayPhase4aReportingScores(m: BlitzpayPhase4aScoreInput): BlitzpayPhase4aReportingScores {
  const treasuryPressureScore = computeTreasuryPressureScore0to100(m)
  const marginRiskScore = computeMarginRiskScore0to100(m)
  const collectionsOptimizationScore = computeCollectionsOptimizationScore0to100(m)
  const payrollPressureScore = computePayrollPressureScore0to100(m)
  const procurementEfficiencyScore = computeProcurementEfficiencyScore0to100(m)
  const procurementStressScore = 100 - procurementEfficiencyScore
  const vendorConcentrationRiskScore = computeVendorConcentrationRiskScore0to100(m)
  const aiInsightCoverageRate = computeAiInsightCoverageRate0to100(m)
  const aiFinancialRiskScore = computeAiFinancialRiskScore0to100({
    treasuryPressureScore,
    marginRiskScore,
    collectionsOptimizationScore,
    payrollPressureScore,
    vendorConcentrationRiskScore,
    procurementStressScore,
    financingRiskScore: m.financingRiskScore,
    churnRisk: m.blitzpayChurnRiskScore0to100,
  })
  return {
    aiFinancialRiskScore,
    treasuryPressureScore,
    marginRiskScore,
    collectionsOptimizationScore,
    payrollPressureScore,
    procurementEfficiencyScore,
    vendorConcentrationRiskScore,
    aiInsightCoverageRate,
  }
}
