/**
 * Phase RV-1 — End-to-end revenue path validation (local regression + optional production read-only).
 *
 * Local:
 *   pnpm test:revenue-path-validation
 *
 * Production (read-only):
 *   pnpm test:revenue-path-validation:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN } from "../lib/growth/apollo/apollo-full-pipeline-production-certification-types"
import { APOLLO_MEETING_BRIDGE_SOURCE_ATTRIBUTION } from "../lib/growth/apollo/apollo-meeting-bridge-types"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  REVENUE_PATH_HENRY_LEAD_ID,
  REVENUE_PATH_PILOT_COHORT_ID,
  REVENUE_PATH_QUEUE_DEFINITIONS,
  REVENUE_PATH_STAGES,
  REVENUE_PATH_VALIDATION_QA_MARKER,
} from "../lib/growth/qa/revenue-path-validation-types"
import { GROWTH_ATTRIBUTION_TOUCH_TYPES } from "../lib/growth/revenue-attribution/attribution-touch-types"

type Check = { id: string; pass: boolean; detail: Record<string, unknown> }

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function runLocalRegression(): void {
  console.log(`\n=== RV-1 local regression (${REVENUE_PATH_VALIDATION_QA_MARKER}) ===\n`)

  assert.equal(REVENUE_PATH_VALIDATION_QA_MARKER, "revenue-path-validation-rv1-v1")
  console.log("  ✓ QA marker")

  assert.equal(REVENUE_PATH_STAGES.length, 15)
  console.log("  ✓ revenue path stage count (15)")

  const upstream = APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN.slice()
  const bridge = APOLLO_MEETING_BRIDGE_SOURCE_ATTRIBUTION.slice()
  assert.deepEqual(upstream, bridge.slice(0, upstream.length))
  console.log("  ✓ upstream attribution chain aligns with meeting bridge")

  for (const stage of REVENUE_PATH_STAGES.slice(0, 7)) {
    assert.ok(upstream.includes(stage as (typeof upstream)[number]), `Missing upstream stage: ${stage}`)
  }
  console.log("  ✓ Apollo → Sequence Execution stages present")

  for (const queue of REVENUE_PATH_QUEUE_DEFINITIONS) {
    const routePath = path.join(process.cwd(), "app/api/platform/growth", queue.api.replace("/api/platform/growth/", ""), "route.ts")
    assert.ok(fs.existsSync(routePath), `Missing queue route: ${queue.api}`)
  }
  console.log("  ✓ queue API routes exist")

  const requiredLibs = [
    "lib/growth/apollo/apollo-meeting-bridge.ts",
    "lib/growth/meeting-intelligence/opportunity-approval-service.ts",
    "lib/growth/aiden/aiden-revenue-journey-tracker.ts",
    "lib/growth/revenue-attribution/revenue-attribution-dashboard.ts",
    "lib/growth/deal-intelligence/deal-intelligence-service.ts",
    "lib/growth/qa/revenue-path-validation-types.ts",
  ]
  for (const relativePath of requiredLibs) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ required lib modules exist")

  console.log("\n  Local regression: PASS\n")
}

async function countByStatus(
  admin: SupabaseClient,
  table: string,
  statusField: string,
): Promise<{ total: number; by_status: Record<string, number>; error?: string }> {
  const { data, error } = await admin.schema("growth").from(table).select(statusField).limit(1000)
  if (error) return { total: 0, by_status: {}, error: error.message }
  const by_status: Record<string, number> = {}
  for (const row of data ?? []) {
    const status = asString((row as Record<string, unknown>)[statusField])
    by_status[status] = (by_status[status] ?? 0) + 1
  }
  return { total: data?.length ?? 0, by_status }
}

async function verifyLinkedRecord(
  admin: SupabaseClient,
  table: string,
  id: string | null | undefined,
): Promise<{ table: string; id: string | null; exists: boolean }> {
  const trimmed = asString(id) || null
  if (!trimmed) return { table, id: null, exists: false }
  const { data, error } = await admin.schema("growth").from(table).select("id").eq("id", trimmed).maybeSingle()
  return { table, id: trimmed, exists: !error && Boolean(data) }
}

async function validateHenryLeadChain(admin: SupabaseClient): Promise<{
  checks: Check[]
  linkage: Record<string, unknown>
}> {
  const checks: Check[] = []
  const leadId = REVENUE_PATH_HENRY_LEAD_ID

  const { loadApolloMeetingBridgePipelineInputForLead } = await import(
    "../lib/growth/apollo/apollo-meeting-bridge"
  )
  const pipelineInput = await loadApolloMeetingBridgePipelineInputForLead(admin, { lead_id: leadId })

  checks.push({
    id: "henry_lead_exists",
    pass: pipelineInput !== null,
    detail: { lead_id: leadId, company_name: pipelineInput?.lead.company_name ?? null },
  })

  const seq = pipelineInput?.sequence_execution
  const linkageIds = {
    growth_lead_id: leadId,
    company_candidate_id: pipelineInput?.company.company_candidate_id ?? null,
    enrollment_candidate_id: seq?.enrollment_candidate_id ?? null,
    account_playbook_id: pipelineInput?.account_playbook.account_playbook_id ?? null,
    voice_drop_candidate_id: seq?.voice_drop_candidate_id ?? null,
    multichannel_sequence_candidate_id: seq?.multichannel_sequence_candidate_id ?? null,
    sequence_execution_candidate_id: seq?.sequence_execution_id ?? null,
    sequence_enrollment_id: seq?.sequence_enrollment_id ?? null,
  }

  const linkVerifications = await Promise.all([
    verifyLinkedRecord(admin, "apollo_enrollment_candidates", linkageIds.enrollment_candidate_id),
    verifyLinkedRecord(admin, "account_playbooks", linkageIds.account_playbook_id),
    verifyLinkedRecord(admin, "apollo_voice_drop_candidates", linkageIds.voice_drop_candidate_id),
    verifyLinkedRecord(admin, "apollo_multichannel_sequence_candidates", linkageIds.multichannel_sequence_candidate_id),
    verifyLinkedRecord(admin, "apollo_sequence_execution_candidates", linkageIds.sequence_execution_candidate_id),
    verifyLinkedRecord(admin, "sequence_enrollments", linkageIds.sequence_enrollment_id),
  ])

  const linkedCount = linkVerifications.filter((v) => v.exists).length
  const expectedLinks = linkVerifications.filter((v) => v.id !== null).length

  checks.push({
    id: "henry_upstream_linkage",
    pass: linkedCount >= 4,
    detail: {
      linkage_ids: linkageIds,
      verifications: linkVerifications,
      linked: linkedCount,
      expected: expectedLinks,
    },
  })

  const { data: replies } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("id,intent,created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(5)

  checks.push({
    id: "henry_reply_intelligence",
    pass: (replies?.length ?? 0) > 0,
    detail: { reply_count: replies?.length ?? 0, sample: replies ?? [] },
  })

  const { data: meetingCandidates } = await admin
    .schema("growth")
    .from("meeting_candidates")
    .select("id,status,meeting_id")
    .eq("lead_id", leadId)
    .limit(10)

  const { data: meetings } = await admin
    .schema("growth")
    .from("meetings")
    .select("id,status")
    .eq("lead_id", leadId)
    .limit(10)

  checks.push({
    id: "henry_meeting_candidate",
    pass: (meetingCandidates?.length ?? 0) > 0 || (meetings?.length ?? 0) > 0,
    detail: {
      meeting_candidates: meetingCandidates?.length ?? 0,
      meetings: meetings?.length ?? 0,
    },
  })

  const meetingIds = (meetings ?? []).map((m) => asString((m as { id: string }).id)).filter(Boolean)
  let prepCount = 0
  if (meetingIds.length > 0) {
    const { count } = await admin
      .schema("growth")
      .from("ai_meeting_preparations")
      .select("id", { count: "exact", head: true })
      .in("meeting_id", meetingIds)
    prepCount = count ?? 0
  }

  checks.push({
    id: "henry_ai_meeting_prep",
    pass: prepCount > 0 || (meetings?.length ?? 0) === 0,
    detail: { prep_count: prepCount, meeting_ids: meetingIds },
  })

  const { data: drafts } = await admin
    .schema("growth")
    .from("opportunity_drafts")
    .select("id,status,opportunity_id,meeting_id,lead_id")
    .eq("lead_id", leadId)
    .limit(10)

  const draftOppIds = (drafts ?? [])
    .map((d) => asString((d as { opportunity_id: string }).opportunity_id))
    .filter(Boolean)

  let opportunities: Record<string, unknown>[] = []
  const { data: oppsByLead, error: oppsByLeadError } = await admin
    .schema("growth")
    .from("opportunities")
    .select("id,stage_key,amount,lead_id,closed_won_at")
    .eq("lead_id", leadId)
    .limit(10)
  opportunities = (oppsByLead ?? []) as Record<string, unknown>[]

  if (opportunities.length === 0 && draftOppIds.length > 0) {
    const { data: oppsByDraftRef, error: oppsByDraftError } = await admin
      .schema("growth")
      .from("opportunities")
      .select("id,stage_key,amount,lead_id,closed_won_at")
      .in("id", draftOppIds)
      .limit(10)
    opportunities = (oppsByDraftRef ?? []) as Record<string, unknown>[]
    if (oppsByDraftError && opportunities.length === 0) {
      checks.push({
        id: "henry_opportunity_query_error",
        pass: false,
        detail: { error: oppsByDraftError.message, opps_by_lead_error: oppsByLeadError?.message ?? null },
      })
    }
  }

  const linkageMismatch =
    draftOppIds.length > 0 &&
    opportunities.length > 0 &&
    opportunities.some((o) => asString(o.lead_id) !== leadId)

  checks.push({
    id: "henry_opportunity_draft",
    pass: (drafts?.length ?? 0) > 0,
    detail: { drafts: drafts ?? [] },
  })

  checks.push({
    id: "henry_opportunity_created",
    pass: opportunities.length > 0,
    detail: {
      opportunities,
      draft_opportunity_ids: draftOppIds,
      linkage_mismatch: linkageMismatch,
    },
  })

  if (linkageMismatch) {
    checks.push({
      id: "henry_opportunity_lead_linkage",
      pass: false,
      detail: {
        expected_lead_id: leadId,
        opportunity_lead_ids: opportunities.map((o) => o.lead_id),
      },
    })
  }

  if (draftOppIds.length > 0 && opportunities.length === 0) {
    checks.push({
      id: "henry_opportunity_phantom_reference",
      pass: false,
      detail: {
        draft_opportunity_ids: draftOppIds,
        note: "converted draft references opportunity_id with no matching growth.opportunities row",
      },
    })
  }

  const oppIds = opportunities.map((o) => asString(o.id)).filter(Boolean)
  let dealIntelCount = 0
  if (oppIds.length > 0) {
    const { count } = await admin
      .schema("growth")
      .from("deal_intelligence_scores")
      .select("id", { count: "exact", head: true })
      .in("opportunity_id", oppIds)
    dealIntelCount = count ?? 0
  }

  checks.push({
    id: "henry_deal_intelligence",
    pass: dealIntelCount > 0 || oppIds.length === 0,
    detail: { deal_intelligence_scores: dealIntelCount, opportunity_ids: oppIds },
  })

  const { data: leadForecast } = await admin
    .schema("growth")
    .from("leads")
    .select("revenue_forecast_computed_at,revenue_forecast_amount")
    .eq("id", leadId)
    .maybeSingle()

  checks.push({
    id: "henry_revenue_forecast",
    pass: Boolean(leadForecast?.revenue_forecast_computed_at) || oppIds.length === 0,
    detail: {
      revenue_forecast_computed_at: leadForecast?.revenue_forecast_computed_at ?? null,
      revenue_forecast_amount: leadForecast?.revenue_forecast_amount ?? null,
    },
  })

  const { data: touches } = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("touch_type,touched_at")
    .eq("lead_id", leadId)
    .order("touched_at", { ascending: true })

  const touchTypes = (touches ?? []).map((t) => asString((t as { touch_type: string }).touch_type))
  checks.push({
    id: "henry_attribution_chain",
    pass: touchTypes.includes("email_send") && touchTypes.length >= 2,
    detail: { touch_types: touchTypes, touch_count: touchTypes.length },
  })

  return {
    checks,
    linkage: { linkage_ids: linkageIds, source_attribution: pipelineInput?.source_attribution ?? {} },
  }
}

async function detectOrphans(admin: SupabaseClient, cohortLeadIds: string[]): Promise<Check[]> {
  const checks: Check[] = []

  const { data: orphanOpps } = await admin
    .schema("growth")
    .from("opportunities")
    .select("id,lead_id")
    .not("lead_id", "is", null)
    .limit(200)

  const { data: leadRows } = cohortLeadIds.length
    ? await admin.schema("growth").from("leads").select("id").in("id", cohortLeadIds)
    : { data: [] }
  const validLeadIds = new Set((leadRows ?? []).map((r) => asString((r as { id: string }).id)))

  const orphanOppLeads = (orphanOpps ?? []).filter((o) => {
    const lid = asString((o as { lead_id: string }).lead_id)
    return lid && cohortLeadIds.includes(lid) && !validLeadIds.has(lid)
  })

  checks.push({
    id: "orphan_opportunities",
    pass: orphanOppLeads.length === 0,
    detail: { orphan_count: orphanOppLeads.length },
  })

  const { data: draftsWithMeeting } = await admin
    .schema("growth")
    .from("opportunity_drafts")
    .select("id,meeting_id")
    .not("meeting_id", "is", null)
    .limit(200)

  let brokenDraftMeetingLinks = 0
  for (const draft of draftsWithMeeting ?? []) {
    const meetingId = asString((draft as { meeting_id: string }).meeting_id)
    if (!meetingId) continue
    const { data } = await admin.schema("growth").from("meetings").select("id").eq("id", meetingId).maybeSingle()
    if (!data) brokenDraftMeetingLinks += 1
  }

  checks.push({
    id: "orphan_opportunity_draft_meetings",
    pass: brokenDraftMeetingLinks === 0,
    detail: { broken_links: brokenDraftMeetingLinks, drafts_checked: draftsWithMeeting?.length ?? 0 },
  })

  return checks
}

async function auditDuplicatePrevention(admin: SupabaseClient, cohortLeadIds: string[]): Promise<Check[]> {
  const checks: Check[] = []

  if (cohortLeadIds.length === 0) {
    checks.push({
      id: "duplicate_opportunities_per_lead",
      pass: true,
      detail: { note: "no cohort leads to check" },
    })
    return checks
  }

  const { data: oppRows } = await admin
    .schema("growth")
    .from("opportunities")
    .select("id,lead_id")
    .in("lead_id", cohortLeadIds)
    .limit(500)

  const byLead: Record<string, number> = {}
  for (const row of oppRows ?? []) {
    const lid = asString((row as { lead_id: string }).lead_id)
    if (!lid) continue
    byLead[lid] = (byLead[lid] ?? 0) + 1
  }
  const duplicateLeads = Object.entries(byLead).filter(([, count]) => count > 1)

  checks.push({
    id: "duplicate_opportunities_per_lead",
    pass: duplicateLeads.length === 0,
    detail: { duplicate_lead_count: duplicateLeads.length, sample: duplicateLeads.slice(0, 5) },
  })

  const { data: convertedDrafts } = await admin
    .schema("growth")
    .from("opportunity_drafts")
    .select("id,lead_id,opportunity_id,status")
    .eq("status", "converted")
    .in("lead_id", cohortLeadIds)
    .limit(200)

  const oppIdByDraft: Record<string, string[]> = {}
  for (const draft of convertedDrafts ?? []) {
    const oppId = asString((draft as { opportunity_id: string }).opportunity_id)
    const draftId = asString((draft as { id: string }).id)
    if (!oppId || !draftId) continue
    if (!oppIdByDraft[oppId]) oppIdByDraft[oppId] = []
    oppIdByDraft[oppId].push(draftId)
  }
  const duplicateConverted = Object.entries(oppIdByDraft).filter(([, drafts]) => drafts.length > 1)

  checks.push({
    id: "duplicate_converted_drafts",
    pass: duplicateConverted.length === 0,
    detail: { duplicate_opportunity_ids: duplicateConverted.length },
  })

  return checks
}

async function runProductionValidation(): Promise<{
  ok: boolean
  blockers: string[]
  warnings: string[]
  report: Record<string, unknown>
}> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: [".env.vercel.production", ".vercel/.env.production.local", ".env.production.local", ".env.local.rebuild"],
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })

  if (!boot) {
    return {
      ok: false,
      blockers: ["production_supabase_unavailable"],
      warnings: [],
      report: { production_skipped: true },
    }
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const blockers: string[] = []
  const warnings: string[] = []
  const certificationChecks: Check[] = []

  const { resolveApolloCohortLeadIds } = await import("../lib/growth/apollo/resolve-apollo-cohort-lead-ids")
  const cohortResolution = await resolveApolloCohortLeadIds(admin, REVENUE_PATH_PILOT_COHORT_ID)
  const cohortLeadIds = cohortResolution?.lead_ids ?? []

  // --- Queue audit ---
  const queueAudit: Record<string, unknown> = {}
  let totalPendingReview = 0
  let totalRejected = 0
  for (const queue of REVENUE_PATH_QUEUE_DEFINITIONS) {
    const stats = await countByStatus(admin, queue.table, queue.statusField)
    queueAudit[queue.id] = { label: queue.label, api: queue.api, ...stats }
    totalPendingReview += stats.by_status.pending_review ?? stats.by_status.playbook_pending_review ?? 0
    totalRejected += stats.by_status.rejected ?? stats.by_status.playbook_rejected ?? 0
  }

  // --- Henry lead chain ---
  const { checks: henryChecks, linkage } = await validateHenryLeadChain(admin)

  // --- Orphans + duplicates ---
  const orphanChecks = await detectOrphans(admin, cohortLeadIds)
  const duplicateChecks = await auditDuplicatePrevention(admin, cohortLeadIds)

  // --- Attribution audit (cohort sample) ---
  const chainLeadIds = [REVENUE_PATH_HENRY_LEAD_ID, ...cohortLeadIds.slice(0, 30)]
  const { data: chainTouches } = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("lead_id,touch_type,touched_at")
    .in("lead_id", chainLeadIds)
    .order("touched_at", { ascending: true })

  const chainByLead: Record<string, string[]> = {}
  for (const touch of chainTouches ?? []) {
    const lead = asString((touch as { lead_id: string }).lead_id)
    if (!chainByLead[lead]) chainByLead[lead] = []
    chainByLead[lead].push(asString((touch as { touch_type: string }).touch_type))
  }

  const touchTypeCounts: Record<string, number> = {}
  for (const touchType of GROWTH_ATTRIBUTION_TOUCH_TYPES) {
    const { count } = await admin
      .schema("growth")
      .from("attribution_touches")
      .select("id", { count: "exact", head: true })
      .eq("touch_type", touchType)
    touchTypeCounts[touchType] = count ?? 0
  }

  const attributionAudit = {
    touch_type_counts: touchTypeCounts,
    cohort_leads_sampled: chainLeadIds.length,
    henry_chain: chainByLead[REVENUE_PATH_HENRY_LEAD_ID] ?? [],
    leads_with_send: Object.values(chainByLead).filter((t) => t.includes("email_send")).length,
    leads_with_reply: Object.values(chainByLead).filter((t) => t.includes("reply")).length,
    leads_with_meeting: Object.values(chainByLead).filter((t) => t.includes("meeting")).length,
    leads_with_opportunity: Object.values(chainByLead).filter((t) => t.includes("opportunity_created")).length,
  }

  // --- Revenue audit ---
  let revenueDashboard: Awaited<
    ReturnType<(typeof import("../lib/growth/revenue-attribution/revenue-attribution-dashboard"))["fetchGrowthRevenueAttributionDashboard"]>
  > | null = null
  try {
    const { fetchGrowthRevenueAttributionDashboard } = await import(
      "../lib/growth/revenue-attribution/revenue-attribution-dashboard"
    )
    revenueDashboard = await fetchGrowthRevenueAttributionDashboard(admin, {})
  } catch (error) {
    blockers.push("revenue_attribution_dashboard_load_failed")
    warnings.push(error instanceof Error ? error.message : String(error))
  }

  const { count: forecastSnapshots } = await admin
    .schema("growth")
    .from("revenue_forecast_snapshots")
    .select("id", { count: "exact", head: true })

  const { count: leadsWithForecast } = await admin
    .schema("growth")
    .from("leads")
    .select("id", { count: "exact", head: true })
    .not("revenue_forecast_computed_at", "is", null)

  const { fetchAidenRevenueJourneyTracker } = await import("../lib/growth/aiden/aiden-revenue-journey-tracker")
  const journeyTracker = await fetchAidenRevenueJourneyTracker(admin, {
    cohortId: REVENUE_PATH_PILOT_COHORT_ID,
    limit: 50,
  })

  const revenueAudit = {
    dashboard_qa_marker: revenueDashboard?.qa_marker ?? null,
    funnel: revenueDashboard?.funnel ?? null,
    forecast_snapshots: forecastSnapshots ?? 0,
    leads_with_forecast: leadsWithForecast ?? 0,
    journey_tracker: {
      qa_marker: journeyTracker.qa_marker,
      summary: journeyTracker.summary,
      complete_journeys: journeyTracker.journeys.filter((j) =>
        j.stages.every((s) => s.complete),
      ).length,
    },
  }

  // --- Certification checks (8 required gates) ---
  certificationChecks.push({
    id: "lead_opportunity_linkage",
    pass: henryChecks.find((c) => c.id === "henry_opportunity_created")?.pass ?? false,
    detail: { henry_lead_id: REVENUE_PATH_HENRY_LEAD_ID },
  })

  certificationChecks.push({
    id: "attribution_chain_complete",
    pass:
      (attributionAudit.leads_with_send > 0 && attributionAudit.leads_with_reply > 0) ||
      (attributionAudit.henry_chain.length >= 2),
    detail: attributionAudit,
  })

  certificationChecks.push({
    id: "no_orphan_records",
    pass: orphanChecks.every((c) => c.pass),
    detail: { checks: orphanChecks },
  })

  certificationChecks.push({
    id: "queue_progression",
    pass: Object.values(queueAudit).some(
      (q) => typeof q === "object" && q !== null && (q as { total: number }).total > 0,
    ),
    detail: { queue_audit: queueAudit },
  })

  certificationChecks.push({
    id: "opportunity_creation",
    pass:
      henryChecks.find((c) => c.id === "henry_opportunity_created")?.pass ??
      attributionAudit.leads_with_opportunity > 0,
    detail: {
      henry_opportunity: henryChecks.find((c) => c.id === "henry_opportunity_created")?.detail,
      cohort_opportunities: attributionAudit.leads_with_opportunity,
    },
  })

  certificationChecks.push({
    id: "revenue_recomputation",
    pass: (leadsWithForecast ?? 0) > 0 || (forecastSnapshots ?? 0) > 0,
    detail: { leads_with_forecast: leadsWithForecast, forecast_snapshots: forecastSnapshots },
  })

  certificationChecks.push({
    id: "forecast_updates",
    pass: (forecastSnapshots ?? 0) > 0 || Boolean(revenueDashboard?.funnel?.length),
    detail: { forecast_snapshots: forecastSnapshots, dashboard_loaded: revenueDashboard !== null },
  })

  certificationChecks.push({
    id: "duplicate_prevention",
    pass: duplicateChecks.every((c) => c.pass),
    detail: { checks: duplicateChecks },
  })

  const certPassCount = certificationChecks.filter((c) => c.pass).length
  const certificationPct = pct(certPassCount, certificationChecks.length)

  // --- Bottleneck analysis ---
  const pendingByQueue = Object.entries(queueAudit)
    .map(([id, stats]) => ({
      id,
      pending:
        (stats as { by_status?: Record<string, number> }).by_status?.pending_review ??
        (stats as { by_status?: Record<string, number> }).by_status?.playbook_pending_review ??
        0,
    }))
    .sort((a, b) => b.pending - a.pending)

  const journeyIncomplete = journeyTracker.journeys.filter((j) => !j.stages.every((s) => s.complete))
  const stuckAtMeeting = journeyIncomplete.filter((j) => j.current_stage === "meeting").length
  const stuckAtOpportunity = journeyIncomplete.filter((j) => j.current_stage === "opportunity").length
  const stuckAtReply = journeyIncomplete.filter((j) => j.current_stage === "reply_received").length

  const bottleneckAnalysis = {
    longest_manual_step: pendingByQueue[0]?.id ?? "unknown",
    pending_review_total: totalPendingReview,
    pending_by_queue: pendingByQueue,
    most_common_failure_point:
      totalRejected > 0 ? "queue_rejections" : stuckAtMeeting > stuckAtOpportunity ? "meeting_bridge" : "reply_classification",
    rejection_total: totalRejected,
    operator_abandonment_risk:
      stuckAtMeeting >= stuckAtOpportunity && stuckAtMeeting >= stuckAtReply
        ? "meeting_candidate_approval"
        : stuckAtOpportunity >= stuckAtReply
          ? "opportunity_draft_approval"
          : "reply_inbox_review",
    journey_stuck: {
      at_reply: stuckAtReply,
      at_meeting: stuckAtMeeting,
      at_opportunity: stuckAtOpportunity,
    },
  }

  // Blockers / warnings
  for (const check of certificationChecks.filter((c) => !c.pass)) {
    blockers.push(`certification_failed:${check.id}`)
  }
  if (attributionAudit.leads_with_reply === 0 && attributionAudit.leads_with_send > 0) {
    warnings.push("reply_attribution_touches_missing_on_cohort_sample")
  }
  if (henryChecks.some((c) => c.id === "henry_opportunity_lead_linkage" && !c.pass)) {
    warnings.push("henry_opportunity_lead_id_mismatch")
  }
  if (!henryChecks.find((c) => c.id === "henry_opportunity_created")?.pass) {
    warnings.push("henry_lead_opportunity_not_created")
  }
  if (!henryChecks.find((c) => c.id === "henry_deal_intelligence")?.pass) {
    warnings.push("henry_lead_deal_intelligence_not_computed")
  }

  const recommendedNextPhase =
    certificationPct >= 87.5
      ? "RV-2: Operator onboarding playbook + first-customer shadow session"
      : "RV-1B: Complete Henry Schein certify path (meeting → draft → approve → opportunity) then re-run"

  const biggestWeakness =
    henryChecks.some((c) => c.id === "henry_opportunity_phantom_reference" && !c.pass)
      ? "Opportunity draft→create path is broken in production: Henry Schein has a converted draft pointing at opportunity_id 80df826d… but no row exists in growth.opportunities — attribution touches were written without durable opportunity persistence."
      : henryChecks.some((c) => c.id === "henry_opportunity_lead_linkage" && !c.pass)
        ? "Opportunity records can diverge from lead_id on the draft — breaking pipeline integrity and deal intelligence refresh."
        : !henryChecks.find((c) => c.id === "henry_opportunity_created")?.pass
      ? "Downstream revenue conversion is not proven on the pilot lead — opportunity draft → approve → create opportunity has not completed end-to-end in production."
      : attributionAudit.leads_with_reply === 0
        ? "Reply attribution chain breaks between send and meeting — operators cannot trust funnel metrics."
        : bottleneckAnalysis.operator_abandonment_risk === "meeting_candidate_approval"
          ? "Meeting candidate approval is the highest-friction manual gate — no auto-bridge from positive replies to scheduled meetings."
          : "Queue sprawl across 8 approval surfaces without a unified daily action queue increases operator abandonment risk."

  const report = {
    phase: "RV-1",
    qa_marker: REVENUE_PATH_VALIDATION_QA_MARKER,
    observe_only: true,
    cohort_id: REVENUE_PATH_PILOT_COHORT_ID,
    henry_lead_id: REVENUE_PATH_HENRY_LEAD_ID,
    certification_pct: certificationPct,
    certification_checks: certificationChecks,
    pipeline_integrity: {
      henry_chain: henryChecks,
      linkage,
      orphan_checks: orphanChecks,
      duplicate_checks: duplicateChecks,
    },
    attribution_audit: attributionAudit,
    queue_audit: queueAudit,
    revenue_audit: revenueAudit,
    bottleneck_analysis: bottleneckAnalysis,
    recommended_next_phase: recommendedNextPhase,
    final_verdict: {
      biggest_weakness_for_first_customer: biggestWeakness,
      ready_for_first_customer: certificationPct >= 75 && blockers.length === 0,
    },
    blockers,
    warnings,
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    report,
  }
}

async function main(): Promise<void> {
  const productionOnly = process.argv.includes("--production")

  runLocalRegression()

  if (!productionOnly) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          local_only: true,
          qa_marker: REVENUE_PATH_VALIDATION_QA_MARKER,
          hint: "Run pnpm test:revenue-path-validation:production for full production certification",
        },
        null,
        2,
      ),
    )
    return
  }

  const production = await runProductionValidation()

  if (production.report.production_skipped) {
    console.error(JSON.stringify({ ok: false, error: "production_supabase_unavailable" }, null, 2))
    process.exit(1)
  }

  console.log(JSON.stringify(production.report, null, 2))

  if (!production.ok) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
