import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { extractContentMergeFields } from "@/lib/growth/content/merge-field-validator"
import type { GrowthSharePageTemplateBlock } from "@/lib/growth/share-pages/share-page-template-block-types"
import {
  canArchiveSharePageTemplate,
  canEditSharePageTemplateVersion,
  canPublishSharePageTemplate,
  canUnpublishSharePageTemplate,
  nextSharePageTemplateVersionNumber,
  type GrowthSharePageTemplate,
  type GrowthSharePageTemplateStatus,
  type GrowthSharePageTemplateVersion,
  GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-template-types"
import {
  DEFAULT_GROWTH_SHARE_PAGE_THEME,
  type GrowthSharePageTheme,
} from "@/lib/growth/share-pages/share-page-types"

function templatesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_page_templates")
}

function versionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("share_page_template_versions")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.length > 0)
  }
  return []
}

function asBlocks(value: unknown): GrowthSharePageTemplateBlock[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is GrowthSharePageTemplateBlock => {
    return Boolean(item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string")
  })
}

function asTheme(value: unknown): GrowthSharePageTheme {
  if (!value || typeof value !== "object") return { ...DEFAULT_GROWTH_SHARE_PAGE_THEME }
  const theme = value as Record<string, unknown>
  return {
    brandColor: asString(theme.brandColor) || DEFAULT_GROWTH_SHARE_PAGE_THEME.brandColor,
    accentColor: asString(theme.accentColor) || DEFAULT_GROWTH_SHARE_PAGE_THEME.accentColor,
    logoUrl: asString(theme.logoUrl) || null,
    heroImageUrl: asString(theme.heroImageUrl) || null,
    publicThemeMode:
      theme.publicThemeMode === "light" || theme.publicThemeMode === "dark" || theme.publicThemeMode === "system"
        ? theme.publicThemeMode
        : DEFAULT_GROWTH_SHARE_PAGE_THEME.publicThemeMode,
    footerNote: asString(theme.footerNote) || null,
  }
}

function collectMergeFieldStrings(value: unknown, output: string[]): void {
  if (typeof value === "string") {
    output.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectMergeFieldStrings(item, output)
    return
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectMergeFieldStrings(nested, output)
    }
  }
}

export function extractSharePageTemplateMergeFields(blocks: GrowthSharePageTemplateBlock[]): string[] {
  const strings: string[] = []
  collectMergeFieldStrings(blocks, strings)
  const keys = new Set<string>()
  for (const text of strings) {
    for (const key of extractContentMergeFields(text)) keys.add(key)
  }
  return [...keys]
}

export function createDefaultSharePageTemplateBlocks(): GrowthSharePageTemplateBlock[] {
  return [
    {
      id: randomUUID(),
      type: "hero",
      order: 0,
      headline: "",
      subheadline: null,
      heroMessage: "",
      heroMediaType: "none",
      heroMediaUrl: null,
      heroMediaThumbnailUrl: null,
    },
  ]
}

function mapVersion(row: Record<string, unknown>): GrowthSharePageTemplateVersion {
  return {
    id: asString(row.id),
    templateId: asString(row.template_id),
    versionNumber: asNumber(row.version_number, 1),
    status: asString(row.status) as GrowthSharePageTemplateVersion["status"],
    blocks: asBlocks(row.blocks_json),
    theme: asTheme(row.theme_json),
    defaultBookingPageId: asString(row.default_booking_page_id) || null,
    mergeFieldsUsed: asStringArray(row.merge_fields_used),
    changeSummary: asString(row.change_summary),
    isImmutable: Boolean(row.is_immutable),
    createdBy: asString(row.created_by) || null,
    publishedBy: asString(row.published_by) || null,
    publishedAt: asString(row.published_at) || null,
    createdAt: asString(row.created_at),
  }
}

