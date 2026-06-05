/** Phase 7.PS-IG — Service-shop targeted batch expansion. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runBatchGraphExpansion } from "@/lib/growth/graph-expansion/batch-graph-expansion-orchestrator"
import { loadServiceShopCohort } from "@/lib/growth/graph-expansion/service-shop-cohort"
import {
  GROWTH_SERVICE_SHOP_EXPANSION_QA_MARKER,
  SERVICE_SHOP_PRIOR_WAVE_NAMED_PERSONS,
  type ServiceShopExpansionResult,
  type ServiceShopSourceContribution,
} from "@/lib/growth/graph-expansion/service-shop-expansion-types"
import { isGenericIdentityName } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function runBatchServiceShopExpansion(
  admin: SupabaseClient,
  input: {
    wave_size?: number
    max_companies?: number
    scan_limit?: number
    include_anchors?: boolean
    dry_run?: boolean
    stop_after_wave?: boolean
  } = {},
): Promise<ServiceShopExpansionResult> {
  const wave_size = input.wave_size ?? 25
  const max_companies = Math.min(input.max_companies ?? 25, 25)

  const { cohort, diagnostics } = await loadServiceShopCohort(admin, {
    limit: max_companies,
    scan_limit: input.scan_limit ?? 500,
    include_anchors: input.include_anchors ?? true,
    min_score: 20,
  })

  const messages: string[] = [
    `service_shop_selected=${diagnostics.companies_selected} down_ranked_excluded=${diagnostics.down_ranked_excluded}`,
    `score_distribution high=${diagnostics.score_distribution.high} medium=${diagnostics.score_distribution.medium} low=${diagnostics.score_distribution.low}`,
  ]

  if (cohort.length === 0) {
    return {
      qa_marker: GROWTH_SERVICE_SHOP_EXPANSION_QA_MARKER,
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
          failure_reasons: ["no_service_shop_cohort"],
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
        messages: ["no_service_shop_cohort"],
      },
      prior_wave_named_persons: SERVICE_SHOP_PRIOR_WAVE_NAMED_PERSONS,
      named_person_yield_delta: 0,
      names_discovered: [],
      titles_discovered: [],
      source_contribution: [],
      messages: [...messages, "no_service_shop_cohort"],
    }
  }

  const expansion = await runBatchGraphExpansion(admin, {
    wave_size,
    max_companies,
    cohort_override: cohort,
    expansion_profile: "service_shop",
    include_anchors: false,
    dry_run: input.dry_run,
    stop_after_wave: input.stop_after_wave ?? true,
  })

  const companyIds = cohort.map((c) => c.canonical_company_id)
  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("full_name, title, metadata")
    .in("company_id", companyIds)
    .neq("contact_status", "archived")

  const names_discovered: string[] = []
  const titles_discovered: string[] = []
  for (const row of contacts ?? []) {
    const full_name = asString((row as Record<string, unknown>).full_name)
    const title = asString((row as Record<string, unknown>).title)
    if (full_name && !isGenericIdentityName(full_name) && !names_discovered.includes(full_name)) {
      names_discovered.push(full_name)
    }
    if (title && !titles_discovered.includes(title)) titles_discovered.push(title)
  }

  const source_contribution: ServiceShopSourceContribution[] = []
  for (const result of expansion.company_results) {
    for (const message of result.messages) {
      const match = message.match(/external_evidence: records=(\d+) names=(\d+)/)
      if (!match) continue
      source_contribution.push({
        source_type: "service_shop_external",
        records_matched: Number.parseInt(match[1] ?? "0", 10),
        names_discovered: Number.parseInt(match[2] ?? "0", 10),
      })
    }
  }

  const named_after = expansion.density_funnel.after.total_named_persons
  const named_person_yield_delta = named_after - SERVICE_SHOP_PRIOR_WAVE_NAMED_PERSONS

  return {
    qa_marker: GROWTH_SERVICE_SHOP_EXPANSION_QA_MARKER,
    ok: expansion.ok && diagnostics.companies_selected > 0,
    cohort_diagnostics: diagnostics,
    expansion,
    prior_wave_named_persons: SERVICE_SHOP_PRIOR_WAVE_NAMED_PERSONS,
    named_person_yield_delta,
    names_discovered,
    titles_discovered,
    source_contribution,
    messages: [
      ...messages,
      `batch_processed=${expansion.wave_metrics.companies_processed} named+${expansion.wave_metrics.named_persons_added}`,
    ],
  }
}
