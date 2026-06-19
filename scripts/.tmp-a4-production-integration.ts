/**
 * A4 production integration — events, summaries, scoring, AI signals.
 */
import assert from "node:assert/strict"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  createGrowthVideoAnalyticsSummaryService,
} from "@/lib/growth/videos/growth-video-analytics-summary-service"
import { createGrowthVideoPageEventService } from "@/lib/growth/videos/growth-video-page-event-service"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import {
  createGrowthVideoUploadAsset,
  createGrowthVideoUploadUrl,
  completeGrowthVideoUpload,
} from "@/lib/growth/videos/growth-video-upload-service"
import { createGrowthVideoService } from "@/lib/growth/videos/growth-video-service"
import {
  GROWTH_VIDEO_ANALYTICS_QA_MARKER,
  GROWTH_VIDEO_AI_ENGAGEMENT_SIGNALS,
} from "@/lib/growth/videos/growth-video-types"
import { GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES } from "@/lib/growth/videos/growth-video-engagement-scoring-service"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const CERT_SLUG_PREFIX = "growth-video-analytics-a4-cert"

async function ensureCertAsset(admin: ReturnType<typeof createClient>, orgId: string) {
  const { data } = await admin
    .schema("growth")
    .from("video_assets")
    .select("id")
    .eq("organization_id", orgId)
    .eq("status", "ready")
    .eq("upload_status", "uploaded")
    .limit(1)
  if (data?.[0]?.id) return { assetId: data[0].id as string, created: false }

  const asset = await createGrowthVideoUploadAsset(admin, {
    organizationId: orgId,
    title: "A4 cert asset",
    originalFilename: "a4-cert.mp4",
    mimeType: "video/mp4",
    fileSizeBytes: 1024,
  })
  const upload = await createGrowthVideoUploadUrl(admin, {
    organizationId: orgId,
    assetId: asset.id,
    mimeType: "video/mp4",
    fileSizeBytes: 1024,
  })
  if (upload.uploadUrl) {
    await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4" },
      body: Buffer.alloc(1024),
    })
  }
  await completeGrowthVideoUpload(admin, { organizationId: orgId, assetId: asset.id, fileSizeBytes: 1024 })
  return { assetId: asset.id, created: true }
}

