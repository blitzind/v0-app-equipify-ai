"use client"

import { GitBranch, Loader2 } from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthSharePageTemplateVersionCard } from "@/components/growth/share-pages/templates/growth-share-page-template-version-card"
import { GROWTH_SHARE_PAGE_TEMPLATE_VERSIONING_QA_MARKER } from "@/lib/growth/share-pages/share-page-template-version-diff"
import type {
  GrowthSharePageTemplate,
  GrowthSharePageTemplateVersion,
} from "@/lib/growth/share-pages/share-page-template-types"

export function GrowthSharePageTemplateVersionTimeline({
  template,
  versions,
  loading,
  busyVersionId,
  disabled,
  onRestore,
  onDuplicate,
}: {
  template: GrowthSharePageTemplate
  versions: GrowthSharePageTemplateVersion[]
  loading?: boolean
  busyVersionId?: string | null
  disabled?: boolean
  onRestore: (version: GrowthSharePageTemplateVersion) => void
  onDuplicate: (version: GrowthSharePageTemplateVersion) => void
}) {
  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)

  return (
    <GrowthEngineCard
      title="Version history"
      icon={<GitBranch className="size-4" />}
      data-qa-marker={GROWTH_SHARE_PAGE_TEMPLATE_VERSIONING_QA_MARKER}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Published versions are immutable. Restoring or duplicating creates a new draft and updates the current pointer.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading version history…
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No versions yet.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((version, index) => {
            const previousVersion = sorted[index + 1] ?? null
            return (
              <GrowthSharePageTemplateVersionCard
                key={version.id}
                version={version}
                template={template}
                previousVersion={previousVersion}
                busy={busyVersionId === version.id}
                disabled={disabled}
                onRestore={onRestore}
                onDuplicate={onDuplicate}
              />
            )
          })}
        </div>
      )}
    </GrowthEngineCard>
  )
}
