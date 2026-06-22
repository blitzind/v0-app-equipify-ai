"use client"

import { History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { formatPersonalizationDraftTimestamp } from "@/lib/growth/personalization/personalization-generation-ux"
import type { GrowthPersonalizationGenerationVersionEntry } from "@/lib/growth/personalization/personalization-generation-ux"
import { GROWTH_PERSONALIZATION_VERSION_HISTORY_DRAWER_QA_MARKER } from "@/lib/growth/personalization/personalization-generation-ux"
import { personalizationStatusLabel } from "@/lib/growth/personalization/personalization-types"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "blocked" | "neutral"> = {
  draft: "attention",
  approved: "healthy",
  rejected: "neutral",
  sent: "healthy",
  archived: "neutral",
  blocked: "blocked",
}

type Props = {
  versions: GrowthPersonalizationGenerationVersionEntry[]
  selectedId: string | null
  disabled?: boolean
  onOpenHistory: () => void
}

export function GrowthPersonalizationVersionHistorySummary({
  versions,
  selectedId,
  disabled = false,
  onOpenHistory,
}: Props) {
  const activeVersion =
    versions.find((version) => version.id === selectedId) ?? versions[0] ?? null

  return (
    <section
      aria-labelledby="personalization-version-history-summary-heading"
      className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm"
      data-qa={GROWTH_PERSONALIZATION_VERSION_HISTORY_DRAWER_QA_MARKER}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id="personalization-version-history-summary-heading" className="text-sm font-semibold">
            Version History
          </h2>
          {!activeVersion ? (
            <p className="text-xs text-muted-foreground">No generations yet. Generate a draft to start v1.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  v{activeVersion.versionNumber} {personalizationStatusLabel(activeVersion.status).toLowerCase()}
                </span>
                <span className="text-xs text-muted-foreground">
                  · Evidence {activeVersion.evidenceCoverageScore}%
                </span>
                {activeVersion.personalizationScore != null ? (
                  <GrowthBadge label={`Q ${activeVersion.personalizationScore}`} tone="neutral" />
                ) : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">{activeVersion.subject || "Untitled draft"}</p>
              <p className="text-xs text-muted-foreground">
                Last generated {formatPersonalizationDraftTimestamp(activeVersion.createdAt)}
              </p>
            </>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={onOpenHistory}
          disabled={disabled || !versions.length}
        >
          <History className="mr-1 size-3.5" />
          View History
        </Button>
      </div>
      {activeVersion ? (
        <div className="mt-2">
          <GrowthBadge
            label={personalizationStatusLabel(activeVersion.status)}
            tone={STATUS_TONE[activeVersion.status] ?? "neutral"}
          />
        </div>
      ) : null}
    </section>
  )
}
