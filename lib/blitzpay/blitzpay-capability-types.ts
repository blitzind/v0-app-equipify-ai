/**
 * Shared types for BlitzPay capability / entitlement surfaces (FCC shell + overview widgets).
 * Plan tiers reuse {@link CommercialProductTier} — the canonical SaaS ladder includes `enterprise`.
 */
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"

/** Alias for product/docs language — same union as {@link CommercialProductTier}. */
export type BlitzPayPlanTier = CommercialProductTier

/**
 * How a surface should behave in navigation, routing, and data loading.
 * - `hidden`: omit from nav; do not mount data panels; direct routes redirect (unless strict preview env).
 * - `enabled`: tier includes this FCC section — full panel + prefetch eligibility.
 * - `upgrade_preview`: curated deep-link only — polished upgrade surface, no org data fetch.
 * - `preview` / `upgrade_cta`: legacy packaging hints (non-FCC surfaces / catalogs).
 */
export type BlitzPaySurfaceMode = "hidden" | "enabled" | "preview" | "upgrade_cta" | "upgrade_preview"
