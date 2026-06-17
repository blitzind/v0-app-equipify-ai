"use client"

import { GitBranch } from "lucide-react"
import { GrowthReplyWorkflowWorkspace } from "@/components/growth/replies/growth-reply-workflow-workspace"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthInboxWorkflowPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Sales Workflow Actions"
        description="Reply-generated recommendations — mark interested, create call tasks, review opportunities, and resolve sequence exits. All actions require operator confirmation."
        icon={GitBranch}
        iconClassName="bg-indigo-50 text-indigo-600"
      />

      <GrowthReplyWorkflowWorkspace showPageHeader={false} />
    </div>
  )
}
