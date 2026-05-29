import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  createBulkAcquisitionRun,
  listAcquisitionCompanyCandidateIds,
  listCompaniesPendingContactDiscovery,
  loadBulkAcquisitionRun,
  markCompanyContactsProcessed,
  saveBulkAcquisitionRunState,
} from "@/lib/growth/acquisition/acquisition-repository"
import {
  GROWTH_BULK_ACQUISITION_COMPANIES_PER_TICK,
  GROWTH_BULK_ACQUISITION_PROMOTE_PER_TICK,
  GROWTH_BULK_ACQUISITION_QA_MARKER,
  GROWTH_BULK_ACQUISITION_VERIFY_PER_TICK,
  type GrowthBulkAcquisitionPhase,
  type GrowthBulkAcquisitionRun,
  type GrowthBulkAcquisitionTickResult,
} from "@/lib/growth/acquisition/acquisition-types"
import { promoteVerifiedContactsBatch } from "@/lib/growth/acquisition/promote-verified-contact-to-lead"
import {
  listContactCandidatesForCompany,
  syncContactCandidatesToCompanyContacts,
} from "@/lib/growth/acquisition/sync-contact-candidates-to-company-contacts"
import {
  listCompanyContactsPendingAcquisitionVerification,
  listVerifiedCompanyContactsReadyForPromotion,
  verifyCompanyContactForAcquisition,
} from "@/lib/growth/acquisition/verify-company-contact-for-acquisition"
import { isEmailReadyForLeadPromotion } from "@/lib/growth/contact-verification/email-verification-types"
import { runContactDiscoveryForCompany } from "@/lib/growth/contact-discovery/contact-repository"
import {
  buildLiveProviderDiscoveryQueries,
  planLiveProviderQueryBatches,
} from "@/lib/growth/real-world-discovery/live-provider-query-expansion"
import type { GrowthRealWorldDiscoverySearchInputs } from "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"
import { runRealWorldCompanyDiscovery } from "@/lib/growth/real-world-discovery/real-world-discovery-repository"

function resolveNextPhase(state: GrowthBulkAcquisitionRun["state"]): GrowthBulkAcquisitionPhase {
  const queries = state.use_fallback_queries ? state.query_plan.fallback : state.query_plan.primary
  if (state.query_index < queries.length) return "discover_companies"
  return state.phase === "discover_companies" ? "discover_contacts" : state.phase
}

function allQueriesExhausted(state: GrowthBulkAcquisitionRun["state"]): boolean {
  const primaryDone = state.query_index >= state.query_plan.primary.length
  if (!primaryDone) return false
  if (state.query_plan.fallback.length === 0) return true
  if (!state.use_fallback_queries) return false
  return state.query_index >= state.query_plan.primary.length + state.query_plan.fallback.length
}

function currentQuery(state: GrowthBulkAcquisitionRun["state"]): string | null {
  const combined = state.use_fallback_queries
    ? [...state.query_plan.primary, ...state.query_plan.fallback]
    : state.query_plan.primary
  return combined[state.query_index] ?? null
}

async function tickDiscoverCompanies(
  admin: SupabaseClient,
  run: GrowthBulkAcquisitionRun,
  createdBy?: string | null,
): Promise<{ run: GrowthBulkAcquisitionRun; actions: string[] }> {
  const actions: string[] = []
  const state = { ...run.state }
  const query = currentQuery(state)

  if (!query) {
    if (!state.use_fallback_queries && state.query_plan.fallback.length > 0) {
      state.use_fallback_queries = true
      actions.push("switched_to_fallback_queries")
    } else {
      state.phase = "discover_contacts"
      actions.push("company_discovery_complete")
    }
    const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "running" })
    return { run: saved ?? run, actions }
  }

  const discovery = await runRealWorldCompanyDiscovery(admin, {
    query,
    search_inputs: state.search_inputs,
    limit: state.limit_per_query,
    created_by: createdBy,
  })

  if (discovery.run?.id && !state.child_run_ids.includes(discovery.run.id)) {
    state.child_run_ids.push(discovery.run.id)
  }

  state.stats.companies_discovered += discovery.candidates.length
  state.query_index += 1

  if (discovery.candidates.length === 0 && !state.use_fallback_queries && state.query_index >= state.query_plan.primary.length) {
    state.use_fallback_queries = true
    actions.push("zero_results_switching_to_fallback")
  }

  if (allQueriesExhausted(state)) {
    state.phase = "discover_contacts"
    actions.push("company_discovery_complete")
  } else {
    state.phase = resolveNextPhase(state)
  }

  actions.push(`discovered_companies:${discovery.candidates.length}`)
  state.last_tick_at = new Date().toISOString()
  state.last_error = null

  const saved = await saveBulkAcquisitionRunState(admin, run.id, {
    state,
    status: "running",
    candidate_count: state.stats.companies_discovered,
  })

  logGrowthEngine("acquisition_tick_discover_companies", {
    runId: run.id,
    query,
    discovered: discovery.candidates.length,
  })

  return { run: saved ?? run, actions }
}

