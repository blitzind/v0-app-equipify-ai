import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SENDR_LIMITS,
  GROWTH_SENDR_QA_MARKER,
  type GrowthSendrLandingPageSectionType,
  type GrowthSendrLandingPageStatus,
} from "@/lib/growth/sendr/growth-sendr-config"
import type {
  GrowthSendrLandingPage,
  GrowthSendrLandingPagePublication,
  GrowthSendrLandingPageSection,
} from "@/lib/growth/sendr/growth-sendr-types"
import { renderSendrPersonalizedText } from "@/lib/growth/sendr/growth-sendr-personalization-runtime"
import { buildSendrPublishedSlug } from "@/lib/growth/sendr/growth-sendr-slug-runtime"

function pagesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_landing_pages")
}

function sectionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_landing_page_sections")
}

function publicationsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_landing_page_publications")
}

function mapPage(row: Record<string, unknown>): GrowthSendrLandingPage {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    ownerUserId: String(row.owner_user_id),
    mediaAssetId: row.media_asset_id ? String(row.media_asset_id) : null,
    leadId: row.lead_id ? String(row.lead_id) : null,
    title: String(row.title),
    status: String(row.status) as GrowthSendrLandingPageStatus,
    variableMap: (row.variable_map as Record<string, string>) ?? {},
    mobileMetadata: (row.mobile_metadata as Record<string, unknown>) ?? {},
    legacySharePageId: row.legacy_share_page_id ? String(row.legacy_share_page_id) : null,
    slug: row.slug ? String(row.slug) : null,
    publishedSlug: row.published_slug ? String(row.published_slug) : null,
    publishedVersion: row.published_version != null ? Number(row.published_version) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapSection(row: Record<string, unknown>): GrowthSendrLandingPageSection {
  return {
    id: String(row.id),
    landingPageId: String(row.landing_page_id),
    organizationId: String(row.organization_id),
    sectionType: String(row.section_type) as GrowthSendrLandingPageSectionType,
    sortOrder: Number(row.sort_order),
    content: (row.content as Record<string, unknown>) ?? {},
    variablePlaceholders: (row.variable_placeholders as string[]) ?? [],
    createdAt: String(row.created_at),
  }
}

export async function createGrowthSendrLandingPage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    ownerUserId: string
    title: string
    leadId?: string | null
    mediaAssetId?: string | null
    legacySharePageId?: string | null
    variableMap?: Record<string, string>
    mobileMetadata?: Record<string, unknown>
  },
): Promise<GrowthSendrLandingPage> {
  const { data, error } = await pagesTable(admin)
    .insert({
      organization_id: input.organizationId,
      owner_user_id: input.ownerUserId,
      title: input.title,
      lead_id: input.leadId ?? null,
      media_asset_id: input.mediaAssetId ?? null,
      legacy_share_page_id: input.legacySharePageId ?? null,
      variable_map: input.variableMap ?? {},
      mobile_metadata: input.mobileMetadata ?? {},
      qa_marker: GROWTH_SENDR_QA_MARKER,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapPage(data as Record<string, unknown>)
}

export async function upsertGrowthSendrLandingPageSection(
  admin: SupabaseClient,
  input: {
    landingPageId: string
    organizationId: string
    sectionType: GrowthSendrLandingPageSectionType
    sortOrder: number
    content: Record<string, unknown>
    variablePlaceholders?: string[]
  },
): Promise<GrowthSendrLandingPageSection> {
  const existing = await listGrowthSendrLandingPageSections(admin, input.landingPageId)
  if (existing.length >= GROWTH_SENDR_LIMITS.MAX_PAGE_SECTIONS) {
    throw new Error("page_section_cap_exceeded")
  }
  if (input.sortOrder >= GROWTH_SENDR_LIMITS.MAX_PAGE_SECTIONS) {
    throw new Error("page_section_cap_exceeded")
  }
  const { data, error } = await sectionsTable(admin)
    .insert({
      landing_page_id: input.landingPageId,
      organization_id: input.organizationId,
      section_type: input.sectionType,
      sort_order: input.sortOrder,
      content: input.content,
      variable_placeholders: input.variablePlaceholders ?? [],
      qa_marker: GROWTH_SENDR_QA_MARKER,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapSection(data as Record<string, unknown>)
}

export async function listGrowthSendrLandingPageSections(
  admin: SupabaseClient,
  landingPageId: string,
): Promise<GrowthSendrLandingPageSection[]> {
  const { data, error } = await sectionsTable(admin)
    .select("*")
    .eq("landing_page_id", landingPageId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(GROWTH_SENDR_LIMITS.MAX_PAGE_SECTIONS)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapSection(row as Record<string, unknown>))
}

export async function publishGrowthSendrLandingPage(
  admin: SupabaseClient,
  input: {
    landingPageId: string
    organizationId: string
    publishedBy: string
  },
): Promise<GrowthSendrLandingPage> {
  const sections = await listGrowthSendrLandingPageSections(admin, input.landingPageId)
  const { data: pageRow, error: pageError } = await pagesTable(admin)
    .select("*")
    .eq("id", input.landingPageId)
    .single()
  if (pageError) throw new Error(pageError.message)

  const page = mapPage(pageRow as Record<string, unknown>)
  const existingPublications = await listGrowthSendrLandingPagePublications(
    admin,
    input.landingPageId,
    GROWTH_SENDR_LIMITS.MAX_LANDING_PAGE_PUBLICATIONS_PER_PAGE,
  )
  const nextVersion = existingPublications.length + 1
  const publishedSlug = buildSendrPublishedSlug(page.title, page.id)
  const publishedAt = new Date().toISOString()

  const resolvedSections = sections.map((section) => {
    const body = typeof section.content.body === "string" ? section.content.body : ""
    return {
      ...section,
      content: {
        ...section.content,
        body: renderSendrPersonalizedText(body, {
          variables: page.variableMap,
          fallbacks: page.variableMap,
        }),
      },
    }
  })

  const publicationRow: Record<string, unknown> = {
    landing_page_id: input.landingPageId,
    organization_id: input.organizationId,
    version_snapshot: { page, sections: resolvedSections },
    published_by: input.publishedBy,
    qa_marker: GROWTH_SENDR_QA_MARKER,
  }
  publicationRow.version_number = nextVersion
  publicationRow.published_slug = publishedSlug

  let pubError = (
    await publicationsTable(admin).insert(publicationRow)
  ).error
  if (
    pubError &&
    (pubError.message.includes("version_number") || pubError.message.includes("published_slug"))
  ) {
    pubError = (
      await publicationsTable(admin).insert({
        landing_page_id: input.landingPageId,
        organization_id: input.organizationId,
        version_snapshot: {
          page,
          sections: resolvedSections,
          publishedSlug,
          versionNumber: nextVersion,
        },
        published_by: input.publishedBy,
        qa_marker: GROWTH_SENDR_QA_MARKER,
      })
    ).error
  }
  if (pubError) throw new Error(pubError.message)

  const updatePatch: Record<string, unknown> = {
    status: "published",
    slug: publishedSlug,
    published_slug: publishedSlug,
    published_version: nextVersion,
    published_at: publishedAt,
    updated_at: publishedAt,
  }

  const { data, error } = await pagesTable(admin)
    .update(updatePatch)
    .eq("id", input.landingPageId)
    .select("*")
    .single()
  if (error) {
    // Schema-missing tolerant fallback when slug columns not migrated yet
    if (error.message.includes("published_slug") || error.message.includes("column")) {
      await pagesTable(admin)
        .update({
          status: "published",
          mobile_metadata: {
            ...page.mobileMetadata,
            publishedSlug,
            publishedVersion: nextVersion,
            publishedAt,
          },
        })
        .eq("id", input.landingPageId)
      const fallback = await getGrowthSendrLandingPage(admin, input.landingPageId)
      if (!fallback) throw new Error("publish_update_failed")
      return {
        ...fallback,
        status: "published",
        slug: publishedSlug,
        publishedSlug,
        publishedVersion: nextVersion,
        publishedAt,
      }
    }
    throw new Error(error.message)
  }
  return mapPage(data as Record<string, unknown>)
}

export async function countGrowthSendrLandingPagesPublishedToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const { count, error } = await publicationsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("published_at", dayStart)
  if (error) return 0
  return count ?? 0
}

export async function getGrowthSendrLandingPage(
  admin: SupabaseClient,
  landingPageId: string,
): Promise<GrowthSendrLandingPage | null> {
  const { data, error } = await pagesTable(admin)
    .select("*")
    .eq("id", landingPageId)
    .is("deleted_at", null)
    .maybeSingle()
  if (error || !data) return null
  return mapPage(data as Record<string, unknown>)
}

export async function listGrowthSendrLandingPages(
  admin: SupabaseClient,
  input: {
    organizationId: string
    status?: GrowthSendrLandingPageStatus
    limit?: number
    offset?: number
  },
): Promise<{ items: GrowthSendrLandingPage[]; total: number }> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)
  let query = pagesTable(admin)
    .select("*", { count: "exact" })
    .eq("organization_id", input.organizationId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
  if (input.status) query = query.eq("status", input.status)
  const { data, error, count } = await query.range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)
  return {
    items: (data ?? []).map((row) => mapPage(row as Record<string, unknown>)),
    total: count ?? 0,
  }
}

export async function updateGrowthSendrLandingPage(
  admin: SupabaseClient,
  input: {
    landingPageId: string
    organizationId: string
    title?: string
    status?: GrowthSendrLandingPageStatus
    variableMap?: Record<string, string>
    mobileMetadata?: Record<string, unknown>
    leadId?: string | null
    mediaAssetId?: string | null
  },
): Promise<GrowthSendrLandingPage> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.title !== undefined) patch.title = input.title
  if (input.status !== undefined) patch.status = input.status
  if (input.variableMap !== undefined) patch.variable_map = input.variableMap
  if (input.mobileMetadata !== undefined) patch.mobile_metadata = input.mobileMetadata
  if (input.leadId !== undefined) patch.lead_id = input.leadId
  if (input.mediaAssetId !== undefined) patch.media_asset_id = input.mediaAssetId

  const { data, error } = await pagesTable(admin)
    .update(patch)
    .eq("id", input.landingPageId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapPage(data as Record<string, unknown>)
}

