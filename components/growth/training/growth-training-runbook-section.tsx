"use client"

import { GrowthAutonomyStatusBanner } from "@/components/growth/autonomy/growth-autonomy-status-banner"
import { GrowthLaunchRunbookPanel } from "@/components/growth/operational/growth-launch-runbook-panel"
import { GrowthOperatorSetupHealthPanel } from "@/components/growth/operational/growth-operator-setup-health-panel"
import { GrowthTrainingSectionCard } from "@/components/growth/training/growth-training-section-card"
import { GROWTH_TRAINING_RUNBOOK_TITLE } from "@/lib/growth/training/growth-training-workspace-types"

export function GrowthTrainingRunbookSection() {
  return (
    <GrowthTrainingSectionCard
      title={GROWTH_TRAINING_RUNBOOK_TITLE}
      description="How do we operate? Procedures, approvals, autonomy, and workflows — never messaging or philosophy."
      qaSection="training-runbook"
    >
      <div className="space-y-6">
        <GrowthAutonomyStatusBanner />
        <GrowthOperatorSetupHealthPanel />
        <GrowthLaunchRunbookPanel embedded />
      </div>
    </GrowthTrainingSectionCard>
  )
}
