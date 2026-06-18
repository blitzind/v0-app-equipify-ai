"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import { useGrowthInboxTier1Refresh } from "@/lib/growth/inbox/use-growth-inbox-tier1-refresh"
import { recordGrowthInboxPollCycle } from "@/lib/growth/inbox/growth-inbox-query-metrics"

export const GROWTH_INBOX_TIER1_POLL_COORDINATOR_QA_MARKER = "growth-inbox-tier1-poll-coordinator-v1" as const

type GrowthInboxTier1PollContextValue = {
  registerRefresh: (listener: () => void) => () => void
}

const GrowthInboxTier1PollContext = createContext<GrowthInboxTier1PollContextValue | null>(null)

export function useGrowthInboxTier1PollCoordinator(): GrowthInboxTier1PollContextValue {
  const value = useContext(GrowthInboxTier1PollContext)
  if (!value) {
    throw new Error("useGrowthInboxTier1PollCoordinator must be used within GrowthInboxTier1PollCoordinatorProvider")
  }
  return value
}

/** Single 90s Tier 1 poll timer — registers multiple refresh listeners. */
export function GrowthInboxTier1PollCoordinatorProvider({ children }: { children: ReactNode }) {
  const listenersRef = useRef(new Set<() => void>())

  const registerRefresh = useCallback((listener: () => void) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  useGrowthInboxTier1Refresh({
    onRefresh: () => {
      recordGrowthInboxPollCycle()
      for (const listener of listenersRef.current) {
        listener()
      }
    },
  })

  const value = useMemo(() => ({ registerRefresh }), [registerRefresh])

  return (
    <GrowthInboxTier1PollContext.Provider value={value}>
      <span className="hidden" data-qa-marker={GROWTH_INBOX_TIER1_POLL_COORDINATOR_QA_MARKER} />
      {children}
    </GrowthInboxTier1PollContext.Provider>
  )
}

/** Subscribe a refresh callback to the shared Tier 1 poll coordinator when present; otherwise use a direct timer. */
export function useGrowthInboxTier1PollRefresh(onRefresh: () => void, enabled = true): void {
  const coordinator = useContext(GrowthInboxTier1PollContext)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useGrowthInboxTier1Refresh({
    onRefresh: () => {
      onRefreshRef.current()
    },
    enabled: enabled && !coordinator,
  })

  useEffect(() => {
    if (!enabled || !coordinator) return
    return coordinator.registerRefresh(() => {
      onRefreshRef.current()
    })
  }, [coordinator, enabled])
}
