import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthSendrBookingAsset } from "@/lib/growth/sendr/growth-sendr-booking-runtime-repository"
import { getGrowthSendrLandingPage } from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import { listGrowthSendrMediaAssets } from "@/lib/growth/sendr/growth-sendr-media-asset-repository"
import type { GrowthSendrAssetPickerItem } from "@/lib/growth/sendr/growth-sendr-types"
import { getGrowthSendrVideoAsset } from "@/lib/growth/sendr/growth-sendr-video-runtime-repository"
import { buildSendrPagePublicLink } from "@/lib/growth/sendr/growth-sendr-slug-runtime"

export async function listSendrAssetPickerItems(
  admin: SupabaseClient,
  input: {
    organizationId: string
    kind?: "media" | "video" | "booking" | "landing_page" | "all"
    search?: string
    limit?: number
  },
): Promise<GrowthSendrAssetPickerItem[]> {
  const kind = input.kind ?? "all"
  const search = input.search?.trim().toLowerCase() ?? ""
  const limit = Math.min(input.limit ?? 50, 100)
  const items: GrowthSendrAssetPickerItem[] = []

  if (kind === "all" || kind === "media") {
    const media = await listGrowthSendrMediaAssets(admin, {
      organizationId: input.organizationId,
      limit,
    })
    for (const asset of media.items) {
      if (search && !asset.name.toLowerCase().includes(search)) continue
      items.push({
        id: asset.id,
        assetKind: "media",
        name: asset.name,
        subtitle: asset.assetType,
        status: asset.status,
        previewUrl: null,
        metadata: asset.metadata,
      })
    }
  }

  if (kind === "all" || kind === "video") {
    const { data, error } = await admin
      .schema("growth")
      .from("growth_video_assets")
      .select("id, source_url, poster_url, duration_seconds, created_at")
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (!error) {
      for (const row of data ?? []) {
        const r = row as Record<string, unknown>
        const name = String(r.source_url ?? r.id).slice(0, 80)
        if (search && !name.toLowerCase().includes(search)) continue
        items.push({
          id: String(r.id),
          assetKind: "video",
          name,
          subtitle: r.duration_seconds != null ? `${r.duration_seconds}s` : "video",
          status: "registered",
          previewUrl: r.poster_url ? String(r.poster_url) : null,
          metadata: { sourceUrl: r.source_url, posterUrl: r.poster_url },
        })
      }
    }
  }

  if (kind === "all" || kind === "booking") {
    const { data, error } = await admin
      .schema("growth")
      .from("growth_booking_assets")
      .select("id, meeting_link, meeting_type, duration_minutes, created_at")
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (!error) {
      for (const row of data ?? []) {
        const r = row as Record<string, unknown>
        const name = String(r.meeting_type ?? "Booking")
        if (search && !name.toLowerCase().includes(search) && !String(r.meeting_link ?? "").includes(search)) {
          continue
        }
        items.push({
          id: String(r.id),
          assetKind: "booking",
          name,
          subtitle: r.meeting_link ? String(r.meeting_link) : null,
          status: "registered",
          previewUrl: null,
          metadata: {
            meetingLink: r.meeting_link,
            durationMinutes: r.duration_minutes,
          },
        })
      }
    }
  }

  if (kind === "all" || kind === "landing_page") {
    const { data, error } = await admin
      .schema("growth")
      .from("growth_landing_pages")
      .select("id, title, status, published_slug, published_at")
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit)
    if (!error) {
      for (const row of data ?? []) {
        const r = row as Record<string, unknown>
        const title = String(r.title)
        if (search && !title.toLowerCase().includes(search)) continue
        const slug = r.published_slug ? String(r.published_slug) : null
        items.push({
          id: String(r.id),
          assetKind: "landing_page",
          name: title,
          subtitle: slug,
          status: String(r.status),
          previewUrl: slug ? buildSendrPagePublicLink(slug) : null,
          metadata: { publishedAt: r.published_at, slug },
        })
      }
    }
  }

  return items.slice(0, limit)
}

export async function getSendrPageAttachmentPreview(
  admin: SupabaseClient,
  landingPageId: string,
): Promise<{
  page: Awaited<ReturnType<typeof getGrowthSendrLandingPage>>
  video: Awaited<ReturnType<typeof getGrowthSendrVideoAsset>>
  booking: Awaited<ReturnType<typeof getGrowthSendrBookingAsset>>
  publicUrl: string | null
} | null> {
  const page = await getGrowthSendrLandingPage(admin, landingPageId)
  if (!page) return null
  const videoId =
    typeof page.mobileMetadata.videoAssetId === "string" ? page.mobileMetadata.videoAssetId : null
  const bookingId =
    typeof page.mobileMetadata.bookingAssetId === "string" ? page.mobileMetadata.bookingAssetId : null
  const slug = page.publishedSlug ?? page.slug
  return {
    page,
    video: videoId ? await getGrowthSendrVideoAsset(admin, videoId) : null,
    booking: bookingId ? await getGrowthSendrBookingAsset(admin, bookingId) : null,
    publicUrl: slug ? buildSendrPagePublicLink(slug) : null,
  }
}
