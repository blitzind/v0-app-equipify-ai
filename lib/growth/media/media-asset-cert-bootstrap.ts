/**
 * S1.5 — production/integration Supabase bootstrap for media assets certification.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  bootstrapGrowthOperatorNotificationsCertEnv,
  type GrowthOperatorNotificationsCertBootstrapResult,
} from "@/lib/growth/notifications/growth-notification-cert-bootstrap"

export type GrowthMediaAssetsCertBootstrapResult = GrowthOperatorNotificationsCertBootstrapResult

export function bootstrapGrowthMediaAssetsCertEnv(input?: {
  requireVercelProductionEnvRun?: boolean
}): GrowthMediaAssetsCertBootstrapResult | null {
  return bootstrapGrowthOperatorNotificationsCertEnv(input)
}

export function describeMediaAssetsCertBootstrapFailure(input?: {
  requireVercelProductionEnvRun?: boolean
}): Record<string, unknown> {
  const requireVercelProductionEnvRun = input?.requireVercelProductionEnvRun ?? false
  const vercelProductionEnvRun = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1"

  if (requireVercelProductionEnvRun && !vercelProductionEnvRun) {
    return {
      ok: false,
      final_verdict: "FAIL",
      error: "vercel_production_env_run_required",
      note: "Run via pnpm test:growth-media-assets:production with vercel-production-env-run.ts (.env.local not used)",
      vercel_production_env_run: false,
    }
  }

  return {
    ok: false,
    final_verdict: "FAIL",
    error: "supabase_unavailable",
    note: "Could not resolve Supabase URL + service role from Vercel Production env or Supabase CLI linked project",
    vercel_production_env_run: vercelProductionEnvRun,
  }
}

export type { SupabaseClient }
