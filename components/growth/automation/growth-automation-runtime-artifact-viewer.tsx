"use client"

import type { GrowthAutomationRuntimeStats } from "@/lib/growth/automation/growth-automation-runtime-publisher-types"

type Props = {
  patternId: string | null
  artifactCounts: GrowthAutomationRuntimeStats | null
  publishHistory?: Array<{
    publishedAt: string
    patternId: string
    versionId: string
    artifactVersion: number
  }>
}

export function GrowthAutomationRuntimeArtifactViewer({
  patternId,
  artifactCounts,
  publishHistory = [],
}: Props) {
  if (!patternId && !artifactCounts) {
    return <p className="text-xs text-muted-foreground">No SR-3 artifacts published yet.</p>
  }

  return (
    <div className="space-y-3 text-xs">
      {patternId ? (
        <div className="rounded-md border border-border/70 p-2">
          <p className="text-muted-foreground">Pattern ID</p>
          <p className="font-mono text-[11px] break-all">{patternId}</p>
        </div>
      ) : null}

      {artifactCounts ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <span>Steps: {artifactCounts.patternStepCount}</span>
          <span>Conditions: {artifactCounts.conditionCount}</span>
          <span>Edges: {artifactCounts.edgeCount}</span>
          <span>Waits: {artifactCounts.waitCount}</span>
          <span>Compiled steps: {artifactCounts.stepCount}</span>
        </div>
      ) : null}

      {publishHistory.length > 0 ? (
        <div>
          <p className="mb-1 font-medium">Publish history</p>
          <ul className="space-y-1">
            {publishHistory.slice(-5).reverse().map((entry) => (
              <li key={`${entry.publishedAt}-${entry.artifactVersion}`} className="text-muted-foreground">
                v{entry.artifactVersion} · {new Date(entry.publishedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
