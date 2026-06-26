"use client"

import { ArrowDown, Check, Circle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AiOsExecutPlanningReportWorkOrderPlanStep } from "@/lib/growth/aios/ai-executive-planning-report-types"
import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"
import { cn } from "@/lib/utils"

function resolveRoadmapStatus(
  step: AiOsExecutPlanningReportWorkOrderPlanStep,
  activeTypes: Set<AiWorkOrderType>,
  currentIndex: number,
  stepIndex: number,
): "completed" | "current" | "upcoming" | "skipped" {
  if (step.duplicateSkipped) return "skipped"
  if (activeTypes.has(step.workOrderType)) return "completed"
  if (stepIndex === currentIndex) return "current"
  if (stepIndex < currentIndex) return "completed"
  return "upcoming"
}

export function GrowthAiOsWorkOrderRoadmap({
  steps,
  activeWorkOrderTypes,
}: {
  steps: AiOsExecutPlanningReportWorkOrderPlanStep[]
  activeWorkOrderTypes: AiWorkOrderType[]
}) {
  const activeTypes = new Set(activeWorkOrderTypes)
  let currentIndex = steps.findIndex(
    (step) => !step.duplicateSkipped && !activeTypes.has(step.workOrderType),
  )
  if (currentIndex < 0) currentIndex = steps.length

  return (
    <Card data-qa-section="work-order-roadmap">
      <CardHeader className="pb-3">
        <CardTitle>Work Order roadmap</CardTitle>
        <CardDescription>Constitutional workflow for this mission stage — current step highlighted.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-0">
          {steps.map((step, index) => {
            const status = resolveRoadmapStatus(step, activeTypes, currentIndex, index)
            const isLast = index === steps.length - 1
            return (
              <li key={`${step.sequence}-${step.workOrderType}`} className="flex gap-3">
                <div className="flex w-8 shrink-0 flex-col justify-center pt-1">
                  {status === "completed" ? (
                    <div className="flex size-7 rounded-full bg-emerald-100 text-emerald-700">
                      <Check className="size-4" />
                    </div>
                  ) : status === "current" ? (
                    <div className="flex size-7 rounded-full border-2 border-indigo-500 bg-indigo-50 text-indigo-700">
                      <Circle className="size-3 fill-current" />
                    </div>
                  ) : status === "skipped" ? (
                    <div className="flex size-7 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground">
                      <span className="text-[10px] font-semibold">—</span>
                    </div>
                  ) : (
                    <div className="flex size-7 rounded-full border border-border bg-muted/20 text-muted-foreground">
                      <span className="text-[10px] font-semibold">{step.sequence}</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-4">
                  <div
                    className={cn(
                      "rounded-lg border px-3 py-2.5",
                      status === "current" && "border-indigo-300 bg-indigo-50/70 shadow-sm",
                      status === "completed" && "border-emerald-200 bg-emerald-50/40",
                      status === "upcoming" && "border-border/60 bg-muted/10 opacity-80",
                      status === "skipped" && "border-dashed border-muted-foreground/30 bg-muted/5 opacity-70",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          status === "upcoming" || status === "skipped"
                            ? "text-muted-foreground"
                            : "text-foreground",
                        )}
                      >
                        {step.label}
                      </p>
                      {status === "current" ? (
                        <Badge className="bg-indigo-600 hover:bg-indigo-600">Current</Badge>
                      ) : null}
                      {status === "skipped" ? <Badge variant="outline">Skipped</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {step.assignedAgent} · priority {step.priority}
                    </p>
                  </div>
                  {!isLast ? (
                    <div className="ml-3 mt-1 text-muted-foreground/50">
                      <ArrowDown className="size-4" aria-hidden />
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
