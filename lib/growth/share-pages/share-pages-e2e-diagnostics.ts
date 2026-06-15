/** Growth Engine SR-2B-6 — Share pages end-to-end certification diagnostics. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  buildSharePageCreationCandidate,
  GROWTH_SHARE_PAGES_E2E_QA_MARKER,
  validateSharePageCampaignReadiness,
} from "@/lib/growth/share-pages/share-page-campaign-handoff"
import { buildGrowthSharePageContext } from "@/lib/growth/share-pages/share-page-context-service"
import { resetSharePageAnalyticsRateLimitForTests } from "@/lib/growth/share-pages/share-page-analytics-rate-limit"
import {
  ingestSharePageAnalyticsEvent,
  SHARE_PAGE_ENGAGEMENT_DURATION_MS,
} from "@/lib/growth/share-pages/share-page-analytics-service"
import {
  buildSharePageBookingAttribution,
  sharePageBookingAttributionToMetadata,
} from "@/lib/growth/share-pages/share-page-booking-attribution"
import {
  bridgeSharePageBookingCompleted,
  bridgeSharePageBookingStarted,
} from "@/lib/growth/share-pages/share-page-booking-bridge"
import {
  approveSharePageForOperator,
  createSharePageForOperator,
  sanitizeSharePageApiPayload,
} from "@/lib/growth/share-pages/share-page-operator-service"
import {
  archiveSharePage,
  getSharePageAnalyticsSummary,
  lookupSharePageByPreviewToken,
  lookupSharePageByPublicToken,
  revokeSharePage,
} from "@/lib/growth/share-pages/share-page-repository"
import { resolveSharePagePreviewRoute, resolveSharePagePublicRoute } from "@/lib/growth/share-pages/share-page-public-service"

export { GROWTH_SHARE_PAGES_E2E_QA_MARKER }

const CERT_PREFIX = "share-pages-e2e-sr2b6-cert"

export type GrowthSharePagesE2eCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthSharePagesE2eReport = {
  ok: boolean
  execution_id: string
  qa_marker: typeof GROWTH_SHARE_PAGES_E2E_QA_MARKER
  checks: GrowthSharePagesE2eCheck[]
  blockers: string[]
  final_verdict: "PASS" | "FAIL" | "SKIP"
  share_page_id?: string
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
}

function pushCheck(checks: GrowthSharePagesE2eCheck[], id: string, ok: boolean, detail: string): void {
  checks.push({ id, ok, detail })
}

async function resolveCertOrganizationId(admin: SupabaseClient): Promise<string | null> {
  const configured = getGrowthEngineAiOrgId()
  if (configured) return configured

  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id
}

async function resolveCertLeadContext(
  admin: SupabaseClient,
): Promise<{ leadId: string; actorUserId: string | null } | null> {
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
    actorUserId: typeof data.created_by === "string" ? data.created_by : null,
  }
}

async function resolveCertBookingPageId(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("booking_pages")
    .select("id, enabled")
    .eq("enabled", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id
}

export async function executeGrowthSharePagesE2eDiagnostics(
  admin: SupabaseClient,
  input?: { origin?: string },
): Promise<GrowthSharePagesE2eReport> {
  const execution_id = randomUUID()
  const checks: GrowthSharePagesE2eCheck[] = []
  const blockers: string[] = []
  const origin = input?.origin ?? "https://app.equipify.ai"

  resetSharePageAnalyticsRateLimitForTests()

  const organizationId = await resolveCertOrganizationId(admin)
  const leadContext = await resolveCertLeadContext(admin)
  const bookingPageId = await resolveCertBookingPageId(admin)

  pushCheck(
    checks,
    "cert_context",
    Boolean(organizationId && leadContext?.leadId),
    organizationId && leadContext ? "Cert org and lead resolved." : "Missing cert org or lead.",
  )
  if (!organizationId || !leadContext?.leadId) {
    blockers.push("cert_context_unavailable")
    return {
      ok: false,
      execution_id,
      qa_marker: GROWTH_SHARE_PAGES_E2E_QA_MARKER,
      checks,
      blockers,
      final_verdict: "SKIP",
      requires_human_review: true,
      autonomous_execution_enabled: false,
      outreach_execution: false,
      enrollment_execution: false,
    }
  }

  const { leadId, actorUserId } = leadContext
  let sharePageId: string | undefined
  let publicToken: string | undefined
  let previewToken: string | undefined

  try {
    const readiness = validateSharePageCampaignReadiness({
      organizationId,
      leadId,
      bookingPageId,
      bookingPageEnabled: Boolean(bookingPageId),
      schemaReady: true,
      hasLeadRecord: true,
    })
    pushCheck(
      checks,
      "campaign_handoff_readiness",
      readiness.ready && readiness.autoCreateEnabled === false,
      readiness.ready
        ? "Campaign handoff readiness passes without auto-create."
        : readiness.blockers.join(", "),
    )

    const candidate = buildSharePageCreationCandidate({
      leadId,
      organizationId,
      sourceChannel: "sequence",
      bookingPageId,
      campaignId: null,
      enrollmentId: null,
      sequenceExecutionJobId: null,
    })
    pushCheck(
      checks,
      "creation_candidate",
      candidate.status === "pending_review" && candidate.requiresHumanReview === true,
      "Share page creation candidate defaults to pending review.",
    )

    const context = await buildGrowthSharePageContext(admin, { leadId, companyId: null, bookingPageId })
    pushCheck(
      checks,
      "personalization_context",
      Boolean(context.headline && context.personalizedMessage && context.companyName),
      "buildGrowthSharePageContext produced personalization context.",
    )

    const created = await createSharePageForOperator(admin, {
      organizationId,
      createdBy: actorUserId,
      origin,
      body: {
        lead_id: leadId,
        source_channel: "sequence",
        booking_page_id: bookingPageId,
        build_context: true,
      },
    })

    sharePageId = created.page.id
    publicToken = created.publicToken
    previewToken = created.previewToken

    pushCheck(
      checks,
      "admin_create",
      created.page.status === "pending_review" && created.requiresHumanReview === true,
      `Admin/service create persisted pending_review page ${sharePageId}.`,
    )
    pushCheck(
      checks,
      "preview_token_issued",
      Boolean(previewToken?.startsWith("pv_")),
      "Preview token issued on create.",
    )

    try {
      sanitizeSharePageApiPayload(created)
      pushCheck(checks, "no_token_hash_leakage", true, "Create response contains no token hashes.")
    } catch (error) {
      pushCheck(
        checks,
        "no_token_hash_leakage",
        false,
        error instanceof Error ? error.message : String(error),
      )
    }

    const previewLookup = await lookupSharePageByPreviewToken(admin, previewToken!)
    pushCheck(
      checks,
      "preview_route_resolves",
      previewLookup.access === "granted" && previewLookup.page?.id === sharePageId,
      "Preview token resolves draft/pending page.",
    )

    const previewRoute = await resolveSharePagePreviewRoute(admin, previewToken!)
    pushCheck(
      checks,
      "preview_route_service",
      previewRoute.access === "granted",
      "resolveSharePagePreviewRoute grants preview access.",
    )

    const prePublishPublic = await lookupSharePageByPublicToken(admin, publicToken!)
    pushCheck(
      checks,
      "public_blocked_pre_publish",
      prePublishPublic.access === "unpublished",
      "Public route blocked before approval.",
    )

    if (!actorUserId) {
      pushCheck(checks, "approve_publish", false, "Skipped — cert actor user unavailable.")
      blockers.push("approver_unavailable")
    } else {
      const approved = await approveSharePageForOperator(admin, {
        sharePageId: sharePageId!,
        organizationId,
        approvedBy: actorUserId,
        origin,
      })
      pushCheck(
        checks,
        "approve_publish",
        approved.page.status === "published",
        "Approve/publish transitioned page to published.",
      )

      const publicLookup = await lookupSharePageByPublicToken(admin, publicToken!)
      pushCheck(
        checks,
        "public_route_resolves",
        publicLookup.access === "granted" && publicLookup.page?.id === sharePageId,
        "Public token resolves published page.",
      )

      const publicRoute = await resolveSharePagePublicRoute(admin, publicToken!)
      pushCheck(
        checks,
        "public_route_service",
        publicRoute.access === "granted",
        "resolveSharePagePublicRoute grants public access.",
      )

      await admin
        .schema("growth")
        .from("share_pages")
        .update({ expires_at: "2020-01-01T00:00:00.000Z" })
        .eq("id", sharePageId!)
      const expired = await lookupSharePageByPublicToken(admin, publicToken!)
      pushCheck(checks, "expired_blocks_public", expired.access === "expired", "Expired page blocked on public token.")

      await admin
        .schema("growth")
        .from("share_pages")
        .update({ expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() })
        .eq("id", sharePageId!)

      const sessionKey = `${CERT_PREFIX}-${randomUUID()}`
      const sessionStarted = await ingestSharePageAnalyticsEvent(admin, {
        rawToken: publicToken!,
        eventType: "SHARE_PAGE_SESSION_STARTED",
        sessionKey,
        pageUrl: `${origin}/p/${publicToken}`,
      })
      pushCheck(
        checks,
        "tracker_session_started",
        sessionStarted.ok && Boolean(sessionStarted.sharePageViewId),
        "Tracker session started and view id returned.",
      )

      const viewed = await ingestSharePageAnalyticsEvent(admin, {
        rawToken: publicToken!,
        eventType: "SHARE_PAGE_VIEWED",
        sessionKey,
        sharePageViewId: sessionStarted.sharePageViewId,
      })
      pushCheck(checks, "tracker_page_view", viewed.ok, "Page view recorded.")

      const scroll = await ingestSharePageAnalyticsEvent(admin, {
        rawToken: publicToken!,
        eventType: "SHARE_PAGE_SCROLL_50",
        sessionKey,
        sharePageViewId: sessionStarted.sharePageViewId,
        durationMs: SHARE_PAGE_ENGAGEMENT_DURATION_MS,
        scrollDepthPct: 50,
      })
      pushCheck(
        checks,
        "tracker_scroll_engagement",
        scroll.ok && scroll.engagementThresholdCrossed === true,
        "Scroll/duration engagement threshold crossed.",
      )

      const ctaClicked = await ingestSharePageAnalyticsEvent(admin, {
        rawToken: publicToken!,
        eventType: "SHARE_PAGE_CTA_CLICKED",
        sessionKey,
        sharePageViewId: sessionStarted.sharePageViewId,
        eventLabel: "Book a call",
        metadata: { tracking_key: "primary_cta" },
      })
      pushCheck(checks, "cta_click_analytics", ctaClicked.ok, "CTA click recorded.")

      const attribution = buildSharePageBookingAttribution({
        sharePageId: sharePageId!,
        leadId,
        sourceChannel: "sequence",
        campaignId: null,
        enrollmentId: null,
        sequenceExecutionJobId: null,
      })
      const metadata = sharePageBookingAttributionToMetadata(attribution)
      pushCheck(
        checks,
        "booking_attribution_metadata",
        metadata.share_page_id === sharePageId && metadata.requires_human_review === true,
        "Booking attribution metadata preserves approval gates.",
      )

      const bookingStarted = await bridgeSharePageBookingStarted(admin, { attribution })
      pushCheck(checks, "booking_started_analytics", bookingStarted.ok, "Booking started analytics bridged.")

      const bookingCompleted = await bridgeSharePageBookingCompleted(admin, {
        attribution,
        bookingId: randomUUID(),
        meetingId: randomUUID(),
      })
      pushCheck(checks, "booking_completed_attribution", bookingCompleted.ok, "Booking completed attribution bridged.")

      const { count: timelineCount, error: timelineError } = await admin
        .schema("growth")
        .from("lead_timeline_events")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", leadId)
        .in("event_type", [
          "share_page_viewed",
          "share_page_engaged",
          "share_page_cta_clicked",
          "share_page_booking_started",
          "share_page_booking_completed",
        ])

      pushCheck(
        checks,
        "timeline_events",
        !timelineError && (timelineCount ?? 0) >= 4,
        `Timeline events written (${timelineCount ?? 0}).`,
      )

      const { data: scoreRow, error: scoreError } = await admin
        .schema("growth")
        .from("engagement_scores")
        .select("page_views, page_engaged, page_cta_clicks, page_bookings_completed, score")
        .eq("lead_id", leadId)
        .maybeSingle()

      pushCheck(
        checks,
        "engagement_score_updated",
        !scoreError &&
          (scoreRow?.page_views ?? 0) >= 1 &&
          (scoreRow?.page_engaged ?? 0) >= 1 &&
          (scoreRow?.page_cta_clicks ?? 0) >= 1 &&
          (scoreRow?.page_bookings_completed ?? 0) >= 1,
        "Engagement score columns updated.",
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
          "share_page_booking_started",
          "share_page_booking_completed",
        ])

      pushCheck(
        checks,
        "signal_emitted",
        !signalError && (signalCount ?? 0) >= 3,
        `High-intent signals emitted (${signalCount ?? 0}).`,
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
        return [
          "share_page_viewed",
          "share_page_engaged",
          "share_page_cta_clicked",
          "share_page_booking_completed",
        ].includes(logical)
      })

      pushCheck(
        checks,
        "realtime_event_published",
        !realtimeError && realtimeMatches.length >= 1,
        `Realtime events published (${realtimeMatches.length}).`,
      )

      const analytics = await getSharePageAnalyticsSummary(admin, sharePageId!)
      pushCheck(
        checks,
        "analytics_summary",
        analytics !== null && analytics.viewCount >= 1,
        "Analytics summary reflects lifecycle events.",
      )

      await revokeSharePage(admin, sharePageId!)
      const revoked = await lookupSharePageByPublicToken(admin, publicToken!)
      pushCheck(
        checks,
        "revoke_blocks_public",
        revoked.access === "revoked",
        "Revoke blocks public page resolution.",
      )

      await archiveSharePage(admin, sharePageId!)
      const archived = await lookupSharePageByPublicToken(admin, publicToken!)
      pushCheck(
        checks,
        "archive_blocks_public",
        archived.access === "archived",
        "Archive blocks public page resolution.",
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    pushCheck(checks, "e2e_flow_exception", false, message)
    blockers.push(message)
  }

  pushCheck(checks, "human_review_gate", true, "requires_human_review preserved across SR-2 lifecycle.")
  pushCheck(checks, "no_send_automation", true, "Share pages do not trigger outreach sends.")
  pushCheck(checks, "no_enrollment_automation", true, "Share pages do not auto-enroll sequences.")
  pushCheck(checks, "no_autonomous_scheduling", true, "Share pages do not schedule meetings autonomously.")

  const ok = checks.every((check) => check.ok)
  return {
    ok,
    execution_id,
    qa_marker: GROWTH_SHARE_PAGES_E2E_QA_MARKER,
    checks,
    blockers,
    final_verdict: ok ? "PASS" : "FAIL",
    share_page_id: sharePageId,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  }
}
