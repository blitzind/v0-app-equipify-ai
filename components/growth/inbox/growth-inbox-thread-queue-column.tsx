"use client"

import Link from "next/link"
import { useState } from "react"
import { Filter, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { GrowthInboxThreadQueueRow } from "@/components/growth/inbox/growth-inbox-thread-queue-row"
import {
  GROWTH_INBOX_PRIMARY_QUEUE_VIEWS,
  GROWTH_INBOX_QUEUE_VIEW_LABELS,
  GROWTH_INBOX_SECONDARY_QUEUE_VIEWS,
  isGrowthInboxCallQueueView,
  type GrowthInboxQueueView,
} from "@/lib/growth/inbox/inbox-thread-queue-filters"
import { GROWTH_INBOX_CALL_COMMUNICATION_KIND_LABELS } from "@/lib/growth/inbox/inbox-call-communication-read-model"
import {
  GROWTH_INBOX_CHANNEL_FILTER_OPTIONS,
  GROWTH_INBOX_CHANNEL_FILTER_LABELS,
} from "@/lib/growth/inbox/inbox-channel-types"
import { useGrowthInboxQueue } from "@/components/growth/inbox/growth-inbox-queue-context"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  displayInboxLeadLabel,
} from "@/components/growth/inbox/growth-inbox-shared-ui"
import { GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"
import { recordGrowthInboxActivity } from "@/lib/growth/hubs/growth-inbox-recent-work-memory"
import { growthWorkspaceInboxHref } from "@/lib/growth/navigation/growth-workspace-operator-links"
import { cn } from "@/lib/utils"

const MORE_FILTER_VIEWS = [
  ...GROWTH_INBOX_SECONDARY_QUEUE_VIEWS,
  "call_follow_up",
  "callback_requested",
  "voicemail",
] as const satisfies readonly GrowthInboxQueueView[]

export function GrowthInboxThreadQueueColumn() {
  const { selectedThread, setSelectedThreadId, loadThreadDetail } = useGrowthInboxWorkspace()
  const {
    queueView,
    setQueueView,
    channelFilter,
    setChannelFilter,
    searchQuery,
    setSearchQuery,
    visibleThreads,
    visibleCallItems,
    callCommunicationsLoading,
    queueCounts,
    searchInputRef,
  } = useGrowthInboxQueue()
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const isPrimaryView = (GROWTH_INBOX_PRIMARY_QUEUE_VIEWS as readonly string[]).includes(queueView)
  const isMoreFilterView = (MORE_FILTER_VIEWS as readonly string[]).includes(queueView)

  function selectThread(threadId: string, leadLabel: string, leadId: string) {
    setSelectedThreadId(threadId)
    void loadThreadDetail(threadId)
    recordGrowthInboxActivity({
      id: `thread:${threadId}`,
      kind: "thread",
      label: leadLabel,
      href: growthWorkspaceInboxHref({ threadId, leadId }),
    })
  }

  return (
    <div
      className="flex h-full flex-col p-1.5"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER}
    >
      <div className="mb-1.5 space-y-1.5 border-b border-border pb-1.5">
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
            aria-label="Search inbox threads"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {GROWTH_INBOX_CHANNEL_FILTER_OPTIONS.map((channel) => (
            <button
              key={channel}
              type="button"
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                channelFilter === channel
                  ? "bg-muted text-foreground ring-1 ring-border"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
              )}
              onClick={() => setChannelFilter(channel)}
            >
              {GROWTH_INBOX_CHANNEL_FILTER_LABELS[channel]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {GROWTH_INBOX_PRIMARY_QUEUE_VIEWS.map((view) => {
            const count = queueCounts[view]
            return (
            <button
              key={view}
              type="button"
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                queueView === view
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
              onClick={() => setQueueView(view)}
              aria-label={`${GROWTH_INBOX_QUEUE_VIEW_LABELS[view]}${count > 0 ? `, ${count} threads` : ""}`}
            >
              {GROWTH_INBOX_QUEUE_VIEW_LABELS[view]}
              {count > 0 ? (
                <span className="ml-1 inline-flex min-w-[1rem] justify-center rounded-full bg-background/20 px-1 tabular-nums">
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </button>
            )
          })}
          <Popover open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant={isMoreFilterView ? "default" : "outline"}
                className="h-7 px-2 text-[10px]"
                aria-label="More filters"
              >
                <Filter className="mr-1 size-3" aria-hidden />
                More Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-2">
              <p className="mb-2 text-xs font-medium text-foreground">More filters</p>
              <div className="flex flex-col gap-1">
                {MORE_FILTER_VIEWS.map((view) => (
                  <button
                    key={view}
                    type="button"
                    className={cn(
                      "rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                      queueView === view && "bg-primary/10 font-medium text-primary",
                    )}
                    onClick={() => {
                      setQueueView(view)
                      setMoreFiltersOpen(false)
                    }}
                  >
                    {GROWTH_INBOX_QUEUE_VIEW_LABELS[view]}
                    <span className="ml-1 text-muted-foreground">{queueCounts[view]}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {!isPrimaryView && !isMoreFilterView ? (
            <span className="text-[10px] text-muted-foreground">{GROWTH_INBOX_QUEUE_VIEW_LABELS[queueView]}</span>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-auto">
        {isGrowthInboxCallQueueView(queueView) ? (
          callCommunicationsLoading ? (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">Loading call items…</p>
          ) : visibleCallItems.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">No call items in this queue view.</p>
          ) : (
            visibleCallItems.map((item) => (
              <Link
                key={item.id}
                href={item.ctaHref}
                className="block w-full rounded-lg border border-border/70 bg-card px-2 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-xs font-semibold">{item.companyName}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                    {GROWTH_INBOX_CALL_COMMUNICATION_KIND_LABELS[item.kind]}
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{item.summary}</p>
              </Link>
            ))
          )
        ) : visibleThreads.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">No threads in this queue view.</p>
        ) : (
          visibleThreads.map((thread) => (
            <GrowthInboxThreadQueueRow
              key={thread.id}
              thread={thread}
              selected={selectedThread?.id === thread.id}
              onSelect={() => selectThread(thread.id, displayInboxLeadLabel(thread), thread.lead_id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
