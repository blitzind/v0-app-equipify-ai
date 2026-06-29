import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  formatGrowthResetReportSummary,
  GrowthResetDeletePreflightError,
  GrowthResetDryRunCountError,
  GrowthResetFkMappingPhaseError,
  runGrowthTestDataReset,
  type GrowthResetRunResult,
} from "./growth-test-data-reset-service"
import type { GrowthResetAdminRunMode } from "./growth-test-data-reset-admin-route-gates"

export type GrowthResetAdminRunResult =
  | { ok: true; mode: GrowthResetAdminRunMode; report: Record<string, unknown>; result: GrowthResetRunResult }
  | { ok: false; error: string; details?: Record<string, unknown> }

function extractProjectRefFromSupabaseUrl(url: string | undefined): string | null {
  if (!url?.trim()) return null
  try {
    const host = new URL(url).hostname
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * Runs the Growth test-data reset audit from server runtime using the shared service-role client.
 * Does not read CLI credentials or prompt for secrets.
 */
export async function runGrowthTestDataResetFromAdminRuntime(
  admin: SupabaseClient,
  input: {
    mode: GrowthResetAdminRunMode
    cwd?: string
  },
): Promise<GrowthResetAdminRunResult> {
  try {
    const result = await runGrowthTestDataReset(admin, {
      mode: input.mode,
      cwd: input.cwd,
      persistReports: false,
      countContext: {
        projectRef: extractProjectRefFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
        accessToken: process.env.SUPABASE_ACCESS_TOKEN?.trim() || null,
      },
    })

    const report = formatGrowthResetReportSummary(result)
    report.reports = { before: null, after: null }

    return {
      ok: true,
      mode: input.mode,
      report,
      result,
    }
  } catch (error) {
    if (error instanceof GrowthResetDryRunCountError) {
      return {
        ok: false,
        error: "growth_reset_count_phase_failed",
        details: error.toJSON(),
      }
    }
    if (error instanceof GrowthResetDeletePreflightError) {
      return {
        ok: false,
        error: "growth_reset_delete_preflight_failed",
        details: error.toJSON(),
      }
    }
    if (error instanceof GrowthResetFkMappingPhaseError) {
      return {
        ok: false,
        error: "growth_reset_fk_mapping_validation_failed",
        details: error.toJSON(),
      }
    }

    return {
      ok: false,
      error: "growth_reset_admin_run_failed",
      details: {
        message: error instanceof Error ? error.message : String(error),
      },
    }
  }
}
