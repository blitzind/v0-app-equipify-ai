/** Growth Engine access diagnostic — server-only collector. */

import "server-only"

import {
  buildGrowthEngineAccessDiagnostic,
  isGrowthEngineAccessDiagnosticEnabledEnv,
} from "@/lib/growth/growth-engine-access-diagnostic"
import {
  isGrowthEngineEnabledEnv,
  resolveGrowthEnginePlatformUserResolution,
} from "@/lib/growth/access"
import { getPlatformAdminAllowlistMeta, isPlatformAdminEmail } from "@/lib/platform-admin"

export async function loadGrowthEngineAccessDiagnostic(request: Request) {
  const allowlistMeta = getPlatformAdminAllowlistMeta()
  const resolution = await resolveGrowthEnginePlatformUserResolution(request)
  const resolved_email = resolution.resolved_user?.userEmail ?? null

  return buildGrowthEngineAccessDiagnostic({
    growth_engine_enabled: isGrowthEngineEnabledEnv(),
    diagnostic_enabled: isGrowthEngineAccessDiagnosticEnabledEnv(),
    request_has_authorization_header: request.headers.has("authorization") || request.headers.has("Authorization"),
    bearer_token_present: resolution.bearer_token_present,
    bearer_user_resolved: resolution.bearer_user_resolved,
    cookie_user_resolved: resolution.cookie_user_resolved,
    resolved_email,
    admin_allowlist_env_present: allowlistMeta.admin_allowlist_env_present,
    admin_allowlist_entry_count: allowlistMeta.admin_allowlist_entry_count,
    admin_allowlist_env_source: allowlistMeta.admin_allowlist_env_source,
    resolved_email_in_admin_allowlist: isPlatformAdminEmail(resolved_email),
  })
}
