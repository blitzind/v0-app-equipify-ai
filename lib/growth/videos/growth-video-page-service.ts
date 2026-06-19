import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_VIDEO_PAGES_QA_MARKER,
  type GrowthVideoPage,
  type GrowthVideoPageStatus,
} from "@/lib/growth/videos/growth-video-types"
import {
  parseGrowthVideoPageBranding,
  parseGrowthVideoPagePersonalization,
  sanitizeGrowthVideoPageDescription,
  sanitizeGrowthVideoPageLabel,
  sanitizeGrowthVideoPageTitle,
  sanitizeGrowthVideoPageUrl,
  slugFromGrowthVideoPageTitle,
} from "@/lib/growth/videos/growth-video-page-validation"
import { isGrowthVideoPagesSchemaReady } from "@/lib/growth/videos/growth-video-schema-health"
import { createGrowthVideoService } from "@/lib/growth/videos/growth-video-service"

const PAGE_SELECT =
  "id, organization_id, video_asset_id, created_by, slug, title, description, status, cta_label, cta_url, calendar_url, branding_json, personalization_json, metadata_json, published_at, created_at, updated_at"

type VideoPageRow = {
  id: string
  organization_id: string
  video_asset_id: string
  created_by: string | null
  slug: string
  title: string
  description: string | null
  status: string
  cta_label: string | null
  cta_url: string | null
  calendar_url: string | null
  branding_json: Record<string, unknown> | null
  personalization_json: Record<string, unknown> | null
  metadata_json: Record<string, unknown> | null
  published_at: string | null
  created_at: string
  updated_at: string
}

function pagesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("video_pages")
}

