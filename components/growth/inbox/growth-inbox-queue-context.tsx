"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import {
  type GrowthInboxQueueView,
  GROWTH_INBOX_QUEUE_VIEWS,
  countInboxThreadsByQueueView,
  filterInboxThreadsByQueueView,
  filterInboxThreadsBySearch,
  sortInboxQueueThreads,
} from "@/lib/growth/inbox/inbox-thread-queue-filters"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"

type GrowthInboxQueueContextValue = {
  queueView: GrowthInboxQueueView
  setQueueView: (view: GrowthInboxQueueView) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  visibleThreads: GrowthInboxThread[]
  queueCounts: Record<GrowthInboxQueueView, number>
  selectThreadByIndex: (index: number) => void
  selectAdjacentThread: (direction: "next" | "prev") => void
  focusSearch: () => void
  searchInputRef: React.RefObject<HTMLInputElement | null>
}

const GrowthInboxQueueContext = createContext<GrowthInboxQueueContextValue | null>(null)

export function useGrowthInboxQueue(): GrowthInboxQueueContextValue {
  const value = useContext(GrowthInboxQueueContext)
  if (!value) {
    throw new Error("useGrowthInboxQueue must be used within GrowthInboxQueueProvider")
  }
  return value
}

export function GrowthInboxQueueProvider({ children }: { children: ReactNode }) {
  const { threads, selectedThread, setSelectedThreadId, loadThreadDetail } = useGrowthInboxWorkspace()
  const [queueView, setQueueView] = useState<GrowthInboxQueueView>("needs_action")
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const visibleThreads = useMemo(() => {
    const byView = filterInboxThreadsByQueueView(threads, queueView)
    const bySearch = filterInboxThreadsBySearch(byView, searchQuery)
    return sortInboxQueueThreads(bySearch)
  }, [threads, queueView, searchQuery])

  const queueCounts = useMemo(() => countInboxThreadsByQueueView(threads), [threads])

  const selectThreadByIndex = useCallback(
    (index: number) => {
      const thread = visibleThreads[index]
      if (!thread) return
      setSelectedThreadId(thread.id)
      void loadThreadDetail(thread.id)
    },
    [visibleThreads, setSelectedThreadId, loadThreadDetail],
  )

  const selectAdjacentThread = useCallback(
    (direction: "next" | "prev") => {
      if (visibleThreads.length === 0) return
      const currentIndex = visibleThreads.findIndex((thread) => thread.id === selectedThread?.id)
      const startIndex = currentIndex >= 0 ? currentIndex : 0
      const nextIndex =
        direction === "next"
          ? Math.min(startIndex + 1, visibleThreads.length - 1)
          : Math.max(startIndex - 1, 0)
      selectThreadByIndex(nextIndex)
    },
    [visibleThreads, selectedThread?.id, selectThreadByIndex],
  )

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus()
  }, [searchInputRef])

  const value = useMemo(
    () => ({
      queueView,
      setQueueView,
      searchQuery,
      setSearchQuery,
      visibleThreads,
      queueCounts,
      selectThreadByIndex,
      selectAdjacentThread,
      focusSearch,
      searchInputRef,
    }),
    [
      queueView,
      searchQuery,
      visibleThreads,
      queueCounts,
      selectThreadByIndex,
      selectAdjacentThread,
      focusSearch,
      searchInputRef,
    ],
  )

  return <GrowthInboxQueueContext.Provider value={value}>{children}</GrowthInboxQueueContext.Provider>
}

export { GROWTH_INBOX_QUEUE_VIEWS }
