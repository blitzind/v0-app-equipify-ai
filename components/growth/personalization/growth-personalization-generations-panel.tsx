"use client"

import { Copy, Eye, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
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

type Props = {
  companyLabel: string
  versions: GrowthPersonalizationGenerationVersionEntry[]
  selectedId: string | null
  disabled?: boolean
  onSelect: (generationId: string) => void
  onPreview: (generationId: string) => void
  onDuplicate: (generationId: string) => void
  onRegenerate: (generationId: string) => void
}

export function GrowthPersonalizationGenerationsPanel({
  companyLabel,
  versions,
  selectedId,
  disabled = false,
  onSelect,
  onPreview,
  onDuplicate,
  onRegenerate,
}: Props) {
  return (
    <section
      aria-labelledby="personalization-generations-heading"
      className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <header className="shrink-0 border-b border-border/60 px-3 py-2.5">
        <h2 id="personalization-generations-heading" className="text-sm font-semibold">
          Generations
        </h2>
        <p className="text-xs text-muted-foreground">{companyLabel}</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!versions.length ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">
            No generations yet. Generate a draft to start v1.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {versions.map((version) => {
              const selected = selectedId === version.id
              return (
                <li key={version.id}>
                  <div
                    className={`rounded-lg border px-2.5 py-2 transition ${
                      selected
                        ? "border-violet-400 bg-violet-50/60 ring-1 ring-violet-200"
                        : "border-border/60 hover:bg-muted/30"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => onSelect(version.id)}
                      disabled={disabled}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold">v{version.versionNumber}</span>
                        <GrowthBadge
                          label={personalizationStatusLabel(version.status)}
                          tone={STATUS_TONE[version.status] ?? "neutral"}
                        />
                        <span className="text-xs text-muted-foreground">
                          Q {version.personalizationScore}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatPersonalizationDraftTimestamp(version.createdAt)}
                        </span>
                      </div>
                    </button>

                    <div className="mt-2 flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => onPreview(version.id)}
                        disabled={disabled}
                      >
                        <Eye className="mr-1 size-3" />
                        Preview
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => onDuplicate(version.id)}
                        disabled={disabled}
                      >
                        <Copy className="mr-1 size-3" />
                        Duplicate
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => onRegenerate(version.id)}
                        disabled={disabled}
                      >
                        <RefreshCw className="mr-1 size-3" />
                        Regenerate
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
