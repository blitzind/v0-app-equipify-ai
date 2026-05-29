import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  applyAcquisitionTickFailureToState,
  buildFailedAcquisitionTickLogEntry,
  clearAcquisitionDiagnosticsFields,
  getAcquisitionDiagnosticContext,
  logAcquisitionStep,
  logAcquisitionTickFailure,
  withAcquisitionDiagnosticContext,
} from "@/lib/growth/acquisition/acquisition-diagnostics"
import {
  acquisitionQueryDedupeKey,
  buildAcquisitionGeoTiles,
  currentAcquisitionGeoTile,
} from "@/lib/growth/acquisition/acquisition-geographic-expansion"
import {
  allQueriesExhaustedForTile,
  currentAcquisitionQuery,
  discoveryComplete,
  repairAcquisitionRunPhase,
  resolveNextPhase,
} from "@/lib/growth/acquisition/acquisition-query-phase"
import {
  createBulkAcquisitionRun,
  listCompaniesPendingContactDiscovery,
  loadAcquisitionDedupeHashes,
  loadBulkAcquisitionRun,
  markCompanyContactsProcessed,
  saveBulkAcquisitionRunState,
} from "@/lib/growth/acquisition/acquisition-repository"
import {
  GROWTH_BULK_ACQUISITION_COMPANIES_PER_TICK,
  GROWTH_BULK_ACQUISITION_PROMOTE_PER_TICK,
  GROWTH_BULK_ACQUISITION_QA_MARKER,
  GROWTH_BULK_ACQUISITION_TICK_LOG_MAX,
  GROWTH_BULK_ACQUISITION_VERIFY_PER_TICK,
  GROWTH_BULK_ACQUISITION_ZERO_DISCOVERY_STOP,
  type GrowthBulkAcquisitionRun,
  type GrowthBulkAcquisitionTickResult,
  type GrowthBulkAcquisitionTickLogEntry,
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

function rebuildQueryPlanForCurrentTile(
  state: GrowthBulkAcquisitionRun["state"],
): GrowthBulkAcquisitionRun["state"] {
  const tile = currentAcquisitionGeoTile(state.geo_tiles, state.geo_tile_index)
  if (!tile) return state

  const searchInputs: GrowthRealWorldDiscoverySearchInputs = {
    ...state.search_inputs,
    location: tile,
  }
  const batches = planLiveProviderQueryBatches(searchInputs)

  return {
    ...state,
    search_inputs: searchInputs,
    query_plan: batches,
    query_index: 0,
    use_fallback_queries: false,
  }
}

function advanceGeoTile(state: GrowthBulkAcquisitionRun["state"]): GrowthBulkAcquisitionRun["state"] {
  const nextIndex = state.geo_tile_index + 1
  if (nextIndex >= state.geo_tiles.length) {
    return { ...state, geo_tile_index: nextIndex, discovery_exhausted: true }
  }
  return rebuildQueryPlanForCurrentTile({ ...state, geo_tile_index: nextIndex })
}

function markDiscoveryExhausted(state: GrowthBulkAcquisitionRun["state"]): GrowthBulkAcquisitionRun["state"] {
  return {
    ...state,
    discovery_exhausted: true,
    phase: "discover_contacts",
  }
}

function appendTickLog(
  state: GrowthBulkAcquisitionRun["state"],
  entry: GrowthBulkAcquisitionTickLogEntry,
): GrowthBulkAcquisitionRun["state"] {
  return {
    ...state,
    last_tick: entry,
    recent_ticks: [entry, ...(state.recent_ticks ?? [])].slice(0, GROWTH_BULK_ACQUISITION_TICK_LOG_MAX),
  }
}

function countNetNewCompanies(
  candidates: Array<{ dedupe_hash?: string }>,
  knownHashes: Set<string>,
): number {
  let netNew = 0
  for (const candidate of candidates) {
    const hash = typeof candidate.dedupe_hash === "string" ? candidate.dedupe_hash.trim() : ""
    if (!hash || knownHashes.has(hash)) continue
    knownHashes.add(hash)
    netNew += 1
  }
  return netNew
}

async function tickDiscoverCompanies(
  admin: SupabaseClient,
  run: GrowthBulkAcquisitionRun,
  createdBy?: string | null,
): Promise<{ run: GrowthBulkAcquisitionRun; actions: string[] }> {
  const actions: string[] = []
  let state = { ...run.state }

  if (discoveryComplete(state)) {
    state.phase = "discover_contacts"
    actions.push("company_discovery_complete")
    const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "running" })
    return { run: saved ?? run, actions }
  }

  if (state.geo_tiles.length === 0) {
    state.geo_tiles = buildAcquisitionGeoTiles(state.search_inputs.location).map((tile) => tile.label)
    state = rebuildQueryPlanForCurrentTile(state)
    actions.push(`geo_tiles_initialized:${state.geo_tiles.length}`)
  }

  let query = currentAcquisitionQuery(state)
  const tileLabel = currentAcquisitionGeoTile(state.geo_tiles, state.geo_tile_index) ?? ""

  while (query) {
    const dedupeKey = acquisitionQueryDedupeKey(tileLabel, query)
    if (state.executed_query_keys.includes(dedupeKey)) {
      state.query_index += 1
      query = currentAcquisitionQuery(state)
      continue
    }
    break
  }

  if (!query) {
    if (!allQueriesExhaustedForTile(state)) {
      if (!state.use_fallback_queries && state.query_plan.fallback.length > 0) {
        state.use_fallback_queries = true
        actions.push("switched_to_fallback_queries")
        query = currentAcquisitionQuery(state)
      }
    }
  }

  if (!query) {
    if (state.geo_tile_index + 1 < state.geo_tiles.length) {
      state = advanceGeoTile(state)
      actions.push(`advanced_geo_tile:${state.geo_tile_index}`)
      const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "running" })
      return { run: saved ?? run, actions }
    }

    state = markDiscoveryExhausted(state)
    actions.push("company_discovery_complete")
    const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "running" })
    return { run: saved ?? run, actions }
  }

  const dedupeKey = acquisitionQueryDedupeKey(tileLabel, query)
  const knownHashes = await loadAcquisitionDedupeHashes(admin, state.child_run_ids)

  const discovery = await runRealWorldCompanyDiscovery(admin, {
    query,
    search_inputs: state.search_inputs,
    limit: state.limit_per_query,
    created_by: createdBy,
  })

  if (discovery.provider_status?.label === "provider_quota_rate_limited") {
    state.metrics.provider_errors += 1
  } else if (
    discovery.provider_status?.provider_diagnostics?.some(
      (diag) => diag.provider_executed && diag.provider_result_count === 0,
    )
  ) {
    state.metrics.provider_errors += 1
  }

  if (discovery.run?.id && !state.child_run_ids.includes(discovery.run.id)) {
    state.child_run_ids.push(discovery.run.id)
  }

  const netNew = countNetNewCompanies(discovery.candidates, knownHashes)
  state.stats.companies_discovered += netNew
  state.executed_query_keys = [...state.executed_query_keys, dedupeKey]
  state.query_index += 1

  if (netNew === 0) {
    state.consecutive_zero_discovery += 1
  } else {
    state.consecutive_zero_discovery = 0
  }

  if (
    state.target_company_count != null &&
    state.stats.companies_discovered >= state.target_company_count
  ) {
    state = markDiscoveryExhausted(state)
    actions.push("target_company_count_reached")
  } else if (state.consecutive_zero_discovery >= GROWTH_BULK_ACQUISITION_ZERO_DISCOVERY_STOP) {
    state = markDiscoveryExhausted(state)
    actions.push("provider_exhaustion_reached")
  } else if (netNew === 0 && !state.use_fallback_queries && state.query_index >= state.query_plan.primary.length) {
    state.use_fallback_queries = true
    actions.push("zero_results_switching_to_fallback")
  } else if (allQueriesExhaustedForTile(state)) {
    if (state.geo_tile_index + 1 < state.geo_tiles.length) {
      state = advanceGeoTile(state)
      actions.push(`advanced_geo_tile:${state.geo_tile_index}`)
    } else {
      state = markDiscoveryExhausted(state)
      actions.push("company_discovery_complete")
    }
  } else {
    state.phase = resolveNextPhase(state)
  }

  actions.push(`discovered_companies:${netNew}`)
  state.last_tick_at = new Date().toISOString()
  Object.assign(state, clearAcquisitionDiagnosticsFields())

  const saved = await saveBulkAcquisitionRunState(admin, run.id, {
    state,
    status: "running",
    candidate_count: state.stats.companies_discovered,
  })

  logGrowthEngine("acquisition_tick_discover_companies", {
    runId: run.id,
    query,
    tile: tileLabel,
    discovered: netNew,
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

  logAcquisitionStep("tickDiscoverContacts", {
    runId: run.id,
    phase: run.state.phase,
    child_run_ids: state.child_run_ids.length,
    contact_discovery_cursor: state.contact_discovery_cursor,
  })

  const scan = await listCompaniesPendingContactDiscovery(admin, {
    acquisition_run_id: run.id,
    child_run_ids: state.child_run_ids,
    limit: GROWTH_BULK_ACQUISITION_COMPANIES_PER_TICK,
    cursor: state.contact_discovery_cursor,
  })

  state.contact_discovery_cursor = scan.cursor
  state.contact_discovery_exhausted = scan.exhausted

  if (scan.companies.length === 0) {
    if (scan.exhausted) {
      state.phase = "verify_contacts"
      actions.push("contact_discovery_complete")
    } else {
      state.phase = "discover_contacts"
      actions.push("contact_discovery_scan_continue")
    }
    const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "running" })
    return { run: saved ?? run, actions }
  }

  for (const company of scan.companies) {
    const snapshot = await withAcquisitionDiagnosticContext(
      {
        runId: run.id,
        phase: run.state.phase,
        action: "runContactDiscoveryForCompany",
        companyId: company.id,
      },
      () =>
        runContactDiscoveryForCompany(admin, {
          company_candidate_id: company.id,
          created_by: createdBy,
        }),
    )

    state.stats.contact_candidates_stored += snapshot.contacts.length
    state.metrics.contacts_discovered += snapshot.contacts.length

    const candidates =
      snapshot.contacts.length > 0
        ? snapshot.contacts
        : await withAcquisitionDiagnosticContext(
            {
              runId: run.id,
              phase: run.state.phase,
              action: "listContactCandidatesForCompany",
              companyId: company.id,
            },
            () => listContactCandidatesForCompany(admin, company.id),
          )

    const synced = await withAcquisitionDiagnosticContext(
      {
        runId: run.id,
        phase: run.state.phase,
        action: "syncContactCandidatesToCompanyContacts",
        companyId: company.id,
      },
      () =>
        syncContactCandidatesToCompanyContacts(admin, {
          company_id: company.id,
          candidates,
        }),
    )
    state.stats.company_contacts_synced += synced

    await withAcquisitionDiagnosticContext(
      {
        runId: run.id,
        phase: run.state.phase,
        action: "markCompanyContactsProcessed",
        companyId: company.id,
      },
      () =>
        markCompanyContactsProcessed(admin, {
          company_candidate_id: company.id,
          acquisition_run_id: run.id,
        }),
    )
    state.stats.companies_contacts_processed += 1
    actions.push(`contacts:${company.id}:${snapshot.contacts.length}`)
  }

  state.phase = "discover_contacts"
  state.last_tick_at = new Date().toISOString()
  Object.assign(state, clearAcquisitionDiagnosticsFields())

  const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "running" })
  return { run: saved ?? run, actions }
}

