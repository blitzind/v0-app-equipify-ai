/** Phase 7.PS-IR-RUNTIME — Trigger deployed benchmark PDL validation via Vercel cron telemetry. */

import "server-only"

import { execFileSync } from "node:child_process"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { runApolloReplacementBenchmarkPdlValidation } from "@/lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-discovery"
import { GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER } from "@/lib/growth/benchmark/apollo-replacement-benchmark-pdl-validation-types"
import { fetchLatestCronTelemetryRun } from "@/lib/growth/qa/growth-provider-deployed-runtime-probe"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { isPdlApiConfigured } from "@/lib/growth/providers/pdl/pdl-config"

const PDL_BENCHMARK_VALIDATION_CRON_ROUTE = growthCronApiPath("growth-pdl-benchmark-validation-run")

function triggerVercelCron(cronPath: string): void {
  execFileSync("vercel", ["crons", "run", cronPath], {
    cwd: process.cwd(),
    stdio: "pipe",
    timeout: 120_000,
    encoding: "utf8",
  })
}

export function shouldUseDeployedPdlBenchmarkValidationRuntime(): boolean {
  return !isPdlApiConfigured()
}

export async function runDeployedPdlBenchmarkValidation(input: {
  admin: SupabaseClient
  poll_timeout_ms?: number
}): Promise<{
  ok: boolean
  channel: "vercel_cron_telemetry"
  validation: Awaited<ReturnType<typeof runApolloReplacementBenchmarkPdlValidation>> | null
  error: string | null
  cron_telemetry_run_id: string | null
}> {
  const started_after = new Date(Date.now() - 5_000).toISOString()
  try {
    triggerVercelCron(PDL_BENCHMARK_VALIDATION_CRON_ROUTE)
  } catch (e) {
    return {
      ok: false,
      channel: "vercel_cron_telemetry",
      validation: null,
      error: "vercel_cron_pdl_benchmark_validation_trigger_failed",
      cron_telemetry_run_id: null,
    }
  }

  const telemetry = await fetchLatestCronTelemetryRun({
    admin: input.admin,
    cron_route: PDL_BENCHMARK_VALIDATION_CRON_ROUTE,
    started_after,
    poll_timeout_ms: input.poll_timeout_ms ?? 600_000,
  })

  const validation_result =
    telemetry.metadata?.validation_result &&
    typeof telemetry.metadata.validation_result === "object"
      ? (telemetry.metadata.validation_result as Awaited<
          ReturnType<typeof runApolloReplacementBenchmarkPdlValidation>
        >)
      : null

  if (
    !validation_result ||
    validation_result.qa_marker !== GROWTH_APOLLO_REPLACEMENT_BENCHMARK_PDL_VALIDATION_QA_MARKER
  ) {
    return {
      ok: false,
      channel: "vercel_cron_telemetry",
      validation: null,
      error: "vercel_cron_pdl_benchmark_validation_telemetry_timeout",
      cron_telemetry_run_id: telemetry.run_id,
    }
  }

  return {
    ok: validation_result.ok,
    channel: "vercel_cron_telemetry",
    validation: validation_result,
    error: validation_result.ok ? null : "pdl_benchmark_validation_failed",
    cron_telemetry_run_id: telemetry.run_id,
  }
}
