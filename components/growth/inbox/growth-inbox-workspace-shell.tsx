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
      className="flex min-h-[min(420px,46vh)] flex-col gap-2 lg:flex-row lg:items-stretch"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_V2_QA_MARKER}
    >
      <section
        className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:w-[22%]"
        aria-label="Thread queue"
      >
        {threadQueue}
      </section>
      <section
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-md lg:w-[50%] lg:flex-[0_0_50%]"
        aria-label="Conversation"
      >
        {conversation}
      </section>
      <section
        className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:w-[28%]"
        aria-label="Action center"
      >
        {actionCenter}
      </section>
    </div>
  )
}
