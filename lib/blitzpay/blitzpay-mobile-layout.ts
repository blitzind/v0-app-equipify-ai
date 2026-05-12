/**
 * Shared Tailwind class bundles for BlitzPay staff surfaces (Phase 7A mobile hardening).
 * Prefer these on dense financial cards and horizontal metrics to avoid overflow on small viewports.
 */

/** Vertical stack with safe width for nested financial cards. */
export const BLITZPAY_MOBILE_FIN_STACK = "flex flex-col gap-3 w-full min-w-0"

/** Horizontal scroll container for wide tabular content (staff-only). */
export const BLITZPAY_TABLE_SAFE_WRAP = "w-full min-w-0 overflow-x-auto"

/** Minimum touch target per WCAG-style field ops (44px). */
export const BLITZPAY_TOUCH_TARGET = "min-h-11 min-w-11 inline-flex items-center justify-center"
