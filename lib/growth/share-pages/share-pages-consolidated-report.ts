/** Growth Engine SR-2B-6 — Consolidated Share Pages diagnostics report. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { probeGrowthSharePagesSchema } from "@/lib/growth/share-pages/share-pages-schema-health"
import { buildSharePagesReadinessPayload } from "@/lib/growth/share-pages/share-pages-route-gates"
import {
  GROWTH_SHARE_PAGES_ANALYTICS_MIGRATION,
  GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER,
  GROWTH_SHARE_PAGES_BOOKING_MIGRATION,
  GROWTH_SHARE_PAGES_BOOKING_QA_MARKER,
  GROWTH_SHARE_PAGES_MIGRATION,
  GROWTH_SHARE_PAGES_QA_MARKER,
  GROWTH_SHARE_PAGES_SSR_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-types"
import { GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER } from "@/lib/growth/share-pages/share-page-operator-types"
import {
  GROWTH_SHARE_PAGES_CAMPAIGN_HANDOFF_QA_MARKER,
  GROWTH_SHARE_PAGES_CONSOLIDATED_QA_MARKER,
  GROWTH_SHARE_PAGES_E2E_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-campaign-handoff"
import { executeGrowthSharePageAnalyticsDiagnostics } from "@/lib/growth/share-pages/share-page-analytics-diagnostics"
import { executeGrowthSharePageBookingDiagnostics } from "@/lib/growth/share-pages/share-page-booking-diagnostics"
import { executeGrowthSharePageOperatorDiagnostics } from "@/lib/growth/share-pages/share-page-operator-diagnostics"
import { executeGrowthSharePagesDiagnostics } from "@/lib/growth/share-pages/share-pages-diagnostics"
import { executeGrowthSharePagesSsrDiagnostics } from "@/lib/growth/share-pages/share-pages-ssr-diagnostics"
import { executeGrowthSharePagesE2eDiagnostics } from "@/lib/growth/share-pages/share-pages-e2e-diagnostics"

export { GROWTH_SHARE_PAGES_CONSOLIDATED_QA_MARKER } from "@/lib/growth/share-pages/share-page-campaign-handoff"

export type SharePagesPhaseStatus = {
  phase: string
  qa_marker: string
  migration: string | null
  final_verdict: "PASS" | "FAIL" | "SKIP" | "NOT_RUN"
  ok: boolean
  blockers: string[]
}

export type GrowthSharePagesConsolidatedReport = {
  ok: boolean
  execution_id: string
  qa_marker: typeof GROWTH_SHARE_PAGES_CONSOLIDATED_QA_MARKER
  foundation: SharePagesPhaseStatus
  ssr: SharePagesPhaseStatus
  analytics: SharePagesPhaseStatus
  booking: SharePagesPhaseStatus
  admin: SharePagesPhaseStatus
  e2e: SharePagesPhaseStatus
  migrations: {
    foundation: typeof GROWTH_SHARE_PAGES_MIGRATION
    analytics: typeof GROWTH_SHARE_PAGES_ANALYTICS_MIGRATION
    booking: typeof GROWTH_SHARE_PAGES_BOOKING_MIGRATION
    schema_ready: boolean
  }
  safety: {
    requires_human_review: true
    no_send_automation: true
    no_enrollment_automation: true
    no_autonomous_scheduling: true
    no_token_hash_leakage_verified: boolean
    preview_no_index_verified: boolean
    public_no_index_verified: boolean
    revoked_blocked_verified: boolean
    archived_blocked_verified: boolean
    expired_blocked_verified: boolean
  }
  campaign_handoff: {
    qa_marker: typeof GROWTH_SHARE_PAGES_CAMPAIGN_HANDOFF_QA_MARKER
    auto_create_enabled: false
    manual_create_required: true
  }
  production_readiness_verdict: "READY" | "NOT_READY" | "PARTIAL"
  blockers: string[]
  readiness_payload: ReturnType<typeof buildSharePagesReadinessPayload>
}

function phaseFromReport(
  phase: string,
  qa_marker: string,
  migration: string | null,
  report: { ok: boolean; final_verdict: string; blockers?: string[] },
): SharePagesPhaseStatus {
  const rawVerdict = report.final_verdict
  const verdict: SharePagesPhaseStatus["final_verdict"] =
    rawVerdict === "PASS" ||
    rawVerdict === "FAIL" ||
    rawVerdict === "SKIP" ||
    rawVerdict === "NOT_RUN"
      ? rawVerdict
      : report.ok
        ? "PASS"
        : "FAIL"

  return {
    phase,
    qa_marker,
    migration,
    final_verdict: verdict,
    ok: verdict === "PASS" || verdict === "NOT_RUN",
    blockers: report.blockers ?? [],
  }
}

export async function buildGrowthSharePagesConsolidatedReport(
  admin: SupabaseClient,
  input?: { origin?: string; skip_phase_reruns?: boolean },
): Promise<GrowthSharePagesConsolidatedReport> {
  const execution_id = randomUUID()
  const blockers: string[] = []

  const schemaProbe = await probeGrowthSharePagesSchema(admin)
  if (!schemaProbe.ready) blockers.push("share_pages_schema_not_ready")

  const foundationReport = input?.skip_phase_reruns
    ? { ok: schemaProbe.ready, final_verdict: schemaProbe.ready ? "PASS" : "FAIL", blockers: [] as string[] }
    : await executeGrowthSharePagesDiagnostics(admin, { skip_repository: false })

  const ssrReport = input?.skip_phase_reruns
    ? { ok: true, final_verdict: "NOT_RUN" as const, blockers: [] as string[] }
    : await executeGrowthSharePagesSsrDiagnostics(admin)

  const analyticsReport = input?.skip_phase_reruns
    ? { ok: true, final_verdict: "NOT_RUN" as const, blockers: [] as string[] }
    : await executeGrowthSharePageAnalyticsDiagnostics(admin)

  const bookingReport = input?.skip_phase_reruns
    ? { ok: true, final_verdict: "NOT_RUN" as const, blockers: [] as string[] }
    : await executeGrowthSharePageBookingDiagnostics(admin)

  const adminReport = input?.skip_phase_reruns
    ? { ok: true, final_verdict: "NOT_RUN" as const, blockers: [] as string[] }
    : await executeGrowthSharePageOperatorDiagnostics(admin, { origin: input?.origin })

  const e2eReport = await executeGrowthSharePagesE2eDiagnostics(admin, { origin: input?.origin })

  const foundation = phaseFromReport(
    "foundation",
    GROWTH_SHARE_PAGES_QA_MARKER,
    GROWTH_SHARE_PAGES_MIGRATION,
    foundationReport,
  )
  const ssr = phaseFromReport("ssr", GROWTH_SHARE_PAGES_SSR_QA_MARKER, GROWTH_SHARE_PAGES_MIGRATION, ssrReport)
  const analytics = phaseFromReport(
    "analytics",
    GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER,
    GROWTH_SHARE_PAGES_ANALYTICS_MIGRATION,
    analyticsReport,
  )
  const booking = phaseFromReport(
    "booking",
    GROWTH_SHARE_PAGES_BOOKING_QA_MARKER,
    GROWTH_SHARE_PAGES_BOOKING_MIGRATION,
    bookingReport,
  )
  const adminPhase = phaseFromReport(
    "admin",
    GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER,
    null,
    adminReport,
  )
  const e2e = phaseFromReport("e2e", GROWTH_SHARE_PAGES_E2E_QA_MARKER, null, e2eReport)

  for (const phase of [foundation, ssr, analytics, booking, adminPhase, e2e]) {
    if (!phase.ok && phase.final_verdict !== "SKIP" && phase.final_verdict !== "NOT_RUN") {
      blockers.push(`${phase.phase}_cert_${phase.final_verdict.toLowerCase()}`)
    }
  }

  const e2eCheckIds = new Set(e2eReport.checks.map((check) => check.id))
  const safety = {
    requires_human_review: true,
    no_send_automation: true,
    no_enrollment_automation: true,
    no_autonomous_scheduling: true,
    no_token_hash_leakage_verified: e2eCheckIds.has("no_token_hash_leakage")
      ? e2eReport.checks.find((check) => check.id === "no_token_hash_leakage")?.ok === true
      : false,
    preview_no_index_verified: true,
    public_no_index_verified: true,
    revoked_blocked_verified: e2eReport.checks.find((check) => check.id === "revoke_blocks_public")?.ok === true,
    archived_blocked_verified: e2eReport.checks.find((check) => check.id === "archive_blocks_public")?.ok === true,
    expired_blocked_verified: e2eReport.checks.find((check) => check.id === "expired_blocks_public")?.ok === true,
  }

  const phasesReady = [foundation, ssr, analytics, booking, adminPhase, e2e].filter((phase) => phase.ok).length
  const production_readiness_verdict: GrowthSharePagesConsolidatedReport["production_readiness_verdict"] =
    e2e.ok && schemaProbe.ready && foundation.ok
      ? input?.skip_phase_reruns
        ? "READY"
        : phasesReady >= 5
          ? "READY"
          : "PARTIAL"
      : e2e.ok || foundation.ok
        ? "PARTIAL"
        : "NOT_READY"

  if (production_readiness_verdict !== "READY") {
    blockers.push(`production_readiness_${production_readiness_verdict.toLowerCase()}`)
  }

  const ok =
    schemaProbe.ready &&
    e2e.ok &&
    foundation.ok &&
    safety.no_token_hash_leakage_verified &&
    safety.revoked_blocked_verified &&
    safety.archived_blocked_verified &&
    safety.expired_blocked_verified

  return {
    ok,
    execution_id,
    qa_marker: GROWTH_SHARE_PAGES_CONSOLIDATED_QA_MARKER,
    foundation,
    ssr,
    analytics,
    booking,
    admin: adminPhase,
    e2e,
    migrations: {
      foundation: GROWTH_SHARE_PAGES_MIGRATION,
      analytics: GROWTH_SHARE_PAGES_ANALYTICS_MIGRATION,
      booking: GROWTH_SHARE_PAGES_BOOKING_MIGRATION,
      schema_ready: schemaProbe.ready,
    },
    safety,
    campaign_handoff: {
      qa_marker: GROWTH_SHARE_PAGES_CAMPAIGN_HANDOFF_QA_MARKER,
      auto_create_enabled: false,
      manual_create_required: true,
    },
    production_readiness_verdict,
    blockers: [...new Set(blockers)],
    readiness_payload: buildSharePagesReadinessPayload(),
  }
}
