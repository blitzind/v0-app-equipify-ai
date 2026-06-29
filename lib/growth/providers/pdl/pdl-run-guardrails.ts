/** GE-PROVIDERS-1A — Per-run PDL lookup and company guardrails (Apollo parity). Server-only. */

import "server-only"

import { resolvePdlCreditLimits } from "@/lib/growth/providers/pdl/pdl-config"

export const GROWTH_PDL_RUN_GUARDRAILS_QA_MARKER =
  "growth-pdl-run-guardrails-ge-providers-1a-v1" as const

export type PdlRunGuardrailBudget =
  | "lookups"
  | "companies_processed"
  | "person_enrich_calls"
  | "company_enrich_calls"

type RunGuardrailState = {
  lookups: number
  companies_processed: number
  person_enrich_calls: number
  company_enrich_calls: number
}

let activeRun: RunGuardrailState | null = null

export function beginPdlRunGuardrails(): void {
  activeRun = {
    lookups: 0,
    companies_processed: 0,
    person_enrich_calls: 0,
    company_enrich_calls: 0,
  }
}

export function getPdlRunGuardrailSnapshot(): RunGuardrailState | null {
  return activeRun ? { ...activeRun } : null
}

export function resetPdlRunGuardrails(): void {
  activeRun = null
}

export class PdlRunGuardrailError extends Error {
  readonly budget: PdlRunGuardrailBudget
  readonly limit: number

  constructor(input: { budget: PdlRunGuardrailBudget; limit: number }) {
    super(formatPdlRunGuardrailExceededMessage(input.budget, input.limit))
    this.name = "PdlRunGuardrailError"
    this.budget = input.budget
    this.limit = input.limit
  }
}

export function formatPdlRunGuardrailExceededMessage(
  budget: PdlRunGuardrailBudget,
  limit: number,
): string {
  switch (budget) {
    case "lookups":
      return `PDL run guardrail: max lookups per run (${limit}) exceeded.`
    case "companies_processed":
      return `PDL run guardrail: max companies per run (${limit}) exceeded.`
    case "person_enrich_calls":
      return `PDL run guardrail: max person enrich calls per run (${limit}) exceeded.`
    case "company_enrich_calls":
      return `PDL run guardrail: max company enrich calls per run (${limit}) exceeded.`
  }
}

export function assertPdlLookupAllowed(input?: { env?: NodeJS.ProcessEnv }): void {
  const limits = resolvePdlCreditLimits(input?.env)
  const run = activeRun
  if (!run) return

  if (run.lookups >= limits.max_lookups_per_run) {
    throw new PdlRunGuardrailError({ budget: "lookups", limit: limits.max_lookups_per_run })
  }
}

export function assertPdlCompanyProcessingAllowed(input?: { env?: NodeJS.ProcessEnv }): void {
  const limits = resolvePdlCreditLimits(input?.env)
  const run = activeRun
  if (!run) return

  if (run.companies_processed >= limits.max_companies_per_run) {
    throw new PdlRunGuardrailError({
      budget: "companies_processed",
      limit: limits.max_companies_per_run,
    })
  }
}

export function assertPdlPersonEnrichAllowed(input?: { env?: NodeJS.ProcessEnv }): void {
  assertPdlLookupAllowed(input)
  const limits = resolvePdlCreditLimits(input?.env)
  const run = activeRun
  if (!run) return

  if (run.person_enrich_calls >= limits.max_lookups_per_run) {
    throw new PdlRunGuardrailError({
      budget: "person_enrich_calls",
      limit: limits.max_lookups_per_run,
    })
  }
}

export function assertPdlCompanyEnrichAllowed(input?: { env?: NodeJS.ProcessEnv }): void {
  assertPdlLookupAllowed(input)
  const limits = resolvePdlCreditLimits(input?.env)
  const run = activeRun
  if (!run) return

  if (run.company_enrich_calls >= limits.max_lookups_per_run) {
    throw new PdlRunGuardrailError({
      budget: "company_enrich_calls",
      limit: limits.max_lookups_per_run,
    })
  }
}

export function recordPdlLookup(input?: { env?: NodeJS.ProcessEnv }): void {
  assertPdlLookupAllowed(input)
  if (!activeRun) return
  activeRun.lookups += 1
}

export function recordPdlCompanyProcessed(): void {
  if (!activeRun) return
  activeRun.companies_processed += 1
}

export function recordPdlPersonEnrichCall(input?: { env?: NodeJS.ProcessEnv }): void {
  assertPdlPersonEnrichAllowed(input)
  if (!activeRun) return
  activeRun.lookups += 1
  activeRun.person_enrich_calls += 1
}

export function recordPdlCompanyEnrichCall(input?: { env?: NodeJS.ProcessEnv }): void {
  assertPdlCompanyEnrichAllowed(input)
  if (!activeRun) return
  activeRun.lookups += 1
  activeRun.company_enrich_calls += 1
}
