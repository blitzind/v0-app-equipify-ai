"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ClipboardList, HardHat, MapPin } from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { applyArchivedAtScope } from "@/lib/archive-scope"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TechnicianInventoryMobileCard } from "@/components/inventory/technician-inventory-mobile-card"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"

function localYmd(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function labelStatus(s: string) {
  switch (s) {
    case "open":
      return "Open"
    case "scheduled":
      return "Scheduled"
    case "in_progress":
      return "In progress"
    case "completed":
      return "Completed"
    case "completed_pending_signature":
      return "Pending signature"
    case "invoiced":
      return "Invoiced"
    default:
      return s
  }
}

type Row = {
  id: string
  title: string
  status: string
  scheduled_on: string | null
  scheduled_time: string | null
  customer_id: string
  equipment_id: string
  work_order_number?: number | null
}

export default function TechnicianTodayPage() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const [userId, setUserId] = useState<string | null>(null)
  const [todayRows, setTodayRows] = useState<Row[]>([])
  const [openRows, setOpenRows] = useState<Row[]>([])
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({})
  const [equipmentNames, setEquipmentNames] = useState<Record<string, string>>({})
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
      if (!user) {
        if (!cancelled) {
          setUserId(null)
          setTodayRows([])
          setOpenRows([])
          setLoading(false)
        }
        return
      }
      if (!cancelled) setUserId(user.id)

      if (orgStatus !== "ready" || !organizationId) {
        if (!cancelled) {
          setTodayRows([])
          setOpenRows([])
          setLoading(false)
        }
        return
      }

      const orgId = organizationId

      async function fetchToday() {
        let q = supabase
          .from("work_orders")
          .select(
            "id, title, status, scheduled_on, scheduled_time, customer_id, equipment_id, work_order_number",
          )
          .eq("organization_id", orgId)
          .eq("assigned_user_id", user.id)
          .eq("scheduled_on", ymd)
          .order("scheduled_time", { ascending: true, nullsFirst: false })
        q = applyArchivedAtScope(q, "active")
        const { data, error: e } = await q
        if (e?.message?.includes("work_order_number")) {
          let q2 = supabase
            .from("work_orders")
            .select("id, title, status, scheduled_on, scheduled_time, customer_id, equipment_id")
            .eq("organization_id", orgId)
            .eq("assigned_user_id", user.id)
            .eq("scheduled_on", ymd)
            .order("scheduled_time", { ascending: true, nullsFirst: false })
          q2 = applyArchivedAtScope(q2, "active")
          return await q2
        }
        return { data: data as Row[] | null, error: e }
      }

      async function fetchUndatedOpen() {
        let q = supabase
          .from("work_orders")
          .select(
            "id, title, status, scheduled_on, scheduled_time, customer_id, equipment_id, work_order_number",
          )
          .eq("organization_id", orgId)
          .eq("assigned_user_id", user.id)
          .is("scheduled_on", null)
          .in("status", ["open", "scheduled", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(25)
        q = applyArchivedAtScope(q, "active")
        const { data, error: e } = await q
        if (e?.message?.includes("work_order_number")) {
          let q2 = supabase
            .from("work_orders")
            .select("id, title, status, scheduled_on, scheduled_time, customer_id, equipment_id")
            .eq("organization_id", orgId)
            .eq("assigned_user_id", user.id)
            .is("scheduled_on", null)
            .in("status", ["open", "scheduled", "in_progress"])
            .order("created_at", { ascending: false })
            .limit(25)
          q2 = applyArchivedAtScope(q2, "active")
          return await q2
        }
        return { data: data as Row[] | null, error: e }
      }

      const [tRes, oRes] = await Promise.all([fetchToday(), fetchUndatedOpen()])
      if (cancelled) return

      if (tRes.error || oRes.error) {
        setError(tRes.error?.message || oRes.error?.message || "Could not load assignments.")
        setTodayRows([])
        setOpenRows([])
        setLoading(false)
        return
      }

      const tList = (tRes.data ?? []) as Row[]
      const oList = (oRes.data ?? []) as Row[]
      setTodayRows(tList)
      setOpenRows(oList)

      const custIds = [...new Set([...tList, ...oList].map((r) => r.customer_id))]
      const eqIds = [...new Set([...tList, ...oList].map((r) => r.equipment_id))]

      const [{ data: custs }, { data: eqs }] = await Promise.all([
        custIds.length
          ? supabase.from("customers").select("id, company_name").eq("organization_id", orgId).in("id", custIds)
          : Promise.resolve({ data: [] as { id: string; company_name: string }[] }),
        eqIds.length
          ? supabase.from("equipment").select("id, name").eq("organization_id", orgId).in("id", eqIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ])

      if (!cancelled) {
        setCustomerNames(
          Object.fromEntries((custs ?? []).map((c) => [c.id as string, String(c.company_name ?? "")])),
        )
        setEquipmentNames(Object.fromEntries((eqs ?? []).map((e) => [e.id as string, String(e.name ?? "")])))
      }
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [organizationId, orgStatus, ymd])

  function woLink(id: string) {
    return `/work-orders?workOrderId=${encodeURIComponent(id)}`
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <HardHat className="w-5 h-5 text-primary shrink-0" aria-hidden />
            My jobs today
          </h1>
          <p className="text-sm text-muted-foreground">
            Work orders assigned to you for <span className="font-mono text-foreground">{ymd}</span>, plus open jobs
            without a scheduled date.
          </p>
        </div>
        <Button variant="outline" size="default" className="shrink-0 min-h-11 px-4 touch-manipulation lg:min-h-9 lg:size-sm" asChild>
          <Link href="/work-orders">All work orders</Link>
        </Button>
      </div>

      {!userId ? (
        <p className="text-sm text-muted-foreground">Sign in to see your assignments.</p>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Scheduled today
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nothing on your calendar for today.</p>
              ) : (
                todayRows.map((r) => (
                  <Link
                    key={r.id}
                    href={woLink(r.id)}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-4 min-h-[4.5rem] text-left shadow-sm",
                      "active:scale-[0.99] transition-transform touch-manipulation",
                    )}
                  >
                    <span className="text-sm font-medium text-foreground line-clamp-2">{r.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {customerNames[r.customer_id] || "Customer"} · {equipmentNames[r.equipment_id] || "Equipment"}
                    </span>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-md bg-muted px-2 py-0.5 font-medium">{labelStatus(r.status)}</span>
                      {r.scheduled_time ? (
                        <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 font-mono">
                          {r.scheduled_time.slice(0, 5)}
                        </span>
                      ) : null}
                      {r.work_order_number != null ? (
                        <span className="text-muted-foreground">WO #{r.work_order_number}</span>
                      ) : null}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                Open — no scheduled date
              </CardTitle>
              <p className="text-xs text-muted-foreground font-normal">
                Tap a job to open it in the work order drawer.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {openRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No undated open assignments.</p>
              ) : (
                openRows.map((r) => (
                  <Link
                    key={r.id}
                    href={woLink(r.id)}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-4 min-h-[4.5rem] text-left shadow-sm",
                      "active:scale-[0.99] transition-transform touch-manipulation",
                    )}
                  >
                    <span className="text-sm font-medium text-foreground line-clamp-2">{r.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {customerNames[r.customer_id] || "Customer"} · {equipmentNames[r.equipment_id] || "Equipment"}
                    </span>
                    <span className="text-[11px] rounded-md bg-muted px-2 py-0.5 font-medium w-fit">
                      {labelStatus(r.status)}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Technician-friendly inventory panel — appears beneath the day's
              jobs so a tech can use a part on the *first* scheduled job
              without leaving Today, and request a restock for anything
              running low. The panel resolves their assigned vehicle bin
              automatically. */}
          <TechnicianInventoryMobileCard
            activeWorkOrder={
              todayRows[0]
                ? {
                    id: todayRows[0].id,
                    display: getWorkOrderDisplay({
                      id: todayRows[0].id,
                      workOrderNumber: todayRows[0].work_order_number ?? null,
                    }),
                    title: todayRows[0].title,
                  }
                : openRows[0]
                  ? {
                      id: openRows[0].id,
                      display: getWorkOrderDisplay({
                        id: openRows[0].id,
                        workOrderNumber: openRows[0].work_order_number ?? null,
                      }),
                      title: openRows[0].title,
                    }
                  : null
            }
          />
        </>
      )}
    </div>
  )
}
