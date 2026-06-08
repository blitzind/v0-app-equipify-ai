/** Phase 7.PCA-3 — Per-run Apollo API call and credit guardrails. Server-only. */

import "server-only"

import {
  isApolloEmailEnrichmentEnabled,
  resolveApolloCreditLimits,
} from "@/lib/growth/providers/apollo/apollo-config"

export const GROWTH_APOLLO_RUN_GUARDRAILS_QA_MARKER = "growth-apollo-run-guardrails-7-pca-3-v1" as const

type RunGuardrailState = {
  companies_processed: number
  api_calls: number
  search_api_calls: number
  bulk_match_batches: number
  credits_estimate: number
}

let activeRun: RunGuardrailState | null = null

export function beginApolloRunGuardrails(): void {
  activeRun = {
    companies_processed: 0,
    api_calls: 0,
    search_api_calls: 0,
    bulk_match_batches: 0,
    credits_estimate: 0,
  }
}

export function getApolloRunGuardrailSnapshot(): RunGuardrailState | null {
  return activeRun ? { ...activeRun } : null
}

export function resetApolloRunGuardrails(): void {
  activeRun = null
}

export class ApolloRunGuardrailError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApolloRunGuardrailError"
  }
}

export function assertApolloCompanySearchAllowed(input?: {
  company_limit?: number
  env?: NodeJS.ProcessEnv
}): void {
  const limits = resolveApolloCreditLimits(input?.env)
  const run = activeRun
  if (!run) return

  if (run.companies_processed >= limits.max_companies_per_run) {
    throw new ApolloRunGuardrailError(
      `Apollo run guardrail: max companies per run (${limits.max_companies_per_run}) exceeded.`,
    )
  }
  if (run.api_calls >= limits.max_api_calls_per_run) {
    throw new ApolloRunGuardrailError(
      `Apollo run guardrail: max API calls per run (${limits.max_api_calls_per_run}) exceeded.`,
    )
  }
  const requested = input?.company_limit ?? limits.max_companies_per_run
  if (requested > limits.max_companies_per_run) {
    throw new ApolloRunGuardrailError(
      `Apollo run guardrail: requested company limit ${requested} exceeds max ${limits.max_companies_per_run}.`,
    )
  }
}

export function recordApolloSearchApiCall(input?: { env?: NodeJS.ProcessEnv }): void {
  if (!activeRun) return
  activeRun.companies_processed += 1
  activeRun.api_calls += 1
  activeRun.search_api_calls += 1
  if (!isApolloEmailEnrichmentEnabled(input?.env)) {
    activeRun.credits_estimate += 0
  }
}

export function recordApolloBulkMatchBatch(input: { batches: number; env?: NodeJS.ProcessEnv }): void {
  if (!activeRun) return
  if (!isApolloEmailEnrichmentEnabled(input?.env)) {
    throw new ApolloRunGuardrailError(
      "Apollo bulk_match blocked: GROWTH_APOLLO_ENRICH_EMAILS is not enabled.",
    )
  }
  activeRun.bulk_match_batches += input.batches
  activeRun.api_calls += input.batches
  activeRun.credits_estimate += input.batches
}

export function resolveContactsPerCompanyLimit(
  requested: number | undefined,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const limits = resolveApolloCreditLimits(env)
  const base = requested ?? limits.max_contacts_per_company
  return Math.min(Math.max(base, 1), limits.max_contacts_per_company)
}
