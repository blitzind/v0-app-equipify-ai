import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getSendrPageAttachmentPreview } from "@/lib/growth/sendr/growth-sendr-asset-picker-service"
import { attachSendrPageToSequence } from "@/lib/growth/sendr/growth-sendr-sequence-bridge-service"
import type { GrowthSendrLandingPage } from "@/lib/growth/sendr/growth-sendr-types"

export type GrowthSendrEnrollmentPageAttachment = {
  landingPageId: string
  title: string
  slug: string | null
  publishedAt: string | null
  publicUrl: string | null
  videoAssetId: string | null
  bookingAssetId: string | null
}

export async function buildSendrEnrollmentPageAttachment(
  admin: SupabaseClient,
  landingPageId: string,
): Promise<GrowthSendrEnrollmentPageAttachment | null> {
  const preview = await getSendrPageAttachmentPreview(admin, landingPageId)
  if (!preview?.page) return null
  const page = preview.page
  return {
    landingPageId: page.id,
    title: page.title,
    slug: page.publishedSlug ?? page.slug,
    publishedAt: page.publishedAt,
    publicUrl: preview.publicUrl,
    videoAssetId:
      typeof page.mobileMetadata.videoAssetId === "string" ? page.mobileMetadata.videoAssetId : null,
    bookingAssetId:
      typeof page.mobileMetadata.bookingAssetId === "string" ? page.mobileMetadata.bookingAssetId : null,
  }
}

export async function attachSendrPageOnAudienceEnrollment(
  admin: SupabaseClient,
  input: {
    organizationId: string
    landingPageId: string
    sequencePatternId: string
    enrollmentRunId: string
    attachedBy?: string | null
    dryRun?: boolean
  },
): Promise<{ linkId: string | null; page: GrowthSendrLandingPage | null }> {
  if (input.dryRun) {
    const preview = await getSendrPageAttachmentPreview(admin, input.landingPageId)
    return { linkId: null, page: preview?.page ?? null }
  }

  const link = await attachSendrPageToSequence(admin, {
    organizationId: input.organizationId,
    landingPageId: input.landingPageId,
    sequencePatternId: input.sequencePatternId,
    enrollmentRunId: input.enrollmentRunId,
    attachedBy: input.attachedBy ?? null,
    metadata: { source: "audience_enrollment" },
  })

  const preview = await getSendrPageAttachmentPreview(admin, input.landingPageId)
  return { linkId: link.id, page: preview?.page ?? null }
}
