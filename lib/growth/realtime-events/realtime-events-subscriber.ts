/** Phase GS-4C — Client-side realtime subscription with polling fallback (client-safe). */

import type { RealtimeChannel } from "@supabase/supabase-js"
import type { GrowthRealtimeEvent } from "@/lib/growth/realtime-events/realtime-events-types"

export type GrowthRealtimeSubscriptionMode = "realtime" | "polling" | "unavailable"

export type GrowthRealtimeSubscriptionHandle = {
  mode: GrowthRealtimeSubscriptionMode
  unsubscribe: () => void
}

async function fetchRecentEvents(limit: number): Promise<GrowthRealtimeEvent[]> {
  const res = await fetch(`/api/platform/growth/realtime-events?limit=${limit}`)
  if (!res.ok) return []
  const data = (await res.json()) as { events?: GrowthRealtimeEvent[] }
  return data.events ?? []
}

/**
 * Subscribe to growth realtime events — Supabase postgres_changes when available, polling fallback otherwise.
 * Callback receives normalized events for UI refresh signals only (no execution).
 */
export function subscribeToGrowthRealtimeEvents(input: {
  organizationId?: string | null
  limit?: number
  pollingIntervalMs?: number
  onEvents: (events: GrowthRealtimeEvent[], mode: GrowthRealtimeSubscriptionMode) => void
  onError?: (error: string) => void
}): GrowthRealtimeSubscriptionHandle {
  const limit = input.limit ?? 25
  const pollingIntervalMs = input.pollingIntervalMs ?? 30_000
  let disposed = false
  let channel: RealtimeChannel | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let mode: GrowthRealtimeSubscriptionMode = "polling"

  async function pollOnce(): Promise<void> {
    if (disposed) return
    try {
      const events = await fetchRecentEvents(limit)
      input.onEvents(events, mode)
    } catch (e) {
      input.onError?.(e instanceof Error ? e.message : String(e))
    }
  }

  function startPolling(): void {
    mode = "polling"
    void pollOnce()
    pollTimer = setInterval(() => void pollOnce(), pollingIntervalMs)
  }

  async function tryRealtime(): Promise<void> {
    try {
      const { createBrowserSupabaseClient } = await import("@/lib/supabase/client")
      const supabase = createBrowserSupabaseClient()
      if (!supabase || disposed) {
        startPolling()
        return
      }

      channel = supabase
        .channel(`growth-realtime-events-${input.organizationId ?? "global"}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "growth",
            table: "signal_events",
            ...(input.organizationId ? { filter: `organization_id=eq.${input.organizationId}` } : {}),
          },
          () => {
            void pollOnce()
          },
        )
        .subscribe((status) => {
          if (disposed) return
          if (status === "SUBSCRIBED") {
            mode = "realtime"
            void pollOnce()
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            mode = "polling"
            if (!pollTimer) startPolling()
          }
        })

      setTimeout(() => {
        if (!disposed && mode !== "realtime" && !pollTimer) startPolling()
      }, 4000)
    } catch {
      if (!disposed) startPolling()
    }
  }

  void tryRealtime()

  return {
    mode,
    unsubscribe: () => {
      disposed = true
      if (pollTimer) clearInterval(pollTimer)
      if (channel) void channel.unsubscribe()
    },
  }
}
