/** Growth Engine S1-D — Share Page Template version diff summaries (client-safe). */

import type { GrowthSharePageTheme } from "@/lib/growth/share-pages/share-page-types"
import type {
  GrowthSharePageTemplate,
  GrowthSharePageTemplateVersion,
} from "@/lib/growth/share-pages/share-page-template-types"
import { GROWTH_SHARE_PAGE_TEMPLATE_VERSIONING_QA_MARKER } from "@/lib/growth/share-pages/share-page-template-types"

export { GROWTH_SHARE_PAGE_TEMPLATE_VERSIONING_QA_MARKER }

export type SharePageTemplateVersionDiffMetadata = {
  name?: string
  description?: string
  category?: string
  tags?: string[]
  previewImageUrl?: string | null
}

export type SharePageTemplateVersionDiffSummary = {
  lines: string[]
  blockCountBefore: number
  blockCountAfter: number
  blockCountDelta: number
  themeChanged: boolean
  themeChanges: string[]
  metadataChanged: boolean
  metadataChanges: string[]
  mergeFieldsAdded: string[]
  mergeFieldsRemoved: string[]
}

function countEnabledBlocks(version: GrowthSharePageTemplateVersion | null): number {
  if (!version) return 0
  return version.blocks.filter((block) => block.enabled !== false).length
}

const themeFieldLabels: Record<keyof GrowthSharePageTheme, string> = {
  brandColor: "Brand color",
  accentColor: "Accent color",
  logoUrl: "Logo URL",
  heroImageUrl: "Hero image URL",
  publicThemeMode: "Theme mode",
  footerNote: "Footer note",
}

function compareTheme(
  before: GrowthSharePageTheme | null | undefined,
  after: GrowthSharePageTheme | null | undefined,
): string[] {
  if (!before || !after) return []
  const changes: string[] = []
  for (const key of Object.keys(themeFieldLabels) as (keyof GrowthSharePageTheme)[]) {
    const left = before[key] ?? null
    const right = after[key] ?? null
    if (left !== right) {
      changes.push(`${themeFieldLabels[key]} updated`)
    }
  }
  return changes
}

function compareMetadata(
  before: SharePageTemplateVersionDiffMetadata | null | undefined,
  after: SharePageTemplateVersionDiffMetadata | null | undefined,
): string[] {
  if (!before || !after) return []
  const changes: string[] = []
  if (before.name !== after.name) changes.push("Template name changed")
  if (before.description !== after.description) changes.push("Description changed")
  if (before.category !== after.category) changes.push("Category changed")
  if ((before.previewImageUrl ?? null) !== (after.previewImageUrl ?? null)) {
    changes.push("Preview image changed")
  }
  const beforeTags = [...(before.tags ?? [])].sort().join("|")
  const afterTags = [...(after.tags ?? [])].sort().join("|")
  if (beforeTags !== afterTags) changes.push("Tags changed")
  return changes
}

export function summarizeSharePageTemplateVersionDiff(input: {
  before: GrowthSharePageTemplateVersion | null
  after: GrowthSharePageTemplateVersion | null
  metadataBefore?: SharePageTemplateVersionDiffMetadata | null
  metadataAfter?: SharePageTemplateVersionDiffMetadata | null
}): SharePageTemplateVersionDiffSummary {
  const blockCountBefore = countEnabledBlocks(input.before)
  const blockCountAfter = countEnabledBlocks(input.after)
  const blockCountDelta = blockCountAfter - blockCountBefore

  const themeChanges = compareTheme(input.before?.theme, input.after?.theme)
  const metadataChanges = compareMetadata(input.metadataBefore, input.metadataAfter)

  const beforeMerge = new Set(input.before?.mergeFieldsUsed ?? [])
  const afterMerge = new Set(input.after?.mergeFieldsUsed ?? [])
  const mergeFieldsAdded = [...afterMerge].filter((field) => !beforeMerge.has(field)).sort()
  const mergeFieldsRemoved = [...beforeMerge].filter((field) => !afterMerge.has(field)).sort()

  const lines: string[] = []
  if (blockCountDelta === 0) {
    lines.push(`Block count unchanged (${blockCountAfter} sections)`)
  } else if (blockCountDelta > 0) {
    lines.push(`Added ${blockCountDelta} section${blockCountDelta === 1 ? "" : "s"} (${blockCountBefore} → ${blockCountAfter})`)
  } else {
    lines.push(
      `Removed ${Math.abs(blockCountDelta)} section${blockCountDelta === -1 ? "" : "s"} (${blockCountBefore} → ${blockCountAfter})`,
    )
  }

  if (themeChanges.length > 0) {
    lines.push(`Theme: ${themeChanges.join(", ")}`)
  }
  if (metadataChanges.length > 0) {
    lines.push(`Metadata: ${metadataChanges.join(", ")}`)
  }
  if (mergeFieldsAdded.length > 0) {
    lines.push(`Merge fields added: ${mergeFieldsAdded.join(", ")}`)
  }
  if (mergeFieldsRemoved.length > 0) {
    lines.push(`Merge fields removed: ${mergeFieldsRemoved.join(", ")}`)
  }
  if (lines.length === 1 && blockCountDelta === 0 && themeChanges.length === 0 && metadataChanges.length === 0) {
    lines.push("Content updated with no structural changes detected")
  }

  return {
    lines,
    blockCountBefore,
    blockCountAfter,
    blockCountDelta,
    themeChanged: themeChanges.length > 0,
    themeChanges,
    metadataChanged: metadataChanges.length > 0,
    metadataChanges,
    mergeFieldsAdded,
    mergeFieldsRemoved,
  }
}

export function metadataFromTemplate(template: GrowthSharePageTemplate): SharePageTemplateVersionDiffMetadata {
  return {
    name: template.name,
    description: template.description,
    category: template.category,
    tags: template.tags,
    previewImageUrl: template.previewImageUrl,
  }
}

export function nextPublishVersionNumber(template: GrowthSharePageTemplate | null, versions: GrowthSharePageTemplateVersion[]): number {
  const fromVersions = versions.reduce((max, version) => Math.max(max, version.versionNumber), 0)
  const fromCurrent = template?.currentVersion?.versionNumber ?? 0
  const fromPublished = template?.publishedVersion?.versionNumber ?? 0
  const maxKnown = Math.max(fromVersions, fromCurrent, fromPublished)
  if (template?.currentVersion?.status === "draft") {
    return template.currentVersion.versionNumber
  }
  return maxKnown + 1
}
