"use client"

import { use } from "react"
import { GrowthAutomationFlowEditor } from "@/components/growth/automation/growth-automation-flow-editor"

export default function GrowthAutomationEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  return (
    <div className="px-4 py-4 md:px-6 md:py-6">
      <GrowthAutomationFlowEditor flowId={id} />
    </div>
  )
}