function mapTemplate(
  row: Record<string, unknown>,
  currentVersion: GrowthSharePageTemplateVersion | null = null,
  publishedVersion: GrowthSharePageTemplateVersion | null = null,
  versionCount = 0,
): GrowthSharePageTemplate {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    createdBy: asString(row.created_by) || null,
    name: asString(row.name),
    description: asString(row.description),
    category: asString(row.category) || "general",
    tags: asStringArray(row.tags),
    previewImageUrl: asString(row.preview_image_url) || null,
    status: asString(row.status) as GrowthSharePageTemplateStatus,
    publishedAt: asString(row.published_at) || null,
    archivedAt: asString(row.archived_at) || null,
    currentVersionId: asString(row.current_version_id) || null,
    publishedVersionId: asString(row.published_version_id) || null,
    requiresHumanReview: true,
    qaMarker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
    currentVersion,
    publishedVersion,
    versionCount,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

async function loadVersionCounts(
  admin: SupabaseClient,
  templateIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (templateIds.length === 0) return counts

  const { data, error } = await versionsTable(admin).select("template_id").in("template_id", templateIds)
  if (error) throw new Error(error.message)

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const templateId = asString(row.template_id)
    counts.set(templateId, (counts.get(templateId) ?? 0) + 1)
  }
  return counts
}

async function loadVersionsForTemplate(
  admin: SupabaseClient,
  template: Record<string, unknown>,
  versionCount?: number,
): Promise<GrowthSharePageTemplate> {
  const templateId = asString(template.id)
  const currentId = asString(template.current_version_id)
  const publishedId = asString(template.published_version_id)
  let currentVersion: GrowthSharePageTemplateVersion | null = null
  let publishedVersion: GrowthSharePageTemplateVersion | null = null

  if (currentId) {
    const { data } = await versionsTable(admin).select("*").eq("id", currentId).maybeSingle()
    if (data) currentVersion = mapVersion(data as Record<string, unknown>)
  }
  if (publishedId) {
    const { data } = await versionsTable(admin).select("*").eq("id", publishedId).maybeSingle()
    if (data) publishedVersion = mapVersion(data as Record<string, unknown>)
  }

  let resolvedCount = versionCount
  if (resolvedCount == null) {
    const counts = await loadVersionCounts(admin, [templateId])
    resolvedCount = counts.get(templateId) ?? 0
  }

  return mapTemplate(template, currentVersion, publishedVersion, resolvedCount)
}

async function listTemplateVersions(
  admin: SupabaseClient,
  templateId: string,
): Promise<GrowthSharePageTemplateVersion[]> {
  const { data, error } = await versionsTable(admin)
    .select("*")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapVersion)
}

export async function listTemplates(
  admin: SupabaseClient,
  input: {
    organizationId: string
    status?: GrowthSharePageTemplateStatus
    category?: string
    tag?: string
    search?: string
    limit?: number
    offset?: number
  },
): Promise<{ items: GrowthSharePageTemplate[]; total: number }> {
  let query = templatesTable(admin)
    .select("*", { count: "exact" })
    .eq("organization_id", input.organizationId)
    .order("updated_at", { ascending: false })

  if (input.status) query = query.eq("status", input.status)
  if (input.category) query = query.eq("category", input.category)
  if (input.tag) query = query.contains("tags", [input.tag])
  if (input.search?.trim()) {
    const term = input.search.trim()
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
  }

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Record<string, unknown>[]
  const versionCounts = await loadVersionCounts(
    admin,
    rows.map((row) => asString(row.id)),
  )
  const items = await Promise.all(
    rows.map((row) =>
      loadVersionsForTemplate(admin, row, versionCounts.get(asString(row.id)) ?? 0),
    ),
  )
  return { items, total: count ?? items.length }
}

