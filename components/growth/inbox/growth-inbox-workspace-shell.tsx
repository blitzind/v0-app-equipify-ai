"use client"

import type { ReactNode } from "react"
import { GROWTH_INBOX_WORKSPACE_V2_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"
import { cn } from "@/lib/utils"

export const GROWTH_INBOX_WORKSPACE_GRID_QA_MARKER = "growth-inbox-workspace-grid-v1" as const

const INBOX_WORKSPACE_COLUMN_SECTION =
  "flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm" as const

type GrowthInboxWorkspaceShellProps = {
  notifications?: ReactNode
  threadQueue: ReactNode
  conversation: ReactNode
  actionCenter: ReactNode
}

export function GrowthInboxWorkspaceShell({
  notifications,
  threadQueue,
  conversation,
  actionCenter,
}: GrowthInboxWorkspaceShellProps) {
  const hasNotifications = Boolean(notifications)
  const workspaceRowStart = hasNotifications ? "lg:row-start-2" : "lg:row-start-1"
  const actionCenterRowSpan = hasNotifications ? "lg:row-span-2" : "lg:row-span-1"

  return (
    <div
      className="grid min-h-[min(420px,46vh)] grid-cols-1 gap-2 lg:grid-cols-[22fr_50fr_28fr] lg:items-stretch"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_V2_QA_MARKER}
      data-qa-marker={GROWTH_INBOX_WORKSPACE_GRID_QA_MARKER}
    >
      {notifications ? (
        <div className="order-1 min-w-0 lg:order-none lg:col-span-2 lg:col-start-1 lg:row-start-1">
          {notifications}
        </div>
      ) : null}

      <section
        className={cn(
          INBOX_WORKSPACE_COLUMN_SECTION,
          "order-2 lg:order-none lg:col-start-1",
          workspaceRowStart,
        )}
        aria-label="Thread queue"
      >
        {threadQueue}
      </section>

      <section
        className={cn(
          INBOX_WORKSPACE_COLUMN_SECTION,
          "order-3 min-w-0 shadow-md lg:order-none lg:col-start-2",
          workspaceRowStart,
        )}
        aria-label="Conversation"
      >
        {conversation}
      </section>

      <section
        className={cn(
          INBOX_WORKSPACE_COLUMN_SECTION,
          "order-4 lg:order-none lg:col-start-3 lg:row-start-1",
          actionCenterRowSpan,
        )}
        aria-label="Action center"
      >
        {actionCenter}
      </section>
    </div>
  )
}
