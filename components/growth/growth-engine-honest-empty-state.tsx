"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  buildGrowthEngineHonestEmptyState,
  GROWTH_ENGINE_HONEST_EMPTY_STATE_QA_MARKER,
} from "@/lib/growth/e2e/growth-engine-hardening-empty-states"
import type { GrowthEngineEmptyStateKind } from "@/lib/growth/e2e/growth-engine-hardening-types"

export function GrowthEngineHonestEmptyState({
  kind,
  title,
  message,
}: {
  kind: GrowthEngineEmptyStateKind
  title?: string
  message?: string
}) {
  const config = buildGrowthEngineHonestEmptyState(kind)

  return (
    <div
      className="rounded-xl border border-border/80 bg-muted/30 px-4 py-4 text-sm"
      data-qa-marker={GROWTH_ENGINE_HONEST_EMPTY_STATE_QA_MARKER}
      data-empty-kind={kind}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <GrowthBadge label="Read-only · Human review" tone="neutral" />
      </div>
      <p className="font-medium">{title ?? config.title}</p>
      <p className="mt-1 text-muted-foreground">{message ?? config.message}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        {config.guidance.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
