"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Radio } from "lucide-react"
import { InstallVerificationCard } from "@/components/growth/intent-pixel-monitor/install-verification-card"
import { LiveVisitorsPanel } from "@/components/growth/intent-pixel-monitor/live-visitors-panel"
import { VisitorTimelinePanel } from "@/components/growth/intent-pixel-monitor/visitor-timeline-panel"
import { HighIntentQueuePanel } from "@/components/growth/intent-pixel-monitor/high-intent-queue-panel"
import {
  GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER,
  type GrowthLiveVisitorMonitorSnapshot,
} from "@/lib/growth/intent-pixel/live-visitor-monitor-types"

export function GrowthLiveVisitorMonitor({
  siteKey,
  schemaReady,
}: {
  siteKey: string
  schemaReady: boolean
}) {
  const [snapshot, setSnapshot] = useState<GrowthLiveVisitorMonitorSnapshot | null>(null)
  const [loading, setLoading] = useState(false)

  const loadMonitor = useCallback(async () => {
    if (!schemaReady) {
      setSnapshot(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/platform/growth/intent-pixel/monitor?site_key=${encodeURIComponent(siteKey)}`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        snapshot?: GrowthLiveVisitorMonitorSnapshot
      }
      if (res.ok && data.ok && data.snapshot) setSnapshot(data.snapshot)
    } finally {
      setLoading(false)
    }
  }, [siteKey, schemaReady])

  useEffect(() => {
    void loadMonitor()
  }, [loadMonitor])

  useEffect(() => {
    if (!schemaReady) return
    const timer = window.setInterval(() => void loadMonitor(), 20_000)
    return () => window.clearInterval(timer)
  }, [schemaReady, loadMonitor])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs text-muted-foreground">{GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER}</p>
        {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Refreshing" /> : null}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
        <Radio className="size-4 shrink-0" />
        <span>Live visitor monitor — refreshes every 20s when schema is ready.</span>
      </div>

      <InstallVerificationCard verification={snapshot?.install_verification ?? null} />
      <LiveVisitorsPanel visitors={snapshot?.live_visitors ?? []} />
      <VisitorTimelinePanel timeline={snapshot?.visitor_timeline ?? []} />
      <HighIntentQueuePanel
        queue={snapshot?.high_intent_queue ?? []}
        siteKey={siteKey}
        onProcessed={() => void loadMonitor()}
      />
    </div>
  )
}
