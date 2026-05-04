"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Calendar, Clock, ChevronRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { cn } from "@/lib/utils"
import { MaintenancePlansLucideIcon } from "@/lib/navigation/module-icons"

/** Local calendar YYYY-MM-DD */
function localDateParts(d: Date) {
  const y = d.getFullYear()
  const m = d.getMonth()
  const day = d.getDate()
  return { y, m, day }
}

function monthRangeLocalStrings() {
  const { y, m } = localDateParts(new Date())
  const pad = (n: number) => String(n).padStart(2, "0")
  const monthStart = `${y}-${pad(m + 1)}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const monthEnd = `${y}-${pad(m + 1)}-${pad(lastDay)}`
  return { monthStart, monthEnd }
}

function todayLocalString() {
  const { y, m, day } = localDateParts(new Date())
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${y}-${pad(m + 1)}-${pad(day)}`
}

function monthStartEndIsoUtc() {
  const { y, m } = localDateParts(new Date())
  const start = new Date(y, m, 1, 0, 0, 0, 0)
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export function MaintenanceAutomationStats() {
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const [dueThisMonth, setDueThisMonth] = useState<number | null>(null)
  const [overdue, setOverdue] = useState<number | null>(null)
  const [autoThisMonth, setAutoThisMonth] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (orgStatus !== "ready" || !activeOrgId) {
        if (!cancelled) {
          setDueThisMonth(null)
          setOverdue(null)
          setAutoThisMonth(null)
          setLoading(false)
        }
        return
      }

      if (!cancelled) setLoading(true)
      const supabase = createBrowserSupabaseClient()
      const orgId = activeOrgId

      const today = todayLocalString()
      const { monthStart, monthEnd } = monthRangeLocalStrings()
      const { startIso, endIso } = monthStartEndIsoUtc()

      const basePlans = () =>
        supabase
          .from("maintenance_plans")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .eq("status", "active")

      const [dueMonthRes, overdueRes, autoRes] = await Promise.all([
        basePlans()
          .gte("next_due_date", monthStart)
          .lte("next_due_date", monthEnd)
          .not("next_due_date", "is", null),
        basePlans().lt("next_due_date", today).not("next_due_date", "is", null),
        supabase
          .from("work_orders")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .eq("created_by_pm_automation", true)
          .gte("created_at", startIso)
          .lte("created_at", endIso),
      ])

      if (cancelled) return

      setDueThisMonth(dueMonthRes.count ?? 0)
      setOverdue(overdueRes.count ?? 0)
      setAutoThisMonth(autoRes.count ?? 0)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [activeOrgId, orgStatus])

  type MetricRow = {
    kind: "metric"
    label: string
    value: number | null
    Icon: LucideIcon
    iconClass: string
    bgClass: string
  }
  const items: MetricRow[] = [
    {
      kind: "metric",
      label: "PM due this month",
      value: dueThisMonth,
      Icon: Clock,
      iconClass: "text-amber-600",
      bgClass: "bg-amber-500/10",
    },
    {
      kind: "metric",
      label: "PM overdue",
      value: overdue,
      Icon: Calendar,
      iconClass: "text-destructive",
      bgClass: "bg-destructive/10",
    },
    {
      kind: "metric",
      label: "Auto-created this month",
      value: autoThisMonth,
      Icon: MaintenancePlansLucideIcon,
      iconClass: "text-muted-foreground",
      bgClass: "bg-muted/60",
    },
  ]

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Maintenance plans</h2>
        <Link
          href="/maintenance-plans"
          className="text-xs font-medium text-primary hover:underline underline-offset-2 transition-colors inline-flex items-center gap-1"
        >
          View plans <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {items.map((row) => (
          <div key={row.label} className="flex items-center gap-3 px-5 py-4">
            <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg shrink-0", row.bgClass)}>
              <row.Icon className={cn("w-5 h-5", row.iconClass)} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium">{row.label}</p>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {loading ? "—" : row.value ?? "—"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
