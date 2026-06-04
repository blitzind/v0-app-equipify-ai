"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_INBOX_QUEUE_VIEWS,
  GROWTH_INBOX_QUEUE_VIEW_LABELS,
} from "@/lib/growth/inbox/inbox-thread-queue-filters"
import { useGrowthInboxQueue } from "@/components/growth/inbox/growth-inbox-queue-context"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  INBOX_STATUS_TONE,
  displayInboxLeadLabel,
  formatInboxDate,
} from "@/components/growth/inbox/growth-inbox-shared-ui"
import { classificationLabel } from "@/lib/growth/inbox/reply-classifier"
import { priorityTierLabel } from "@/lib/growth/inbox/thread-priority"
import { GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"
import { cn } from "@/lib/utils"

export function GrowthInboxThreadQueueColumn() {
  const { selectedThread, setSelectedThreadId, loadThreadDetail } = useGrowthInboxWorkspace()
  const {
    queueView,
    setQueueView,
    searchQuery,
    setSearchQuery,
    visibleThreads,
    queueCounts,
    searchInputRef,
  } = useGrowthInboxQueue()

  return (
    <div
      className="flex h-full flex-col p-2"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER}
    >
      <div className="mb-2 space-y-2 border-b border-border pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Thread Queue</h2>
          <span className="text-xs text-muted-foreground">{visibleThreads.length}</span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2 size-3.5 text-muted-foreground" />
          <Input
            ref={(node) => {
              searchInputRef.current = node
            }}
            id="inbox-queue-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search threads… (/)"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {GROWTH_INBOX_QUEUE_VIEWS.map((view) => (
            <button
              key={view}
              type="button"
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                queueView === view
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
              onClick={() => setQueueView(view)}
            >
              {GROWTH_INBOX_QUEUE_VIEW_LABELS[view]}
              <span className="ml-1 opacity-70">{queueCounts[view]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-auto">
        {visibleThreads.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">No threads in this queue view.</p>
        ) : (
          visibleThreads.map((thread) => {
            const isSelected = selectedThread?.id === thread.id
            return (
              <button
                key={thread.id}
                type="button"
                className={cn(
                  "w-full rounded-lg border px-2 py-2 text-left transition-colors",
                  isSelected
                    ? "border-primary/40 bg-primary/10 shadow-sm"
                    : "border-border/70 bg-card hover:bg-muted/40",
                )}
                onClick={() => {
                  setSelectedThreadId(thread.id)
                  void loadThreadDetail(thread.id)
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-xs font-semibold">{displayInboxLeadLabel(thread)}</p>
                  <GrowthBadge
                    label={priorityTierLabel(thread.priority_tier)}
                    tone={INBOX_STATUS_TONE[thread.priority_tier] ?? "neutral"}
                  />
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{thread.subject || "Untitled thread"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <GrowthBadge
                    label={classificationLabel(thread.classification)}
                    tone={INBOX_STATUS_TONE[thread.priority_tier] ?? "neutral"}
                  />
                  {!thread.owner_user_id ? (
                    <span className="text-[10px] text-amber-700 dark:text-amber-300">Unassigned</span>
                  ) : null}
                  {thread.requires_human_review ? (
                    <span className="text-[10px] text-rose-700 dark:text-rose-300">Needs review</span>
                  ) : null}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{formatInboxDate(thread.last_message_at)}</p>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
