/** Apollo production yield benchmark production route — server-only orchestration. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { runApolloProductionYieldBenchmark } from "@/lib/growth/apollo/apollo-production-yield-benchmark"
import { resolveApolloProductionYieldBenchmarkCohort } from "@/lib/growth/apollo/apollo-production-yield-benchmark-cohort"
import type { ApolloProductionYieldBenchmarkReport } from "@/lib/growth/apollo/apollo-production-yield-benchmark-types"
import {
  assertApolloProductionYieldBenchmarkExecuteAllowed,
  buildApolloProductionYieldBenchmarkReadinessPayload,
  redactApolloProductionYieldBenchmarkSecrets,
} from "@/lib/growth/apollo/apollo-production-yield-benchmark-route-gates"

export type ApolloProductionYieldBenchmarkExecuteResult = {
  ok: boolean
  execution_id: string
  benchmark_id: string | null
  benchmark: ApolloProductionYieldBenchmarkReport | null
  blockers: string[]
  error?: "gates_failed" | "cohort_failed" | "benchmark_failed"
  message?: string | null
}

export async function buildApolloProductionYieldBenchmarkReadiness(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv },
) {
  const env = input?.env ?? process.env
  const company_limit = assertApolloProductionYieldBenchmarkExecuteAllowed(env).company_limit
  let cohort_companies_selected = 0
  let cohort_companies: Array<{
    company_candidate_id: string
    company_name: string
    domain: string | null
    domain_present: boolean
  }> = []
  let cohort_error: string | null = null

  try {
    const cohort = await resolveApolloProductionYieldBenchmarkCohort(admin, {
      company_limit,
      env,
    })
    cohort_companies_selected = cohort.selected.length
    cohort_companies = cohort.selected.map((row) => ({
      company_candidate_id: row.company_candidate_id,
      company_name: row.company_name,
      domain: row.domain,
      domain_present: row.domain_present,
    }))
  } catch (error) {
    cohort_error = error instanceof Error ? error.message : String(error)
  }

  return buildApolloProductionYieldBenchmarkReadinessPayload({
    cohort_companies_selected,
    cohort_companies,
    cohort_error,
    env,
  })
}

export async function executeApolloProductionYieldBenchmarkInProduction(
  admin: SupabaseClient,
  input?: {
    company_limit?: number
    contact_limit?: number
    created_by?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloProductionYieldBenchmarkExecuteResult> {
  const env = input?.env ?? process.env
  const execution_id = randomUUID()
  const gates = assertApolloProductionYieldBenchmarkExecuteAllowed(env, {
    company_limit: input?.company_limit,
  })

  if (!gates.ok) {
    return redactApolloProductionYieldBenchmarkSecrets({
      ok: false,
      execution_id,
      benchmark_id: null,
      benchmark: null,
      blockers: gates.blockers,
      error: "gates_failed",
      message: gates.error,
    })
  }

  const company_limit = input?.company_limit ?? gates.company_limit

  let cohort_resolution: Awaited<ReturnType<typeof resolveApolloProductionYieldBenchmarkCohort>>
  try {
    cohort_resolution = await resolveApolloProductionYieldBenchmarkCohort(admin, {
      company_limit,
      env,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return redactApolloProductionYieldBenchmarkSecrets({
      ok: false,
      execution_id,
      benchmark_id: null,
      benchmark: null,
      blockers: [message],
      error: "cohort_failed",
      message,
    })
  }

  try {
    const benchmark = await runApolloProductionYieldBenchmark(admin, {
      execution_id,
      company_limit,
      contact_limit: input?.contact_limit,
      created_by: input?.created_by ?? null,
      env,
      cohort_resolution,
    })

    const completed =
      benchmark.aggregate.companies_processed >= company_limit

    return redactApolloProductionYieldBenchmarkSecrets({
      ok: completed,
      execution_id,
      benchmark_id: benchmark.benchmark_id,
      benchmark,
      blockers: benchmark.top_blockers.map((row) => `${row.category} (${row.count})`),
      ...(completed
        ? {}
        : {
            error: "benchmark_failed" as const,
            message: `Yield benchmark incomplete (processed=${benchmark.aggregate.companies_processed}, expected=${company_limit}).`,
          }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return redactApolloProductionYieldBenchmarkSecrets({
      ok: false,
      execution_id,
      benchmark_id: null,
      benchmark: null,
      blockers: [message],
      error: "benchmark_failed",
      message,
    })
  }
}
