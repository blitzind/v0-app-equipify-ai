"use client"

import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { GrowthAiOsOperationsDashboard } from "@/components/growth/ai-os/operations/growth-ai-os-operations-dashboard"
import { GrowthAiOsCommandCenterDiagnosticsSections } from "@/components/growth/ai-os/command-center/growth-ai-os-command-center-diagnostics-sections"
import { GrowthAiOsMetaRecommenderSection } from "@/components/growth/ai-os/command-center/growth-ai-os-meta-recommender-section"
import { GrowthAiOsPriorityBindingSection } from "@/components/growth/ai-os/command-center/growth-ai-os-priority-binding-section"
import { GrowthAiOsBoundedAutonomousOutboundSection } from "@/components/growth/ai-os/command-center/growth-ai-os-bounded-autonomous-outbound-section"
import { GrowthAiOsClosedLoopLearningSection } from "@/components/growth/ai-os/command-center/growth-ai-os-closed-loop-learning-section"
import { GrowthAiOsAdaptiveCalibrationSection } from "@/components/growth/ai-os/command-center/growth-ai-os-adaptive-calibration-section"
import type { AiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-types"

function DisclosureGroup({
  title,
  description,
  qaSection,
  children,
  defaultOpen = false,
}: {
  title: string
  description: string
  qaSection: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-xl border border-border/70 bg-muted/10">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-5 py-5" data-qa-section={qaSection}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function GrowthAiOsOperatorEngineeringDisclosure({
  model,
  onRefresh,
}: {
  model: AiOsCommandCenterReadModel
  onRefresh: () => void
}) {
  return (
    <div className="space-y-4 border-t border-dashed border-border pt-8" data-qa-section="operator-engineering-disclosure">
      <div>
        <h2 className="text-xl font-semibold">Engineering Diagnostics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Full subsystem read models — collapsed by default. No runtime behavior changes.
        </p>
      </div>

      <div className="space-y-3">
        <DisclosureGroup
          title="Legacy Operations Console"
          description="Pre-UX-1A engineering dashboard with KPI grids and subsystem cards."
          qaSection="engineering-legacy-operations-dashboard"
        >
          <GrowthAiOsOperationsDashboard
            dashboard={model.operationsDashboard}
            metaRecommender={model.metaRecommender}
            communicationEngine={model.communicationEngine}
            revenueDirector={model.revenueDirector}
            priorityBinding={model.priorityBinding}
            humanApprovalCenter={model.humanApprovalCenter}
            boundedAutonomousOutbound={model.boundedAutonomousOutbound}
            closedLoopLearning={model.closedLoopLearning}
            adaptiveCalibration={model.adaptiveCalibration}
            calibrationApply={model.calibrationApply}
          />
        </DisclosureGroup>

        <DisclosureGroup
          title="Meta-Recommender"
          description="Ranking coefficients and recommendation evidence."
          qaSection="engineering-meta-recommender"
        >
          <GrowthAiOsMetaRecommenderSection metaRecommender={model.metaRecommender} />
        </DisclosureGroup>

        <DisclosureGroup
          title="Priority Engine"
          description="Objective binding and priority overlays."
          qaSection="engineering-priority-engine"
        >
          <GrowthAiOsPriorityBindingSection priorityBinding={model.priorityBinding} />
        </DisclosureGroup>

        <DisclosureGroup
          title="Learning"
          description="Closed-loop learning outcomes and insights."
          qaSection="engineering-learning"
        >
          <GrowthAiOsClosedLoopLearningSection closedLoopLearning={model.closedLoopLearning} />
        </DisclosureGroup>

        <DisclosureGroup
          title="Calibration"
          description="Adaptive calibration proposals and apply read model."
          qaSection="engineering-calibration"
        >
          <GrowthAiOsAdaptiveCalibrationSection
            adaptiveCalibration={model.adaptiveCalibration}
            calibrationApply={model.calibrationApply}
          />
        </DisclosureGroup>

        <DisclosureGroup
          title="Bounded Autonomous Outbound"
          description="Scope storage, channel mix, and stop conditions."
          qaSection="engineering-bounded-outbound"
        >
          <GrowthAiOsBoundedAutonomousOutboundSection
            boundedAutonomousOutbound={model.boundedAutonomousOutbound}
          />
        </DisclosureGroup>

        <DisclosureGroup
          title="Full Phase Diagnostics (1A–5D)"
          description="Agent framework, runtime, boundary audit, pilots, and memory."
          qaSection="engineering-full-diagnostics"
        >
          <GrowthAiOsCommandCenterDiagnosticsSections model={model} onRefresh={onRefresh} />
        </DisclosureGroup>
      </div>
    </div>
  )
}