function mapPageRow(row: VideoPageRow): GrowthVideoPage {
  return {
    id: row.id,
    organizationId: row.organization_id,
    videoAssetId: row.video_asset_id,
    createdBy: row.created_by,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: row.status as GrowthVideoPageStatus,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    calendarUrl: row.calendar_url,
    branding: parseGrowthVideoPageBranding(row.branding_json),
    personalization: parseGrowthVideoPagePersonalization(row.personalization_json),
    metadata: row.metadata_json ?? {},
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type CreateGrowthVideoPageInput = {
  organizationId: string
  createdBy?: string | null
  videoAssetId: string
  slug?: string
  title: string
  description?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  calendarUrl?: string | null
  branding?: Record<string, unknown>
  personalization?: Record<string, unknown>
}

export type UpdateGrowthVideoPagePatch = {
  videoAssetId?: string
  slug?: string
  title?: string
  description?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  calendarUrl?: string | null
  branding?: Record<string, unknown>
  personalization?: Record<string, unknown>
  metadata?: Record<string, unknown>
  status?: GrowthVideoPageStatus
}

export class GrowthVideoPageService {
  constructor(private readonly admin: SupabaseClient) {}

  private async ensureSchema(): Promise<void> {
    if (!(await isGrowthVideoPagesSchemaReady(this.admin))) {
      throw new Error("pages_schema_not_ready")
    }
  }

  async listPages(input: {
    organizationId: string
    status?: GrowthVideoPageStatus
    search?: string
    limit?: number
  }): Promise<GrowthVideoPage[]> {
    await this.ensureSchema()
    let query = pagesTable(this.admin)
      .select(PAGE_SELECT)
      .eq("organization_id", input.organizationId)
      .order("updated_at", { ascending: false })
      .limit(input.limit ?? 100)

    if (input.status) query = query.eq("status", input.status)
    if (input.search?.trim()) {
      query = query.or(
        `title.ilike.%${input.search.trim()}%,slug.ilike.%${input.search.trim()}%,description.ilike.%${input.search.trim()}%`,
      )
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => mapPageRow(row as VideoPageRow))
  }

  async getPageById(input: { organizationId: string; pageId: string }): Promise<GrowthVideoPage | null> {
    await this.ensureSchema()
    const { data, error } = await pagesTable(this.admin)
      .select(PAGE_SELECT)
      .eq("organization_id", input.organizationId)
      .eq("id", input.pageId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    return mapPageRow(data as VideoPageRow)
  }

  async createPage(input: CreateGrowthVideoPageInput): Promise<GrowthVideoPage> {
    await this.ensureSchema()

    const videoService = createGrowthVideoService(this.admin)
    const asset = await videoService.getAssetById({
      organizationId: input.organizationId,
      assetId: input.videoAssetId,
    })
    if (!asset.ok) throw new Error(asset.error)

    const title = sanitizeGrowthVideoPageTitle(input.title)
    const slug = input.slug
      ? slugFromGrowthVideoPageTitle(input.slug)
      : slugFromGrowthVideoPageTitle(title)

    const { data, error } = await pagesTable(this.admin)
      .insert({
        organization_id: input.organizationId,
        video_asset_id: input.videoAssetId,
        created_by: input.createdBy ?? null,
        slug,
        title,
        description: sanitizeGrowthVideoPageDescription(input.description),
        status: "draft",
        cta_label: sanitizeGrowthVideoPageLabel(input.ctaLabel),
        cta_url: sanitizeGrowthVideoPageUrl(input.ctaUrl),
        calendar_url: sanitizeGrowthVideoPageUrl(input.calendarUrl),
        branding_json: input.branding ?? {},
        personalization_json: input.personalization ?? {},
        metadata_json: { qa_marker: GROWTH_VIDEO_PAGES_QA_MARKER },
      })
      .select(PAGE_SELECT)
      .single()

    if (error) {
      if (error.code === "23505") throw new Error("slug_conflict")
      throw new Error(error.message)
    }
    return mapPageRow(data as VideoPageRow)
  }

  async updatePage(input: {
    organizationId: string
    pageId: string
    patch: UpdateGrowthVideoPagePatch
  }): Promise<GrowthVideoPage> {
    await this.ensureSchema()
    const patch: Record<string, unknown> = {}

    if (input.patch.videoAssetId) {
      const videoService = createGrowthVideoService(this.admin)
      const asset = await videoService.getAssetById({
        organizationId: input.organizationId,
        assetId: input.patch.videoAssetId,
      })
      if (!asset.ok) throw new Error(asset.error)
      patch.video_asset_id = input.patch.videoAssetId
    }
    if (input.patch.slug) patch.slug = slugFromGrowthVideoPageTitle(input.patch.slug)
    if (input.patch.title) patch.title = sanitizeGrowthVideoPageTitle(input.patch.title)
    if (input.patch.description !== undefined) {
      patch.description = sanitizeGrowthVideoPageDescription(input.patch.description)
    }
    if (input.patch.ctaLabel !== undefined) patch.cta_label = sanitizeGrowthVideoPageLabel(input.patch.ctaLabel)
    if (input.patch.ctaUrl !== undefined) patch.cta_url = sanitizeGrowthVideoPageUrl(input.patch.ctaUrl)
    if (input.patch.calendarUrl !== undefined) {
      patch.calendar_url = sanitizeGrowthVideoPageUrl(input.patch.calendarUrl)
    }
    if (input.patch.branding) patch.branding_json = input.patch.branding
    if (input.patch.personalization) patch.personalization_json = input.patch.personalization
    if (input.patch.metadata) {
      const existing = await this.getPageById(input)
      if (!existing) throw new Error("not_found")
      patch.metadata_json = {
        ...existing.metadata,
        ...input.patch.metadata,
        qa_marker: GROWTH_VIDEO_PAGES_QA_MARKER,
      }
    }
    if (input.patch.status) patch.status = input.patch.status

    const { data, error } = await pagesTable(this.admin)
      .update(patch)
      .eq("organization_id", input.organizationId)
      .eq("id", input.pageId)
      .select(PAGE_SELECT)
      .single()

    if (error) {
      if (error.code === "23505") throw new Error("slug_conflict")
      throw new Error(error.message)
    }
    return mapPageRow(data as VideoPageRow)
  }

  async publishPage(input: { organizationId: string; pageId: string }): Promise<GrowthVideoPage> {
    await this.ensureSchema()
    const page = await this.getPageById(input)
    if (!page) throw new Error("not_found")

    const videoService = createGrowthVideoService(this.admin)
    const asset = await videoService.getAssetById({
      organizationId: input.organizationId,
      assetId: page.videoAssetId,
    })
    if (!asset.ok) throw new Error(asset.error)
    if (asset.asset.status !== "ready" || asset.asset.uploadStatus !== "uploaded") {
      throw new Error("video_not_ready")
    }

    const now = new Date().toISOString()
    const { data, error } = await pagesTable(this.admin)
      .update({
        status: "published",
        published_at: page.publishedAt ?? now,
      })
      .eq("organization_id", input.organizationId)
      .eq("id", input.pageId)
      .select(PAGE_SELECT)
      .single()

    if (error) throw new Error(error.message)
    return mapPageRow(data as VideoPageRow)
  }

  async archivePage(input: { organizationId: string; pageId: string }): Promise<GrowthVideoPage> {
    await this.ensureSchema()
    const { data, error } = await pagesTable(this.admin)
      .update({ status: "archived" })
      .eq("organization_id", input.organizationId)
      .eq("id", input.pageId)
      .select(PAGE_SELECT)
      .single()

    if (error) throw new Error(error.message)
    return mapPageRow(data as VideoPageRow)
  }

  async deletePage(input: { organizationId: string; pageId: string }): Promise<void> {
    await this.ensureSchema()
    const { error } = await pagesTable(this.admin)
      .delete()
      .eq("organization_id", input.organizationId)
      .eq("id", input.pageId)
    if (error) throw new Error(error.message)
  }

  async countEventsForPage(input: { organizationId: string; pageId: string }): Promise<Record<string, number>> {
    await this.ensureSchema()
    const { data, error } = await this.admin
      .schema("growth")
      .from("video_page_events")
      .select("event_type")
      .eq("organization_id", input.organizationId)
      .eq("video_page_id", input.pageId)

    if (error) throw new Error(error.message)

    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      const type = String((row as { event_type?: string }).event_type ?? "")
      counts[type] = (counts[type] ?? 0) + 1
    }
    return counts
  }
}

export function createGrowthVideoPageService(admin: SupabaseClient): GrowthVideoPageService {
  return new GrowthVideoPageService(admin)
}
