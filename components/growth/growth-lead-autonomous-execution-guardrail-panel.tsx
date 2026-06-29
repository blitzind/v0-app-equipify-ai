"use client"

import { useEffect, useState } from "react"
import { Loader2, ShieldAlert } from "lucide-react"
import { GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthAutonomousExecutionGuardrailSummary } from "@/components/growth/growth-autonomous-execution-guardrail-summary"
import { isAutonomousExecutionGuardrailsEnabledClient } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-feature"
import type { AutonomousExecutionGuardrailDisplay } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-view"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type { GrowthLead } from "@/lib/growth/types"

export function GrowthLeadAutonomousExecutionGuardrailPanel({ lead }: { lead: GrowthLead }) {
  const [display, setDisplay] = useState<AutonomousExecutionGuardrailDisplay | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isAutonomousExecutionGuardrailsEnabledClient()) {
      setDisplay(null)
      return
    }

    let cancelled = false
    setLoading(true)
    void fetch(
      `/api/platform/growth/autonomous-execution-guardrails?leadId=${encodeURIComponent(lead.id)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          ok?: boolean
          enabled?: boolean
          display?: AutonomousExecutionGuardrailDisplay | null
        }
        if (cancelled || !response.ok || !payload.ok || !payload.enabled) {
          setDisplay(null)
          return
        }
        setDisplay(payload.display ?? null)
      })
      .catch(() => {
        if (!cancelled) setDisplay(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [lead.id])

  if (!isAutonomousExecutionGuardrailsEnabledClient()) return null

  return (
    <GrowthCollapsibleEngineCard
      id="growth-autonomous-execution-guardrails"
      title="Autonomous Execution Guardrails"
      icon={<ShieldAlert className="size-4" />}
      headerAside={display?.status_label ?? "Preview"}
      defaultOpen={false}
      persistKey={GROWTH_DRAWER_CARD_KEYS.command}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Evaluating guardrails…
        </div>
      ) : display ? (
        <GrowthAutonomousExecutionGuardrailSummary display={display} />
      ) : (
        <p className="text-sm text-muted-foreground">Guardrail preview unavailable for this lead.</p>
      )}
    </GrowthCollapsibleEngineCard>
  )
}
