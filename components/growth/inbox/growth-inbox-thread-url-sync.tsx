"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  buildGrowthInboxThreadHref,
  GROWTH_OPS_URL_STATE_7A1_QA_MARKER,
  resolveGrowthInboxThreadIdFromSearchParams,
} from "@/lib/growth/navigation/growth-workspace-url-state-7a1"

/**
 * Keeps inbox thread selection in the URL and restores it on refresh/deep link.
 */
export function GrowthInboxThreadUrlSync() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { threads, selectedThreadId, setSelectedThreadId, loadThreadDetail } = useGrowthInboxWorkspace()
  const syncingFromUrlRef = useRef(false)
  const lastPushedThreadIdRef = useRef<string | null>(null)

  useEffect(() => {
    const threadId = resolveGrowthInboxThreadIdFromSearchParams(searchParams)
    if (!threadId || threads.length === 0) return
    const match = threads.find((thread) => thread.id === threadId)
    if (!match) return
    if (selectedThreadId === threadId) return

    syncingFromUrlRef.current = true
    setSelectedThreadId(threadId)
    void loadThreadDetail(threadId).finally(() => {
      syncingFromUrlRef.current = false
    })
  }, [loadThreadDetail, searchParams, selectedThreadId, setSelectedThreadId, threads])

  useEffect(() => {
    if (syncingFromUrlRef.current) return
    if (!selectedThreadId) return
    if (lastPushedThreadIdRef.current === selectedThreadId) return
    if (resolveGrowthInboxThreadIdFromSearchParams(searchParams) === selectedThreadId) {
      lastPushedThreadIdRef.current = selectedThreadId
      return
    }

    const thread = threads.find((entry) => entry.id === selectedThreadId)
    const href = buildGrowthInboxThreadHref({
      threadId: selectedThreadId,
      leadId: thread?.lead_id ?? null,
      preserve: searchParams,
    })
    lastPushedThreadIdRef.current = selectedThreadId
    router.replace(href, { scroll: false })
  }, [router, searchParams, selectedThreadId, threads])

  return (
    <span className="sr-only" data-growth-ops-url-state={GROWTH_OPS_URL_STATE_7A1_QA_MARKER} aria-hidden />
  )
}
