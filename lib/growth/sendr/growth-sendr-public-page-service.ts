import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SENDR_PUBLIC_QA_MARKER,
  type GrowthSendrLandingPageSectionType,
} from "@/lib/growth/sendr/growth-sendr-config"
import { getGrowthSendrBookingAsset } from "@/lib/growth/sendr/growth-sendr-booking-runtime-repository"
import {
  getGrowthSendrLandingPageByPublishedSlug,
  getLatestSendrPublicationForPage,
} from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import { isValidSendrPublicSlug, normalizeSendrSlugInput } from "@/lib/growth/sendr/growth-sendr-slug-runtime"
import type {
  GrowthSendrPublicPagePayload,
  GrowthSendrPublicPageSection,
} from "@/lib/growth/sendr/growth-sendr-types"
import { getGrowthSendrVideoAsset } from "@/lib/growth/sendr/growth-sendr-video-runtime-repository"
import { probeSendrSchemaReady } from "@/lib/growth/sendr/growth-sendr-schema-health"
import {
  personalizeSendrPublicPagePayload,
  resolveSendrVisitorLeadId,
} from "@/lib/growth/sendr/growth-sendr-visitor-personalization-service"
import type { SendrVisitorRenderContext } from "@/lib/growth/sendr/growth-sendr-visitor-render-context"

type PublicationSnapshot = {
  page?: Record<string, unknown>
  sections?: Array<Record<string, unknown>>
}

function sanitizeSection(row: Record<string, unknown>): GrowthSendrPublicPageSection {
  return {
    type: String(row.sectionType ?? row.section_type ?? "text") as GrowthSendrLandingPageSectionType,
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
    content: (row.content as Record<string, unknown>) ?? {},
  }
}

function snapshotFromPublication(
  snapshot: PublicationSnapshot,
  fallbackTitle: string,
  publishedVersion: number,
  publishedAt: string,
): GrowthSendrPublicPagePayload {
  const page = snapshot.page ?? {}
  const sections = (snapshot.sections ?? []).map((row) => sanitizeSection(row))
  return {
    title: String(page.title ?? fallbackTitle),
    publishedVersion,
    publishedAt,
    sections,
    video: null,
    booking: null,
  }
}

export async function loadSendrPublicPageBySlug(
  admin: SupabaseClient,
  rawSlug: string,
  renderContext?: SendrVisitorRenderContext,
): Promise<
  | { ok: true; slug: string; payload: GrowthSendrPublicPagePayload }
  | { ok: false; status: number; error: string }
> {
  if (!(await probeSendrSchemaReady(admin))) {
    return { ok: false, status: 503, error: "schema_not_ready" }
  }

  const slug = normalizeSendrSlugInput(rawSlug)
  if (!isValidSendrPublicSlug(slug)) {
    return { ok: false, status: 404, error: "not_found" }
  }

  const page = await getGrowthSendrLandingPageByPublishedSlug(admin, slug)
  if (!page || page.status !== "published") {
    return { ok: false, status: 404, error: "not_found" }
  }

  const publication = await getLatestSendrPublicationForPage(admin, page.id)
  if (!publication?.versionSnapshot) {
    return { ok: false, status: 404, error: "snapshot_not_found" }
  }

  const snapshot = publication.versionSnapshot as PublicationSnapshot
  const payload = snapshotFromPublication(
    snapshot,
    page.title,
    page.publishedVersion ?? publication.versionNumber ?? 1,
    page.publishedAt ?? publication.publishedAt,
  )

  const videoAssetId =
    typeof page.mobileMetadata.videoAssetId === "string" ? page.mobileMetadata.videoAssetId : null
  const bookingAssetId =
    typeof page.mobileMetadata.bookingAssetId === "string" ? page.mobileMetadata.bookingAssetId : null

  if (videoAssetId) {
    const video = await getGrowthSendrVideoAsset(admin, videoAssetId)
    if (video) {
      payload.video = {
        sourceUrl: video.sourceUrl,
        posterUrl: video.posterUrl,
        durationSeconds: video.durationSeconds,
      }
    }
  }

  if (bookingAssetId) {
    const booking = await getGrowthSendrBookingAsset(admin, bookingAssetId)
    if (booking) {
      payload.booking = {
        meetingLink: booking.meetingLink,
        meetingType: booking.meetingType,
        durationMinutes: booking.durationMinutes,
        timezone: booking.timezone,
      }
    }
  }

  const personalizedPayload = await personalizeSendrPublicPagePayload(admin, {
    page,
    payload,
    renderContext,
  })

  return { ok: true, slug, payload: personalizedPayload }
}

export type SendrPublicPageContext = {
  organizationId: string
  landingPageId: string
  leadId: string | null
  publishedSlug: string
  videoAssetId: string | null
  bookingAssetId: string | null
}

export async function resolveSendrPublicPageContext(
  admin: SupabaseClient,
  rawSlug: string,
  renderContext?: SendrVisitorRenderContext,
): Promise<SendrPublicPageContext | null> {
  const slug = normalizeSendrSlugInput(rawSlug)
  if (!isValidSendrPublicSlug(slug)) return null

  const page = await getGrowthSendrLandingPageByPublishedSlug(admin, slug)
  if (!page || page.status !== "published") return null

  const visitorLead = await resolveSendrVisitorLeadId(admin, page, renderContext)

  return {
    organizationId: page.organizationId,
    landingPageId: page.id,
    leadId: visitorLead.leadId ?? page.leadId,
    publishedSlug: slug,
    videoAssetId:
      typeof page.mobileMetadata.videoAssetId === "string" ? page.mobileMetadata.videoAssetId : null,
    bookingAssetId:
      typeof page.mobileMetadata.bookingAssetId === "string" ? page.mobileMetadata.bookingAssetId : null,
  }
}

export { GROWTH_SENDR_PUBLIC_QA_MARKER }
