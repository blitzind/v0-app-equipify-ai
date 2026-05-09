"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

type Stats = {
  new_count: number
  urgent_open_count: number
  needs_info_count: number
}

export function ServiceRequestSignals({
  organizationId,
  className,
}: {
  organizationId: string
  className?: string
}) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/service-requests/stats`,
          { cache: "no-store" },
        )
        const body = (await res.json().catch(() => ({}))) as Stats & { error?: string }
        if (!cancelled && res.ok) setStats(body)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId])

  if (loading || !stats) return null
  const total = stats.new_count + stats.needs_info_count + stats.urgent_open_count
  if (total === 0) return null

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
          <Inbox className="h-4 w-4 text-sky-700 dark:text-sky-300" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Service requests</p>
          <p className="text-xs text-muted-foreground">
            {stats.new_count > 0 ?
              <>
                <span className="font-medium text-foreground">{stats.new_count}</span> new
              </>
            : null}
            {stats.urgent_open_count > 0 ?
              <>
                {stats.new_count > 0 ? " · " : null}
                <span className="text-rose-700 dark:text-rose-300 font-medium">{stats.urgent_open_count}</span>{" "}
                urgent in queue
              </>
            : null}
            {stats.needs_info_count > 0 ?
              <>
                {(stats.new_count > 0 || stats.urgent_open_count > 0) ? " · " : null}
                <span className="text-amber-800 dark:text-amber-200 font-medium">{stats.needs_info_count}</span>{" "}
                awaiting info
              </>
            : null}
          </p>
        </div>
      </div>
      <Link
        href="/communications/service-requests"
        className="text-xs font-medium text-primary hover:underline shrink-0"
      >
        Open queue
      </Link>
    </div>
  )
}
