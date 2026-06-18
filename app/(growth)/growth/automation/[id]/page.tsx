"use client"

import { use } from "react"
import { GrowthAutomationFlowEditor } from "@/components/growth/automation/growth-automation-flow-editor"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthAutomationEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  return (
    <GrowthWorkspacePageContent>
      <GrowthAutomationFlowEditor flowId={id} />
    </GrowthWorkspacePageContent>
  )
}
