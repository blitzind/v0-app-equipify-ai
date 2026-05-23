/**
 * Growth Engine communication scope model.
 *
 * Today: platform-admin internal ops only (`/api/platform/growth/*`, service role).
 * Future: org-scoped customer add-ons may mirror these shapes under org membership + RLS.
 *
 * Do not expose customer UI or org APIs until an explicit add-on slice ships.
 * Avoid baking in global singleton assumptions in resolver/domain code — keep scope explicit at boundaries.
 */

/** Shipped scopes. Extend with `organization` when customer add-ons land. */
export const GROWTH_COMMUNICATION_SCOPES = ["platform"] as const

export type GrowthCommunicationScope = (typeof GROWTH_COMMUNICATION_SCOPES)[number]

/** Scope-agnostic defaults row shape (maps to platform singleton today; org table later). */
export type GrowthCommunicationDefaults = {
  callDialMode?: string | null
  customUrlTemplate?: string | null
  showAlternateDialers?: boolean | null
  activeEmailConnectionId?: string | null
}

/** Scope-agnostic per-user override shape (platform admin user today; org member later). */
export type GrowthCommunicationUserOverrides = {
  callDialMode?: string | null
  customUrlTemplate?: string | null
  showAlternateDialers?: boolean | null
  preferredEmailConnectionId?: string | null
}

/** Where a resolved preference value came from in the fallback chain. */
export type GrowthCommunicationPreferenceSource = "user" | "scope_defaults" | "hard_default"

/** Hard defaults when no scope or user values exist (safe tel fallback). */
export const GROWTH_COMMUNICATION_HARD_DEFAULTS = {
  callDialMode: "tel",
  customUrlTemplate: null,
  showAlternateDialers: false,
  preferredEmailConnectionId: null,
} as const satisfies GrowthCommunicationDefaults

/**
 * Future org add-on tables (not created yet) should mirror:
 * - `growth.communication_settings` columns → org-owned defaults row
 * - `growth.user_communication_preferences` columns → org member overrides
 * - `growth.email_provider_connections` → org-owned connections when add-on enabled
 *
 * Add nullable `organization_id` only in the slice that introduces org-scoped storage.
 */
