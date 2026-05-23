/**
 * Growth Engine outbound provider scope model.
 *
 * Today: internal platform Growth Engine (`growth.email_provider_connections`, service role only).
 * Future: org-scoped outbound add-ons should reuse the same connection/campaign/event shapes
 * with org ownership + membership RLS — not a parallel global-only provider stack.
 *
 * Keep adapter registry and capability metadata scope-neutral; scope belongs on connection rows.
 */

export const GROWTH_OUTBOUND_SCOPES = ["platform"] as const

export type GrowthOutboundScope = (typeof GROWTH_OUTBOUND_SCOPES)[number]

/**
 * Future org add-on path:
 * - `email_provider_connections.organization_id` (nullable until org slice)
 * - Platform internal connections remain org_id IS NULL (or scope = platform)
 * - Customer UI reads/writes only org-owned connections via org APIs + entitlements
 *
 * Do not wire org routes or weaken service-role-only behavior until that slice ships.
 */
