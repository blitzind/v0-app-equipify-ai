"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { GrowthInboxKeyboardWorkflow } from "@/components/growth/inbox/growth-inbox-keyboard-workflow"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"

export function GrowthInboxWorkspaceKeyboardBridge() {
  const router = useRouter()
  const { selectedThreadId, runAction, assignOwner, archiveThread } = useGrowthInboxWorkspace()
  const { leadId, refreshWorkflow } = useGrowthInboxLeadContext()

  const onAssign = useCallback(() => {
    if (!selectedThreadId) return
    void runAction("assign", assignOwner)
  }, [runAction, assignOwner, selectedThreadId])

  const onArchive = useCallback(() => {
    if (!selectedThreadId) return
    void runAction("archive", archiveThread)
  }, [runAction, archiveThread, selectedThreadId])

  const onCall = useCallback(() => {
    if (!leadId) return
    router.push(`/admin/growth/calls/workspace?leadId=${encodeURIComponent(leadId)}`)
  }, [leadId, router])

  const onReply = useCallback(() => {
    const draftSection = document.getElementById("inbox-reply-draft")
    if (!draftSection) return
    draftSection.scrollIntoView({ behavior: "smooth", block: "nearest" })
    draftSection.querySelector<HTMLElement>("textarea, input, button")?.focus()
  }, [])

  const onCreateTask = useCallback(async () => {
    if (!leadId) return
    await fetch("/api/platform/growth/replies/workflow-actions/create-follow-up-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    })
    await refreshWorkflow()
  }, [leadId, refreshWorkflow])

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