export async function getTemplate(
  admin: SupabaseClient,
  templateId: string,
): Promise<GrowthSharePageTemplate | null> {
  const { data, error } = await templatesTable(admin).select("*").eq("id", templateId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return loadVersionsForTemplate(admin, data as Record<string, unknown>)
}

export async function getCurrentVersion(
  admin: SupabaseClient,
  templateId: string,
): Promise<GrowthSharePageTemplateVersion | null> {
  const template = await getTemplate(admin, templateId)
  return template?.currentVersion ?? null
}

export async function createTemplate(
  admin: SupabaseClient,
  input: {
    organizationId: string
    createdBy?: string | null
    name: string
    description?: string
    category?: string
    tags?: string[]
    previewImageUrl?: string | null
    blocks?: GrowthSharePageTemplateBlock[]
    theme?: GrowthSharePageTheme
    defaultBookingPageId?: string | null
    changeSummary?: string
  },
): Promise<GrowthSharePageTemplate> {
  const now = new Date().toISOString()
  const blocks = input.blocks ?? createDefaultSharePageTemplateBlocks()
  const theme = input.theme ?? { ...DEFAULT_GROWTH_SHARE_PAGE_THEME }
  const mergeFieldsUsed = extractSharePageTemplateMergeFields(blocks)

  const { data: templateRow, error: templateError } = await templatesTable(admin)
    .insert({
      organization_id: input.organizationId,
      created_by: input.createdBy ?? null,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      category: input.category?.trim() || "general",
      tags: input.tags ?? [],
      preview_image_url: input.previewImageUrl ?? null,
      status: "draft",
      requires_human_review: true,
      qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
      updated_at: now,
    })
    .select("*")
    .single()
  if (templateError) throw new Error(templateError.message)

  const templateId = asString((templateRow as Record<string, unknown>).id)

  const { data: versionRow, error: versionError } = await versionsTable(admin)
    .insert({
      template_id: templateId,
      version_number: 1,
      status: "draft",
      blocks_json: blocks,
      theme_json: theme,
      default_booking_page_id: input.defaultBookingPageId ?? null,
      merge_fields_used: mergeFieldsUsed,
      change_summary: input.changeSummary?.trim() ?? "Initial draft",
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single()
  if (versionError) throw new Error(versionError.message)

  const versionId = asString((versionRow as Record<string, unknown>).id)
  await templatesTable(admin).update({ current_version_id: versionId, updated_at: now }).eq("id", templateId)

  return getTemplate(admin, templateId) as Promise<GrowthSharePageTemplate>
}

async function createDraftFromVersion(
  admin: SupabaseClient,
  templateId: string,
  source: GrowthSharePageTemplateVersion,
  input: {
    blocks?: GrowthSharePageTemplateBlock[]
    theme?: GrowthSharePageTheme
    defaultBookingPageId?: string | null
    changeSummary?: string
    actorUserId?: string | null
    name?: string
    description?: string
    category?: string
    tags?: string[]
    previewImageUrl?: string | null
  },
): Promise<GrowthSharePageTemplateVersion> {
  const existing = await getTemplate(admin, templateId)
  if (!existing) throw new Error("template_not_found")

  const versions = await listTemplateVersions(admin, templateId)
  const maxVersion = versions.reduce((max, version) => Math.max(max, version.versionNumber), 0)
  const blocks = input.blocks ?? source.blocks
  const theme = input.theme ?? source.theme
  const mergeFieldsUsed = extractSharePageTemplateMergeFields(blocks)
  const now = new Date().toISOString()

  const { data, error } = await versionsTable(admin)
    .insert({
      template_id: templateId,
      version_number: nextSharePageTemplateVersionNumber(maxVersion),
      status: "draft",
      blocks_json: blocks,
      theme_json: theme,
      default_booking_page_id: input.defaultBookingPageId ?? source.defaultBookingPageId,
      merge_fields_used: mergeFieldsUsed,
      change_summary: input.changeSummary?.trim() ?? `Draft created from version ${source.versionNumber}`,
      created_by: input.actorUserId ?? null,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const version = mapVersion(data as Record<string, unknown>)
  await templatesTable(admin)
    .update({
      current_version_id: version.id,
      status: "draft",
      name: input.name?.trim() ?? existing.name,
      description: input.description?.trim() ?? existing.description,
      category: input.category?.trim() ?? existing.category,
      tags: input.tags ?? existing.tags,
      preview_image_url: input.previewImageUrl ?? existing.previewImageUrl,
      updated_at: now,
    })
    .eq("id", templateId)

  return version
}

async function createDraftVersionFromPublished(
  admin: SupabaseClient,
  templateId: string,
  input: {
    blocks?: GrowthSharePageTemplateBlock[]
    theme?: GrowthSharePageTheme
    defaultBookingPageId?: string | null
    changeSummary?: string
    actorUserId?: string | null
    name?: string
    description?: string
    category?: string
    tags?: string[]
    previewImageUrl?: string | null
  },
): Promise<GrowthSharePageTemplateVersion> {
  const existing = await getTemplate(admin, templateId)
  if (!existing) throw new Error("template_not_found")

  const base =
    existing.currentVersion?.isImmutable === true
      ? existing.currentVersion
      : existing.publishedVersion
  if (!base) throw new Error("published_version_not_found")

  return createDraftFromVersion(admin, templateId, base, {
    ...input,
    changeSummary: input.changeSummary?.trim() ?? "Draft created from published version",
  })
}

export async function updateTemplate(
  admin: SupabaseClient,
  templateId: string,
  input: {
    name?: string
    description?: string
    category?: string
    tags?: string[]
    previewImageUrl?: string | null
    blocks?: GrowthSharePageTemplateBlock[]
    theme?: GrowthSharePageTheme
    defaultBookingPageId?: string | null
    changeSummary?: string
    actorUserId?: string | null
  },
): Promise<GrowthSharePageTemplate> {
  const existing = await getTemplate(admin, templateId)
  if (!existing) throw new Error("template_not_found")
  if (existing.status === "archived") throw new Error("template_archived")

  const currentVersion = existing.currentVersion
  if (!currentVersion) throw new Error("version_not_found")

  const versionContentChanged =
    input.blocks != null || input.theme != null || input.defaultBookingPageId !== undefined

  if (versionContentChanged && !canEditSharePageTemplateVersion(currentVersion.isImmutable)) {
    await createDraftVersionFromPublished(admin, templateId, input)
    return getTemplate(admin, templateId) as Promise<GrowthSharePageTemplate>
  }

  const now = new Date().toISOString()
  const blocks = input.blocks ?? currentVersion.blocks
  const theme = input.theme ?? currentVersion.theme
  const mergeFieldsUsed = extractSharePageTemplateMergeFields(blocks)

  if (versionContentChanged) {
    await versionsTable(admin)
      .update({
        blocks_json: blocks,
        theme_json: theme,
        default_booking_page_id: input.defaultBookingPageId ?? currentVersion.defaultBookingPageId,
        merge_fields_used: mergeFieldsUsed,
        change_summary: input.changeSummary?.trim() ?? currentVersion.changeSummary,
      })
      .eq("id", currentVersion.id)
  }

  const metadataChanged =
    input.name != null ||
    input.description != null ||
    input.category != null ||
    input.tags != null ||
    input.previewImageUrl !== undefined

  if (metadataChanged || versionContentChanged) {
    await templatesTable(admin)
      .update({
        name: input.name?.trim() ?? existing.name,
        description: input.description?.trim() ?? existing.description,
        category: input.category?.trim() ?? existing.category,
        tags: input.tags ?? existing.tags,
        preview_image_url: input.previewImageUrl ?? existing.previewImageUrl,
        status: existing.status === "published" && versionContentChanged ? "draft" : existing.status,
        updated_at: now,
      })
      .eq("id", templateId)
  }

  return getTemplate(admin, templateId) as Promise<GrowthSharePageTemplate>
}

export async function archiveTemplate(
  admin: SupabaseClient,
  templateId: string,
): Promise<GrowthSharePageTemplate> {
  const existing = await getTemplate(admin, templateId)
  if (!existing) throw new Error("template_not_found")
  if (!canArchiveSharePageTemplate(existing.status)) throw new Error("invalid_status")

  const now = new Date().toISOString()
  await templatesTable(admin)
    .update({
      status: "archived",
      archived_at: now,
      updated_at: now,
    })
    .eq("id", templateId)

  return getTemplate(admin, templateId) as Promise<GrowthSharePageTemplate>
}

export async function duplicateTemplate(
  admin: SupabaseClient,
  input: {
    templateId: string
    organizationId: string
    actorUserId?: string | null
    name?: string
  },
): Promise<GrowthSharePageTemplate> {
  const existing = await getTemplate(admin, input.templateId)
  if (!existing) throw new Error("template_not_found")
  if (existing.organizationId !== input.organizationId) throw new Error("organization_scope_mismatch")

  const sourceVersion = existing.currentVersion ?? existing.publishedVersion
  if (!sourceVersion) throw new Error("version_not_found")

  return createTemplate(admin, {
    organizationId: input.organizationId,
    createdBy: input.actorUserId ?? null,
    name: input.name?.trim() || `${existing.name} (Copy)`,
    description: existing.description,
    category: existing.category,
    tags: [...existing.tags],
    previewImageUrl: existing.previewImageUrl,
    blocks: sourceVersion.blocks,
    theme: sourceVersion.theme,
    defaultBookingPageId: sourceVersion.defaultBookingPageId,
    changeSummary: `Duplicated from template ${existing.id}`,
  })
}

export async function createVersion(
  admin: SupabaseClient,
  input: {
    templateId: string
    actorUserId?: string | null
    blocks?: GrowthSharePageTemplateBlock[]
    theme?: GrowthSharePageTheme
    defaultBookingPageId?: string | null
    changeSummary?: string
  },
): Promise<GrowthSharePageTemplateVersion> {
  const existing = await getTemplate(admin, input.templateId)
  if (!existing) throw new Error("template_not_found")
  if (existing.status === "archived") throw new Error("template_archived")

  const base = existing.currentVersion ?? existing.publishedVersion
  if (!base) throw new Error("version_not_found")

  if (base.isImmutable) {
    return createDraftVersionFromPublished(admin, input.templateId, input)
  }

  const versions = await listTemplateVersions(admin, input.templateId)
  const maxVersion = versions.reduce((max, version) => Math.max(max, version.versionNumber), 0)
  const blocks = input.blocks ?? base.blocks
  const theme = input.theme ?? base.theme
  const mergeFieldsUsed = extractSharePageTemplateMergeFields(blocks)
  const now = new Date().toISOString()

  const { data, error } = await versionsTable(admin)
    .insert({
      template_id: input.templateId,
      version_number: nextSharePageTemplateVersionNumber(maxVersion),
      status: "draft",
      blocks_json: blocks,
      theme_json: theme,
      default_booking_page_id: input.defaultBookingPageId ?? base.defaultBookingPageId,
      merge_fields_used: mergeFieldsUsed,
      change_summary: input.changeSummary?.trim() ?? "New draft version",
      created_by: input.actorUserId ?? null,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const version = mapVersion(data as Record<string, unknown>)
  await templatesTable(admin)
    .update({
      current_version_id: version.id,
      status: "draft",
      updated_at: now,
    })
    .eq("id", input.templateId)

  return version
}

export async function listTemplateVersionHistory(
  admin: SupabaseClient,
  templateId: string,
): Promise<GrowthSharePageTemplateVersion[]> {
  const existing = await getTemplate(admin, templateId)
  if (!existing) throw new Error("template_not_found")
  return listTemplateVersions(admin, templateId)
}

export async function publishVersion(
  admin: SupabaseClient,
  input: {
    templateId: string
    versionId?: string | null
    actorUserId?: string | null
  },
): Promise<GrowthSharePageTemplate> {
  const existing = await getTemplate(admin, input.templateId)
  if (!existing) throw new Error("template_not_found")
  if (!canPublishSharePageTemplate(existing.status)) throw new Error("invalid_status")

  const versionId = input.versionId ?? existing.currentVersionId
  if (!versionId) throw new Error("version_not_found")

  const { data: versionRow, error: versionLoadError } = await versionsTable(admin)
    .select("*")
    .eq("id", versionId)
    .eq("template_id", input.templateId)
    .maybeSingle()
  if (versionLoadError) throw new Error(versionLoadError.message)
  if (!versionRow) throw new Error("version_not_found")

  const version = mapVersion(versionRow as Record<string, unknown>)
  if (version.isImmutable || version.status === "published") throw new Error("version_already_published")
  if (version.status === "archived") throw new Error("invalid_version_status")

  const now = new Date().toISOString()
  await versionsTable(admin)
    .update({
      status: "published",
      is_immutable: true,
      published_by: input.actorUserId ?? null,
      published_at: now,
    })
    .eq("id", version.id)

  await templatesTable(admin)
    .update({
      status: "published",
      published_version_id: version.id,
      current_version_id: version.id,
      published_at: now,
      updated_at: now,
    })
    .eq("id", input.templateId)

  return getTemplate(admin, input.templateId) as Promise<GrowthSharePageTemplate>
}

export async function unpublishTemplate(
  admin: SupabaseClient,
  templateId: string,
): Promise<GrowthSharePageTemplate> {
  const existing = await getTemplate(admin, templateId)
  if (!existing) throw new Error("template_not_found")
  if (!canUnpublishSharePageTemplate(existing.status)) throw new Error("invalid_status")

  const now = new Date().toISOString()
  await templatesTable(admin)
    .update({
      status: "draft",
      updated_at: now,
    })
    .eq("id", templateId)

  return getTemplate(admin, templateId) as Promise<GrowthSharePageTemplate>
}

export async function restoreVersion(
  admin: SupabaseClient,
  input: {
    templateId: string
    versionId: string
    actorUserId?: string | null
    changeSummary?: string
  },
): Promise<GrowthSharePageTemplate> {
  const existing = await getTemplate(admin, input.templateId)
  if (!existing) throw new Error("template_not_found")
  if (existing.status === "archived") throw new Error("template_archived")

  const { data: versionRow, error: versionLoadError } = await versionsTable(admin)
    .select("*")
    .eq("id", input.versionId)
    .eq("template_id", input.templateId)
    .maybeSingle()
  if (versionLoadError) throw new Error(versionLoadError.message)
  if (!versionRow) throw new Error("version_not_found")

  const source = mapVersion(versionRow as Record<string, unknown>)
  await createDraftFromVersion(admin, input.templateId, source, {
    changeSummary: input.changeSummary?.trim() ?? `Restored from version ${source.versionNumber}`,
    actorUserId: input.actorUserId,
  })

  return getTemplate(admin, input.templateId) as Promise<GrowthSharePageTemplate>
}

export async function duplicateVersion(
  admin: SupabaseClient,
  input: {
    templateId: string
    versionId: string
    actorUserId?: string | null
    changeSummary?: string
  },
): Promise<GrowthSharePageTemplateVersion> {
  const existing = await getTemplate(admin, input.templateId)
  if (!existing) throw new Error("template_not_found")
  if (existing.status === "archived") throw new Error("template_archived")

  const { data: versionRow, error: versionLoadError } = await versionsTable(admin)
    .select("*")
    .eq("id", input.versionId)
    .eq("template_id", input.templateId)
    .maybeSingle()
  if (versionLoadError) throw new Error(versionLoadError.message)
  if (!versionRow) throw new Error("version_not_found")

  const source = mapVersion(versionRow as Record<string, unknown>)
  return createDraftFromVersion(admin, input.templateId, source, {
    changeSummary: input.changeSummary?.trim() ?? `Duplicated from version ${source.versionNumber}`,
    actorUserId: input.actorUserId,
  })
}

export async function getPublishedTemplateVersionForInstantiation(
  admin: SupabaseClient,
  templateId: string,
): Promise<GrowthSharePageTemplateVersion | null> {
  const template = await getTemplate(admin, templateId)
  if (!template || template.status !== "published") return null
  const version = template.publishedVersion
  if (!version || version.status !== "published" || !version.isImmutable) return null
  return version
}
