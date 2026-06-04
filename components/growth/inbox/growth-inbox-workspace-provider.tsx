"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type {
  GrowthInboxDashboard,
  GrowthInboxThread,
  GrowthReplyIntelligenceEvent,
  GrowthReplyIntelligenceSummary,
} from "@/lib/growth/inbox/inbox-types"
import {
  resolveGrowthInboxSetupPhase,
  shouldShowGrowthInboxHonestEmptyState,
} from "@/lib/growth/inbox/inbox-runtime-types"
import type { GrowthInboxSyncDashboard, GrowthInboxThreadSyncDetail } from "@/lib/growth/inbox-sync/inbox-sync-types"
import { sanitizeInboxUiErrorMessage } from "@/components/growth/inbox/growth-inbox-shared-ui"

type ListPayload = {
  ok?: boolean
  threads?: GrowthInboxThread[]
  leads?: Array<{ id: string; label: string }>
  message?: string
}

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthInboxDashboard
  threads?: GrowthInboxThread[]
  intelligence?: GrowthReplyIntelligenceSummary
  events?: GrowthReplyIntelligenceEvent[]
  message?: string
}

type SyncDashboardPayload = {
  ok?: boolean
  dashboard?: GrowthInboxSyncDashboard
  message?: string
}

type MailboxesPayload = {
  ok?: boolean
  mailboxes?: Array<{ id: string }>
  message?: string
}

type ThreadDetailPayload = {
  thread?: GrowthInboxThread
  syncDetail?: GrowthInboxThreadSyncDetail | null
  message?: string
}

export type GrowthInboxActionRefreshMode = "full" | "threads" | "thread" | "none"

export type GrowthInboxWorkspaceState = {
  loading: boolean
  error: string | null
  actionLoading: string | null
  dashboard: GrowthInboxDashboard | null
  threads: GrowthInboxThread[]
  events: GrowthReplyIntelligenceEvent[]
  intelligence: GrowthReplyIntelligenceSummary | null
  syncDashboard: GrowthInboxSyncDashboard | null
  syncSchemaReady: boolean
  mailboxConnectionCount: number | null
  syncDetail: GrowthInboxThreadSyncDetail | null
  leads: Array<{ id: string; label: string }>
  selectedThreadId: string
  selectedThread: GrowthInboxThread | null
  selectedMessages: GrowthInboxThread["messages"]
  setupPhase: ReturnType<typeof resolveGrowthInboxSetupPhase>
  showHonestEmptyState: boolean
  newLeadId: string
  newSubject: string
  messageBody: string
  messageDirection: "inbound" | "outbound"
  setSelectedThreadId: (threadId: string) => void
  setNewLeadId: (value: string) => void
  setNewSubject: (value: string) => void
  setMessageBody: (value: string) => void
  setMessageDirection: (value: "inbound" | "outbound") => void
  load: () => Promise<void>
  refreshThreads: () => Promise<void>
  loadThreadDetail: (threadId: string) => Promise<void>
  runAction: (key: string, action: () => Promise<void>, refreshMode?: GrowthInboxActionRefreshMode) => Promise<void>
  createThread: () => Promise<void>
  addMessage: () => Promise<void>
  assignOwner: () => Promise<void>
  resolveThread: () => Promise<void>
  archiveThread: () => Promise<void>
}

const GrowthInboxWorkspaceContext = createContext<GrowthInboxWorkspaceState | null>(null)

export function GrowthInboxWorkspaceProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthInboxDashboard | null>(null)
  const [threads, setThreads] = useState<GrowthInboxThread[]>([])
  const [events, setEvents] = useState<GrowthReplyIntelligenceEvent[]>([])
  const [intelligence, setIntelligence] = useState<GrowthReplyIntelligenceSummary | null>(null)
  const [syncDashboard, setSyncDashboard] = useState<GrowthInboxSyncDashboard | null>(null)
  const [syncSchemaReady, setSyncSchemaReady] = useState(true)
  const [mailboxConnectionCount, setMailboxConnectionCount] = useState<number | null>(null)
  const [syncDetail, setSyncDetail] = useState<GrowthInboxThreadSyncDetail | null>(null)
  const [leads, setLeads] = useState<Array<{ id: string; label: string }>>([])
  const [selectedThreadId, setSelectedThreadId] = useState("")
  const [newLeadId, setNewLeadId] = useState("")
  const [newSubject, setNewSubject] = useState("")
  const [messageBody, setMessageBody] = useState("")
  const [messageDirection, setMessageDirection] = useState<"inbound" | "outbound">("inbound")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null,
    [threads, selectedThreadId],
  )

  const selectedMessages = useMemo(() => selectedThread?.messages ?? [], [selectedThread])

  const setupPhase = useMemo(
    () =>
      resolveGrowthInboxSetupPhase({
        threadCount: threads.length,
        syncRunCount: syncDashboard?.runs?.length ?? 0,
        mailboxConnectionCount,
        syncSchemaReady,
      }),
    [mailboxConnectionCount, syncDashboard?.runs?.length, syncSchemaReady, threads.length],
  )

  const showHonestEmptyState = useMemo(
    () =>
      shouldShowGrowthInboxHonestEmptyState({
        threadCount: threads.length,
        syncRunCount: syncDashboard?.runs?.length ?? 0,
        mailboxConnectionCount,
        syncSchemaReady,
      }),
    [mailboxConnectionCount, syncDashboard?.runs?.length, syncSchemaReady, threads.length],
  )

  const loadThreadDetail = useCallback(async (threadId: string) => {
    const response = await fetch(`/api/platform/growth/inbox/thread/${threadId}`)
    const payload = (await response.json()) as ThreadDetailPayload
    if (!response.ok) throw new Error(payload.message ?? "Could not load thread detail.")
    if (payload.thread) {
      setThreads((current) => current.map((thread) => (thread.id === threadId ? payload.thread! : thread)))
    }
    setSyncDetail(payload.syncDetail ?? null)
  }, [])

  const refreshThreads = useCallback(async () => {
    const [listResponse, dashboardResponse] = await Promise.all([
      fetch("/api/platform/growth/inbox"),
      fetch("/api/platform/growth/inbox/dashboard"),
    ])
    const listPayload = (await listResponse.json()) as ListPayload
    const dashboardPayload = (await dashboardResponse.json()) as DashboardPayload
    if (!listResponse.ok) {
      throw new Error(sanitizeInboxUiErrorMessage(listPayload.message) ?? "Could not load inbox threads.")
    }
    if (!dashboardResponse.ok) {
      throw new Error(sanitizeInboxUiErrorMessage(dashboardPayload.message) ?? "Could not load inbox dashboard.")
    }

    const mergedThreads = dashboardPayload.threads ?? listPayload.threads ?? []
    setThreads(mergedThreads)
    setLeads(listPayload.leads ?? [])
    setDashboard(dashboardPayload.dashboard ?? null)
    setIntelligence(dashboardPayload.intelligence ?? null)
    setEvents(dashboardPayload.events ?? [])
  }, [])

  const refreshAfterThreadMutation = useCallback(
    async (threadId: string) => {
      await Promise.all([refreshThreads(), loadThreadDetail(threadId)])
    },
    [refreshThreads, loadThreadDetail],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [listResponse, dashboardResponse, syncResponse, mailboxesResponse] = await Promise.all([
        fetch("/api/platform/growth/inbox"),
        fetch("/api/platform/growth/inbox/dashboard"),
        fetch("/api/platform/growth/inbox/sync/dashboard"),
        fetch("/api/platform/growth/mailboxes"),
      ])
      const listPayload = (await listResponse.json()) as ListPayload
      const dashboardPayload = (await dashboardResponse.json()) as DashboardPayload
      const syncPayload = (await syncResponse.json()) as SyncDashboardPayload
      const mailboxesPayload = (await mailboxesResponse.json()) as MailboxesPayload
      if (!listResponse.ok) {
        throw new Error(sanitizeInboxUiErrorMessage(listPayload.message) ?? "Could not load inbox threads.")
      }
      if (!dashboardResponse.ok) {
        throw new Error(sanitizeInboxUiErrorMessage(dashboardPayload.message) ?? "Could not load inbox dashboard.")
      }

      const mergedThreads = dashboardPayload.threads ?? listPayload.threads ?? []
      setThreads(mergedThreads)
      setLeads(listPayload.leads ?? [])
      setDashboard(dashboardPayload.dashboard ?? null)
      setIntelligence(dashboardPayload.intelligence ?? null)
      setEvents(dashboardPayload.events ?? [])
      setSyncSchemaReady(syncResponse.ok)
      if (syncResponse.ok && syncPayload.dashboard) setSyncDashboard(syncPayload.dashboard)
      else setSyncDashboard(null)
      if (mailboxesResponse.ok) setMailboxConnectionCount(mailboxesPayload.mailboxes?.length ?? 0)
      else setMailboxConnectionCount(null)

      const nextSelected = selectedThreadId || mergedThreads[0]?.id || ""
      if (nextSelected && !selectedThreadId) setSelectedThreadId(nextSelected)
      if (nextSelected) await loadThreadDetail(nextSelected)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? sanitizeInboxUiErrorMessage(loadError.message) ?? "Could not load unified inbox."
          : "Could not load unified inbox.",
      )
    } finally {
      setLoading(false)
    }
  }, [loadThreadDetail, selectedThreadId])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(
    key: string,
    action: () => Promise<void>,
    refreshMode: GrowthInboxActionRefreshMode = "thread",
  ) {
    setActionLoading(key)
    setError(null)
    const threadIdBeforeAction = selectedThreadId
    try {
      await action()
      switch (refreshMode) {
        case "full":
          await load()
          break
        case "threads":
          await refreshThreads()
          if (threadIdBeforeAction) await loadThreadDetail(threadIdBeforeAction)
          break
        case "thread":
          if (threadIdBeforeAction) await refreshAfterThreadMutation(threadIdBeforeAction)
          else await refreshThreads()
          break
        case "none":
          break
        default:
          break
      }
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? sanitizeInboxUiErrorMessage(actionError.message) ?? "Inbox action failed."
          : "Inbox action failed.",
      )
    } finally {
      setActionLoading(null)
    }
  }

  async function createThread() {
    const response = await fetch("/api/platform/growth/inbox/thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: newLeadId,
        subject: newSubject.trim() || "New thread",
      }),
    })
    const payload = (await response.json()) as { message?: string; thread?: GrowthInboxThread }
    if (!response.ok) throw new Error(payload.message ?? "Could not create inbox thread.")
    if (payload.thread) {
      setSelectedThreadId(payload.thread.id)
      await refreshThreads()
      await loadThreadDetail(payload.thread.id)
    }
    setNewSubject("")
  }

  async function addMessage() {
    if (!selectedThread) throw new Error("Select a thread first.")
    const response = await fetch("/api/platform/growth/inbox/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: selectedThread.id,
        direction: messageDirection,
        subject: selectedThread.subject,
        bodyPreview: messageBody.trim(),
      }),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not add message.")
    setMessageBody("")
    await loadThreadDetail(selectedThread.id)
  }

  async function assignOwner() {
    if (!selectedThread) throw new Error("Select a thread first.")
    const response = await fetch(`/api/platform/growth/inbox/thread/${selectedThread.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not assign owner.")
  }

  async function resolveThread() {
    if (!selectedThread) throw new Error("Select a thread first.")
    const response = await fetch(`/api/platform/growth/inbox/thread/${selectedThread.id}/resolve`, {
      method: "POST",
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not resolve thread.")
  }

  async function archiveThread() {
    if (!selectedThread) throw new Error("Select a thread first.")
    const response = await fetch(`/api/platform/growth/inbox/thread/${selectedThread.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive: true }),
    })
    const payload = (await response.json()) as { message?: string }
    if (!response.ok) throw new Error(payload.message ?? "Could not archive thread.")
  }

  const value: GrowthInboxWorkspaceState = {
    loading,
    error,
    actionLoading,
    dashboard,
    threads,
    events,
    intelligence,
    syncDashboard,
    syncSchemaReady,
    mailboxConnectionCount,
    syncDetail,
    leads,
    selectedThreadId,
    selectedThread,
    selectedMessages,
    setupPhase,
    showHonestEmptyState,
    newLeadId,
    newSubject,
    messageBody,
    messageDirection,
    setSelectedThreadId,
    setNewLeadId,
    setNewSubject,
    setMessageBody,
    setMessageDirection,
    load,
    refreshThreads,
    loadThreadDetail,
    runAction,
    createThread,
    addMessage,
    assignOwner,
    resolveThread,
    archiveThread,
  }

  return <GrowthInboxWorkspaceContext.Provider value={value}>{children}</GrowthInboxWorkspaceContext.Provider>
}

export function useGrowthInboxWorkspace(): GrowthInboxWorkspaceState {
  const context = useContext(GrowthInboxWorkspaceContext)
  if (!context) throw new Error("useGrowthInboxWorkspace must be used within GrowthInboxWorkspaceProvider")
  return context
}