async function tickVerifyContacts(
  admin: SupabaseClient,
  run: GrowthBulkAcquisitionRun,
): Promise<{ run: GrowthBulkAcquisitionRun; actions: string[] }> {
  const actions: string[] = []
  const state = { ...run.state }

  const scan = await listCompanyContactsPendingAcquisitionVerification(admin, {
    child_run_ids: state.child_run_ids,
    limit: GROWTH_BULK_ACQUISITION_VERIFY_PER_TICK,
    company_scan_cursor: state.verify_company_scan_cursor,
  })

  state.verify_company_scan_cursor = scan.company_scan_cursor

  if (scan.contacts.length === 0) {
    if (scan.exhausted) {
      state.phase = "promote_leads"
      actions.push("verification_complete")
    } else {
      state.phase = "verify_contacts"
      actions.push("verification_scan_continue")
    }
    const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "running" })
    return { run: saved ?? run, actions }
  }

  let verified = 0
  for (const contact of scan.contacts) {
    state.metrics.emails_verification_attempted += 1
    const updated = await withAcquisitionDiagnosticContext(
      {
        runId: run.id,
        phase: run.state.phase,
        action: "verifyCompanyContactForAcquisition",
        contactId: contact.id,
        companyId: contact.company_id,
      },
      () => verifyCompanyContactForAcquisition(admin, contact.id),
    )
    if (!updated) {
      state.metrics.verification_failures += 1
      continue
    }
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
      state.metrics.emails_verified += 1
    } else {
      state.metrics.verification_failures += 1
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

  const scan = await listVerifiedCompanyContactsReadyForPromotion(admin, {
    child_run_ids: state.child_run_ids,
    limit: GROWTH_BULK_ACQUISITION_PROMOTE_PER_TICK,
    company_scan_cursor: state.promote_company_scan_cursor,
  })

  state.promote_company_scan_cursor = scan.company_scan_cursor

  if (scan.contacts.length === 0) {
    if (!scan.exhausted) {
      state.phase = "promote_leads"
      actions.push("promotion_scan_continue")
      const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "running" })
      return { run: saved ?? run, actions, done: false }
    }

    const queriesDone = discoveryComplete(state)
    const pendingCompanies = await listCompaniesPendingContactDiscovery(admin, {
      acquisition_run_id: run.id,
      child_run_ids: state.child_run_ids,
      limit: 1,
      cursor: state.contact_discovery_cursor,
    })
    const pendingVerify = await listCompanyContactsPendingAcquisitionVerification(admin, {
      child_run_ids: state.child_run_ids,
      limit: 1,
      company_scan_cursor: state.verify_company_scan_cursor,
    })

    if (
      queriesDone &&
      pendingCompanies.companies.length === 0 &&
      pendingCompanies.exhausted &&
      pendingVerify.contacts.length === 0 &&
      pendingVerify.exhausted
    ) {
      state.phase = "done"
      actions.push("acquisition_complete")
      const saved = await saveBulkAcquisitionRunState(admin, run.id, { state, status: "completed" })
      return { run: saved ?? run, actions, done: true }
    }

    if (!queriesDone) {
      state.phase = "discover_companies"
      actions.push("resume_company_discovery")
    } else if (pendingCompanies.companies.length > 0) {
      state.phase = "discover_contacts"
      actions.push("resume_contact_discovery")
    } else if (pendingVerify.contacts.length > 0) {
      state.phase = "verify_contacts"
      actions.push("resume_verification")
    }

    const saved = await saveBulkAcquisitionRunState(admin, run.id, {
      state,
      status:
        pendingCompanies.companies.length || pendingVerify.contacts.length || !queriesDone
          ? "running"
          : "completed",
    })
    return { run: saved ?? run, actions, done: state.phase === "done" }
  }

  const outcomes = await withAcquisitionDiagnosticContext(
    {
      runId: run.id,
      phase: run.state.phase,
      action: "promoteVerifiedContactsBatch",
    },
    () =>
      promoteVerifiedContactsBatch(admin, {
        contacts: scan.contacts,
        acquisitionRunId: run.id,
        createdBy,
      }),
  )

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
    target_company_count?: number | null
  },
): Promise<GrowthBulkAcquisitionRun | null> {
  const geoTiles = buildAcquisitionGeoTiles(input.search_inputs.location).map((tile) => tile.label)
  const firstTile = geoTiles[0] ?? input.search_inputs.location ?? "United States"
  const tileInputs: GrowthRealWorldDiscoverySearchInputs = {
    ...input.search_inputs,
    location: firstTile,
  }

  const plan = buildLiveProviderDiscoveryQueries(tileInputs)
  const batches = planLiveProviderQueryBatches(tileInputs)

  return createBulkAcquisitionRun(admin, {
    search_inputs: tileInputs,
    query_plan: batches,
    primary_query: plan.primary_query,
    created_by: input.created_by,
    limit_per_query: input.limit_per_query,
    geo_tiles: geoTiles,
    target_company_count: input.target_company_count ?? null,
  })
}

