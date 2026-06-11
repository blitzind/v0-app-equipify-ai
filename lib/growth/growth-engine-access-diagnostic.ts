/** Growth Engine platform access diagnostic — client-safe (temporary production debug). */

export const GROWTH_ENGINE_ACCESS_DIAGNOSTIC_QA_MARKER =
  "growth-engine-access-diagnostic-v1" as const

export const GROWTH_ENGINE_ACCESS_DECISIONS = [
  "allowed",
  "feature_disabled",
  "diagnostic_disabled",
  "unauthenticated",
  "forbidden",
] as const

export type GrowthEngineAccessDecision = (typeof GROWTH_ENGINE_ACCESS_DECISIONS)[number]

export type GrowthEngineAccessDiagnostic = {
  qa_marker: typeof GROWTH_ENGINE_ACCESS_DIAGNOSTIC_QA_MARKER
  computed_at: string
  growth_engine_enabled: boolean
  request_has_authorization_header: boolean
  bearer_token_present: boolean
  bearer_resolution_attempted: boolean
  bearer_resolution_error_code: string | null
  bearer_resolution_error_message_safe: string | null
  bearer_token_length: number
  bearer_token_segment_count: number
  bearer_user_resolved: boolean
  cookie_user_resolved: boolean
  resolved_email: string | null
  admin_allowlist_env_present: boolean
  admin_allowlist_entry_count: number
  admin_allowlist_env_source: string | null
  resolved_email_in_admin_allowlist: boolean
  access_decision: GrowthEngineAccessDecision
}

export function isGrowthEngineAccessDiagnosticEnabledEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GROWTH_ENGINE_ACCESS_DIAGNOSTIC_ENABLED?.trim() === "true"
}

export function buildGrowthEngineAccessDiagnostic(input: {
  growth_engine_enabled: boolean
  diagnostic_enabled: boolean
  request_has_authorization_header: boolean
  bearer_token_present: boolean
  bearer_resolution_attempted: boolean
  bearer_resolution_error_code: string | null
  bearer_resolution_error_message_safe: string | null
  bearer_token_length: number
  bearer_token_segment_count: number
  bearer_user_resolved: boolean
  cookie_user_resolved: boolean
  resolved_email: string | null
  admin_allowlist_env_present: boolean
  admin_allowlist_entry_count: number
  admin_allowlist_env_source: string | null
  resolved_email_in_admin_allowlist: boolean
}): GrowthEngineAccessDiagnostic {
  let access_decision: GrowthEngineAccessDecision
  if (!input.diagnostic_enabled) {
    access_decision = "diagnostic_disabled"
  } else if (!input.growth_engine_enabled) {
    access_decision = "feature_disabled"
  } else if (!input.resolved_email) {
    access_decision = "unauthenticated"
  } else if (!input.resolved_email_in_admin_allowlist) {
    access_decision = "forbidden"
  } else {
    access_decision = "allowed"
  }

  return {
    qa_marker: GROWTH_ENGINE_ACCESS_DIAGNOSTIC_QA_MARKER,
    computed_at: new Date().toISOString(),
    growth_engine_enabled: input.growth_engine_enabled,
    request_has_authorization_header: input.request_has_authorization_header,
    bearer_token_present: input.bearer_token_present,
    bearer_resolution_attempted: input.bearer_resolution_attempted,
    bearer_resolution_error_code: input.bearer_resolution_error_code,
    bearer_resolution_error_message_safe: input.bearer_resolution_error_message_safe,
    bearer_token_length: input.bearer_token_length,
    bearer_token_segment_count: input.bearer_token_segment_count,
    bearer_user_resolved: input.bearer_user_resolved,
    cookie_user_resolved: input.cookie_user_resolved,
    resolved_email: input.resolved_email,
    admin_allowlist_env_present: input.admin_allowlist_env_present,
    admin_allowlist_entry_count: input.admin_allowlist_entry_count,
    admin_allowlist_env_source: input.admin_allowlist_env_source,
    resolved_email_in_admin_allowlist: input.resolved_email_in_admin_allowlist,
    access_decision,
  }
}
