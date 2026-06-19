"use client"

import type { ReactNode } from "react"
import {
  GROWTH_INBOX_CONVERSATION_WORKSPACE_QA_MARKER,
  GROWTH_INBOX_FINAL_POLISH_QA_MARKER,
} from "@/lib/growth/hubs/growth-inbox-conversation-workspace-config"
import { GROWTH_INBOX_WORKSPACE_V2_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"

export const GROWTH_INBOX_OPERATOR_WORKSPACE_QA_MARKER = "growth-inbox-operator-workspace-v2" as const

type GrowthInboxPrimaryWorkspaceProps = {
  threadQueue: ReactNode
  conversation: ReactNode
  intelligenceSidebar: ReactNode
}

/** 28/42/30 — thread queue | conversation workspace | intelligence + actions (UX-AUDIT-9). */
export function GrowthInboxPrimaryWorkspace({
  threadQueue,
  conversation,
  intelligenceSidebar,
}: GrowthInboxPrimaryWorkspaceProps) {
  return (
    <section
      aria-labelledby="inbox-primary-workspace-heading"
      className="grid min-h-[min(480px,56vh)] grid-cols-1 gap-1.5 lg:grid-cols-[7fr_10fr_7fr]"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_V2_QA_MARKER}
      data-qa-marker={GROWTH_INBOX_OPERATOR_WORKSPACE_QA_MARKER}
      data-growth-inbox-conversation-workspace={GROWTH_INBOX_CONVERSATION_WORKSPACE_QA_MARKER}
      data-growth-inbox-final-polish={GROWTH_INBOX_FINAL_POLISH_QA_MARKER}
      data-section="primary-workspace"
    >
      <h2 id="inbox-primary-workspace-heading" className="sr-only">
        Primary inbox workspace
      </h2>
      <div className="min-h-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">{threadQueue}</div>
      <div className="min-h-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">{conversation}</div>
      <div className="min-h-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm max-lg:order-last">
        {intelligenceSidebar}
      </div>
    </section>
  )
}
