"use client"

import { Check } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { GrowthObjectiveStageId } from "@/lib/growth/objectives/growth-objective-types"
import {
  AI_OS_EXECUTIVE_MISSION_FUNNEL,
  type AiOsExecutMissionFunnelStepId,
} from "@/lib/growth/aios/ai-executive-planning-review-ux-types"
import { cn } from "@/lib/utils"
import { GrowthAiOsProgressBar } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-ux-utils"

function resolveFunnelStepId(stageId: GrowthObjectiveStageId): AiOsExecutMissionFunnelStepId {
  for (const step of AI_OS_EXECUTIVE_MISSION_FUNNEL) {
    if (step.constitutionalStages.includes(stageId)) return step.id
  }
  return "discover"
}

function resolveFunnelProgress(currentStepId: AiOsExecutMissionFunnelStepId): number {
  const index = AI_OS_EXECUTIVE_MISSION_FUNNEL.findIndex((step) => step.id === currentStepId)
  if (index < 0) return 0
  return Math.round(((index + 1) / AI_OS_EXECUTIVE_MISSION_FUNNEL.length) * 100)
}

export function GrowthAiOsMissionProgressTrack({
  stageId,
  stageLabel,
  progressPercent,
}: {
  stageId: GrowthObjectiveStageId
  stageLabel: string
  progressPercent: number
}) {
  const currentFunnelId = resolveFunnelStepId(stageId)
  const currentIndex = AI_OS_EXECUTIVE_MISSION_FUNNEL.findIndex((step) => step.id === currentFunnelId)
  const funnelProgress = resolveFunnelProgress(currentFunnelId)

  return (
    <Card data-qa-section="mission-progress">
      <CardHeader className="pb-3">
        <CardTitle>Mission progress</CardTitle>
        <CardDescription>
          Currently in {stageLabel} · estimated {funnelProgress}% through executive funnel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <GrowthAiOsProgressBar value={progressPercent} label="Mission target progress" />
        <div className="overflow-x-auto pb-1">
          <ol className="flex min-w-[640px] items-start justify-between gap-2">
            {AI_OS_EXECUTIVE_MISSION_FUNNEL.map((step, index) => {
              const isComplete = index < currentIndex
              const isCurrent = step.id === currentFunnelId
              return (
                <li key={step.id} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div
                    className={cn(
                      "flex size-8 shrink-0 rounded-full border text-xs font-semibold",
                      isComplete && "border-emerald-300 bg-emerald-50 text-emerald-700",
                      isCurrent && "border-indigo-400 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200",
                      !isComplete && !isCurrent && "border-border bg-muted/30 text-muted-foreground",
                    )}
                  >
                    {isComplete ? <Check className="size-4" /> : index + 1}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-xs font-medium",
                        isCurrent ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </p>
                  </div>
                  {index < AI_OS_EXECUTIVE_MISSION_FUNNEL.length - 1 ? (
                    <div className="mx-1 hidden h-px flex-1 bg-border sm:block" aria-hidden />
                  ) : null}
                </li>
              )
            })}
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
