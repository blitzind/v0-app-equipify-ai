"use client"

import { useCallback, useEffect, useState } from "react"
import type { NativeCallWorkspaceSessionPublicView, NativeDialerQueueItemPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import type { OperatorInboxItem, OperatorInboxQueueResponse } from "@/lib/growth/operator-inbox/operator-inbox-types"
import {
  adaptNativeCallSession,
  adaptNativeDialerQueueItem,
  adaptOperatorInboxCallItem,
  countCallCommunicationsByQueueView,
  mergeGrowthInboxCallCommunicationItems,
  type GrowthInboxCallCommunicationItem,
} from "@/lib/growth/inbox/inbox-call-communication-read-model"

export function useGrowthInboxCallCommunications() {
  const [items, setItems] = useState<GrowthInboxCallCommunicationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [queueRes, dashboardRes, operatorRes] = await Promise.all([
        fetch("/api/platform/growth/calls/queue", { cache: "no-store" }),
        fetch("/api/platform/growth/calls/dashboard", { cache: "no-store" }),
        fetch("/api/platform/growth/operator-inbox?filter=all&limit=40", { cache: "no-store" }),
      ])

      const queuePayload = (await queueRes.json().catch(() => ({}))) as {
        queue?: NativeDialerQueueItemPublicView[]
      }
      const dashboardPayload = (await dashboardRes.json().catch(() => ({}))) as {
        workspaceDashboard?: {
          recentSessions?: NativeCallWorkspaceSessionPublicView[]
          queuePreview?: NativeDialerQueueItemPublicView[]
        }
      }
      const operatorPayload = (await operatorRes.json().catch(() => ({}))) as OperatorInboxQueueResponse

      const derived: GrowthInboxCallCommunicationItem[] = []
      for (const item of queuePayload.queue ?? []) derived.push(adaptNativeDialerQueueItem(item))
      for (const item of dashboardPayload.workspaceDashboard?.queuePreview ?? []) {
        derived.push(adaptNativeDialerQueueItem(item))
      }
      for (const session of dashboardPayload.workspaceDashboard?.recentSessions ?? []) {
        const adapted = adaptNativeCallSession(session)
        if (adapted) derived.push(adapted)
      }
      for (const item of operatorPayload.items ?? []) {
        const adapted = adaptOperatorInboxCallItem(item as OperatorInboxItem)
        if (adapted) derived.push(adapted)
      }

      setItems(mergeGrowthInboxCallCommunicationItems(derived))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Call communications unavailable.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return {
    items,
    counts: countCallCommunicationsByQueueView(items),
    loading,
    error,
    reload: load,
  }
}
