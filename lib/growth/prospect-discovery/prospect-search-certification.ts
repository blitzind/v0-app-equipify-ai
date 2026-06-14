/** Phase GS-2A — Prospect Discovery Foundation certification (client-safe gates + server cert). */

import { randomUUID } from "node:crypto"
import { buildProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-plan-builder"
import { parseProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-parser"
import { normalizeProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-normalizer"
import { buildProspectSearchSuggestions } from "@/lib/growth/prospect-discovery/prospect-search-suggestions"
import {
  PROSPECT_DISCOVERY_EXECUTE_CONFIRM,
  PROSPECT_DISCOVERY_QA_MARKER,
} from "@/lib/growth/prospect-discovery/prospect-search-intent-types"

export { PROSPECT_DISCOVERY_EXECUTE_CONFIRM }

export const PROSPECT_DISCOVERY_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "GS-2A is planning-only — no search execution, enrollment, or outreach.",
  "Parser and plan builder are deterministic — no LLM agents.",
  "Reuses GrowthProspectSearchFilters and existing discovery provider names.",
  "Human review required before any search execution in GS-2B.",
] as const

export function assertProspectDiscoveryExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export function validateProspectDiscoveryCertificationConfirmation(body: unknown): {
  ok: boolean
  dry_run: boolean
  error: string | null
} {
  if (!body || typeof body !== "object") {
    return { ok: false, dry_run: false, error: "body_required" }
  }
  const record = body as Record<string, unknown>
  if (record.confirm !== PROSPECT_DISCOVERY_EXECUTE_CONFIRM) {
    return { ok: false, dry_run: false, error: "confirm_token_mismatch" }
  }
  return { ok: true, dry_run: record.dry_run === true, error: null }
}

export function buildProspectDiscoveryReadinessPayload(input?: {
  blockers?: string[]
  gates_ok?: boolean
}): Record<string, unknown> {
  const env = typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : {}
  const gateCheck = assertProspectDiscoveryExecuteAllowed(env)
  return {
    qa_marker: PROSPECT_DISCOVERY_QA_MARKER,
    execute_confirm: PROSPECT_DISCOVERY_EXECUTE_CONFIRM,
    readiness_checklist: [...PROSPECT_DISCOVERY_READINESS_CHECKLIST],
    gates_ok: input?.gates_ok ?? gateCheck.ok,
    blockers: input?.blockers ?? gateCheck.blockers,
    search_execution_enabled: false,
    requires_human_review: true,
  }
}

const CERT_QUERIES = {
  biomedical: "Find independent biomedical service companies in the southeast with 10-100 employees servicing hospitals.",
  hvac: "Find HVAC companies in Texas with 20+ technicians and recent hiring signals.",
  manufacturing: "Find manufacturing service companies that use Salesforce and recently raised funding.",
  vague: "Find biomedical companies",
  tech_only: "Companies using Salesforce",
} as const

export function executeProspectDiscoveryFoundationCertification(input?: { dry_run?: boolean }) {
  const execution_id = randomUUID()
  const gateCheck = assertProspectDiscoveryExecuteAllowed(process.env as Record<string, string | undefined>)

  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: PROSPECT_DISCOVERY_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: PROSPECT_DISCOVERY_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []

  const biomedical = parseProspectSearchIntent(CERT_QUERIES.biomedical)
  checks.push({
    id: "industry_extraction",
    pass: biomedical.industries.some((i) => /biomedical/i.test(i)),
    detail: { industries: biomedical.industries },
  })

  checks.push({
    id: "location_extraction",
    pass: biomedical.locations.length >= 3,
    detail: { locations: biomedical.locations.slice(0, 5), count: biomedical.locations.length },
  })

  checks.push({
    id: "employee_extraction",
    pass: biomedical.employee_ranges.some((r) => r.includes("10-100")),
    detail: { employee_ranges: biomedical.employee_ranges },
  })

  const manufacturing = parseProspectSearchIntent(CERT_QUERIES.manufacturing)
  checks.push({
    id: "technology_extraction",
    pass: manufacturing.technologies.includes("Salesforce"),
    detail: { technologies: manufacturing.technologies },
  })

  const hvac = parseProspectSearchIntent(CERT_QUERIES.hvac)
  checks.push({
    id: "signal_extraction",
    pass: hvac.signals.includes("hiring"),
    detail: { signals: hvac.signals },
  })

  checks.push({
    id: "ambiguity_detection",
    pass: parseProspectSearchIntent(CERT_QUERIES.vague).ambiguities.length > 0,
    detail: { ambiguities: parseProspectSearchIntent(CERT_QUERIES.vague).ambiguities },
  })

  const suggestions = buildProspectSearchSuggestions({ query: CERT_QUERIES.vague })
  checks.push({
    id: "suggestions_generation",
    pass: suggestions.suggestions.length >= 3,
    detail: { count: suggestions.suggestions.length, ids: suggestions.suggestions.map((s) => s.id) },
  })

  const plan = buildProspectSearchPlan(biomedical)
  checks.push({
    id: "search_plan_generation",
    pass: plan.discovery_providers.length >= 3 && plan.search_execution_enabled === false,
    detail: { providers: plan.discovery_providers },
  })

  checks.push({
    id: "provider_recommendations",
    pass:
      plan.discovery_providers.includes("real_world_google_places") &&
      plan.discovery_providers.includes("company_intelligence") &&
      plan.discovery_providers.includes("apollo_people_search"),
    detail: { providers: plan.discovery_providers },
  })

  checks.push({
    id: "quality_estimation",
    pass: plan.estimated_result_quality === "high",
    detail: { quality: plan.estimated_result_quality, confidence: biomedical.confidence },
  })

  const normalized = normalizeProspectSearchIntent(biomedical)
  checks.push({
    id: "normalizer_maps_prospect_search_filters",
    pass: Boolean(normalized.prospect_search_filters.industry) && Boolean(normalized.prospect_search_filters.location),
    detail: {
      industry: normalized.prospect_search_filters.industry,
      location: normalized.prospect_search_filters.location,
    },
  })

  const techSuggestions = buildProspectSearchSuggestions({ query: CERT_QUERIES.tech_only })
  checks.push({
    id: "tech_only_suggestions",
    pass: techSuggestions.suggestions.some((s) => s.field === "industries"),
    detail: { suggestion_ids: techSuggestions.suggestions.map((s) => s.id) },
  })

  const passCount = checks.filter((c) => c.pass).length
  const certification_pct = checks.length === 0 ? 0 : Math.round((passCount / checks.length) * 1000) / 10

  return {
    ok: passCount === checks.length,
    execution_id,
    qa_marker: PROSPECT_DISCOVERY_QA_MARKER,
    certification_pct,
    certification_checks: checks,
    final_verdict: passCount === checks.length ? "PASS" : "FAIL",
    blockers: checks.filter((c) => !c.pass).map((c) => c.id),
    search_execution_enabled: false,
    requires_human_review: true,
  }
}
