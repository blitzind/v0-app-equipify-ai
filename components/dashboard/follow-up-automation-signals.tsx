"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"

type Stats = {
  pendingTotal: number
  overdueReminders: number
  invoiceRemindersPending: number
  proposalFollowUpsPending: number
}

export function FollowUpAutomationSignals({
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
          `/api/organizations/${encodeURIComponent(organizationId)}/follow-up-tasks/stats`,
          { cache: "no-store" },
        )
        const body = (await res.json()) as Stats & { error?: string }
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

  if (loading || !stats || stats.pendingTotal === 0) return null

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Follow-up queue</p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{stats.pendingTotal}</span> pending review
            {stats.overdueReminders > 0 ? (
              <>
                {" "}
                · <span className="text-amber-700 dark:text-amber-300">{stats.overdueReminders}</span> overdue reminders
              </>
            ) : null}
          </p>
        </div>
      </div>
      <Link
        href="/communications/follow-ups"
        className="text-sm font-medium text-primary hover:underline shrink-0"
      >
        Open queue
      </Link>
    </div>
  )
}
