/**
 * Deterministic demo / sample BlitzPay metrics for documentation, fixtures, and future seeding hooks.
 * Values are illustrative only — no real customer data, no randomness.
 */

export const BLITZPAY_DEMO_OPERATIONAL_PRESETS = {
  treasuryOperatingCents: 128_400_00,
  treasuryHeldReserveCents: 22_500_00,
  pendingPayoutsCents: 8_200_00,
  payrollPendingCommissionCents: 4_150_00,
  apOpenOutstandingCents: 31_900_00,
  mobileFinancialIntentCount: 42,
  mobileSyncFailureRate: 0.04,
  observabilityCoverageRate: 0.78,
  queueHealthScore: 88,
  claimsExposureCents: 12_000_00,
  procurementReorderExposureCents: 9_500_00,
  aiFinancialRiskScore: 34,
  revenueOptimizationScore: 61,
} as const
