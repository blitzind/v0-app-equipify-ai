"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { formatPersonalizationDraftTimestamp } from "@/lib/growth/personalization/personalization-generation-ux"
import type { GrowthPersonalizationGenerationVersionEntry } from "@/lib/growth/personalization/personalization-generation-ux"
import { personalizationStatusLabel } from "@/lib/growth/personalization/personalization-types"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "blocked" | "neutral"> = {
  draft: "attention",
  approved: "healthy",
  rejected: "neutral",
  sent: "healthy",
  archived: "neutral",
  blocked: "blocked",
}

const RECENT_GENERATIONS_LIMIT = 10

type Props = {
  companyLabel: string
  versions: GrowthPersonalizationGenerationVersionEntry[]
  selectedId: string | null
  disabled?: boolean
  onSelect: (generationId: string) => void
}

export function GrowthPersonalizationRecentGenerationsPanel({
  companyLabel,
  versions,
  selectedId,
  disabled = false,
  onSelect,
}: Props) {
  const recentVersions = versions.slice(0, RECENT_GENERATIONS_LIMIT)

  return (
    <section
      aria-labelledby="personalization-recent-generations-heading"
      className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      data-qa="growth-personalization-recent-generations-panel"
    >
      <header className="shrink-0 border-b border-border/60 px-3 py-2.5">
        <h2 id="personalization-recent-generations-heading" className="text-sm font-semibold">
          Recent Generations
        </h2>
        <p className="truncate text-xs text-muted-foreground">{companyLabel}</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!recentVersions.length ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">
            No generations yet. Generate a draft to start v1.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {recentVersions.map((version) => {
              const active = selectedId === version.id
              return (
                <li key={version.id}>
                  <button
                    type="button"
                    className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                      active
                        ? "border-violet-400 bg-violet-50/60 ring-1 ring-violet-200"
                        : "border-border/60 hover:bg-muted/30"
                    }`}
                    onClick={() => onSelect(version.id)}
                    disabled={disabled}
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold">v{version.versionNumber}</span>
                      <GrowthBadge
                        label={personalizationStatusLabel(version.status)}
                        tone={STATUS_TONE[version.status] ?? "neutral"}
                      />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {version.subject || "Untitled draft"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Evidence {version.evidenceCoverageScore}%
                      {version.personalizationScore != null ? ` · Q ${version.personalizationScore}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatPersonalizationDraftTimestamp(version.createdAt)}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
