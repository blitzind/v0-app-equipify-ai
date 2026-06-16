"use client"

import type { GrowthAutomationFlowVersion } from "@/lib/growth/automation/growth-automation-types"

type Props = {
  versions: GrowthAutomationFlowVersion[]
  currentVersionId?: string | null
  publishedVersionId?: string | null
}

export function GrowthAutomationVersionTimeline({
  versions,
  currentVersionId,
  publishedVersionId,
}: Props) {
  if (versions.length === 0) {
    return <p className="text-xs text-muted-foreground">No versions yet.</p>
  }

  return (
    <ol className="space-y-2">
      {versions.map((version) => {
        const isCurrent = version.id === currentVersionId
        const isPublished = version.id === publishedVersionId
        return (
          <li
            key={version.id}
            className="rounded-md border border-border/70 p-2 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">v{version.versionNumber}</span>
              <span className="uppercase tracking-wide text-muted-foreground">{version.lifecycle}</span>
            </div>
            <p className="mt-1 text-muted-foreground">
              {isCurrent ? "Current draft" : null}
              {isPublished ? " Published snapshot" : null}
              {!isCurrent && !isPublished ? " Historical version" : null}
            </p>
            {version.publishedAt ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Published {new Date(version.publishedAt).toLocaleString()}
              </p>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
