/** Growth Engine SR-2B-4 — Share page booking diagnostics & certification. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { fetchGrowthBookingPageById } from "@/lib/growth/booking/booking-page-repository"
import { bridgeSharePageBookingCompleted, bridgeSharePageBookingStarted } from "@/lib/growth/share-pages/share-page-booking-bridge"
import {
  buildSharePageBookingAttribution,
  buildSharePageBookingUrl,
  sharePageBookingAttributionToMetadata,
} from "@/lib/growth/share-pages/share-page-booking-attribution"
import { resolveSharePageBookingRenderModel } from "@/lib/growth/share-pages/share-page-booking-service"
import {
  approveSharePage,
  createSharePage,
  updateSharePage,
} from "@/lib/growth/share-pages/share-page-repository"
import {
  GROWTH_SHARE_PAGES_BOOKING_CONFIRM,
  GROWTH_SHARE_PAGES_BOOKING_MIGRATION,
  GROWTH_SHARE_PAGES_BOOKING_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-types"

export { GROWTH_SHARE_PAGES_BOOKING_CONFIRM }

const CERT_PREFIX = "share-pages-booking-sr2b4-cert"

export type GrowthSharePageBookingDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthSharePageBookingDiagnosticsReport = {
  ok: boolean
  execution_id: string
  qa_marker: typeof GROWTH_SHARE_PAGES_BOOKING_QA_MARKER
  migration: typeof GROWTH_SHARE_PAGES_BOOKING_MIGRATION
  checks: GrowthSharePageBookingDiagnosticsCheck[]
  blockers: string[]
  final_verdict: "PASS" | "FAIL" | "SKIP"
  share_page_id?: string
  booking_page_id?: string
}

function pushCheck(
  checks: GrowthSharePageBookingDiagnosticsCheck[],
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

async function resolveCertBookingPageId(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("booking_pages")
    .select("id")
    .eq("enabled", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id
}

export async function executeGrowthSharePageBookingDiagnostics(
  admin: SupabaseClient,
): Promise<GrowthSharePageBookingDiagnosticsReport> {
  const execution_id = randomUUID()
  const checks: GrowthSharePageBookingDiagnosticsCheck[] = []
  const blockers: string[] = []

  const attribution = buildSharePageBookingAttribution({
    sharePageId: randomUUID(),
    leadId: randomUUID(),
    sourceChannel: "email",
    campaignId: randomUUID(),
  })
  const bookingUrl = buildSharePageBookingUrl("demo-booking", attribution)
  pushCheck(
    checks,
    "booking_url_attribution",
    bookingUrl.includes("ref=share_page") &&
      bookingUrl.includes(`share_page_id=${attribution.sharePageId}`) &&
      bookingUrl.includes(`lead_id=${attribution.leadId}`) &&
      bookingUrl.includes("source_channel=email") &&
      !bookingUrl.includes("token_hash"),
    "Booking URL includes share page attribution query params.",
  )

  const previewUrl = buildSharePageBookingUrl("demo-booking", attribution, { preview: true })
  pushCheck(
    checks,
    "preview_booking_url",
    previewUrl.includes("preview=1"),
    "Preview booking URL flagged for preview-only behavior.",
  )

  const metadata = sharePageBookingAttributionToMetadata(attribution)
  pushCheck(
    checks,
    "booking_metadata_shape",
    metadata.share_page_id === attribution.sharePageId && metadata.requires_human_review === true,
    "Booking metadata preserves approval gates.",
  )

  const { error: metadataColumnError } = await admin
    .schema("growth")
    .from("booking_page_bookings")
    .select("metadata")
    .limit(1)

  pushCheck(
    checks,
    "booking_metadata_column",
    !metadataColumnError,
    metadataColumnError ? `Booking metadata column unavailable: ${metadataColumnError.message}` : "Booking metadata column available.",
  )
  if (metadataColumnError) blockers.push("booking_metadata_migration_not_applied")

  const organizationId = await resolveCertOrganizationId(admin)
  const leadContext = await resolveCertLeadId(admin)
  const bookingPageId = await resolveCertBookingPageId(admin)

  if (!organizationId || !leadContext || !bookingPageId) {
    pushCheck(checks, "booking_integration", false, "Skipped integration — org, lead, or enabled booking page unavailable.")
    if (!bookingPageId) blockers.push("enabled_booking_page_unavailable")
    const ok = checks.every((check) => check.ok)
    return {
      ok,
      execution_id,
      qa_marker: GROWTH_SHARE_PAGES_BOOKING_QA_MARKER,
      migration: GROWTH_SHARE_PAGES_BOOKING_MIGRATION,
      checks,
      blockers,
      final_verdict: ok ? "PASS" : "FAIL",
    }
  }

  const { leadId, approverUserId } = leadContext
  if (!approverUserId) {
    pushCheck(checks, "booking_integration", false, "Skipped integration — approver user id unavailable.")
    blockers.push("approver_unavailable")
    const ok = checks.every((check) => check.ok)
    return {
      ok,
      execution_id,
      qa_marker: GROWTH_SHARE_PAGES_BOOKING_QA_MARKER,
      migration: GROWTH_SHARE_PAGES_BOOKING_MIGRATION,
      checks,
      blockers,
      final_verdict: ok ? "PASS" : "FAIL",
    }
  }

  const created = await createSharePage(admin, {
    organizationId,
    leadId,
    sourceChannel: "sequence",
    status: "draft",
    headline: `${CERT_PREFIX} headline`,
    heroMessage: `${CERT_PREFIX} hero`,
    bookingPageId,
    campaignId: null,
    createdBy: approverUserId,
  })

  await updateSharePage(admin, created.page.id, { status: "pending_review" })
  await approveSharePage(admin, created.page.id, { approvedBy: approverUserId })

  const publicBooking = await resolveSharePageBookingRenderModel(admin, created.page, { previewMode: false })
  pushCheck(
    checks,
    "booking_page_resolution",
    publicBooking !== null && publicBooking.slug.length > 0 && !publicBooking.disabled,
    "Published share page resolved enabled booking page.",
  )

  const previewBooking = await resolveSharePageBookingRenderModel(admin, created.page, { previewMode: true })
  pushCheck(
    checks,
    "preview_booking_disabled",
    previewBooking !== null && previewBooking.disabled === true,
    "Preview mode disables booking interactions.",
  )

  const bookingPage = await fetchGrowthBookingPageById(admin, bookingPageId)
  const liveAttribution = buildSharePageBookingAttribution({
    sharePageId: created.page.id,
    leadId,
    sourceChannel: created.page.sourceChannel,
    campaignId: created.page.campaignId,
    enrollmentId: created.page.enrollmentId,
    sequenceExecutionJobId: created.page.sequenceExecutionJobId,
  })

  const started = await bridgeSharePageBookingStarted(admin, { attribution: liveAttribution })
  pushCheck(checks, "booking_started_bridge", started.ok, "Share page booking started bridge accepted.")

  const completed = await bridgeSharePageBookingCompleted(admin, {
    attribution: liveAttribution,
    bookingId: randomUUID(),
    meetingId: randomUUID(),
  })
  pushCheck(checks, "booking_completed_bridge", completed.ok, "Share page booking completed bridge accepted.")

  const { count: timelineCount, error: timelineError } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("event_type", "share_page_booking_completed")

  pushCheck(
    checks,
    "timeline_integration",
    !timelineError && (timelineCount ?? 0) >= 1,
    `Share page booking completed timeline recorded (${timelineCount ?? 0}).`,
  )

  const { data: scoreRow, error: scoreError } = await admin
    .schema("growth")
    .from("engagement_scores")
    .select("page_bookings_completed, score")
    .eq("lead_id", leadId)
    .maybeSingle()

  pushCheck(
    checks,
    "engagement_score_update",
    !scoreError && (scoreRow?.page_bookings_completed ?? 0) >= 1,
    "Completed booking incremented page_bookings_completed.",
  )

  const { count: signalCount, error: signalError } = await admin
    .schema("growth")
    .from("signals")
    .select("id", { count: "exact", head: true })
    .eq("provider_key", "share_page_analytics")
    .eq("signal_type", "share_page_booking_completed")

  pushCheck(
    checks,
    "signal_creation",
    !signalError && (signalCount ?? 0) >= 1,
    `Share page booking completed signal persisted (${signalCount ?? 0}).`,
  )

  const { data: realtimeRows, error: realtimeError } = await admin
    .schema("growth")
    .from("signal_events")
    .select("event_payload")
    .contains("event_payload", { realtime_event: true })
    .order("occurred_at", { ascending: false })
    .limit(30)

  const realtimeMatches = (realtimeRows ?? []).filter((row) => {
    const payload = row.event_payload as Record<string, unknown> | null
    return payload?.logical_event_type === "share_page_booking_completed"
  })

  pushCheck(
    checks,
    "realtime_publication",
    !realtimeError && realtimeMatches.length >= 1,
    `Share page booking completed realtime published (${realtimeMatches.length}).`,
  )

  pushCheck(
    checks,
    "booking_slug_match",
    bookingPage?.slug === publicBooking?.slug,
    "Resolved booking slug matches linked booking page.",
  )

  const ok = checks.every((check) => check.ok)
  return {
    ok,
    execution_id,
    qa_marker: GROWTH_SHARE_PAGES_BOOKING_QA_MARKER,
    migration: GROWTH_SHARE_PAGES_BOOKING_MIGRATION,
    checks,
    blockers,
    final_verdict: ok ? "PASS" : "FAIL",
    share_page_id: created.page.id,
    booking_page_id: bookingPageId,
  }
}
