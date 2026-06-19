/**
 * One-off A3 production integration — service-role lifecycle + HTTP probes.
 * Not committed; run via vercel-production-env-run.
 */

import assert from "node:assert/strict"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { resolveGrowthDeployedRuntimeBaseUrl } from "@/lib/growth/qa/growth-provider-deployed-runtime-probe"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import { createGrowthVideoPageEventService } from "@/lib/growth/videos/growth-video-page-event-service"
import { resolveGrowthVideoPublicPageBySlug } from "@/lib/growth/videos/growth-video-public-page-service"
import {
  createGrowthVideoUploadAsset,
  createGrowthVideoUploadUrl,
  completeGrowthVideoUpload,
} from "@/lib/growth/videos/growth-video-upload-service"
import { createGrowthVideoService } from "@/lib/growth/videos/growth-video-service"
import { GROWTH_VIDEO_PAGES_QA_MARKER } from "@/lib/growth/videos/growth-video-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const CERT_SLUG_PREFIX = "growth-video-pages-a3-cert"

async function findReadyAsset(
  admin: ReturnType<typeof createClient>,
  orgId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("video_assets")
    .select("id, status, upload_status")
    .eq("organization_id", orgId)
    .eq("status", "ready")
    .eq("upload_status", "uploaded")
    .limit(1)

  if (error) throw new Error(error.message)
  return data?.[0]?.id ?? null
}

