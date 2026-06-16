"use client"

import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthSharePageTemplateVersionActions } from "@/components/growth/share-pages/templates/growth-share-page-template-version-actions"
import { GrowthSharePageTemplateVersionDiff } from "@/components/growth/share-pages/templates/growth-share-page-template-version-diff"
import {
  summarizeSharePageTemplateVersionDiff,
} from "@/lib/growth/share-pages/share-page-template-version-diff"
import type {
  GrowthSharePageTemplate,
  GrowthSharePageTemplateVersion,
} from "@/lib/growth/share-pages/share-page-template-types"

function formatTimestamp(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function versionStatusTone(status: GrowthSharePageTemplateVersion["status"]) {
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

export function GrowthSharePageTemplateVersionCard({
  version,
  template,
  previousVersion,
  busy,
  disabled,
  onRestore,
  onDuplicate,
}: {
  version: GrowthSharePageTemplateVersion
  template: GrowthSharePageTemplate
  previousVersion: GrowthSharePageTemplateVersion | null
  busy?: boolean
  disabled?: boolean
  onRestore: (version: GrowthSharePageTemplateVersion) => void
  onDuplicate: (version: GrowthSharePageTemplateVersion) => void
}) {
  const isCurrent = template.currentVersionId === version.id
  const isPublishedPointer = template.publishedVersionId === version.id
  const diffSummary = summarizeSharePageTemplateVersionDiff({
    before: previousVersion,
    after: version,
  })

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Version {version.versionNumber}</p>
            <GrowthBadge tone={versionStatusTone(version.status)} label={version.status} />
            {isCurrent ? <GrowthBadge tone="healthy" label="Current" /> : null}
            {isPublishedPointer ? <GrowthBadge tone="healthy" label="Published pointer" /> : null}
            {version.isImmutable ? <GrowthBadge tone="neutral" label="Immutable" /> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{version.changeSummary || "No change summary"}</p>
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Created</dt>
          <dd>{formatTimestamp(version.createdAt)}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Published</dt>
          <dd>{formatTimestamp(version.publishedAt)}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Author</dt>
          <dd>{version.createdBy ?? version.publishedBy ?? "System"}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Sections</dt>
          <dd>{version.blocks.length}</dd>
        </div>
      </dl>

      {previousVersion ? (
        <div className="mt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Changes vs prior version</p>
          <GrowthSharePageTemplateVersionDiff summary={diffSummary} compact />
        </div>
      ) : null}

      <div className="mt-4 border-t border-border pt-3">
        <GrowthSharePageTemplateVersionActions
          version={version}
          isCurrent={isCurrent}
          busy={busy}
          disabled={disabled || template.status === "archived"}
          onRestore={onRestore}
          onDuplicate={onDuplicate}
        />
      </div>
    </div>
  )
}