async function tickDiscoverContacts(
  admin: SupabaseClient,
  run: GrowthBulkAcquisitionRun,
  createdBy?: string | null,
): Promise<{ run: GrowthBulkAcquisitionRun; actions: string[] }> {
  const actions: string[] = []
  const state = { ...run.state }

  const pending = await listCompaniesPendingContactDiscovery(admin, {
    acquisition_run_id: run.id,
    child_run_ids: state.child_run_ids,
    limit: GROWTH_BULK_ACQUISITION_COMPANIES_PER_TICK,
  })

  if (pending.length === 0) {
    state.phase = "verify_contacts"
    actions.push("contact_discovery_complete")
    const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "running" })
    return { run: saved ?? run, actions }
  }

  for (const company of pending) {
    const snapshot = await runContactDiscoveryForCompany(admin, {
      company_candidate_id: company.id,
      created_by: createdBy,
    })

    state.stats.contact_candidates_stored += snapshot.contacts.length

    const candidates =
      snapshot.contacts.length > 0
        ? snapshot.contacts
        : await listContactCandidatesForCompany(admin, company.id)

    const synced = await syncContactCandidatesToCompanyContacts(admin, {
      company_id: company.id,
      candidates,
    })
    state.stats.company_contacts_synced += synced

    await markCompanyContactsProcessed(admin, {
      company_candidate_id: company.id,
      acquisition_run_id: run.id,
    })
    state.stats.companies_contacts_processed += 1
    actions.push(`contacts:${company.id}:${snapshot.contacts.length}`)
  }

  state.phase = "discover_contacts"
  state.last_tick_at = new Date().toISOString()
  state.last_error = null

  const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "running" })
  return { run: saved ?? run, actions }
}

async function tickVerifyContacts(
  admin: SupabaseClient,
  run: GrowthBulkAcquisitionRun,
): Promise<{ run: GrowthBulkAcquisitionRun; actions: string[] }> {
  const actions: string[] = []
  const state = { ...run.state }
  const companyIds = await listAcquisitionCompanyCandidateIds(admin, state.child_run_ids)

  const pending = await listCompanyContactsPendingAcquisitionVerification(admin, {
    company_ids: companyIds,
    limit: GROWTH_BULK_ACQUISITION_VERIFY_PER_TICK,
  })

  if (pending.length === 0) {
    state.phase = "promote_leads"
    actions.push("verification_complete")
    const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "running" })
    return { run: saved ?? run, actions }
  }

  let verified = 0
  for (const contact of pending) {
    const updated = await verifyCompanyContactForAcquisition(admin, contact.id)
    if (!updated) continue
    const emailVerification =
      updated.metadata.email_verification &&
      typeof updated.metadata.email_verification === "object"
        ? (updated.metadata.email_verification as {
            email_status?: string
            verified_by_provider?: boolean
          })
        : null
    if (
      emailVerification &&
      isEmailReadyForLeadPromotion({
        email_status: updated.email_status,
        verified_by_provider: emailVerification.verified_by_provider === true,
      })
    ) {
      verified += 1
    }
  }

  state.stats.contacts_verified += verified
  actions.push(`verified:${verified}`)
  state.last_tick_at = new Date().toISOString()

  const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "running" })
  return { run: saved ?? run, actions }
}

