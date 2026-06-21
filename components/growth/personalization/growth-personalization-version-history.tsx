"use client"

import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  personalizationStatusLabel,
  type GrowthPersonalizationGeneration,
} from "@/lib/growth/personalization/personalization-types"
import type { GrowthPersonalizationGenerationVersionEntry } from "@/lib/growth/personalization/personalization-generation-ux"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "blocked" | "neutral"> = {
  draft: "attention",
  approved: "healthy",
  rejected: "neutral",
  sent: "healthy",
  archived: "neutral",
  blocked: "blocked",
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function GrowthPersonalizationVersionHistory({
  companyLabel,
  versions,
  selectedId,
  compareId,
  onSelect,
  onToggleCompare,
}: {
  companyLabel: string
  versions: GrowthPersonalizationGenerationVersionEntry[]
  selectedId: string | null
  compareId: string | null
  onSelect: (generationId: string) => void
  onToggleCompare: (generationId: string) => void
}) {
  return (
    <GrowthEngineCard title={`${companyLabel} — Version History`}>
      {!versions.length ? (
        <p className="text-sm text-muted-foreground">No generations for this lead yet. Generate a draft to start v1.</p>
      ) : (
        <ul className="space-y-2">
          {versions.map((version) => {
            const selected = selectedId === version.id
            const comparing = compareId === version.id
            return (
              <li key={version.id}>
                <div
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    selected ? "border-violet-400 bg-violet-50/50" : "border-border/60"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button type="button" className="text-left font-medium" onClick={() => onSelect(version.id)}>
                      v{version.versionNumber} · {personalizationStatusLabel(version.status)}
                    </button>
                    <div className="flex flex-wrap gap-1">
                      <GrowthBadge label={personalizationStatusLabel(version.status)} tone={STATUS_TONE[version.status] ?? "neutral"} />
                      <GrowthBadge label={`Evidence ${version.evidenceCoverageScore}%`} tone="neutral" />
                    </div>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{version.subject}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatWhen(version.createdAt)}</p>
                  <button
                    type="button"
                    className={`mt-2 text-xs underline-offset-2 hover:underline ${
                      comparing ? "font-medium text-violet-700" : "text-muted-foreground"
                    }`}
                    onClick={() => onToggleCompare(version.id)}
                  >
                    {comparing ? "Comparing" : "Compare"}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

export function GrowthPersonalizationVersionCompare({
  left,
  right,
}: {
  left: GrowthPersonalizationGeneration | null
  right: GrowthPersonalizationGeneration | null
}) {
  if (!left || !right) return null
  return (
    <GrowthEngineCard title="Compare versions">
      <div className="grid gap-4 md:grid-cols-2">
        {[left, right].map((entry) => (
          <div key={entry.id} className="rounded-lg border border-border/60 p-3 text-sm">
            <p className="font-medium">{entry.subject}</p>
            <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{entry.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Evidence {entry.evidenceCoverageScore}% · Score {entry.personalizationScore}
            </p>
          </div>
        ))}
      </div>
    </GrowthEngineCard>
  )
}
