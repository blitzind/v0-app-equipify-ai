"use client"

import Link from "next/link"
import { useMemo } from "react"
import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { readGrowthInboxActivityTimeline } from "@/lib/growth/hubs/growth-inbox-recent-work-memory"
import { growthWorkspaceInboxHref } from "@/lib/growth/navigation/growth-workspace-operator-links"

export const GROWTH_INBOX_CONVERSATION_EMPTY_STATE_QA_MARKER = "growth-inbox-conversation-empty-state-v1" as const

export function GrowthInboxConversationEmptyState() {
  const recentThreads = useMemo(
    () => readGrowthInboxActivityTimeline().filter((item) => item.kind === "thread").slice(0, 3),
    [],
  )

  return (
    <section
      aria-labelledby="inbox-conversation-empty-heading"
      className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 py-10 text-center"
      data-qa-marker={GROWTH_INBOX_CONVERSATION_EMPTY_STATE_QA_MARKER}
    >
      <MessageSquare className="mb-3 size-8 text-muted-foreground/60" aria-hidden />
      <h2 id="inbox-conversation-empty-heading" className="text-base font-semibold text-foreground">
        Select a conversation
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Choose a thread from the queue to view messages, intelligence, and recommended actions.
      </p>
      {recentThreads.length > 0 ? (
        <div className="mt-6 w-full max-w-xs text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent</p>
          <ul className="mt-2 space-y-1">
            {recentThreads.map((item) => (
              <li key={item.id}>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-full justify-start px-2 text-sm" asChild>
                  <Link href={item.href}>• {item.label}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
