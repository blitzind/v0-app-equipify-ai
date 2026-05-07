"use client"

/**
 * Leads + Follow-Up Phase 2 — main dashboard prospect widget.
 *
 * Compact card with one tile per follow-up bucket (overdue / today / this
 * week / no-followup) plus quick links to the prospects pipeline. The
 * widget is opt-in: rendered only when the active member has
 * `canManageProspects`. Read-only roles can already see the pipeline at
 * `/prospects`, so we don't inflate the dashboard for them.
 *
 * Data is fetched lightly via the existing prospects list endpoint with a
 * 200-row cap. Bucketing is done client-side against the user's local
 * timezone (matches the Prospects page).
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  ChevronRight,
  ListChecks,
  Sparkles,
  UserPlus2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { followUpBucketFor, formatProspectStatus } from "@/lib/prospects/format"
import type { ProspectListItem, ProspectStatus } from "@/lib/prospects/types"
import { Badge } from "@/components/ui/badge"

type Bucket = "overdue" | "today" | "this_week" | "none"

const BUCKET_META: Record<Bucket, { label: string; href: string; icon: typeof AlertCircle; tone: string }> = {
  overdue: {
    label: "Overdue",
    href: "/prospects?followup=overdue",
    icon: AlertCircle,
    tone: "text-rose-700 dark:text-rose-300 bg-rose-500/10",
  },
  today: {
    label: "Due today",
    href: "/prospects?followup=today",
    icon: Calendar,
    tone: "text-amber-700 dark:text-amber-300 bg-amber-500/10",
  },
  this_week: {
    label: "This week",
    href: "/prospects?followup=this_week",
    icon: CalendarClock,
    tone: "text-violet-700 dark:text-violet-300 bg-violet-500/10",
  },
  none: {
    label: "No follow-up",
    href: "/prospects?followup=none",
    icon: ListChecks,
    tone: "text-muted-foreground bg-muted/40",
  },
}

export function ProspectFollowUpWidget() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const canManage = Boolean(permissions?.canManageProspects)

  const [rows, setRows] = useState<ProspectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canManage || !organizationId || orgStatus !== "ready") {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId!)}/prospects?archived=active&limit=200`,
          { cache: "no-store" },
        )
        const j = (await res.json().catch(() => ({}))) as {
          prospects?: ProspectListItem[]
          message?: string
        }
        if (!res.ok) throw new Error(j.message ?? "Could not load prospects.")
        if (!cancelled) setRows(j.prospects ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load prospects.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [canManage, organizationId, orgStatus])

  const buckets = useMemo(() => {
    const m: Record<Bucket, number> = { overdue: 0, today: 0, this_week: 0, none: 0 }
    if (!canManage) return m
    for (const r of rows) {
      const b = followUpBucketFor(r.next_follow_up_at)
      if (b === "overdue") m.overdue += 1
      else if (b === "today") m.today += 1
      else if (b === "this_week") m.this_week += 1
      else if (b === "none") m.none += 1
    }
    return m
  }, [rows, canManage])

  const topPriority = useMemo(() => {
    if (!canManage) return []
    const open = rows.filter((r) => {
      const b = followUpBucketFor(r.next_follow_up_at)
      return b === "overdue" || b === "today"
    })
    open.sort((a, b) => {
      const ta = a.next_follow_up_at ? Date.parse(a.next_follow_up_at) : Number.POSITIVE_INFINITY
      const tb = b.next_follow_up_at ? Date.parse(b.next_follow_up_at) : Number.POSITIVE_INFINITY
      return ta - tb
    })
    return open.slice(0, 3)
  }, [rows, canManage])

  if (!canManage) return null

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Prospect follow-ups</h2>
          <Badge variant="outline" className="text-[10px] gap-1 inline-flex items-center">
            <Sparkles className="w-2.5 h-2.5" /> Growth
          </Badge>
        </div>
        <Link
          href="/prospects"
          className="text-xs font-medium text-primary hover:underline underline-offset-2 transition-colors inline-flex items-center gap-0.5"
        >
          Open pipeline
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {error ? (
        <p className="px-5 py-3 text-xs text-destructive">{error}</p>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
        {(Object.keys(BUCKET_META) as Bucket[]).map((b) => {
          const meta = BUCKET_META[b]
          const Icon = meta.icon
          return (
            <Link
              key={b}
              href={meta.href}
              className="bg-card hover:bg-muted/40 transition-colors px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", meta.tone.split(" ").slice(-1)[0])}>
                  <Icon className={cn("w-3.5 h-3.5", meta.tone.split(" ")[0])} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold leading-none">
                    {meta.label}
                  </p>
                  <p className="text-lg font-semibold tabular-nums leading-tight mt-0.5">
                    {loading ? "—" : buckets[b]}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </Link>
          )
        })}
      </div>

      {topPriority.length > 0 ? (
        <div className="px-5 py-4 border-t border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Top priority
          </p>
          <ul className="space-y-1.5">
            {topPriority.map((p) => (
              <li key={p.id}>
                <Link
                  href="/prospects"
                  className="flex items-center justify-between gap-2 px-2 py-1.5 -mx-2 rounded-md hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <UserPlus2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{p.company_name}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {formatProspectStatus(p.status as ProspectStatus)}
                    </Badge>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : !loading && !error ? (
        <div className="px-5 py-4 border-t border-border text-xs text-muted-foreground">
          You're caught up on prospect follow-ups. Add a new lead from the pipeline to start the
          next cycle.
        </div>
      ) : null}
    </div>
  )
}
