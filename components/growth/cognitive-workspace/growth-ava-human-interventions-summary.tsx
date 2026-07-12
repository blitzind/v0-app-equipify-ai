"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthHumanInterventionsPanel } from "@/components/growth/growth-human-interventions-panel"
import { fetchPlatformGrowthClient } from "@/lib/growth/platform-growth-client-fetch"
import {
  HUMAN_INTERVENTION_TYPE_LABELS,
  type HumanInterventionType,
  type HumanInterventionsResponse,
} from "@/lib/growth/human-interventions/human-intervention-types"

const SUMMARY_GROUPS: Array<{
  key: string
  label: string
  types: HumanInterventionType[]
}> = [
  { key: "campaign", label: "Campaign blockers", types: ["campaign_blocked", "channel_issue"] },
  { key: "approval", label: "Approvals", types: ["approval_required", "manual_review"] },
  { key: "replies", label: "Replies", types: ["reply_required", "high_intent"] },
  { key: "followups", label: "Follow-ups", types: ["opportunity", "risk_detected"] },
]

type Props = {
  leadId: string
}

export function GrowthAvaHumanInterventionsSummary({ leadId }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [queue, setQueue] = useState<HumanInterventionsResponse | null>(null)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("lead_id", leadId)
      params.set("filter", "all")
      params.set("limit", "25")
      const res = await fetchPlatformGrowthClient(
        `/api/platform/growth/human-interventions?${params.toString()}`,
      )
      const data = (await res.json()) as HumanInterventionsResponse & { ok?: boolean }
      if (!res.ok) {
        setError("Unable to load interventions")
        setQueue(null)
        return
      }
      setQueue(data)
    } catch {
      setError("Unable to load interventions")
      setQueue(null)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  const total = queue?.total ?? 0
  const groupLines =
    queue == null
      ? []
      : SUMMARY_GROUPS.map((group) => {
          const count = group.types.reduce((sum, type) => sum + (queue.type_counts?.[type] ?? 0), 0)
          return count > 0 ? { key: group.key, label: group.label, count } : null
        }).filter(Boolean) as Array<{ key: string; label: string; count: number }>

  const leftoverTypes = (Object.keys(queue?.type_counts ?? {}) as HumanInterventionType[]).filter(
    (type) => !SUMMARY_GROUPS.some((g) => g.types.includes(type)) && (queue?.type_counts?.[type] ?? 0) > 0,
  )

  return (
    <div className="space-y-3" data-qa-marker="ge-aios-25b-interventions-summary">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-1.5">
          {loading && !queue ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Checking interventions…
            </p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : total === 0 ? (
            <p className="text-sm text-muted-foreground">No interventions require attention.</p>
          ) : (
            <>
              <p className="text-sm font-medium">
                {total} item{total === 1 ? "" : "s"} require attention
              </p>
              <ul className="space-y-0.5 text-sm text-muted-foreground">
                {groupLines.map((line) => (
                  <li key={line.key}>
                    • {line.count} {line.label}
                  </li>
                ))}
                {leftoverTypes.map((type) => (
                  <li key={type}>
                    • {queue?.type_counts?.[type] ?? 0} {HUMAN_INTERVENTION_TYPE_LABELS[type]}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {total > 0 || error ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={() => setExpanded((value) => !value)}
        >
          <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Hide details" : "Expand to see details"}
        </Button>
      ) : null}

      {expanded ? (
        <GrowthHumanInterventionsPanel
          title="Intervention details"
          leadId={leadId}
          compact
          loadOnMount
          enableRealtimeRefresh={false}
        />
      ) : null}
    </div>
  )
}
