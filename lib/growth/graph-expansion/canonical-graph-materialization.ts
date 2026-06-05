/** Phase 7.PS-HT — Canonical graph materialization from discovery candidates. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { mapDiscoveryCandidateRow, mapRealWorldCompanyCandidateRow } from "@/lib/growth/canonical-companies/canonical-company-candidate-mappers"
import { promoteCanonicalCompanyCandidates } from "@/lib/growth/canonical-companies/canonical-company-backfill"
import {
  countCanonicalCompanies,
  loadCanonicalCompanyIndexesFromDb,
} from "@/lib/growth/canonical-companies/canonical-company-repository-core"
import {
  createEmptyCanonicalCompanyResolverIndexes,
  registerCanonicalCompanyInIndexes,
  resolveCanonicalCompany,
} from "@/lib/growth/canonical-companies/canonical-company-resolver"
import { ensureStagingCanonicalCompanyLinkage } from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
import { runCanonicalPersonBackfillForCompanyCandidate } from "@/lib/growth/canonical-persons/canonical-person-backfill"
import {
  evaluateDiscoveryCandidateMaterializationEligibility,
  evaluateNewCanonicalCompanyCreationEligibility,
} from "@/lib/growth/graph-expansion/canonical-graph-materialization-eligibility"
import {
  GROWTH_CANONICAL_GRAPH_MATERIALIZATION_ICP_INDUSTRY_PATTERNS,
  GROWTH_CANONICAL_GRAPH_MATERIALIZATION_QA_MARKER,
  type CanonicalGraphMaterializationBlocker,
  type CanonicalGraphMaterializationMetrics,
  type CanonicalGraphMaterializationResult,
} from "@/lib/growth/graph-expansion/canonical-graph-materialization-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function emptyMetrics(): CanonicalGraphMaterializationMetrics {
  return {
    candidates_discovered: 0,
    candidates_eligible: 0,
    candidates_blocked: 0,
    candidates_promoted: 0,
    candidates_linked_existing: 0,
    companies_added: 0,
    persons_promoted: 0,
    promotion_rate_pct: 0,
    blockers_by_reason: {},
  }
}

function bumpBlocker(
  metrics: CanonicalGraphMaterializationMetrics,
  reason: CanonicalGraphMaterializationBlocker,
): void {
  metrics.candidates_blocked += 1
  metrics.blockers_by_reason[reason] = (metrics.blockers_by_reason[reason] ?? 0) + 1
}

function matchesIcpIndustry(
  industry: string | null | undefined,
  patterns: readonly string[],
): boolean {
  if (patterns.length === 0) return true
  const normalized = asString(industry).toLowerCase()
  if (!normalized) return false
  return patterns.some((pattern) => normalized.includes(pattern.toLowerCase()))
}

async function buildResolverIndexes(admin: SupabaseClient) {
  const loaded = await loadCanonicalCompanyIndexesFromDb(admin)
  const indexes = createEmptyCanonicalCompanyResolverIndexes()
  for (const c of loaded.companies) {
    registerCanonicalCompanyInIndexes(indexes, c.id, {
      primary_domain: c.primary_domain,
      normalized_domain: c.primary_domain,
      city: c.city,
      state: c.state,
      normalized_name: c.normalized_name,
    })
  }
  for (const d of loaded.domains) {
    indexes.by_normalized_domain.set(d.normalized_domain, d.company_id)
    indexes.by_exact_domain.set(d.domain.toLowerCase(), d.company_id)
    indexes.by_exact_domain.set(d.normalized_domain, d.company_id)
  }
  return indexes
}

export async function runCanonicalGraphMaterialization(
  admin: SupabaseClient,
  input: {
    mode?: "dry_run" | "apply"
    limit?: number
    discovery_run_id?: string | null
    industry_contains?: string | null
    industry_patterns?: readonly string[]
    only_unlinked?: boolean
    run_person_backfill?: boolean
  } = {},
): Promise<CanonicalGraphMaterializationResult> {
  const mode = input.mode ?? "apply"
  const limit = input.limit ?? 80
  const industry_patterns =
    input.industry_patterns ??
    (input.industry_contains
      ? [
          input.industry_contains,
          ...GROWTH_CANONICAL_GRAPH_MATERIALIZATION_ICP_INDUSTRY_PATTERNS,
        ]
      : [])
  const metrics = emptyMetrics()
  const messages: string[] = []
  const promoted_companies: CanonicalGraphMaterializationResult["promoted_companies"] = []
  const blocked_samples: CanonicalGraphMaterializationResult["blocked_samples"] = []

  const companies_before = await countCanonicalCompanies(admin)

  let query = admin
    .schema("growth")
    .from("discovery_candidates")
    .select(
      "id, run_id, company_id, source_type, discovery_source_type, company_name, website, domain, industry, location, city, state, source_confidence, dedupe_hash, discovered_at, created_at, metadata, canonical_company_id, evidence, is_suppressed, is_duplicate",
    )
    .order("discovered_at", { ascending: false })
    .limit(Math.max(limit, 200))

  if (input.only_unlinked !== false) {
    query = query.is("canonical_company_id", null)
  }
  if (input.discovery_run_id) {
    query = query.eq("run_id", input.discovery_run_id)
  }

  const { data: discoveryRowsRaw, error } = await query
  if (error) {
    return {
      qa_marker: GROWTH_CANONICAL_GRAPH_MATERIALIZATION_QA_MARKER,
      ok: false,
      metrics,
      promoted_companies,
      blocked_samples,
      messages: [`discovery_candidates_load_failed: ${error.message}`],
    }
  }

  const discoveryRows = (discoveryRowsRaw ?? [])
    .filter((row) =>
      matchesIcpIndustry(asString((row as Record<string, unknown>).industry) || null, industry_patterns),
    )
    .slice(0, limit)

  metrics.candidates_discovered = discoveryRows.length
  const indexes = await buildResolverIndexes(admin)
  const candidatesToPromote = []

  for (const row of discoveryRows) {
    const record = row as Record<string, unknown>
    const discovery_candidate_id = asString(record.id)
    const company_name = asString(record.company_name)
    const evidence = Array.isArray(record.evidence)
      ? (record.evidence as Array<{ claim?: string; evidence?: string }>)
      : []

    const eligibility = evaluateDiscoveryCandidateMaterializationEligibility({
      company_name,
      website: asString(record.website) || null,
      domain: asString(record.domain) || null,
      source_confidence: Number(record.source_confidence ?? 0),
      evidence,
      is_suppressed: record.is_suppressed === true,
      is_duplicate: record.is_duplicate === true,
      canonical_company_id: asString(record.canonical_company_id) || null,
    })

    if (!eligibility.eligible) {
      if (eligibility.blocked_reason) {
        bumpBlocker(metrics, eligibility.blocked_reason)
        if (blocked_samples.length < 12) {
          blocked_samples.push({
            discovery_candidate_id,
            company_name,
            blocked_reason: eligibility.blocked_reason,
          })
        }
      }
      continue
    }

    const mapped = mapDiscoveryCandidateRow(record)
    const resolution = resolveCanonicalCompany(mapped, indexes)
    const creationGate = evaluateNewCanonicalCompanyCreationEligibility({
      would_create_new: resolution.would_create_new,
      normalized_domain: resolution.normalized_domain,
      has_evidence: eligibility.has_evidence,
    })
    if (!creationGate.eligible) {
      if (creationGate.blocked_reason) {
        bumpBlocker(metrics, creationGate.blocked_reason)
        if (blocked_samples.length < 12) {
          blocked_samples.push({
            discovery_candidate_id,
            company_name,
            blocked_reason: creationGate.blocked_reason,
          })
        }
      }
      continue
    }

    metrics.candidates_eligible += 1
    candidatesToPromote.push(mapped)

    const rwCandidateId = asString(record.company_id)
    if (rwCandidateId) {
      const { data: rwRow } = await admin
        .schema("growth")
        .from("real_world_company_candidates")
        .select(
          "id, run_id, provider_name, provider_type, company_name, website, domain, phone, address, city, state, country, industry, confidence, dedupe_hash, created_at, metadata, canonical_company_id, query",
        )
        .eq("id", rwCandidateId)
        .maybeSingle()

      if (rwRow && !asString((rwRow as Record<string, unknown>).canonical_company_id)) {
        const rwMapped = mapRealWorldCompanyCandidateRow(rwRow as Record<string, unknown>)
        const rwResolution = resolveCanonicalCompany(rwMapped, indexes)
        const rwGate = evaluateNewCanonicalCompanyCreationEligibility({
          would_create_new: rwResolution.would_create_new,
          normalized_domain: rwResolution.normalized_domain,
          has_evidence: eligibility.has_evidence,
        })
        if (rwGate.eligible) {
          candidatesToPromote.push(rwMapped)
        }
      }
    }
  }

  const uniqueCandidates = new Map<string, (typeof candidatesToPromote)[number]>()
  for (const candidate of candidatesToPromote) {
    uniqueCandidates.set(`${candidate.source_table}:${candidate.source_id}`, candidate)
  }

  const promotion = await promoteCanonicalCompanyCandidates(admin, {
    mode,
    candidates: [...uniqueCandidates.values()],
  })

  const personJobs: Array<{ rw_candidate_id: string; canonical_company_id: string }> = []

  for (const outcome of promotion.outcomes) {
    if (!outcome.ok) {
      bumpBlocker(metrics, "promotion_error")
      continue
    }
    if (outcome.source_table !== "discovery_candidates") continue

    metrics.candidates_promoted += 1
    if (outcome.linked_existing) metrics.candidates_linked_existing += 1
    if (outcome.would_create_new) metrics.companies_added += 1

    const discoveryRow = (discoveryRows ?? []).find(
      (row) => asString((row as Record<string, unknown>).id) === outcome.source_id,
    ) as Record<string, unknown> | undefined

    const rwId = discoveryRow ? asString(discoveryRow.company_id) : ""
    if (outcome.company_id && rwId) {
      personJobs.push({ rw_candidate_id: rwId, canonical_company_id: outcome.company_id })
    }

    if (outcome.company_id && promoted_companies.length < 40) {
      promoted_companies.push({
        discovery_candidate_id: outcome.source_id,
        real_world_candidate_id: rwId || null,
        canonical_company_id: outcome.company_id,
        company_name: asString(discoveryRow?.company_name),
        resolution_method: outcome.resolution_method,
        created_new: outcome.would_create_new,
      })
    }
  }

  if (input.run_person_backfill !== false && mode === "apply") {
    const seenPersonJobs = new Set<string>()
    for (const job of personJobs) {
      const key = `${job.rw_candidate_id}:${job.canonical_company_id}`
      if (seenPersonJobs.has(key)) continue
      seenPersonJobs.add(key)

      await ensureStagingCanonicalCompanyLinkage(admin, job.rw_candidate_id, {
        explicit_canonical_company_id: job.canonical_company_id,
      }).catch(() => null)

      const personBackfill = await runCanonicalPersonBackfillForCompanyCandidate(admin, {
        company_candidate_id: job.rw_candidate_id,
        canonical_company_id: job.canonical_company_id,
        mode: "apply",
      })
      metrics.persons_promoted += personBackfill.persons_linked
    }
  }

  const companies_after = await countCanonicalCompanies(admin)
  if (metrics.companies_added === 0 && mode === "apply") {
    metrics.companies_added = Math.max(0, companies_after - companies_before)
  }

  metrics.promotion_rate_pct =
    metrics.candidates_discovered > 0
      ? Math.round((metrics.candidates_promoted / metrics.candidates_discovered) * 100)
      : 0

  messages.push(
    `discovered=${metrics.candidates_discovered} eligible=${metrics.candidates_eligible} promoted=${metrics.candidates_promoted}`,
  )
  messages.push(
    `companies_added=${metrics.companies_added} persons_promoted=${metrics.persons_promoted} promotion_rate=${metrics.promotion_rate_pct}%`,
  )

  const ok =
    metrics.candidates_promoted > 0 &&
    metrics.candidates_blocked <= metrics.candidates_discovered &&
    (metrics.companies_added > 0 || metrics.candidates_linked_existing > 0)

  return {
    qa_marker: GROWTH_CANONICAL_GRAPH_MATERIALIZATION_QA_MARKER,
    ok,
    metrics,
    promoted_companies,
    blocked_samples,
    messages,
  }
}
