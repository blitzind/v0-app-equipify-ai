"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarClock, ClipboardList, FileBadge2, MapPin } from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { applyArchivedAtScope } from "@/lib/archive-scope"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type TechWorkRow = {
  id: string
  title: string
  status: string
  scheduled_on: string | null
  scheduled_time: string | null
  customer_id: string
  equipment_id: string | null
  work_order_number?: number | null
}

function localYmd(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function statusLabel(status: string) {
  switch (status) {
    case "scheduled":
      return "Scheduled"
    case "in_progress":
      return "In progress"
    case "completed_pending_signature":
      return "Pending signature"
    case "completed":
      return "Completed"
    case "invoiced":
      return "Invoiced"
    default:
      return "Open"
  }
}

function WorkCard({
  row,
  customer,
  equipment,
}: {
  row: TechWorkRow
  customer: string
  equipment: string
}) {
  return (
    <Link
      href={`/work-orders?workOrderId=${encodeURIComponent(row.id)}`}
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-sm",
        "transition-colors hover:border-primary/40 active:scale-[0.99]",
      )}
    >
      <span className="text-sm font-medium text-foreground line-clamp-2">
        {getWorkOrderDisplay({ id: row.id, workOrderNumber: row.work_order_number ?? null })} · {row.title}
      </span>
      <span className="text-xs text-muted-foreground">
        {customer || "Customer"} · {equipment || "Service visit"}
      </span>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-md bg-muted px-2 py-0.5 font-medium">{statusLabel(row.status)}</span>
        {row.scheduled_on ? <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">{row.scheduled_on}</span> : null}
        {row.scheduled_time ? <span className="rounded-md bg-secondary px-2 py-0.5 font-mono">{row.scheduled_time.slice(0, 5)}</span> : null}
      </div>
    </Link>
  )
}

export function TechnicianHome() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const [today, setToday] = useState<TechWorkRow[]>([])
  const [upcoming, setUpcoming] = useState<TechWorkRow[]>([])
  const [open, setOpen] = useState<TechWorkRow[]>([])
  const [customers, setCustomers] = useState<Record<string, string>>({})
  const [equipment, setEquipment] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ymd = useMemo(() => localYmd(), [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || orgStatus !== "ready" || !organizationId) {
        if (!cancelled) {
          setToday([])
          setUpcoming([])
          setOpen([])
          setLoading(false)
        }
        return
      }

      const select = "id, title, status, scheduled_on, scheduled_time, customer_id, equipment_id, work_order_number"
      const base = () =>
        applyArchivedAtScope(
          supabase
            .from("work_orders")
            .select(select)
            .eq("organization_id", organizationId)
            .eq("assigned_user_id", user.id),
          "active",
        )

      const [todayRes, upcomingRes, openRes] = await Promise.all([
        base().eq("scheduled_on", ymd).order("scheduled_time", { ascending: true, nullsFirst: false }).limit(8),
        base().gt("scheduled_on", ymd).order("scheduled_on", { ascending: true }).limit(8),
        base().is("scheduled_on", null).in("status", ["open", "scheduled", "in_progress", "completed_pending_signature"]).order("created_at", { ascending: false }).limit(8),
      ])

      if (cancelled) return
      if (todayRes.error || upcomingRes.error || openRes.error) {
        setError(todayRes.error?.message ?? upcomingRes.error?.message ?? openRes.error?.message ?? "Could not load assigned work.")
        setLoading(false)
        return
      }

      const allRows = [
        ...((todayRes.data ?? []) as TechWorkRow[]),
        ...((upcomingRes.data ?? []) as TechWorkRow[]),
        ...((openRes.data ?? []) as TechWorkRow[]),
      ]
      setToday((todayRes.data ?? []) as TechWorkRow[])
      setUpcoming((upcomingRes.data ?? []) as TechWorkRow[])
      setOpen((openRes.data ?? []) as TechWorkRow[])

      const customerIds = [...new Set(allRows.map((r) => r.customer_id).filter(Boolean))]
      const equipmentIds = [...new Set(allRows.map((r) => r.equipment_id).filter((id): id is string => Boolean(id)))]
      const [{ data: customerRows }, { data: equipmentRows }] = await Promise.all([
        customerIds.length
          ? supabase.from("customers").select("id, company_name").eq("organization_id", organizationId).in("id", customerIds)
          : Promise.resolve({ data: [] as Array<{ id: string; company_name: string | null }> }),
        equipmentIds.length
          ? supabase.from("equipment").select("id, name").eq("organization_id", organizationId).in("id", equipmentIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
      ])

      if (!cancelled) {
        setCustomers(Object.fromEntries((customerRows ?? []).map((c) => [c.id as string, String(c.company_name ?? "")])))
        setEquipment(Object.fromEntries((equipmentRows ?? []).map((e) => [e.id as string, String(e.name ?? "")])))
        setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [organizationId, orgStatus, ymd])

  const pendingCount = [...today, ...upcoming, ...open].filter((r) => r.status === "completed_pending_signature").length

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Technician workspace</p>
            <h1 className="mt-1 text-xl font-semibold text-foreground">Your assigned work</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Focused view for today&apos;s jobs, upcoming visits, signatures, certificates, and field updates.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" asChild>
              <Link href="/technicians/today">Open Today</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/work-orders">My Work Orders</Link>
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><MapPin className="size-4 text-primary" />Today</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{loading ? "..." : today.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><CalendarClock className="size-4 text-primary" />Upcoming</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{loading ? "..." : upcoming.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><FileBadge2 className="size-4 text-primary" />Pending signatures</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{loading ? "..." : pendingCount}</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[
          { title: "Scheduled today", icon: MapPin, rows: today },
          { title: "Upcoming visits", icon: CalendarClock, rows: upcoming },
          { title: "Open assignments", icon: ClipboardList, rows: open },
        ].map(({ title, icon: Icon, rows }) => (
          <Card key={title}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Icon className="size-4 text-primary" />{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing here right now.</p>
              ) : (
                rows.map((row) => (
                  <WorkCard
                    key={row.id}
                    row={row}
                    customer={customers[row.customer_id] ?? ""}
                    equipment={row.equipment_id ? equipment[row.equipment_id] ?? "" : ""}
                  />
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
