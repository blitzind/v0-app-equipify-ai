"use client"

import { HeartHandshake } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ProspectSearchRelationshipMemorySnapshot } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"
import { GROWTH_RELATIONSHIP_MEMORY_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"

function statusVariant(status: string): "default" | "outline" | "secondary" | "destructive" {
  if (status === "engaged" || status === "active") return "default"
  if (status === "warming") return "secondary"
  if (status === "blocked") return "destructive"
  return "outline"
}

export function ProspectSearchRelationshipIntelligencePanel({
  memory,
  compact = false,
}: {
  memory: ProspectSearchRelationshipMemorySnapshot | null | undefined
  compact?: boolean
}) {
  if (!memory) return null

  return (
    <section
      className="rounded-xl border border-rose-100 bg-rose-50/40 p-4"
      data-relationship-memory-marker={GROWTH_RELATIONSHIP_MEMORY_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <HeartHandshake className="size-4 text-rose-800" />
        <h4 className="text-sm font-semibold text-rose-950">Relationship intelligence</h4>
        <Badge variant={statusVariant(memory.relationship_status)}>
          {memory.relationship_status.replace(/_/g, " ")}
        </Badge>
        <Badge variant="outline">{memory.relationship_strength_score}/100</Badge>
        <Badge variant="outline">{memory.momentum_direction.replace(/_/g, " ")}</Badge>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{memory.recommended_next_action}</p>

      {!compact && memory.last_interaction_at ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Last interaction {new Date(memory.last_interaction_at).toLocaleDateString()}
        </p>
      ) : null}

      {memory.strength_reasons.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {memory.strength_reasons.slice(0, compact ? 2 : 4).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {memory.risks.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-amber-900">
          {memory.risks.slice(0, 2).map((risk) => (
            <li key={risk}>Risk: {risk}</li>
          ))}
        </ul>
      ) : null}

      {!memory.evidence_backed ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          No recorded interactions yet — status reflects discovery flags only.
        </p>
      ) : null}
    </section>
  )
}