async function tickPromoteLeads(
  admin: SupabaseClient,
  run: GrowthBulkAcquisitionRun,
  createdBy?: string | null,
): Promise<{ run: GrowthBulkAcquisitionRun; actions: string[]; done: boolean }> {
  const actions: string[] = []
  const state = { ...run.state }
  const companyIds = await listAcquisitionCompanyCandidateIds(admin, state.child_run_ids)

  const ready = await listVerifiedCompanyContactsReadyForPromotion(admin, {
    company_ids: companyIds,
    limit: GROWTH_BULK_ACQUISITION_PROMOTE_PER_TICK,
  })

  if (ready.length === 0) {
    const queriesDone = allQueriesExhausted(state)
    const pendingCompanies = await listCompaniesPendingContactDiscovery(admin, {
      acquisition_run_id: run.id,
      child_run_ids: state.child_run_ids,
      limit: 1,
    })
    const pendingVerify = await listCompanyContactsPendingAcquisitionVerification(admin, {
      company_ids: companyIds,
      limit: 1,
    })

    if (queriesDone && pendingCompanies.length === 0 && pendingVerify.length === 0) {
      state.phase = "done"
      actions.push("acquisition_complete")
      const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "completed" })
      return { run: saved ?? run, actions, done: true }
    }

    if (!queriesDone) {
      state.phase = "discover_companies"
      actions.push("resume_company_discovery")
    } else if (pendingCompanies.length > 0) {
      state.phase = "discover_contacts"
      actions.push("resume_contact_discovery")
    } else if (pendingVerify.length > 0) {
      state.phase = "verify_contacts"
      actions.push("resume_verification")
    }

    const saved = await saveBulkAcquisitionRunState(admin, run.id, {
      state,
      status: pendingCompanies.length || pendingVerify.length || !queriesDone ? "running" : "completed",
    })
    return { run: saved ?? run, actions, done: state.phase === "done" }
  }

  const outcomes = await promoteVerifiedContactsBatch(admin, {
    contacts: ready,
    acquisitionRunId: run.id,
    createdBy,
  })

  for (const outcome of outcomes) {
    if (outcome.status === "created") state.stats.leads_created += 1
    if (outcome.status === "linked_duplicate") state.stats.leads_linked_duplicate += 1
    if (outcome.status === "suppressed") state.stats.leads_suppressed += 1
    if (outcome.status === "skipped") state.stats.leads_skipped += 1
    if (outcome.status === "error") state.stats.leads_error += 1
  }

  actions.push(`promoted:${outcomes.length}`)
  state.phase = "promote_leads"
  state.last_tick_at = new Date().toISOString()

  const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "running" })
  return { run: saved ?? run, actions, done: false }
}

export async function startBulkAcquisitionRun(
  admin: SupabaseClient,
  input: {
    search_inputs: GrowthRealWorldDiscoverySearchInputs
    created_by?: string | null
    limit_per_query?: number
  },
): Promise<GrowthBulkAcquisitionRun | null> {
  const plan = buildLiveProviderDiscoveryQueries(input.search_inputs)
  const batches = planLiveProviderQueryBatches(input.search_inputs)

  return createBulkAcquisitionRun(admin, {
    search_inputs: input.search_inputs,
    query_plan: batches,
    primary_query: plan.primary_query,
    created_by: input.created_by,
    limit_per_query: input.limit_per_query,
  })
}

export async function tickBulkAcquisitionRun(
  admin: SupabaseClient,
  runId: string,
  input?: { created_by?: string | null },
): Promise<GrowthBulkAcquisitionTickResult | null> {
  const run = await loadBulkAcquisitionRun(admin, runId)
  if (!run) return null
  if (run.state.phase === "done" || run.status === "completed") {
    return { run, phase: "done", tick_actions: ["already_complete"], done: true }
  }

  try {
    let result: { run: GrowthBulkAcquisitionRun; actions: string[]; done?: boolean }

    if (run.state.phase === "discover_companies") {
      result = await tickDiscoverCompanies(admin, run, input?.created_by)
    } else if (run.state.phase === "discover_contacts") {
      result = await tickDiscoverContacts(admin, run, input?.created_by)
    } else if (run.state.phase === "verify_contacts") {
      result = await tickVerifyContacts(admin, run)
    } else if (run.state.phase === "promote_leads") {
      result = await tickPromoteLeads(admin, run, input?.created_by)
    } else {
      return { run, phase: run.state.phase, tick_actions: ["unknown_phase"], done: true }
    }

    return {
      run: result.run,
      phase: result.run.state.phase,
      tick_actions: result.actions,
      done: result.done ?? result.run.state.phase === "done",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "tick_failed"
    const state = { ...run.state, last_error: message }
    const saved = await saveBulkAcquisitionRunState(admin, runId, { state, status: "partial" })
    logGrowthEngine("acquisition_tick_failed", { runId, message })
    return {
      run: saved ?? run,
      phase: state.phase,
      tick_actions: [`error:${message}`],
      done: false,
    }
  }
}

export function bulkAcquisitionMeta() {
  return {
    qa_marker: GROWTH_BULK_ACQUISITION_QA_MARKER,
    companies_per_tick: GROWTH_BULK_ACQUISITION_COMPANIES_PER_TICK,
    verify_per_tick: GROWTH_BULK_ACQUISITION_VERIFY_PER_TICK,
    promote_per_tick: GROWTH_BULK_ACQUISITION_PROMOTE_PER_TICK,
  }
}