async function main(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) throw new Error("supabase_unavailable")

  const orgId = (process.env.GROWTH_ENGINE_AI_ORG_ID ?? "").trim()
  if (!orgId) throw new Error("missing_org")

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const pageService = createGrowthVideoPageService(admin)
  const eventService = createGrowthVideoPageEventService(admin)
  const summaryService = createGrowthVideoAnalyticsSummaryService(admin)
  const videoService = createGrowthVideoService(admin)

  const certAsset = await ensureCertAsset(admin, orgId)
  const slug = `${CERT_SLUG_PREFIX}-${Date.now().toString(36)}`
  const sessionId = `a4-cert-${Date.now()}`
  const visitorId = `visitor-a4-${Date.now()}`

  const report: Record<string, unknown> = {
    qa_marker: GROWTH_VIDEO_ANALYTICS_QA_MARKER,
    checks: {} as Record<string, unknown>,
  }

  let pageId: string | null = null

  try {
    const page = await pageService.createPage({
      organizationId: orgId,
      videoAssetId: certAsset.assetId,
      slug,
      title: "A4 Analytics Cert",
      ctaLabel: "Book demo",
      ctaUrl: "https://equipify.ai/demo",
      calendarUrl: "https://cal.com/equipify",
    })
    pageId = page.id
    await pageService.publishPage({ organizationId: orgId, pageId: page.id })

    const events: Array<{ type: string; metadata?: Record<string, unknown> }> = [
      { type: "page_view" },
      { type: "video_play" },
      { type: "video_progress", metadata: { percent: 30 } },
      { type: "video_progress", metadata: { percent: 55 } },
      { type: "video_progress", metadata: { percent: 80 } },
      { type: "video_complete", metadata: { percent: 95 } },
      { type: "cta_click" },
      { type: "calendar_click" },
    ]

    for (const event of events) {
      const result = await eventService.ingestPublicEvent({
        slug,
        eventType: event.type,
        sessionId,
        visitorIdentifier: visitorId,
        metadata: event.metadata ?? {},
      })
      assert.equal(result.ok, true)
    }

    const { count: eventCount } = await admin
      .schema("growth")
      .from("video_page_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("video_page_id", pageId)
      .eq("session_id", sessionId)
    assert.equal(eventCount, events.length)
    ;(report.checks as Record<string, unknown>).events_written = eventCount

    const rebuild = await summaryService.rebuildSummariesFromEvents({
      organizationId: orgId,
      videoPageId: pageId,
    })
    assert.equal(rebuild.ok, true)
    ;(report.checks as Record<string, unknown>).summaries_rebuilt = rebuild.rebuilt

    const { data: summaryRows, error: summaryError } = await admin
      .schema("growth")
      .from("video_engagement_summaries")
      .select(
        "organization_id, video_asset_id, video_page_id, visitor_identifier, session_id, total_views, total_watch_seconds, highest_percent_watched, total_cta_clicks, total_calendar_clicks, engagement_score, metadata_json",
      )
      .eq("organization_id", orgId)
      .eq("video_page_id", pageId)
      .eq("session_id", sessionId)
      .single()

    if (summaryError) throw new Error(summaryError.message)
    const summary = summaryRows as Record<string, unknown>
    assert.equal(summary.organization_id, orgId)
    assert.equal(summary.video_asset_id, certAsset.assetId)
    assert.equal(summary.video_page_id, pageId)
    assert.equal(summary.visitor_identifier, visitorId)
    assert.equal(summary.session_id, sessionId)
    assert.ok(Number(summary.total_views) >= 1)
    assert.ok(Number(summary.highest_percent_watched) >= 90)
    assert.equal(Number(summary.total_cta_clicks), 1)
    assert.equal(Number(summary.total_calendar_clicks), 1)
    assert.equal(Number(summary.engagement_score), GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES.calendar_click)
    ;(report.checks as Record<string, unknown>).summary_row = summary

    const metadata = summary.metadata_json as Record<string, unknown>
    const aiSignals = metadata.ai_signals as Record<string, boolean>
    assert.equal(aiSignals.video_viewed, true)
    assert.equal(aiSignals.video_cta_clicked, true)
    assert.equal(aiSignals.video_calendar_clicked, true)
    assert.equal(aiSignals.video_high_intent, true)
    assert.ok(typeof metadata.ai_engagement_summary === "string")
    for (const signal of GROWTH_VIDEO_AI_ENGAGEMENT_SIGNALS) {
      assert.ok(signal in aiSignals)
    }
    ;(report.checks as Record<string, unknown>).ai_signals = aiSignals

    const session2 = `${sessionId}-return`
    await eventService.ingestPublicEvent({
      slug,
      eventType: "page_view",
      sessionId: session2,
      visitorIdentifier: visitorId,
    })
    await summaryService.rebuildSummariesFromEvents({ organizationId: orgId, videoPageId: pageId })

    const { data: returnSummary } = await admin
      .schema("growth")
      .from("video_engagement_summaries")
      .select("engagement_score, metadata_json")
      .eq("organization_id", orgId)
      .eq("session_id", session2)
      .single()

    const returnMeta = (returnSummary as { metadata_json: Record<string, unknown> }).metadata_json
    const returnSignals = returnMeta.ai_signals as Record<string, boolean>
    assert.equal(returnSignals.video_return_visitor, true)
  assert.ok(
      Number((returnSummary as { engagement_score: number }).engagement_score) >
        GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES.page_view,
    )
    ;(report.checks as Record<string, unknown>).return_visitor_bonus = true

    const overview = await summaryService.buildOverview({ organizationId: orgId, videoPageId: pageId })
    assert.ok(overview.totalViews >= 2)
    ;(report.checks as Record<string, unknown>).dashboard_overview = overview

    report.ok = true
    report.final_verdict = "PASS"
  } catch (error) {
    report.ok = false
    report.final_verdict = "FAIL"
    report.error = error instanceof Error ? error.message : String(error)
  } finally {
    if (pageId) {
      try {
        await pageService.deletePage({ organizationId: orgId, pageId })
      } catch {
        /* cleanup */
      }
    }
    if (certAsset.created) {
      try {
        await videoService.deleteAsset({ organizationId: orgId, assetId: certAsset.assetId })
      } catch {
        /* cleanup */
      }
    }
    await admin
      .schema("growth")
      .from("video_engagement_summaries")
      .delete()
      .eq("organization_id", orgId)
      .like("session_id", "a4-cert-%")
    await admin
      .schema("growth")
      .from("video_page_events")
      .delete()
      .eq("organization_id", orgId)
      .like("session_id", "a4-cert-%")
  }

  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
