/**
 * Commercial packaging metadata (Phase 7A) — no pricing pages; versioned hooks for future matrices.
 */

export const BLITZPAY_COMMERCIAL_METADATA_VERSION = "7a.1" as const

export type BlitzpayCommercialSurfaceKey =
  | "staff_settings_payments"
  | "insights_financial_hub"
  | "financial_command_center"
  | "platform_blitzpay_ops"

export const BLITZPAY_COMMERCIAL_SURFACE_ORDER: readonly BlitzpayCommercialSurfaceKey[] = [
  "staff_settings_payments",
  "insights_financial_hub",
  "financial_command_center",
  "platform_blitzpay_ops",
] as const
