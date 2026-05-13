"use client"

import { useCallback, useEffect, useState } from "react"
import type { FirstRunGetResponse } from "@/lib/first-run/api-types"

export type UseFirstRunReturn = {
  data: FirstRunGetResponse | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  patch: (
    action: "ack_welcome" | "hide_launchpad" | "show_launchpad",
  ) => Promise<{ ok: false; error: string } | { ok: true }>
}

export function useFirstRun(organizationId: string | null, enabled: boolean): UseFirstRunReturn {
  const [data, setData] = useState<FirstRunGetResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !enabled) {
      setData(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/first-run`, {
        cache: "no-store",
      })
      const json = (await res.json()) as FirstRunGetResponse & { message?: string }
      if (!res.ok) {
        setData(null)
        setError(json.message ?? res.statusText)
        return
      }
      setData(json)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : "Could not load first-run state.")
    } finally {
      setLoading(false)
    }
  }, [organizationId, enabled])

  useEffect(() => {
    void load()
  }, [load])

  const patch = useCallback(
    async (action: "ack_welcome" | "hide_launchpad" | "show_launchpad") => {
      if (!organizationId) return { ok: false as const, error: "no_org" }
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/first-run`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok) {
        return { ok: false as const, error: json.message ?? res.statusText }
      }
      await load()
      return { ok: true as const }
    },
    [organizationId, load],
  )

  return { data, loading, error, reload: load, patch }
}
