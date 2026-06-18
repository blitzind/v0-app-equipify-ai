"use client"

import { useCallback, useEffect, useState } from "react"
import type { NativeCallWorkspaceSessionPublicView, NativeDialerQueueItemPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  adaptNativeCallSession,
  adaptNativeDialerQueueItem,
  countCallCommunicationsByQueueView,
  mergeGrowthInboxCallCommunicationItems,
  type GrowthInboxCallCommunicationItem,
} from "@/lib/growth/inbox/inbox-call-communication-read-model"
import { fetchPlatformGrowthClient } from "@/lib/growth/platform-growth-client-fetch"
import { scheduleGrowthInboxIdleTask } from "@/lib/growth/inbox/inbox-load-scheduler"

/** Phase 8F — callbacks metric only; no duplicate operator-inbox fan-out. */
export function useGrowthInboxCallCommunications(options?: { deferLoad?: boolean }) {
  const deferLoad = options?.deferLoad ?? false
  const [items, setItems] = useState<GrowthInboxCallCommunicationItem[]>([])
  const [loading, setLoading] = useState(!deferLoad)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [queueRes, dashboardRes] = await Promise.all([
        fetchPlatformGrowthClient("/api/platform/growth/calls/queue", { cache: "no-store" }),
        fetchPlatformGrowthClient("/api/platform/growth/calls/dashboard", { cache: "no-store" }),
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

      const derived: GrowthInboxCallCommunicationItem[] = []
      for (const item of queuePayload.queue ?? []) derived.push(adaptNativeDialerQueueItem(item))
      for (const item of dashboardPayload.workspaceDashboard?.queuePreview ?? []) {
        derived.push(adaptNativeDialerQueueItem(item))
      }
      for (const session of dashboardPayload.workspaceDashboard?.recentSessions ?? []) {
        const adapted = adaptNativeCallSession(session)
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
    if (deferLoad) {
      const cancelIdle = scheduleGrowthInboxIdleTask(() => {
        void load()
      })
      return cancelIdle
    }
    void load()
  }, [deferLoad, load])

  return {
    items,
    counts: countCallCommunicationsByQueueView(items),
    loading,
    error,
    reload: load,
  }
}
