"use client"

import { useCallback, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import {
  GROWTH_HOME_AVA_REFRESH_INTELLIGENCE_LABEL,
  GROWTH_HOME_AVA_RUN_INTAKE_LABEL,
  growthHomeSafeExecutionDisclaimer,
  GROWTH_HOME_AVA_START_RESEARCH_LABEL,
  type GrowthHomeAvaExecuteAction,
  type GrowthHomeAvaExecuteApiResponse,
  type GrowthHomeAvaExecuteStatus,
  growthHomeAvaExecuteHref,
} from "@/lib/growth/ava-home/growth-home-ava-execute-api-contract"
import type { GrowthHomeOpportunityIntelligenceApiResponse } from "@/lib/growth/opportunity-intelligence/growth-home-opportunity-intelligence-api-contract"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"

function executionStatusTone(status: GrowthHomeAvaExecuteStatus | null | undefined) {
  switch (status) {
    case "completed":
      return "healthy" as const
    case "running":
    case "queued":
      return "attention" as const
    case "skipped":
      return "neutral" as const
    case "failed":
      return "risk" as const
    default:
      return "neutral" as const
  }
}

type Props = {
  leadId: string
  onIntelligenceRefreshed?: (response: GrowthHomeOpportunityIntelligenceApiResponse) => void
}

export function GrowthHomeAvaSafeExecutionPanel({ leadId, onIntelligenceRefreshed }: Props) {
  const { teammate } = useAiTeammateIdentity()
  const [loadingAction, setLoadingAction] = useState<GrowthHomeAvaExecuteAction | null>(null)
  const [lastResult, setLastResult] = useState<GrowthHomeAvaExecuteApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runAction = useCallback(
    async (action: GrowthHomeAvaExecuteAction) => {
      setLoadingAction(action)
      setError(null)
      try {
        const res = await fetch(growthHomeAvaExecuteHref(leadId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        })
        const payload = (await res.json()) as GrowthHomeAvaExecuteApiResponse
        if (!res.ok || !payload.ok) {
          throw new Error(payload.message ?? "Safe execution failed.")
        }
        setLastResult(payload)

        if (action === "refresh_intelligence" && payload.viewModel && onIntelligenceRefreshed) {
          onIntelligenceRefreshed({
            ok: true,
            readOnly: true,
            leadId,
            viewModel: payload.viewModel,
            researchStatus: payload.researchStatus,
          })
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Safe execution failed.")
      } finally {
        setLoadingAction(null)
      }
    },
    [leadId, onIntelligenceRefreshed],
  )

  return (
    <div
      data-qa-section="home-ava-safe-execution"
      className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3"
    >
      <div>
        <p className="text-sm font-semibold">Safe execution</p>
        <p className="mt-1 text-xs text-muted-foreground">{growthHomeSafeExecutionDisclaimer(teammate)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={loadingAction != null}
          onClick={() => void runAction("run_unified_intake")}
        >
          {loadingAction === "run_unified_intake" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
          {GROWTH_HOME_AVA_RUN_INTAKE_LABEL}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={loadingAction != null}
          onClick={() => void runAction("start_research")}
        >
          {loadingAction === "start_research" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
          {GROWTH_HOME_AVA_START_RESEARCH_LABEL}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loadingAction != null}
          onClick={() => void runAction("refresh_intelligence")}
        >
          {loadingAction === "refresh_intelligence" ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
          {GROWTH_HOME_AVA_REFRESH_INTELLIGENCE_LABEL}
        </Button>
      </div>

      {lastResult?.status ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Last action:</span>
          <span className="font-medium">{lastResult.action?.replaceAll("_", " ")}</span>
          <GrowthBadge label={lastResult.status} tone={executionStatusTone(lastResult.status)} />
          {lastResult.skipReason ? (
            <span className="text-xs text-muted-foreground">({lastResult.skipReason.replaceAll("_", " ")})</span>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
