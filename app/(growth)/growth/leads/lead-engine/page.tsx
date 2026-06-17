"use client"

import { Workflow } from "lucide-react"
import { GrowthLeadEngineWorkspace } from "@/components/growth/growth-lead-engine-workspace"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import {
  GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER,
  GROWTH_LEAD_PIPELINE_IA_QA_MARKER,
  GROWTH_LEAD_PIPELINE_LABEL,
  GROWTH_LEAD_PIPELINE_SUBTITLE,
} from "@/lib/growth/lead-engine/lead-intelligence-inspector-types"
import { GROWTH_NAV_LEAD_INTELLIGENCE_SINGLE_HOME_QA_MARKER } from "@/lib/growth/navigation/growth-navigation-destinations"

export default function GrowthLeadsLeadEnginePage() {
  return (
    <div
      className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8"
      data-qa-marker={GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER}
      data-lead-pipeline-ia-marker={GROWTH_LEAD_PIPELINE_IA_QA_MARKER}
      data-qa={GROWTH_NAV_LEAD_INTELLIGENCE_SINGLE_HOME_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title={GROWTH_LEAD_PIPELINE_LABEL}
        description={GROWTH_LEAD_PIPELINE_SUBTITLE}
        icon={Workflow}
        iconClassName="bg-violet-50 text-violet-600"
      />

      <GrowthLeadEngineWorkspace />
    </div>
  )
}
