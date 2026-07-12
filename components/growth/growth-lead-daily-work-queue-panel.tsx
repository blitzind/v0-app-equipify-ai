"use client"

import { useEffect, useState } from "react"
import { Loader2, ListOrdered } from "lucide-react"
import { GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { isDailyRevenueWorkQueueEnabledClient } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-feature"
import { isAutonomousExecutionGuardrailsEnabledClient } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-feature"
import type { LeadDailyWorkQueueStatus } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-integration"
import type { AutonomousExecutionGuardrailDisplay } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-view"
import { GrowthAutonomousExecutionGuardrailSummary } from "@/components/growth/growth-autonomous-execution-guardrail-summary"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type { GrowthLead } from "@/lib/growth/types"

export function GrowthLeadDailyWorkQueuePanel({ lead }: { lead: GrowthLead }) {
  const { teammate } = useAiTeammateIdentity()
  const [status, setStatus] = useState<LeadDailyWorkQueueStatus | null>(null)
  const [guardrailDisplay, setGuardrailDisplay] = useState<AutonomousExecutionGuardrailDisplay | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isDailyRevenueWorkQueueEnabledClient()) {
      setStatus(null)
      return
    }

    let cancelled = false
    setLoading(true)
    void Promise.all([
      fetch(`/api/platform/growth/daily-revenue-work-queue?leadId=${encodeURIComponent(lead.id)}`, {
        cache: "no-store",
      }),
      isAutonomousExecutionGuardrailsEnabledClient()
        ? fetch(`/api/platform/growth/autonomous-execution-guardrails?leadId=${encodeURIComponent(lead.id)}`, {
            cache: "no-store",
          })
        : Promise.resolve(null),
    ])
      .then(async ([queueResponse, guardrailResponse]) => {
        const payload = (await queueResponse.json()) as {
          ok?: boolean
          enabled?: boolean
          lead_status?: LeadDailyWorkQueueStatus | null
        }
        if (cancelled || !queueResponse.ok || !payload.ok || !payload.enabled) {
          setStatus(null)
        } else {
          setStatus(payload.lead_status ?? null)
        }

        if (guardrailResponse) {
          const guardrailPayload = (await guardrailResponse.json()) as {
            ok?: boolean
            enabled?: boolean
            display?: AutonomousExecutionGuardrailDisplay | null
          }
          if (!cancelled && guardrailResponse.ok && guardrailPayload.ok && guardrailPayload.enabled) {
            setGuardrailDisplay(guardrailPayload.display ?? null)
          } else if (!cancelled) {
            setGuardrailDisplay(null)
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(null)
          setGuardrailDisplay(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [lead.id])

  if (!isDailyRevenueWorkQueueEnabledClient()) return null

  const headline = status?.in_queue
    ? status.queue_position != null
      ? `#${status.queue_position} of ${status.total_actionable}`
      : status.priority ?? "Queued"
    : "Not in today's queue"

  return (
    <GrowthCollapsibleEngineCard
      id="growth-daily-work-queue"
      title="Today's Queue Position"
      icon={<ListOrdered className="size-4" />}
      headerAside={headline}
      defaultOpen
      persistKey={GROWTH_DRAWER_CARD_KEYS.command}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading queue status…
        </div>
      ) : status?.in_queue ? (
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Priority:</span> {status.priority}
          </p>
          {status.action_label ? (
            <p>
              <span className="font-medium">Action:</span> {status.action_label} · {status.channel_label}
            </p>
          ) : null}
          {status.requires_human_approval ? (
            <p className="text-amber-700">Human approval pending</p>
          ) : null}
          {status.reasoning.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {status.reasoning.slice(0, 4).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          {guardrailDisplay ? (
            <div className="pt-2">
              <GrowthAutonomousExecutionGuardrailSummary display={guardrailDisplay} compact />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          This lead is not scheduled in {teammate.name}&apos;s daily work queue today.
        </p>
      )}
    </GrowthCollapsibleEngineCard>
  )
}
