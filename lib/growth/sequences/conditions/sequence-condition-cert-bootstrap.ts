/**
 * SR-3 — production/integration Supabase bootstrap for sequence conditions certification.
 * Reuses the SN-2 Vercel Production + Supabase CLI linked-project fallback bootstrap.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  bootstrapGrowthOperatorNotificationsCertEnv,
  type GrowthOperatorNotificationsCertBootstrapResult,
} from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
} from "@/lib/growth/qa/supabase-cli-linked-project-bootstrap"

export type GrowthSequenceConditionsCertBootstrapResult = GrowthOperatorNotificationsCertBootstrapResult

export function bootstrapGrowthSequenceConditionsCertEnv(input?: {
  /** When true, only succeeds under `vercel-production-env-run.ts`. */
  requireVercelProductionEnvRun?: boolean
}): GrowthSequenceConditionsCertBootstrapResult | null {
  return bootstrapGrowthOperatorNotificationsCertEnv(input)
}

export function describeSequenceConditionsCertBootstrapFailure(input?: {
  requireVercelProductionEnvRun?: boolean
}): Record<string, unknown> {
  const requireVercelProductionEnvRun = input?.requireVercelProductionEnvRun ?? false
  const vercelProductionEnvRun = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1"

  if (requireVercelProductionEnvRun && !vercelProductionEnvRun) {
    return {
      ok: false,
      final_verdict: "FAIL",
      error: "vercel_production_env_run_required",
      note:
        "Run via pnpm test:growth-sequence-conditions:production with vercel-production-env-run.ts (.env.local not used)",
      vercel_production_env_run: false,
    }
  }

  const projectRef = resolveLinkedSupabaseProjectRef()
  if (!projectRef) {
    return {
      ok: false,
      final_verdict: "FAIL",
      error: "missing_linked_supabase_project",
      note:
        "Link Supabase CLI to production (supabase link --project-ref byyfylkklbxcdofaspye) or set SUPABASE_PROJECT_REF",
      supabase_cli_linked_project: false,
      vercel_production_env_run: vercelProductionEnvRun,
    }
  }

  const cliKey = fetchSupabaseServiceRoleKeyFromCli(projectRef)
  if (!cliKey) {
    return {
      ok: false,
      final_verdict: "FAIL",
      error: "missing_service_role_access",
      note: "Supabase CLI could not fetch service_role key for the linked project",
      supabase_cli_linked_project: true,
      project_ref: projectRef,
      vercel_production_env_run: vercelProductionEnvRun,
    }
  }

  return {
    ok: false,
    final_verdict: "FAIL",
    error: "supabase_unavailable",
    note:
      "Could not resolve Supabase URL + service role from Vercel Production env or Supabase CLI linked project",
    supabase_cli_linked_project: true,
    project_ref: projectRef,
    vercel_production_env_run: vercelProductionEnvRun,
  }
}

export type { SupabaseClient }
