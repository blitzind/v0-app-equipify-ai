"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Archive, Copy, Eye, Pencil, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthSharePageTemplate } from "@/lib/growth/share-pages/share-page-template-types"
import { GROWTH_SHARE_PAGE_TEMPLATE_CATEGORIES } from "@/lib/growth/share-pages/share-page-template-types"

const STATUS_LABELS: Record<GrowthSharePageTemplate["status"], string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
}

function statusTone(status: GrowthSharePageTemplate["status"]) {
  switch (status) {
    case "published":
      return "healthy" as const
    case "draft":
      return "attention" as const
    case "archived":
      return "neutral" as const
    default:
      return "neutral" as const
  }
}

function formatCategory(category: string): string {
  const match = GROWTH_SHARE_PAGE_TEMPLATE_CATEGORIES.find((entry) => entry === category)
  if (match) return match.replace(/_/g, " ")
  return category
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Never"
  return new Date(value).toLocaleString()
}

export function GrowthSharePageTemplateCard({
  template,
  onDuplicate,
  onArchive,
  onUseTemplate,
  busy,
}: {
  template: GrowthSharePageTemplate
  onDuplicate: (template: GrowthSharePageTemplate) => void
  onArchive: (template: GrowthSharePageTemplate) => void
  onUseTemplate?: (template: GrowthSharePageTemplate) => void
  busy?: boolean
}) {
  const pathname = usePathname()
  const editPath = growthFeaturePath(pathname, `share-pages/templates/${template.id}`)
  const previewPath = growthFeaturePath(pathname, `share-pages/templates/${template.id}/preview`)
  const hasPublishedPointer = Boolean(template.publishedVersion)
  const hasDraftAhead =
    template.currentVersion &&
    template.publishedVersion &&
    template.currentVersion.id !== template.publishedVersion.id

  return (
    <GrowthEngineCard className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">{template.name}</h3>
            <GrowthBadge tone={statusTone(template.status)} label={STATUS_LABELS[template.status]} />
            {hasPublishedPointer ? (
              <GrowthBadge tone="healthy" label={`Published v${template.publishedVersion?.versionNumber}`} />
            ) : null}
            {hasDraftAhead ? (
              <GrowthBadge tone="attention" label={`Draft v${template.currentVersion?.versionNumber}`} />
            ) : null}
            {template.status === "archived" ? <GrowthBadge tone="neutral" label="Archived" /> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {template.description || "No description yet."}
          </p>
        </div>
        {template.previewImageUrl ? (
          <div
            className="size-14 shrink-0 rounded-xl border border-border bg-muted bg-cover bg-center"
            style={{ backgroundImage: `url(${template.previewImageUrl})` }}
            aria-hidden
          />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-border px-2 py-0.5">{formatCategory(template.category)}</span>
        <span className="rounded-full border border-border px-2 py-0.5">
          {template.versionCount} version{template.versionCount === 1 ? "" : "s"}
        </span>
        {template.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full border border-border px-2 py-0.5">
            {tag}
          </span>
        ))}
      </div>

      <div className="grid gap-1 text-xs text-muted-foreground">
        <p>Last modified {formatTimestamp(template.updatedAt)}</p>
        <p>Last published {formatTimestamp(template.publishedAt)}</p>
      </div>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
        <Button asChild size="sm" variant="default">
          <Link href={editPath}>
            <Pencil className="mr-1.5 size-3.5" />
            Edit
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={previewPath}>
            <Eye className="mr-1.5 size-3.5" />
            Preview
          </Link>
        </Button>
        {template.status === "published" && onUseTemplate ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onUseTemplate(template)}>
            <Sparkles className="mr-1.5 size-3.5" />
            Use template
          </Button>
        ) : null}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onDuplicate(template)}>
          <Copy className="mr-1.5 size-3.5" />
          Duplicate
        </Button>
        {template.status !== "archived" ? (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onArchive(template)}>
            <Archive className="mr-1.5 size-3.5" />
            Archive
          </Button>
        ) : null}
      </div>
    </GrowthEngineCard>
  )
}

export { STATUS_LABELS as GROWTH_SHARE_PAGE_TEMPLATE_STATUS_LABELS }
