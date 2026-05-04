"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Calendar, Clock, ChevronRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { cn } from "@/lib/utils"
import { MaintenancePlansBrandTile } from "@/lib/navigation/module-icons"

function startOfMonthIso(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function MaintenanceAutomationStats() {
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const [dueToday, setDueToday] = useState<number | null>(null)
  const [overdue, setOverdue] = useState<number | null>(null)
  const [autoThisMonth, setAutoThisMonth] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (orgStatus !== "ready" || !activeOrgId) {
        if (!cancelled) {
          setDueToday(null)
          setOverdue(null)
          setAutoThisMonth(null)
          setLoading(false)
        }
        return
      }

      if (!cancelled) setLoading(true)
      const supabase = createBrowserSupabaseClient()
      const orgId = activeOrgId

      const today = new Date().toISOString().slice(0, 10)
      const monthStart = startOfMonthIso()

      const basePlans = () =>
        supabase
          .from("maintenance_plans")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .eq("status", "active")

      const [dueTodayRes, overdueRes, autoRes] = await Promise.all([
        basePlans().eq("next_due_date", today),
        basePlans().lt("next_due_date", today).not("next_due_date", "is", null),
        supabase
          .from("work_orders")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .not("maintenance_plan_id", "is", null)
          .gte("created_at", monthStart),
      ])

      if (cancelled) return

      setDueToday(dueTodayRes.count ?? 0)
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
  type BrandRow = { kind: "brand"; label: string; value: number | null }
  const items: (MetricRow | BrandRow)[] = [
    {
      kind: "metric",
      label: "Due today",
      value: dueToday,
      Icon: Clock,
      iconClass: "text-amber-600",
      bgClass: "bg-amber-500/10",
    },
    {
      kind: "metric",
      label: "Overdue",
      value: overdue,
      Icon: Calendar,
      iconClass: "text-destructive",
      bgClass: "bg-destructive/10",
    },
    {
      kind: "brand",
      label: "Auto-created this month",
      value: autoThisMonth,
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
            {row.kind === "brand" ? (
              <MaintenancePlansBrandTile size="stat" className="rounded-xl" />
            ) : (
            <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg shrink-0", row.bgClass)}>
              <row.Icon className={cn("w-5 h-5", row.iconClass)} />
            </div>
            )}
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
