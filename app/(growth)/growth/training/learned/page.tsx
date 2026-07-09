"use client"

import { GrowthTrainingLearnedSection } from "@/components/growth/training/growth-training-learned-section"
import { useGrowthWorkspaceDashboard } from "@/components/growth/workspace/use-growth-workspace-dashboard"

export default function GrowthTrainingLearnedPage() {
  const { workspaceSummary } = useGrowthWorkspaceDashboard()
  return <GrowthTrainingLearnedSection organizationalKnowledge={workspaceSummary?.organizationalKnowledge ?? null} />
}
