"use client"

import { useCallback, useEffect, useState } from "react"
import type { AidenDailyBriefing } from "@/lib/growth/aiden/aiden-daily-briefing"

export function useAidenBriefing(enabled = true) {
  const [briefing, setBriefing] = useState<AidenDailyBriefing | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/aiden/briefing", { cache: "no-store" })
      const data = (await res.json()) as { ok?: boolean; briefing?: AidenDailyBriefing; message?: string }
      if (!res.ok || !data.ok || !data.briefing) {
        throw new Error(data.message ?? "Could not load briefing.")
      }
      setBriefing(data.briefing)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { briefing, loading, error, reload }
}
