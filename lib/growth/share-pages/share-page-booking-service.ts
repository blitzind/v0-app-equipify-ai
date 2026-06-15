import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthBookingPageById } from "@/lib/growth/booking/booking-page-repository"
import {
  buildSharePageBookingAttribution,
  buildSharePageBookingUrl,
  type GrowthSharePageBookingAttribution,
  type GrowthSharePageBookingRenderModel,
} from "@/lib/growth/share-pages/share-page-booking-attribution"
import type { GrowthSharePage } from "@/lib/growth/share-pages/share-page-types"

export async function resolveSharePageBookingRenderModel(
  admin: SupabaseClient,
  page: GrowthSharePage,
  input: { previewMode: boolean },
): Promise<GrowthSharePageBookingRenderModel | null> {
  if (!page.bookingPageId) return null

  const bookingPage = await fetchGrowthBookingPageById(admin, page.bookingPageId)
  if (!bookingPage || !bookingPage.enabled) return null

  const attribution = buildSharePageBookingAttribution({
    sharePageId: page.id,
    leadId: page.leadId,
    sourceChannel: page.sourceChannel,
    campaignId: page.campaignId,
    enrollmentId: page.enrollmentId,
    sequenceExecutionJobId: page.sequenceExecutionJobId,
  })

  const bookingUrl = buildSharePageBookingUrl(bookingPage.slug, attribution, {
    preview: input.previewMode,
  })

  return {
    bookingPageId: bookingPage.id,
    slug: bookingPage.slug,
    name: bookingPage.name,
    bookingUrl,
    embedUrl: bookingUrl,
    disabled: input.previewMode,
  }
}

export async function fetchSharePageForBookingAttribution(
  admin: SupabaseClient,
  attribution: GrowthSharePageBookingAttribution,
): Promise<GrowthSharePage | null> {
  const { fetchGrowthSharePageById } = await import("@/lib/growth/share-pages/share-page-repository")
  const page = await fetchGrowthSharePageById(admin, attribution.sharePageId)
  if (!page) return null
  if (page.leadId !== attribution.leadId) return null
  if (page.status !== "published" || page.revokedAt || page.archivedAt) return null
  return page
}
