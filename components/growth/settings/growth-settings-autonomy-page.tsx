"use client"

import { Gauge } from "lucide-react"
import { GrowthAutonomyControlCenter } from "@/components/growth/autonomy/growth-autonomy-control-center"
import { GrowthAiSettingsReadinessSummary } from "@/components/growth/settings/growth-ai-settings-readiness-summary"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import {
  GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"

export const GROWTH_SETTINGS_AUTONOMY_PAGE_QA_MARKER = "growth-settings-autonomy-wiring-1a-v1" as const

export function GrowthSettingsAutonomyPage() {
  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_SETTINGS_AUTONOMY_PAGE_QA_MARKER}
      data-growth-settings-ai-refinement={GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Growth Autonomy"
        description="What your AI teammate can do automatically, what needs your approval, and what never runs without you."
        icon={Gauge}
      />

      <GrowthAiSettingsReadinessSummary scope="autonomy" />

      <GrowthAutonomyControlCenter variant="operator" />
    </div>
  )
}