export async function updateGrowthSendrLandingPageSection(
  admin: SupabaseClient,
  input: {
    sectionId: string
    landingPageId: string
    organizationId: string
    content?: Record<string, unknown>
    sortOrder?: number
    variablePlaceholders?: string[]
  },
): Promise<GrowthSendrLandingPageSection> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.content !== undefined) patch.content = input.content
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder
  if (input.variablePlaceholders !== undefined) {
    patch.variable_placeholders = input.variablePlaceholders
  }
  const { data, error } = await sectionsTable(admin)
    .update(patch)
    .eq("id", input.sectionId)
    .eq("landing_page_id", input.landingPageId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapSection(data as Record<string, unknown>)
}

export async function deleteGrowthSendrLandingPageSection(
  admin: SupabaseClient,
  input: {
    sectionId: string
    landingPageId: string
    organizationId: string
  },
): Promise<void> {
  const { error } = await sectionsTable(admin)
    .delete()
    .eq("id", input.sectionId)
    .eq("landing_page_id", input.landingPageId)
    .eq("organization_id", input.organizationId)
  if (error) throw new Error(error.message)
}

export async function listGrowthSendrLandingPagePublications(
  admin: SupabaseClient,
  landingPageId: string,
  limit = 20,
): Promise<GrowthSendrLandingPagePublication[]> {
  const { data, error } = await publicationsTable(admin)
    .select("id, landing_page_id, organization_id, published_at, published_by, created_at")
    .eq("landing_page_id", landingPageId)
    .order("published_at", { ascending: false })
    .limit(Math.min(limit, GROWTH_SENDR_LIMITS.MAX_LANDING_PAGE_PUBLICATIONS_PER_PAGE))
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String((row as Record<string, unknown>).id),
    landingPageId: String((row as Record<string, unknown>).landing_page_id),
    organizationId: String((row as Record<string, unknown>).organization_id),
    publishedAt: String((row as Record<string, unknown>).published_at),
    publishedBy: (row as Record<string, unknown>).published_by
      ? String((row as Record<string, unknown>).published_by)
      : null,
    createdAt: String((row as Record<string, unknown>).created_at),
    versionNumber:
      (row as Record<string, unknown>).version_number != null
        ? Number((row as Record<string, unknown>).version_number)
        : null,
    publishedSlug: (row as Record<string, unknown>).published_slug
      ? String((row as Record<string, unknown>).published_slug)
      : null,
  }))
}

