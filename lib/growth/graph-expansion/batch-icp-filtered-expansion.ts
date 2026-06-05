/** Phase 7.PS-IF — ICP-filtered batch graph expansion. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runBatchGraphExpansion } from "@/lib/growth/graph-expansion/batch-graph-expansion-orchestrator"
import { loadBatchIcpFilteredCohort } from "@/lib/growth/graph-expansion/batch-icp-filtered-cohort"
import {
  BATCH_ICP_PRIOR_WAVE_NAMED_PERSONS,
  GROWTH_BATCH_ICP_FILTERED_EXPANSION_QA_MARKER,
  type BatchIcpFilteredExpansionResult,
} from "@/lib/growth/graph-expansion/batch-icp-filter-types"

export async function runBatchIcpFilteredExpansion(
  admin: SupabaseClient,
  input: {
    wave_size?: number
    max_companies?: number
    scan_limit?: number
    include_anchors?: boolean
    dry_run?: boolean
    stop_after_wave?: boolean
  } = {},
): Promise<BatchIcpFilteredExpansionResult> {
  const wave_size = input.wave_size ?? 25
  const max_companies = Math.min(input.max_companies ?? 25, 25)

  const { cohort, diagnostics } = await loadBatchIcpFilteredCohort(admin, {
    limit: max_companies,
    scan_limit: input.scan_limit ?? 400,
    include_anchors: input.include_anchors ?? true,
    only_unenriched: true,
  })

  const messages: string[] = [
    `icp_qualified=${diagnostics.icp_qualified_count} off_icp_excluded=${diagnostics.off_icp_excluded_count}`,
  ]

  if (cohort.length === 0) {
    return {
      qa_marker: GROWTH_BATCH_ICP_FILTERED_EXPANSION_QA_MARKER,
      ok: false,
      cohort_diagnostics: diagnostics,
      expansion: {
        qa_marker: "growth-batch-graph-expansion-7-ps-ib-v1",
        ok: false,
        batch_id: "",
        resume_token: "",
        manifest: {
          batch_id: "",
          resume_token: "",
          status: "failed",
          wave_size,
          wave_index: 0,
          companies_total: 0,
          companies_queued: 0,
          companies_completed: 0,
          companies_failed: 0,
          companies_skipped: 0,
          last_company_id: null,
          failure_reasons: ["no_icp_qualified_cohort"],
          provider_counters: {
            website_fetches: 0,
            zerobounce_calls: 0,
            external_evidence_sources: 0,
            channel_completion_persons: 0,
          },
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          stopped: true,
        },
        wave_metrics: {
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
        },
        density_funnel: {
          before: {
            companies: 0,
            companies_with_contacts: 0,
            named_person_companies: 0,
            verified_channel_companies: 0,
            outreach_ready_companies: 0,
            total_named_persons: 0,
            total_verified_emails: 0,
            total_verified_phones: 0,
            generic_identities: 0,
          },
          after: {
            companies: 0,
            companies_with_contacts: 0,
            named_person_companies: 0,
            verified_channel_companies: 0,
            outreach_ready_companies: 0,
            total_named_persons: 0,
            total_verified_emails: 0,
            total_verified_phones: 0,
            generic_identities: 0,
          },
        },
        company_results: [],
        messages: ["no_icp_qualified_cohort"],
      },
      prior_wave_named_persons: BATCH_ICP_PRIOR_WAVE_NAMED_PERSONS,
      named_person_yield_delta: 0,
      messages: [...messages, "no_icp_qualified_cohort"],
    }
  }

  const expansion = await runBatchGraphExpansion(admin, {
    wave_size,
    max_companies,
    cohort_override: cohort,
    include_anchors: false,
    dry_run: input.dry_run,
    stop_after_wave: input.stop_after_wave ?? true,
  })

  const named_after = expansion.density_funnel.after.total_named_persons
  const named_person_yield_delta = named_after - BATCH_ICP_PRIOR_WAVE_NAMED_PERSONS

  return {
    qa_marker: GROWTH_BATCH_ICP_FILTERED_EXPANSION_QA_MARKER,
    ok: expansion.ok && diagnostics.icp_qualified_count > 0,
    cohort_diagnostics: diagnostics,
    expansion,
    prior_wave_named_persons: BATCH_ICP_PRIOR_WAVE_NAMED_PERSONS,
    named_person_yield_delta,
    messages: [
      ...messages,
      `batch_processed=${expansion.wave_metrics.companies_processed} named+${expansion.wave_metrics.named_persons_added}`,
    ],
  }
}
