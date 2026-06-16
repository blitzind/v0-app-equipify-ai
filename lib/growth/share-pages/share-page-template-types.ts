/** Growth Engine S1-B — Share Page Template types (client-safe). */

import type { GrowthSharePageTheme } from "@/lib/growth/share-pages/share-page-types"
import type {
  GrowthSharePageTemplateBlock,
  GrowthSharePageTemplateBlockType,
} from "@/lib/growth/share-pages/share-page-template-block-types"

export type {
  GrowthSharePageTemplateBlock,
  GrowthSharePageTemplateBlockType,
} from "@/lib/growth/share-pages/share-page-template-block-types"

export const GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER = "growth-share-page-templates-s1-v1" as const

export const GROWTH_SHARE_PAGE_TEMPLATE_VERSIONING_QA_MARKER =
  "growth-share-page-template-versioning-s1d-v1" as const

export const GROWTH_SHARE_PAGE_TEMPLATE_INSTANTIATION_QA_MARKER =
  "growth-share-page-template-instantiation-s1e-v1" as const

export { GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_QA_MARKER } from "@/lib/growth/share-pages/share-page-template-preview-context"

export const GROWTH_SHARE_PAGE_TEMPLATE_INSTANTIATION_MIGRATION =
  "20270827120600_growth_share_page_template_lineage_s1e.sql" as const

export const GROWTH_SHARE_PAGE_TEMPLATES_CONFIRM = "RUN_GROWTH_SHARE_PAGE_TEMPLATES_CERTIFICATION" as const

export const GROWTH_SHARE_PAGE_TEMPLATES_MIGRATION =
  "20270827120500_growth_share_page_templates_s1b.sql" as const

export const GROWTH_SHARE_PAGE_TEMPLATE_STATUSES = ["draft", "published", "archived"] as const

export type GrowthSharePageTemplateStatus = (typeof GROWTH_SHARE_PAGE_TEMPLATE_STATUSES)[number]

export const GROWTH_SHARE_PAGE_TEMPLATE_VERSION_STATUSES = ["draft", "published", "archived"] as const

export type GrowthSharePageTemplateVersionStatus =
  (typeof GROWTH_SHARE_PAGE_TEMPLATE_VERSION_STATUSES)[number]

export const GROWTH_SHARE_PAGE_TEMPLATE_CATEGORIES = [
  "general",
  "outbound",
  "follow_up",
  "meeting_prep",
  "case_study",
  "custom",
] as const

export type GrowthSharePageTemplateCategory = (typeof GROWTH_SHARE_PAGE_TEMPLATE_CATEGORIES)[number]

export type GrowthSharePageTemplateVersion = {
  id: string
  templateId: string
  versionNumber: number
  status: GrowthSharePageTemplateVersionStatus
  blocks: GrowthSharePageTemplateBlock[]
  theme: GrowthSharePageTheme
  defaultBookingPageId: string | null
  mergeFieldsUsed: string[]
  changeSummary: string
  isImmutable: boolean
  createdBy: string | null
  publishedBy: string | null
  publishedAt: string | null
  createdAt: string
}

export type GrowthSharePageTemplate = {
  id: string
  organizationId: string
  createdBy: string | null
  name: string
  description: string
  category: string
  tags: string[]
  previewImageUrl: string | null
  status: GrowthSharePageTemplateStatus
  publishedAt: string | null
  archivedAt: string | null
  currentVersionId: string | null
  publishedVersionId: string | null
  requiresHumanReview: true
  qaMarker: typeof GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER
  currentVersion: GrowthSharePageTemplateVersion | null
  publishedVersion: GrowthSharePageTemplateVersion | null
  versionCount: number
  createdAt: string
  updatedAt: string
}

export function canEditSharePageTemplateVersion(isImmutable: boolean): boolean {
  return !isImmutable
}

export function canPublishSharePageTemplate(status: GrowthSharePageTemplateStatus): boolean {
  return status === "draft" || status === "published"
}

export function canArchiveSharePageTemplate(status: GrowthSharePageTemplateStatus): boolean {
  return status !== "archived"
}

export function canUnpublishSharePageTemplate(status: GrowthSharePageTemplateStatus): boolean {
  return status === "published"
}

export function hasUnpublishedSharePageTemplateDraft(template: GrowthSharePageTemplate): boolean {
  if (!template.publishedVersion || !template.currentVersion) return false
  return template.currentVersion.id !== template.publishedVersion.id
}

export function nextSharePageTemplateVersionNumber(maxVersion: number): number {
  return Math.max(1, maxVersion + 1)
}