export async function archiveGrowthSendrLandingPage(
  admin: SupabaseClient,
  input: { landingPageId: string; organizationId: string },
): Promise<GrowthSendrLandingPage> {
  return updateGrowthSendrLandingPage(admin, {
    landingPageId: input.landingPageId,
    organizationId: input.organizationId,
    status: "archived",
  })
}

export async function countGrowthSendrLandingPagesCreatedToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const { count, error } = await pagesTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", dayStart)
  if (error) return 0
  return count ?? 0
}

export async function getGrowthSendrLandingPageByPublishedSlug(
  admin: SupabaseClient,
  publishedSlug: string,
): Promise<GrowthSendrLandingPage | null> {
  const { data, error } = await pagesTable(admin)
    .select("*")
    .eq("published_slug", publishedSlug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle()

  if (!error && data) return mapPage(data as Record<string, unknown>)

  if (error && !error.message.includes("published_slug") && !error.message.includes("column")) {
    return null
  }

  const { data: fallbackRows, error: fallbackError } = await pagesTable(admin)
    .select("*")
    .eq("status", "published")
    .is("deleted_at", null)
    .contains("mobile_metadata", { publishedSlug })
    .limit(1)

  if (fallbackError || !fallbackRows?.[0]) return null
  return mapPage(fallbackRows[0] as Record<string, unknown>)
}

export type SendrPublicationRecord = GrowthSendrLandingPagePublication & {
  versionSnapshot: Record<string, unknown>
}

export async function getLatestSendrPublicationForPage(
  admin: SupabaseClient,
  landingPageId: string,
): Promise<SendrPublicationRecord | null> {
  const { data, error } = await publicationsTable(admin)
    .select("id, landing_page_id, organization_id, published_at, published_by, created_at, version_number, published_slug, version_snapshot")
    .eq("landing_page_id", landingPageId)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  const row = data as Record<string, unknown>
  return {
    id: String(row.id),
    landingPageId: String(row.landing_page_id),
    organizationId: String(row.organization_id),
    publishedAt: String(row.published_at),
    publishedBy: row.published_by ? String(row.published_by) : null,
    createdAt: String(row.created_at),
    versionNumber: row.version_number != null ? Number(row.version_number) : null,
    publishedSlug: row.published_slug ? String(row.published_slug) : null,
    versionSnapshot: (row.version_snapshot as Record<string, unknown>) ?? {},
  }
}
