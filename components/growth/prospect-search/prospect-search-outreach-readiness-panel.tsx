"use client"

import { Badge } from "@/components/ui/badge"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  resolveProspectSearchOutreachReadinessGate,
  GROWTH_OUTREACH_READINESS_GATE_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-outreach-readiness-gate"

export function ProspectSearchOutreachReadinessPanel({
  company,
  operatorOverride = false,
}: {
  company: GrowthProspectSearchCompanyResult
  operatorOverride?: boolean
}) {
  const gate = resolveProspectSearchOutreachReadinessGate({
    company,
    operator_override: operatorOverride,
    reachable: company.reachable_human ?? undefined,
  })

  const variant =
    gate.state === "ready"
      ? "default"
      : gate.state === "blocked"
        ? "destructive"
        : "secondary"

  return (
    <div
      className="space-y-2 rounded-lg border border-border bg-muted/20 p-3 text-xs"
      data-outreach-readiness-gate-marker={GROWTH_OUTREACH_READINESS_GATE_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-foreground">Outreach readiness gate</p>
        <Badge variant={variant}>{gate.state.replace(/_/g, " ")}</Badge>
        {gate.gated ? <Badge variant="outline">Gated</Badge> : null}
      </div>
      {gate.reasons[0] ? <p className="text-muted-foreground">{gate.reasons[0]}</p> : null}
      {gate.blockers[0] ? <p className="text-amber-900">{gate.blockers[0]}</p> : null}
      {gate.reachable ? (
        <p className="text-muted-foreground">
          Reachable human score {gate.reachable.score} · {gate.reachable.label.replace(/_/g, " ")}
        </p>
      ) : null}
    </div>
  )
}
