"use client"

import { useEffect, useRef } from "react"
import {
  subscribeToGrowthRealtimeEvents,
  type GrowthRealtimeSubscriptionMode,
} from "@/lib/growth/realtime-events/realtime-events-subscriber"
import type {
  GrowthRealtimeEvent,
  GrowthRealtimeEventSubscriber,
} from "@/lib/growth/realtime-events/realtime-events-types"

/**
 * Wire UI refresh callbacks to growth realtime event routes — no execution side effects.
 */
export function useGrowthRealtimeRefresh(input: {
  subscriber: GrowthRealtimeEventSubscriber
  onRefresh: () => void
  enabled?: boolean
}): { mode: GrowthRealtimeSubscriptionMode } {
  const modeRef = useRef<GrowthRealtimeSubscriptionMode>("polling")
  const onRefreshRef = useRef(input.onRefresh)
  onRefreshRef.current = input.onRefresh

  useEffect(() => {
    if (input.enabled === false) return

    const handle = subscribeToGrowthRealtimeEvents({
      limit: 15,
      pollingIntervalMs: 45_000,
      onEvents: (events: GrowthRealtimeEvent[], mode) => {
        modeRef.current = mode
        const shouldRefresh = events.some((event) =>
          event.routes.some((route) => route.subscriber === input.subscriber),
        )
        if (shouldRefresh) onRefreshRef.current()
      },
    })

    return () => handle.unsubscribe()
  }, [input.enabled, input.subscriber])

  return { mode: modeRef.current }
}
