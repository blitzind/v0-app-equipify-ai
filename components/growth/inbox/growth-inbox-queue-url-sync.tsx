"use client"

import { useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useGrowthInboxQueue } from "@/components/growth/inbox/growth-inbox-queue-context"
import { useGrowthWorkspaceDefaultViewsReadonly } from "@/hooks/growth/use-growth-workspace-default-views-readonly"
import {
  resolveGrowthInboxQueueViewFromUrl,
  shouldApplyGrowthInboxSavedDefaultFilter,
} from "@/lib/growth/settings/growth-workspace-settings-consumption"
import {
  GROWTH_INBOX_QUEUE_VIEWS,
  type GrowthInboxQueueView,
} from "@/lib/growth/inbox/inbox-thread-queue-filters"

function isGrowthInboxQueueView(value: string): value is GrowthInboxQueueView {
  return (GROWTH_INBOX_QUEUE_VIEWS as readonly string[]).includes(value)
}

/**
 * Sync queue filter from URL or saved default.
 * Explicit `?view=` always wins; `threadId`, `leadId`, and other params are untouched.
 */
export function GrowthInboxQueueUrlSync() {
  const searchParams = useSearchParams()
  const { queueView, setQueueView } = useGrowthInboxQueue()
  const { defaultViews, loaded } = useGrowthWorkspaceDefaultViewsReadonly()
  const savedDefaultAppliedRef = useRef(false)

  useEffect(() => {
    const viewParam = searchParams.get("view")

    if (viewParam) {
      if (isGrowthInboxQueueView(viewParam) && viewParam !== queueView) {
        setQueueView(viewParam)
      }
      return
    }

    if (!shouldApplyGrowthInboxSavedDefaultFilter(viewParam) || !loaded || savedDefaultAppliedRef.current) {
      return
    }

    const resolved = resolveGrowthInboxQueueViewFromUrl({
      viewParam,
      savedDefaultFilter: defaultViews.inboxDefaultFilter,
    })

    if (resolved !== queueView) {
      setQueueView(resolved)
    }
    savedDefaultAppliedRef.current = true
  }, [defaultViews.inboxDefaultFilter, loaded, queueView, searchParams, setQueueView])

  return null
}
