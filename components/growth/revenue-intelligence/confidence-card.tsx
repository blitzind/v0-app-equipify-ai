"use client"

import { ConfidenceBar } from "@/components/growth/revenue-intelligence/confidence-bar"
import { normalizeConfidence } from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"

export function ConfidenceCard({
  candidateConfidence,
  operatorConfidence,
  label = "Overall confidence",
}: {
  candidateConfidence: number
  operatorConfidence?: number | null
  label?: string
}) {
  const primary = normalizeConfidence(candidateConfidence)
  const operator = operatorConfidence != null ? normalizeConfidence(operatorConfidence) : null

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <ConfidenceBar value={primary} showLabel={false} className="mt-2" />
        <p className="mt-1 text-sm font-medium tabular-nums">{(primary * 100).toFixed(0)}%</p>
      </div>
      {operator != null ? (
        <div>
          <p className="text-xs text-muted-foreground">Operator guidance confidence</p>
          <ConfidenceBar value={operator} className="mt-1" />
        </div>
      ) : null}
    </div>
  )
}
