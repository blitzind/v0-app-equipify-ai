/** Phase 7.PCA-3 — Per-run Apollo API call and credit guardrails. Server-only. */

import "server-only"

import {
  isApolloEmailEnrichmentEnabled,
  resolveApolloCreditLimits,
} from "@/lib/growth/providers/apollo/apollo-config"

export const GROWTH_APOLLO_RUN_GUARDRAILS_QA_MARKER = "growth-apollo-run-guardrails-7-pca-3-v2" as const

export type ApolloRunGuardrailBudget =
  | "companies_acquired"
  | "search_api_calls"
  | "enrichment_api_calls"
  | "api_calls"

type RunGuardrailState = {
  /** Distinct companies that entered acquisition this run — not tier attempts. */
  companies_acquired: number
  api_calls: number
  search_api_calls: number
  bulk_match_batches: number
  credits_estimate: number
}

let activeRun: RunGuardrailState | null = null

export function beginApolloRunGuardrails(): void {
  activeRun = {
    companies_acquired: 0,
    api_calls: 0,
    search_api_calls: 0,
    bulk_match_batches: 0,
    credits_estimate: 0,
  }
}

export function getApolloRunGuardrailSnapshot(): (RunGuardrailState & {
  /** @deprecated Use companies_acquired — kept for backward-compatible telemetry reads. */
  companies_processed: number
}) | null {
  if (!activeRun) return null
  return {
    ...activeRun,
    companies_processed: activeRun.companies_acquired,
  }
}

export function resetApolloRunGuardrails(): void {
  activeRun = null
}

export class ApolloRunGuardrailError extends Error {
  readonly budget: ApolloRunGuardrailBudget
  readonly limit: number

  constructor(input: { budget: ApolloRunGuardrailBudget; limit: number }) {
    super(formatApolloRunGuardrailExceededMessage(input.budget, input.limit))
    this.name = "ApolloRunGuardrailError"
    this.budget = input.budget
    this.limit = input.limit
  }
}

export function formatApolloRunGuardrailExceededMessage(
  budget: ApolloRunGuardrailBudget,
  limit: number,
): string {
  switch (budget) {
    case "companies_acquired":
      return `Apollo run guardrail: max companies acquired per run (${limit}) exceeded.`
    case "search_api_calls":
      return `Apollo run guardrail: max search API calls per run (${limit}) exceeded.`
    case "enrichment_api_calls":
      return `Apollo run guardrail: max enrichment API calls per run (${limit}) exceeded.`
    case "api_calls":
      return `Apollo run guardrail: max total API calls per run (${limit}) exceeded.`
  }
}

export function classifyApolloRunGuardrailMessage(
  message: string,
): ApolloRunGuardrailBudget | null {
  if (message.includes("max companies acquired per run")) return "companies_acquired"
  if (message.includes("max search API calls per run")) return "search_api_calls"
  if (message.includes("max enrichment API calls per run")) return "enrichment_api_calls"
  if (message.includes("max total API calls per run")) return "api_calls"
  if (message.includes("max companies per run")) return "companies_acquired"
  if (message.includes("max API calls per run")) return "search_api_calls"
  return null
}

export function assertApolloCompanyAcquisitionAllowed(input?: {
  env?: NodeJS.ProcessEnv
}): void {
  const limits = resolveApolloCreditLimits(input?.env)
  const run = activeRun
  if (!run) return

  if (run.companies_acquired >= limits.max_companies_per_run) {
    throw new ApolloRunGuardrailError({
      budget: "companies_acquired",
      limit: limits.max_companies_per_run,
    })
  }
}

export function assertApolloSearchApiCallAllowed(input?: { env?: NodeJS.ProcessEnv }): void {
  const limits = resolveApolloCreditLimits(input?.env)
  const run = activeRun
  if (!run) return

  if (run.search_api_calls >= limits.max_api_calls_per_run) {
    throw new ApolloRunGuardrailError({
      budget: "search_api_calls",
      limit: limits.max_api_calls_per_run,
    })
  }
  if (run.api_calls >= limits.max_api_calls_per_run) {
    throw new ApolloRunGuardrailError({
      budget: "api_calls",
      limit: limits.max_api_calls_per_run,
    })
  }
}

export function assertApolloEnrichmentCallAllowed(input?: { env?: NodeJS.ProcessEnv }): void {
  const limits = resolveApolloCreditLimits(input?.env)
  const run = activeRun
  if (!run) return

  const enrichmentLimit = limits.max_enrichment_batches_per_run
  if (run.bulk_match_batches >= enrichmentLimit) {
    throw new ApolloRunGuardrailError({
      budget: "enrichment_api_calls",
      limit: enrichmentLimit,
    })
  }
}

/** @deprecated Use assertApolloCompanyAcquisitionAllowed or assertApolloSearchApiCallAllowed. */
export function assertApolloCompanySearchAllowed(input?: {
  company_limit?: number
  env?: NodeJS.ProcessEnv
}): void {
  assertApolloSearchApiCallAllowed(input)
  const limits = resolveApolloCreditLimits(input?.env)
  const requested = input?.company_limit ?? limits.max_companies_per_run
  if (requested > limits.max_companies_per_run) {
    throw new ApolloRunGuardrailError({
      budget: "companies_acquired",
      limit: limits.max_companies_per_run,
    })
  }
}

export function recordApolloCompanyAcquisitionStarted(): void {
  if (!activeRun) return
  activeRun.companies_acquired += 1
}

export function recordApolloSearchApiCall(input?: { env?: NodeJS.ProcessEnv }): void {
  if (!activeRun) return
  activeRun.api_calls += 1
  activeRun.search_api_calls += 1
  if (!isApolloEmailEnrichmentEnabled(input?.env)) {
    activeRun.credits_estimate += 0
  }
}

export function recordApolloBulkMatchBatch(input: { batches: number; env?: NodeJS.ProcessEnv }): void {
  if (!activeRun) return
  if (!isApolloEmailEnrichmentEnabled(input?.env)) {
    throw new ApolloRunGuardrailError({
      budget: "enrichment_api_calls",
      limit: 0,
    })
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
