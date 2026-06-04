"use client"

import type { ReactNode } from "react"
import { GROWTH_INBOX_WORKSPACE_V2_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"

type GrowthInboxWorkspaceShellProps = {
  threadQueue: ReactNode
  conversation: ReactNode
  actionCenter: ReactNode
}

export function GrowthInboxWorkspaceShell({
  threadQueue,
  conversation,
  actionCenter,
}: GrowthInboxWorkspaceShellProps) {
  return (
    <div
      className="flex min-h-[560px] flex-col gap-3 lg:flex-row lg:items-stretch"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_V2_QA_MARKER}
    >
      <section
        className="w-full shrink-0 rounded-xl border border-border bg-card shadow-sm lg:w-[24%]"
        aria-label="Thread queue"
      >
        {threadQueue}
      </section>
      <section
        className="min-w-0 flex-1 rounded-xl border border-border bg-card shadow-md lg:w-[52%] lg:flex-[0_0_52%]"
        aria-label="Conversation"
      >
        {conversation}
      </section>
      <section
        className="w-full shrink-0 rounded-xl border border-border bg-card shadow-sm lg:w-[24%]"
        aria-label="Action center"
      >
        {actionCenter}
      </section>
    </div>
  )
}
