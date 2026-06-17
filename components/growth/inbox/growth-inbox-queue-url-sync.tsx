"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useGrowthInboxQueue } from "@/components/growth/inbox/growth-inbox-queue-context"
import {
  GROWTH_INBOX_QUEUE_VIEWS,
  type GrowthInboxQueueView,
} from "@/lib/growth/inbox/inbox-thread-queue-filters"

function isGrowthInboxQueueView(value: string): value is GrowthInboxQueueView {
  return (GROWTH_INBOX_QUEUE_VIEWS as readonly string[]).includes(value)
}

/** Sync `?view=` query param to the thread queue filter without changing filter semantics. */
export function GrowthInboxQueueUrlSync() {
  const searchParams = useSearchParams()
  const { queueView, setQueueView } = useGrowthInboxQueue()

  useEffect(() => {
    const viewParam = searchParams.get("view")
    if (!viewParam || !isGrowthInboxQueueView(viewParam) || viewParam === queueView) return
    setQueueView(viewParam)
  }, [queueView, searchParams, setQueueView])

  return null
}