export async function tickBulkAcquisitionRun(
  admin: SupabaseClient,
  runId: string,
  input?: { created_by?: string | null },
): Promise<GrowthBulkAcquisitionTickResult | null> {
  const loaded = await loadBulkAcquisitionRun(admin, runId)
  if (!loaded) return null

  const repairedState = repairAcquisitionRunPhase(loaded.state)
  if (repairedState.phase !== loaded.state.phase) {
    logGrowthEngine("acquisition_run_phase_repaired", {
      runId,
      from: loaded.state.phase,
      to: repairedState.phase,
      query_index: repairedState.query_index,
      use_fallback_queries: repairedState.use_fallback_queries,
      fallback_queries: repairedState.query_plan.fallback.length,
    })
  }
  const run =
    repairedState.phase !== loaded.state.phase
      ? (await saveBulkAcquisitionRunState(admin, runId, {
          state: repairedState,
          status: loaded.status === "partial" ? "running" : loaded.status,
        })) ?? { ...loaded, state: repairedState }
      : loaded

  if (run.state.phase === "done" || run.status === "completed") {
    return {
      run,
      phase: "done",
      tick_actions: ["already_complete"],
      done: true,
      tick_duration_ms: 0,
    }
  }
  if (run.state.paused) {
    return {
      run,
      phase: run.state.phase,
      tick_actions: ["paused"],
      done: false,
      tick_duration_ms: 0,
    }
  }

  const tickStartedMs = Date.now()

  try {
    if (
      run.state.phase !== "discover_companies" &&
      run.state.phase !== "discover_contacts" &&
      run.state.phase !== "verify_contacts" &&
      run.state.phase !== "promote_leads"
    ) {
      return {
        run,
        phase: run.state.phase,
        tick_actions: ["unknown_phase"],
        done: true,
        tick_duration_ms: 0,
      }
    }

    const result = await withAcquisitionDiagnosticContext(
      { runId, phase: run.state.phase, action: `tick:${run.state.phase}` },
      async () => {
        if (run.state.phase === "discover_companies") {
          return await tickDiscoverCompanies(admin, run, input?.created_by)
        }
        if (run.state.phase === "discover_contacts") {
          return await tickDiscoverContacts(admin, run, input?.created_by)
        }
        if (run.state.phase === "verify_contacts") {
          return await tickVerifyContacts(admin, run)
        }
        return await tickPromoteLeads(admin, run, input?.created_by)
      },
    )

    const tickDurationMs = Date.now() - tickStartedMs
    const tickEntry: GrowthBulkAcquisitionTickLogEntry = {
      at: new Date().toISOString(),
      phase: result.run.state.phase,
      actions: result.actions,
      duration_ms: tickDurationMs,
      done: result.done ?? result.run.state.phase === "done",
    }
    const state = appendTickLog(
      {
        ...result.run.state,
        metrics: {
          ...result.run.state.metrics,
          ticks_completed: result.run.state.metrics.ticks_completed + 1,
          last_tick_duration_ms: tickDurationMs,
          total_tick_duration_ms: result.run.state.metrics.total_tick_duration_ms + tickDurationMs,
        },
        last_tick_at: new Date().toISOString(),
      },
      tickEntry,
    )

    const saved =
      (await saveBulkAcquisitionRunState(admin, runId, {
        state,
        status: result.run.status,
        candidate_count: state.stats.companies_discovered,
      })) ?? { ...result.run, state }

    return {
      run: saved,
      phase: saved.state.phase,
      tick_actions: result.actions,
      done: result.done ?? saved.state.phase === "done",
      tick_duration_ms: tickDurationMs,
    }
  } catch (error) {
    const tickDurationMs = Date.now() - tickStartedMs
    const ctx = getAcquisitionDiagnosticContext()
    const action = ctx?.action ?? `tick:${run.state.phase}`
    logAcquisitionTickFailure({
      error,
      runId,
      phase: run.state.phase,
      action,
      companyId: ctx?.companyId ?? null,
      contactId: ctx?.contactId ?? null,
    })
    const tickEntry = buildFailedAcquisitionTickLogEntry({
      phase: run.state.phase,
      error,
      duration_ms: tickDurationMs,
      action,
    })
    const state = appendTickLog(
      applyAcquisitionTickFailureToState({
        state: {
          ...run.state,
          metrics: {
            ...run.state.metrics,
            ticks_completed: run.state.metrics.ticks_completed + 1,
            last_tick_duration_ms: tickDurationMs,
            total_tick_duration_ms: run.state.metrics.total_tick_duration_ms + tickDurationMs,
          },
        },
        error,
        runId,
        phase: run.state.phase,
        action,
        companyId: ctx?.companyId ?? null,
        contactId: ctx?.contactId ?? null,
      }),
      tickEntry,
    )
    const message = tickEntry.error_message ?? "tick_failed"
    const saved = await saveBulkAcquisitionRunState(admin, runId, { state, status: "partial" })
    return {
      run: saved ?? run,
      phase: state.phase,
      tick_actions: [`error:${message}`],
      done: false,
      tick_duration_ms: tickDurationMs,
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
