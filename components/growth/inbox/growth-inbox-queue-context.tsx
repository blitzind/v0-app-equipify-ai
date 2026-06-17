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
import { useGrowthInboxCallCommunications } from "@/components/growth/inbox/use-growth-inbox-call-communications"
import type { GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import {
  filterCallCommunicationsByQueueView,
  type GrowthInboxCallCommunicationItem,
  isGrowthInboxCallQueueView,
} from "@/lib/growth/inbox/inbox-call-communication-read-model"
import {
  type GrowthInboxQueueView,
  GROWTH_INBOX_QUEUE_VIEWS,
  countInboxThreadsByQueueView,
  filterInboxThreadsByQueueView,
  filterInboxThreadsBySearch,
  sortInboxQueueThreads,
} from "@/lib/growth/inbox/inbox-thread-queue-filters"
import {
  type GrowthInboxChannelFilter,
  filterInboxThreadsByChannel,
} from "@/lib/growth/inbox/inbox-channel-types"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"

type GrowthInboxQueueContextValue = {
  queueView: GrowthInboxQueueView
  setQueueView: (view: GrowthInboxQueueView) => void
  channelFilter: GrowthInboxChannelFilter
  setChannelFilter: (channel: GrowthInboxChannelFilter) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  visibleThreads: GrowthInboxThread[]
  visibleCallItems: GrowthInboxCallCommunicationItem[]
  callCommunicationItems: GrowthInboxCallCommunicationItem[]
  callCommunicationsLoading: boolean
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
  const { threads, selectedThreadId, setSelectedThreadId, loadThreadDetail } = useGrowthInboxWorkspace()
  const { items: callItems, counts: callCounts, loading: callCommunicationsLoading } = useGrowthInboxCallCommunications()
  const [queueView, setQueueView] = useState<GrowthInboxQueueView>("needs_action")
  const [channelFilter, setChannelFilter] = useState<GrowthInboxChannelFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const visibleThreads = useMemo(() => {
    if (isGrowthInboxCallQueueView(queueView)) return []
    const byChannel = filterInboxThreadsByChannel(threads, channelFilter)
    const byView = filterInboxThreadsByQueueView(byChannel, queueView)
    const bySearch = filterInboxThreadsBySearch(byView, searchQuery)
    return sortInboxQueueThreads(bySearch)
  }, [threads, channelFilter, queueView, searchQuery])

  const visibleCallItems = useMemo(() => {
    if (!isGrowthInboxCallQueueView(queueView)) return []
    const filtered = filterCallCommunicationsByQueueView(callItems, queueView)
    const normalized = searchQuery.trim().toLowerCase()
    if (!normalized) return filtered
    return filtered.filter((item) =>
      [item.title, item.summary, item.companyName, item.kind].join(" ").toLowerCase().includes(normalized),
    )
  }, [callItems, queueView, searchQuery])

  const queueCounts = useMemo(
    () => ({
      ...countInboxThreadsByQueueView(threads),
      ...callCounts,
    }),
    [threads, callCounts],
  )

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
      const currentIndex = selectedThreadId
        ? visibleThreads.findIndex((thread) => thread.id === selectedThreadId)
        : -1

      let nextIndex: number
      if (currentIndex < 0) {
        nextIndex = direction === "next" ? 0 : visibleThreads.length - 1
      } else if (direction === "next") {
        nextIndex = Math.min(currentIndex + 1, visibleThreads.length - 1)
      } else {
        nextIndex = Math.max(currentIndex - 1, 0)
      }

      selectThreadByIndex(nextIndex)
    },
    [visibleThreads, selectedThreadId, selectThreadByIndex],
  )

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus()
  }, [searchInputRef])

  const value = useMemo(
    () => ({
      queueView,
      setQueueView,
      channelFilter,
      setChannelFilter,
      searchQuery,
      setSearchQuery,
      visibleThreads,
      visibleCallItems,
      callCommunicationItems: callItems,
      callCommunicationsLoading,
      queueCounts,
      selectThreadByIndex,
      selectAdjacentThread,
      focusSearch,
      searchInputRef,
    }),
    [
      queueView,
      channelFilter,
      searchQuery,
      visibleThreads,
      visibleCallItems,
      callItems,
      callCommunicationsLoading,
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
