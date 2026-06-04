"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { GrowthInboxKeyboardWorkflow } from "@/components/growth/inbox/growth-inbox-keyboard-workflow"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"

export function GrowthInboxWorkspaceKeyboardBridge() {
  const router = useRouter()
  const { selectedThread, runAction, assignOwner, archiveThread } = useGrowthInboxWorkspace()
  const { leadId, refresh } = useGrowthInboxLeadContext()

  const onAssign = useCallback(() => {
    void runAction("assign", assignOwner)
  }, [runAction, assignOwner])

  const onArchive = useCallback(() => {
    void runAction("archive", archiveThread)
  }, [runAction, archiveThread])

  const onCall = useCallback(() => {
    if (!leadId) return
    router.push(`/admin/growth/calls/workspace?leadId=${encodeURIComponent(leadId)}`)
  }, [leadId, router])

  const onReply = useCallback(() => {
    document.getElementById("inbox-reply-draft")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const onCreateTask = useCallback(async () => {
    if (!leadId) return
    await fetch("/api/platform/growth/replies/workflow-actions/create-follow-up-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    })
    await refresh()
  }, [leadId, refresh])

  const onCreateOpportunity = useCallback(async () => {
    if (!leadId) return
    const response = await fetch(
      `/api/platform/growth/replies/workflow-actions/opportunity-draft?leadId=${encodeURIComponent(leadId)}`,
      { cache: "no-store" },
    )
    const payload = (await response.json()) as { draft?: { title?: string } }
    if (!response.ok) return
    document.dispatchEvent(
      new CustomEvent("growth-inbox-open-opportunity-dialog", {
        detail: { draft: payload.draft ?? null },
      }),
    )
  }, [leadId])

  if (!selectedThread) return null

  return (
    <GrowthInboxKeyboardWorkflow
      onAssign={onAssign}
      onArchive={onArchive}
      onCall={onCall}
      onReply={onReply}
      onCreateTask={() => void onCreateTask()}
      onCreateOpportunity={() => void onCreateOpportunity()}
    />
  )
}
