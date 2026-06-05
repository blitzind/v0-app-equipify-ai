/**
 * Phase 7.PS-HA-FIX — Cold-account human acquisition pipeline (server-only).
 * runContactDiscoveryForCompany → contact_candidates → company_contacts → canonical persons.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { syncContactCandidatesToCompanyContacts } from "@/lib/growth/acquisition/sync-contact-candidates-to-company-contacts"
import { runCanonicalPersonBackfillForCompanyCandidate } from "@/lib/growth/canonical-persons/canonical-person-backfill"
import {
  loadContactDiscoverySnapshot,
  runContactDiscoveryForCompany,
} from "@/lib/growth/contact-discovery/contact-repository"
import { ensureStagingCanonicalCompanyLinkage } from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
import { fetchStagingCanonicalCompanyId } from "@/lib/growth/canonical-persons/canonical-person-repository-core"
import { refreshProspectSearchCompanyAfterHumanAcquisition } from "@/lib/growth/prospect-search/prospect-search-human-acquisition-hydration"
import { GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-human-acquisition-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export { GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER }
export {
  GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_HYDRATION_QA_MARKER,
  refreshProspectSearchCompanyAfterHumanAcquisition,
} from "@/lib/growth/prospect-search/prospect-search-human-acquisition-hydration"

export type ProspectSearchHumanAcquisitionResult = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER
  ok: boolean
  company_candidate_id: string
  canonical_company_id: string | null
  discovery_contacts: number
  company_contacts_synced: number
  backfill_rows_processed: number
  backfill_persons_linked: number
  message: string
  provider_messages: string[]
  refreshed_company?: GrowthProspectSearchCompanyResult | null
}

export async function runProspectSearchHumanAcquisitionPipeline(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    created_by?: string | null
    canonical_company_id?: string | null
    run_discovery?: boolean
    company_snapshot?: GrowthProspectSearchCompanyResult | null
    search_query?: string | null
  },
): Promise<ProspectSearchHumanAcquisitionResult> {
  const company_candidate_id = input.company_candidate_id.trim()
  if (!company_candidate_id) {
    return {
      qa_marker: GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER,
      ok: false,
      company_candidate_id: "",
      canonical_company_id: null,
      discovery_contacts: 0,
      company_contacts_synced: 0,
      backfill_rows_processed: 0,
      backfill_persons_linked: 0,
      message: "company_candidate_id is required.",
      provider_messages: [],
    }
  }

  let canonical_company_id =
    (input.canonical_company_id ?? "").trim() ||
    (await fetchStagingCanonicalCompanyId(admin, company_candidate_id))

  const provider_messages: string[] = []
  let discovery_contacts = 0

  if (input.run_discovery !== false) {
    const discovery = await runContactDiscoveryForCompany(admin, {
      company_candidate_id,
      created_by: input.created_by ?? null,
      limit: 20,
    })
    discovery_contacts = discovery.contacts?.length ?? 0
    provider_messages.push(...(discovery.provider_messages ?? []))
    if (!canonical_company_id) {
      canonical_company_id = await fetchStagingCanonicalCompanyId(admin, company_candidate_id)
    }
  } else {
    const snapshot = await loadContactDiscoverySnapshot(admin, company_candidate_id)
    discovery_contacts = snapshot.contacts?.length ?? 0
  }

  let company_contacts_synced = 0
  if (canonical_company_id && discovery_contacts > 0) {
    const snapshot = await loadContactDiscoverySnapshot(admin, company_candidate_id)
    company_contacts_synced = await syncContactCandidatesToCompanyContacts(admin, {
      company_id: canonical_company_id,
      candidates: snapshot.contacts,
    })
  }

  const backfill = await runCanonicalPersonBackfillForCompanyCandidate(admin, {
    company_candidate_id,
    canonical_company_id,
    mode: "apply",
  })

  const linkage = await ensureStagingCanonicalCompanyLinkage(admin, company_candidate_id, {
    explicit_canonical_company_id: canonical_company_id || null,
  })
  if (linkage.canonical_company_id) {
    canonical_company_id = linkage.canonical_company_id
  }

  const ok =
    discovery_contacts > 0 ||
    company_contacts_synced > 0 ||
    backfill.persons_linked > 0 ||
    backfill.rows_processed > 0

  let refreshed_company: GrowthProspectSearchCompanyResult | null = null
  if (input.company_snapshot) {
    refreshed_company = await refreshProspectSearchCompanyAfterHumanAcquisition(admin, {
      company: input.company_snapshot,
      canonical_company_id: canonical_company_id || null,
      query: input.search_query ?? null,
    })
  }

  return {
    qa_marker: GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER,
    ok,
    company_candidate_id,
    canonical_company_id: canonical_company_id || null,
    discovery_contacts,
    company_contacts_synced,
    backfill_rows_processed: backfill.rows_processed,
    backfill_persons_linked: backfill.persons_linked,
    message: ok
      ? `Human acquisition complete — ${discovery_contacts} discovered, ${backfill.persons_linked} canonical person(s) linked.`
      : "Human acquisition finished with no evidence-backed contacts — verify website and retry.",
    provider_messages,
    refreshed_company,
  }
}
