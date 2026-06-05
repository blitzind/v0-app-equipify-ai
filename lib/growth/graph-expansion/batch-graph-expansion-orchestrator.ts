/** Phase 7.PS-IB — Batch graph expansion orchestrator. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runBatchGraphExpansionForCompany } from "@/lib/growth/graph-expansion/batch-graph-expansion-company"
import {
  chunkBatchGraphExpansionCohort,
  loadBatchGraphExpansionCohort,
} from "@/lib/growth/graph-expansion/batch-graph-expansion-cohort"
import { loadBatchGraphExpansionDensityFunnel } from "@/lib/growth/graph-expansion/batch-graph-expansion-density"
import {
  createInitialBatchGraphExpansionManifest,
  enqueueBatchGraphExpansionCompanies,
  loadBatchGraphExpansionManifest,
  loadPendingBatchGraphExpansionCompanies,
  parseBatchGraphExpansionResumeToken,
  persistBatchGraphExpansionManifest,
  updateBatchGraphExpansionCompanyQueue,
} from "@/lib/growth/graph-expansion/batch-graph-expansion-queue"
import {
  DEFAULT_BATCH_GRAPH_EXPANSION_MAX_FETCH_ERRORS_PER_WAVE,
  DEFAULT_BATCH_GRAPH_EXPANSION_MAX_PROVIDER_CALLS_PER_WAVE,
  DEFAULT_BATCH_GRAPH_EXPANSION_WAVE_SIZE,
  GROWTH_BATCH_GRAPH_EXPANSION_QA_MARKER,
  type BatchGraphExpansionCohortCompany,
  type BatchGraphExpansionResult,
  type BatchGraphExpansionWaveMetrics,
} from "@/lib/growth/graph-expansion/batch-graph-expansion-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function emptyWaveMetrics(): BatchGraphExpansionWaveMetrics {
  return {
    companies_processed: 0,
    companies_succeeded: 0,
    companies_failed: 0,
    contacts_discovered: 0,
    named_persons_added: 0,
    titles_added: 0,
    verified_emails_added: 0,
    verified_phones_added: 0,
    generic_shells_contained: 0,
    outreach_ready_delta: 0,
    runtime_ms: 0,
    fetch_errors: 0,
    provider_counters: {
      website_fetches: 0,
      zerobounce_calls: 0,
      external_evidence_sources: 0,
      channel_completion_persons: 0,
    },
  }
}

function companyById(
  cohort: BatchGraphExpansionCohortCompany[],
): Map<string, BatchGraphExpansionCohortCompany> {
  return new Map(cohort.map((company) => [company.canonical_company_id, company]))
}

export async function runBatchGraphExpansion(
  admin: SupabaseClient,
  input: {
    batch_id?: string
    resume_token?: string | null
    wave_size?: number
    max_companies?: number
    cohort_limit?: number
    include_anchors?: boolean
    cohort_override?: BatchGraphExpansionCohortCompany[]
    dry_run?: boolean
    stop_after_wave?: boolean
  } = {},
): Promise<BatchGraphExpansionResult> {
  const started = Date.now()
  const messages: string[] = []
  const wave_metrics = emptyWaveMetrics()
  const company_results: BatchGraphExpansionResult["company_results"] = []

  const wave_size = input.wave_size ?? DEFAULT_BATCH_GRAPH_EXPANSION_WAVE_SIZE
  const max_companies = input.max_companies ?? wave_size

  let batch_id = input.batch_id ?? null
  let wave_index = 0
  if (input.resume_token) {
    const parsed = parseBatchGraphExpansionResumeToken(input.resume_token)
    if (parsed) {
      batch_id = parsed.batch_id
      wave_index = parsed.wave_index
    }
  }

  const fullCohort =
    input.cohort_override ??
    (await loadBatchGraphExpansionCohort(admin, {
      limit: input.cohort_limit ?? 250,
      include_anchors: input.include_anchors,
      only_unenriched: true,
    }))

  let manifest =
    (batch_id ? await loadBatchGraphExpansionManifest(admin, batch_id) : null) ??
    createInitialBatchGraphExpansionManifest({
      batch_id: batch_id ?? undefined,
      wave_size,
      companies_total: fullCohort.length,
    })

  batch_id = manifest.batch_id
  manifest.wave_size = wave_size
  manifest.companies_total = fullCohort.length
  manifest.status = "running"
  manifest.wave_index = wave_index

  const waves = chunkBatchGraphExpansionCohort(fullCohort, wave_size)
  const currentWave = waves[wave_index] ?? []
  const waveCompanies = currentWave.slice(0, max_companies)
  const companyIds = waveCompanies.map((c) => c.canonical_company_id)

  const density_before = await loadBatchGraphExpansionDensityFunnel(admin, companyIds)

  if (!input.dry_run && waveCompanies.length > 0) {
    manifest.companies_queued += await enqueueBatchGraphExpansionCompanies(admin, {
      batch_id,
      companies: waveCompanies,
    })
    await persistBatchGraphExpansionManifest(admin, manifest)
  }

  const cohortMap = companyById(fullCohort)
  const pending =
    input.dry_run
      ? waveCompanies.map((company) => ({
          queue_id: `dry-${company.canonical_company_id}`,
          canonical_company_id: company.canonical_company_id,
          status: "pending" as const,
        }))
      : await loadPendingBatchGraphExpansionCompanies(admin, {
          batch_id,
          limit: max_companies,
        })

  const outreach_before = density_before.outreach_ready_companies

  for (const queueRow of pending) {
    if (manifest.stopped) break
    if (wave_metrics.fetch_errors >= DEFAULT_BATCH_GRAPH_EXPANSION_MAX_FETCH_ERRORS_PER_WAVE) {
      manifest.stopped = true
      manifest.failure_reasons.push("fetch_error_cap_reached")
      break
    }
    if (
      wave_metrics.provider_counters.zerobounce_calls +
        wave_metrics.provider_counters.website_fetches >=
      DEFAULT_BATCH_GRAPH_EXPANSION_MAX_PROVIDER_CALLS_PER_WAVE
    ) {
      manifest.stopped = true
      manifest.failure_reasons.push("provider_call_cap_reached")
      break
    }

    const company = cohortMap.get(queueRow.canonical_company_id)
    if (!company) {
      manifest.companies_skipped += 1
      continue
    }

    wave_metrics.companies_processed += 1
    manifest.last_company_id = company.canonical_company_id

    if (!input.dry_run) {
      await updateBatchGraphExpansionCompanyQueue(admin, {
        queue_id: queueRow.queue_id,
        status: "running",
      })
    }

    const result = input.dry_run
      ? {
          ok: true,
          metrics: {
            contacts_discovered: 0,
            named_persons_added: 0,
            titles_added: 0,
            verified_emails_added: 0,
            verified_phones_added: 0,
            generic_shells_contained: 0,
            corroborated_persons: 0,
            runtime_ms: 0,
            fetch_errors: 0,
            failure_reason: null,
          },
          messages: ["dry_run"],
        }
      : await runBatchGraphExpansionForCompany(admin, {
          company,
          provider_counters: wave_metrics.provider_counters,
        })

    company_results.push({
      company_name: company.company_name,
      canonical_company_id: company.canonical_company_id,
      status: result.ok ? "completed" : "failed",
      metrics: result.metrics,
      messages: result.messages,
    })

    wave_metrics.contacts_discovered += result.metrics.contacts_discovered
    wave_metrics.named_persons_added += result.metrics.named_persons_added
    wave_metrics.titles_added += result.metrics.titles_added
    wave_metrics.verified_emails_added += result.metrics.verified_emails_added
    wave_metrics.verified_phones_added += result.metrics.verified_phones_added
    wave_metrics.fetch_errors += result.metrics.fetch_errors

    if (result.ok) {
      wave_metrics.companies_succeeded += 1
      manifest.companies_completed += 1
    } else {
      wave_metrics.companies_failed += 1
      manifest.companies_failed += 1
      if (result.metrics.failure_reason) {
        manifest.failure_reasons.push(`${company.company_name}: ${result.metrics.failure_reason}`)
      }
    }

    if (!input.dry_run) {
      await updateBatchGraphExpansionCompanyQueue(admin, {
        queue_id: queueRow.queue_id,
        status: result.ok ? "completed" : "failed",
        failure_reason: result.metrics.failure_reason,
      })
      await persistBatchGraphExpansionManifest(admin, manifest)
    }

    messages.push(
      `${company.company_name}: ok=${result.ok} contacts+${result.metrics.contacts_discovered} named+${result.metrics.named_persons_added}`,
    )
  }

  const density_after = await loadBatchGraphExpansionDensityFunnel(admin, companyIds)
  wave_metrics.outreach_ready_delta =
    density_after.outreach_ready_companies - outreach_before
  wave_metrics.runtime_ms = Date.now() - started
  wave_metrics.provider_counters = { ...manifest.provider_counters, ...wave_metrics.provider_counters }
  manifest.provider_counters = wave_metrics.provider_counters

  const waveComplete =
    manifest.companies_completed + manifest.companies_failed >= manifest.companies_queued ||
    input.stop_after_wave !== false

  if (waveComplete && !manifest.stopped) {
    manifest.status = wave_index + 1 < waves.length ? "paused" : "completed"
    manifest.wave_index = Math.min(wave_index + 1, waves.length)
  } else if (manifest.stopped) {
    manifest.status = "paused"
  }

  if (!input.dry_run) {
    await persistBatchGraphExpansionManifest(admin, manifest)
  }

  const enrichment_improved =
    wave_metrics.contacts_discovered > 0 ||
    wave_metrics.named_persons_added > 0 ||
    density_after.companies_with_contacts > density_before.companies_with_contacts

  return {
    qa_marker: GROWTH_BATCH_GRAPH_EXPANSION_QA_MARKER,
    ok: wave_metrics.companies_processed > 0 && (enrichment_improved || wave_metrics.companies_succeeded > 0),
    batch_id,
    resume_token: manifest.resume_token,
    manifest,
    wave_metrics,
    density_funnel: {
      before: density_before,
      after: density_after,
    },
    company_results,
    messages: messages.slice(0, 30),
  }
}
