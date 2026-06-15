/** Growth Engine SR-2B-3 — Share page analytics diagnostics & certification. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { computeAttributionEngagementScore } from "@/lib/growth/tracking/engagement-score"
import { resetSharePageAnalyticsRateLimitForTests } from "@/lib/growth/share-pages/share-page-analytics-rate-limit"
import {
  assertSharePageAnalyticsSchemaReady,
  ingestSharePageAnalyticsEvent,
  SHARE_PAGE_ENGAGEMENT_DURATION_MS,
} from "@/lib/growth/share-pages/share-page-analytics-service"
import { isHighIntentSharePageSignalType } from "@/lib/growth/share-pages/share-page-analytics-signals"
import {
  approveSharePage,
  createSharePage,
  getSharePageAnalyticsSummary,
  revokeSharePage,
} from "@/lib/growth/share-pages/share-page-repository"
import {
  GROWTH_SHARE_PAGES_ANALYTICS_CONFIRM,
  GROWTH_SHARE_PAGES_ANALYTICS_MIGRATION,
  GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-types"

export { GROWTH_SHARE_PAGES_ANALYTICS_CONFIRM }

const CERT_PREFIX = "share-pages-analytics-sr2b3-cert"

export type GrowthSharePageAnalyticsDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthSharePageAnalyticsDiagnosticsReport = {
  ok: boolean
  execution_id: string
  qa_marker: typeof GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER
  migration: typeof GROWTH_SHARE_PAGES_ANALYTICS_MIGRATION
  checks: GrowthSharePageAnalyticsDiagnosticsCheck[]
  blockers: string[]
  final_verdict: "PASS" | "FAIL" | "SKIP"
  share_page_id?: string
}

function pushCheck(
  checks: GrowthSharePageAnalyticsDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

async function resolveCertOrganizationId(admin: SupabaseClient): Promise<string | null> {
  const configured = getGrowthEngineAiOrgId()
  if (configured) return configured

  const { data, error } = await admin.from("organizations").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle()
  if (error || !data?.id) return null
  return data.id
}

async function resolveCertLeadId(admin: SupabaseClient): Promise<{ leadId: string; approverUserId: string | null } | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id, created_by")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null
  return {
    leadId: data.id,
    approverUserId: typeof data.created_by === "string" ? data.created_by : null,
  }
}

export async function executeGrowthSharePageAnalyticsDiagnostics(
  admin: SupabaseClient,
): Promise<GrowthSharePageAnalyticsDiagnosticsReport> {
  const execution_id = randomUUID()
  const checks: GrowthSharePageAnalyticsDiagnosticsCheck[] = []
  const blockers: string[] = []

  resetSharePageAnalyticsRateLimitForTests()

  pushCheck(
    checks,
    "attribution_score_points",
    computeAttributionEngagementScore({
      opens: 0,
      clicks: 0,
      replies: 0,
      meetings: 0,
      pageViews: 1,
      pageEngaged: 1,
      pageCtaClicks: 1,
      pageBookingsCompleted: 1,
      lastActivityAt: new Date().toISOString(),
    }).score === 75,
    "Share page attribution points fold into engagement score.",
  )

  for (const signalType of [
    "share_page_viewed",
    "share_page_engaged",
    "share_page_cta_clicked",
    "share_page_booking_started",
    "share_page_booking_completed",
  ]) {
    pushCheck(
      checks,
      `high_intent_signal_${signalType}`,
      isHighIntentSharePageSignalType(signalType),
      `Signal type ${signalType} registered as high-intent.`,
    )
  }

  const schemaReady = await assertSharePageAnalyticsSchemaReady(admin)
  pushCheck(checks, "analytics_schema_ready", schemaReady, schemaReady ? "Analytics schema objects available." : "Analytics migration not applied.")
  if (!schemaReady) blockers.push("analytics_migration_not_applied")

  const organizationId = await resolveCertOrganizationId(admin)
  const leadContext = await resolveCertLeadId(admin)
  if (!organizationId || !leadContext) {
    pushCheck(checks, "analytics_ingestion", false, "Skipped ingestion — organization or lead unavailable.")
    blockers.push("cert_context_unavailable")
    const ok = checks.every((check) => check.ok)
    return {
      ok,
      execution_id,
      qa_marker: GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER,
      migration: GROWTH_SHARE_PAGES_ANALYTICS_MIGRATION,
      checks,
      blockers,
      final_verdict: ok ? "PASS" : "FAIL",
    }
  }

  const { leadId, approverUserId } = leadContext
  const created = await createSharePage(admin, {
    organizationId,
    leadId,
    sourceChannel: "manual",
    status: "draft",
    headline: `${CERT_PREFIX} headline`,
    heroMessage: `${CERT_PREFIX} hero`,
    createdBy: approverUserId,
  })

  if (!approverUserId) {
    pushCheck(checks, "analytics_ingestion", false, "Skipped ingestion — approver user id unavailable.")
    blockers.push("approver_unavailable")
    const ok = checks.every((check) => check.ok)
    return {
      ok,
      execution_id,
      qa_marker: GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER,
      migration: GROWTH_SHARE_PAGES_ANALYTICS_MIGRATION,
      checks,
      blockers,
      final_verdict: ok ? "PASS" : "FAIL",
      share_page_id: created.page.id,
    }
  }

  await approveSharePage(admin, created.page.id, { approvedBy: approverUserId })
  const sessionKey = `${CERT_PREFIX}-${randomUUID()}`

  const sessionStarted = await ingestSharePageAnalyticsEvent(admin, {
    rawToken: created.publicToken,
    eventType: "SHARE_PAGE_SESSION_STARTED",
    sessionKey,
    pageUrl: "https://app.equipify.ai/p/cert-analytics",
  })
  pushCheck(
    checks,
    "session_creation",
    sessionStarted.ok && Boolean(sessionStarted.sharePageViewId),
    "Session started and view id returned.",
  )

  const viewed = await ingestSharePageAnalyticsEvent(admin, {
    rawToken: created.publicToken,
    eventType: "SHARE_PAGE_VIEWED",
    sessionKey,
    sharePageViewId: sessionStarted.sharePageViewId,
  })
  pushCheck(checks, "page_view_ingestion", viewed.ok, "Share page viewed event ingested.")

  const viewedDuplicate = await ingestSharePageAnalyticsEvent(admin, {
    rawToken: created.publicToken,
    eventType: "SHARE_PAGE_VIEWED",
    sessionKey,
    sharePageViewId: sessionStarted.sharePageViewId,
  })
  pushCheck(checks, "page_view_dedupe", viewedDuplicate.deduplicated === true, "Duplicate page view deduplicated per session.")

  const scroll25 = await ingestSharePageAnalyticsEvent(admin, {
    rawToken: created.publicToken,
    eventType: "SHARE_PAGE_SCROLL_25",
    sessionKey,
    sharePageViewId: sessionStarted.sharePageViewId,
    scrollDepthPct: 25,
  })
  const scroll25Duplicate = await ingestSharePageAnalyticsEvent(admin, {
    rawToken: created.publicToken,
    eventType: "SHARE_PAGE_SCROLL_25",
    sessionKey,
    sharePageViewId: sessionStarted.sharePageViewId,
    scrollDepthPct: 25,
  })
  pushCheck(
    checks,
    "scroll_milestone_dedupe",
    scroll25.ok && scroll25Duplicate.deduplicated === true,
    "Scroll milestone deduplicated per session.",
  )

  const durationUpdate = await ingestSharePageAnalyticsEvent(admin, {
    rawToken: created.publicToken,
    eventType: "SHARE_PAGE_SCROLL_50",
    sessionKey,
    sharePageViewId: sessionStarted.sharePageViewId,
    durationMs: SHARE_PAGE_ENGAGEMENT_DURATION_MS,
    scrollDepthPct: 50,
  })
  pushCheck(
    checks,
    "duration_and_engagement_threshold",
    durationUpdate.ok && durationUpdate.engagementThresholdCrossed === true,
    "Duration update crossed engagement threshold.",
  )

  const ctaClicked = await ingestSharePageAnalyticsEvent(admin, {
    rawToken: created.publicToken,
    eventType: "SHARE_PAGE_CTA_CLICKED",
    sessionKey,
    sharePageViewId: sessionStarted.sharePageViewId,
    eventLabel: "Book a call",
    metadata: { tracking_key: "primary_cta" },
  })
  pushCheck(checks, "cta_click_ingestion", ctaClicked.ok, "CTA click ingested.")

  const bookingCompleted = await ingestSharePageAnalyticsEvent(admin, {
    rawToken: created.publicToken,
    eventType: "SHARE_PAGE_BOOKING_COMPLETED",
    sessionKey,
    sharePageViewId: sessionStarted.sharePageViewId,
  })
  pushCheck(checks, "booking_completed_ingestion", bookingCompleted.ok, "Booking completed ingested.")

  const { count: timelineCount, error: timelineError } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .in("event_type", [
      "share_page_viewed",
      "share_page_engaged",
      "share_page_cta_clicked",
      "share_page_booking_completed",
    ])

  pushCheck(
    checks,
    "timeline_writes",
    !timelineError && (timelineCount ?? 0) >= 4,
    `Timeline events recorded (${timelineCount ?? 0}).`,
  )

  const { data: scoreRow, error: scoreError } = await admin
    .schema("growth")
    .from("engagement_scores")
    .select("page_views, page_engaged, page_cta_clicks, page_bookings_completed, score")
    .eq("lead_id", leadId)
    .maybeSingle()

  pushCheck(
    checks,
    "engagement_scoring",
    !scoreError &&
      (scoreRow?.page_views ?? 0) >= 1 &&
      (scoreRow?.page_engaged ?? 0) >= 1 &&
      (scoreRow?.page_cta_clicks ?? 0) >= 1 &&
      (scoreRow?.page_bookings_completed ?? 0) >= 1,
    "Attribution engagement score columns updated.",
  )

  const { count: signalCount, error: signalError } = await admin
    .schema("growth")
    .from("signals")
    .select("id", { count: "exact", head: true })
    .eq("provider_key", "share_page_analytics")
    .in("signal_type", [
      "share_page_viewed",
      "share_page_engaged",
      "share_page_cta_clicked",
      "share_page_booking_completed",
    ])

  pushCheck(
    checks,
    "high_intent_signals",
    !signalError && (signalCount ?? 0) >= 3,
    `High-intent signals persisted (${signalCount ?? 0}).`,
  )

  const { data: realtimeRows, error: realtimeError } = await admin
    .schema("growth")
    .from("signal_events")
    .select("event_payload")
    .contains("event_payload", { realtime_event: true })
    .order("occurred_at", { ascending: false })
    .limit(50)

  const realtimeMatches = (realtimeRows ?? []).filter((row) => {
    const payload = row.event_payload as Record<string, unknown> | null
    const logical = typeof payload?.logical_event_type === "string" ? payload.logical_event_type : ""
    return ["share_page_viewed", "share_page_engaged", "share_page_booking_completed"].includes(logical)
  })

  pushCheck(
    checks,
    "realtime_publication",
    !realtimeError && realtimeMatches.length >= 1,
    `Realtime audit events published (${realtimeMatches.length}).`,
  )

  const analytics = await getSharePageAnalyticsSummary(admin, created.page.id)
  pushCheck(
    checks,
    "analytics_summary",
    analytics !== null && analytics.viewCount >= 1 && analytics.engagementSummary.ctaClickCount >= 1,
    "Analytics summary reflects ingested events.",
  )

  await revokeSharePage(admin, created.page.id)
  const revoked = await ingestSharePageAnalyticsEvent(admin, {
    rawToken: created.publicToken,
    eventType: "SHARE_PAGE_VIEWED",
    sessionKey: `${sessionKey}-revoked`,
  })
  pushCheck(checks, "revoked_page_rejected", !revoked.ok && revoked.status === 403, "Revoked page rejected.")

  const ok = checks.every((check) => check.ok)
  return {
    ok,
    execution_id,
    qa_marker: GROWTH_SHARE_PAGES_ANALYTICS_QA_MARKER,
    migration: GROWTH_SHARE_PAGES_ANALYTICS_MIGRATION,
    checks,
    blockers,
    final_verdict: ok ? "PASS" : "FAIL",
    share_page_id: created.page.id,
  }
}