async function ensureCertVideoAsset(
  admin: ReturnType<typeof createClient>,
  orgId: string,
): Promise<{ assetId: string; created: boolean }> {
  const existing = await findReadyAsset(admin, orgId)
  if (existing) return { assetId: existing, created: false }

  const asset = await createGrowthVideoUploadAsset(admin, {
    organizationId: orgId,
    title: "A3 production cert asset",
    originalFilename: "a3-cert.mp4",
    mimeType: "video/mp4",
    fileSizeBytes: 1024,
    sourceType: "upload",
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

  await completeGrowthVideoUpload(admin, {
    organizationId: orgId,
    assetId: asset.id,
    fileSizeBytes: 1024,
  })

  return { assetId: asset.id, created: true }
}

async function probeHttpPublicRoute(baseUrl: string, slug: string): Promise<{
  status: number
  not_found: boolean
}> {
  const url = `${baseUrl.replace(/\/$/, "")}/v/${encodeURIComponent(slug)}`
  const response = await fetch(url, { redirect: "follow" })
  return { status: response.status, not_found: response.status === 404 }
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
  if (!orgId) throw new Error("missing_GROWTH_ENGINE_AI_ORG_ID")

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const pageService = createGrowthVideoPageService(admin)
  const eventService = createGrowthVideoPageEventService(admin)
  const videoService = createGrowthVideoService(admin)

  const certAsset = await ensureCertVideoAsset(admin, orgId)
  const assetId = certAsset.assetId

  const slug = `${CERT_SLUG_PREFIX}-${Date.now().toString(36)}`
  const sessionId = `cert-session-${Date.now()}`

  const report: Record<string, unknown> = {
    qa_marker: GROWTH_VIDEO_PAGES_QA_MARKER,
    org_id: orgId,
    asset_id: assetId,
    cert_asset_created: certAsset.created,
    slug,
    checks: {} as Record<string, unknown>,
  }

  let pageId: string | null = null

  try {
    const draft = await pageService.createPage({
      organizationId: orgId,
      videoAssetId: assetId,
      slug,
      title: "A3 Production Cert Page",
      description: "Certification draft description",
      ctaLabel: "Book a demo",
      ctaUrl: "https://equipify.ai/demo",
      calendarUrl: "https://cal.com/equipify",
      branding: {
        logoUrl: "https://equipify.ai/logo.png",
        primaryColor: "#2563eb",
        buttonLabelOverride: "Schedule now",
      },
    })
    pageId = draft.id
    assert.equal(draft.status, "draft")

    const draftResolve = await resolveGrowthVideoPublicPageBySlug(admin, slug)
    assert.equal(draftResolve.ok, false)
    if (draftResolve.ok) throw new Error("draft_should_not_resolve")
    assert.equal(draftResolve.error, "not_found")
    ;(report.checks as Record<string, unknown>).draft_not_public = true

    let slugConflict = false
    try {
      await pageService.createPage({
        organizationId: orgId,
        videoAssetId: assetId,
        slug,
        title: "Duplicate slug test",
      })
    } catch (error) {
      slugConflict = error instanceof Error && error.message === "slug_conflict"
    }
    assert.equal(slugConflict, true)
    ;(report.checks as Record<string, unknown>).slug_unique_per_org = true

    const published = await pageService.publishPage({ organizationId: orgId, pageId: draft.id })
    assert.equal(published.status, "published")

    const pubResolve = await resolveGrowthVideoPublicPageBySlug(admin, slug)
    assert.equal(pubResolve.ok, true)
    if (!pubResolve.ok) throw new Error("expected_published_resolve")
    assert.ok(pubResolve.page.playbackUrl?.startsWith("http"))
    assert.equal(pubResolve.page.title, "A3 Production Cert Page")
    assert.equal(pubResolve.page.ctaLabel, "Book a demo")
    assert.equal(pubResolve.page.calendarUrl, "https://cal.com/equipify")
    assert.equal(pubResolve.page.branding.primaryColor, "#2563eb")
    const publicPayload = { ...pubResolve.page, playbackUrl: undefined }
    const publicJson = JSON.stringify(publicPayload)
    assert.ok(!publicJson.includes(orgId), "organization_id leaked in public payload fields")
    ;(report.checks as Record<string, unknown>).published_public_resolve = {
      playback_url: Boolean(pubResolve.page.playbackUrl),
      no_org_leak: true,
    }

    const eventTypes = [
      "page_view",
      "video_play",
      "video_progress",
      "video_complete",
      "cta_click",
      "calendar_click",
    ] as const

    for (const eventType of eventTypes) {
      const result = await eventService.ingestPublicEvent({
        slug,
        eventType,
        sessionId,
        metadata: { cert: true, progress_pct: eventType === "video_progress" ? 30 : undefined },
      })
      assert.equal(result.ok, true)
    }

    const counts = await pageService.countEventsForPage({ organizationId: orgId, pageId: draft.id })
    for (const eventType of eventTypes) {
      assert.ok((counts[eventType] ?? 0) >= 1, `missing event ${eventType}`)
    }
    ;(report.checks as Record<string, unknown>).event_counts = counts

    const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim()
    if (anonKey) {
      const anon = createClient(boot.url, anonKey, { auth: { persistSession: false } })
      const { error: anonPagesError } = await anon.schema("growth").from("video_pages").select("id").limit(1)
      const { error: anonEventsError } = await anon.schema("growth").from("video_page_events").select("id").limit(1)
      ;(report.checks as Record<string, unknown>).anon_rls_blocked = {
        video_pages: Boolean(anonPagesError),
        video_page_events: Boolean(anonEventsError),
      }
    }

    const baseUrl = resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai"
    const httpPublished = await probeHttpPublicRoute(baseUrl, slug)
    ;(report.checks as Record<string, unknown>).http_published = httpPublished

    await pageService.archivePage({ organizationId: orgId, pageId: draft.id })
    const archivedResolve = await resolveGrowthVideoPublicPageBySlug(admin, slug)
    assert.equal(archivedResolve.ok, false)
    const httpArchived = await probeHttpPublicRoute(baseUrl, slug)
    ;(report.checks as Record<string, unknown>).http_archived = httpArchived
    ;(report.checks as Record<string, unknown>).archived_not_public = archivedResolve.error === "not_found"

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
        // best-effort cleanup
      }
    }
    if (certAsset.created) {
      try {
        await videoService.deleteAsset({ organizationId: orgId, assetId })
      } catch {
        // best-effort cleanup
      }
    }
  }

  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
