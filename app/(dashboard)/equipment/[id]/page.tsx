"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Equipment } from "@/lib/mock-data"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DrawerSection, DrawerRow, DrawerTimeline } from "@/components/detail-drawer"
import { formatWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { WO_LIST_SELECT, WO_LIST_SELECT_WITH_NUM } from "@/lib/work-orders/supabase-select"
import { getEquipmentDisplayPrimary, getEquipmentSecondaryLine } from "@/lib/equipment/display"
import { intervalFromDb, planStatusDbToUi } from "@/lib/maintenance-plans/db-map"
import type { MaintenancePlanRow } from "@/lib/maintenance-plans/db-map"
import { MaintenancePlansBrandTile } from "@/lib/navigation/module-icons"
import {
  ChevronLeft,
  ClipboardList,
  FileText,
  CalendarPlus,
  Shield,
  StickyNote,
  Wrench,
  Calendar,
  Cpu,
  ExternalLink,
} from "lucide-react"

type DbEquipmentRow = {
  id: string
  organization_id: string
  customer_id: string
  equipment_code: string | null
  name: string
  manufacturer: string | null
  category: string | null
  serial_number: string | null
  status: "active" | "needs_service" | "out_of_service" | "in_repair"
  install_date: string | null
  warranty_expires_at: string | null
  last_service_at: string | null
  next_due_at: string | null
  location_label: string | null
  notes: string | null
}

type AssetWo = {
  id: string
  work_order_number?: number | null
  title: string
  status: string
  type: string
  scheduled_on: string | null
  created_at: string
  completed_at: string | null
  total_labor_cents: number
  total_parts_cents: number
  maintenance_plan_id: string | null
}

type PlanRow = {
  id: string
  name: string
  status: string
  interval_value: number
  interval_unit: string
  next_due_date: string | null
  equipment_id: string
}

function fmtDate(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function daysToDue(dateStr: string) {
  if (!dateStr) return 9999
  const due = new Date(dateStr + "T00:00:00Z").getTime()
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24))
}

function mapDbStatusToUi(status: DbEquipmentRow["status"]): Equipment["status"] {
  switch (status) {
    case "active":
      return "Active"
    case "needs_service":
      return "Needs Service"
    case "in_repair":
      return "In Repair"
    case "out_of_service":
      return "Out of Service"
    default:
      return "Active"
  }
}

const STATUS_COLORS: Record<Equipment["status"], string> = {
  Active: "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Needs Service": "bg-[color:var(--status-warning)]/15 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Out of Service": "bg-destructive/15 text-destructive border-destructive/30",
  "In Repair": "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
}

function woDbStatusLabel(s: string) {
  const m: Record<string, string> = {
    open: "Open",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    completed: "Completed",
    invoiced: "Invoiced",
  }
  return m[s] ?? s
}

function woDbTypeLabel(s: string) {
  if (!s) return "—"
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function eqPlanIntervalLabel(row: PlanRow): string {
  const u = row.interval_unit as MaintenancePlanRow["interval_unit"]
  const { interval, customIntervalDays } = intervalFromDb(row.interval_value, u)
  return interval === "Custom" ? `${customIntervalDays} day cycle` : interval
}

function warrantyKpiLabel(days: number, hasDate: boolean): string {
  if (!hasDate) return "—"
  if (days < 0) return "Expired"
  if (days <= 90) return "Expiring"
  return "Active"
}

function rowToEquipment(row: DbEquipmentRow, customerName: string): Equipment {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName,
    equipmentCode: row.equipment_code ?? undefined,
    model: row.name,
    manufacturer: row.manufacturer ?? "",
    category: row.category ?? "",
    serialNumber: row.serial_number ?? "",
    installDate: row.install_date ?? "",
    warrantyExpiration: row.warranty_expires_at ?? "",
    lastServiceDate: row.last_service_at ?? "",
    nextDueDate: row.next_due_at ?? "",
    status: mapDbStatusToUi(row.status),
    notes: row.notes ?? "",
    location: row.location_label ?? "",
    photos: [],
    manuals: [],
    serviceHistory: [],
  }
}

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>()
  const id = typeof params.id === "string" ? params.id : ""
  const activeOrg = useActiveOrganization()

  const [loading, setLoading] = useState(true)
  const [eq, setEq] = useState<Equipment | null>(null)
  const [workOrders, setWorkOrders] = useState<AssetWo[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [tab, setTab] = useState("overview")

  const load = useCallback(async () => {
    if (!id) {
      setEq(null)
      setWorkOrders([])
      setPlans([])
      setLoading(false)
      return
    }
    setLoading(true)
    const supabase = createBrowserSupabaseClient()
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setEq(null)
        setWorkOrders([])
        setPlans([])
        return
      }
      if (activeOrg.status !== "ready" || !activeOrg.organizationId) {
        setEq(null)
        return
      }
      const oid = activeOrg.organizationId

      const { data: row, error } = await supabase
        .from("equipment")
        .select(
          "id, organization_id, customer_id, equipment_code, name, manufacturer, category, serial_number, status, install_date, warranty_expires_at, last_service_at, next_due_at, location_label, notes",
        )
        .eq("id", id)
        .eq("organization_id", oid)
        .eq("is_archived", false)
        .maybeSingle()

      if (error || !row) {
        setEq(null)
        setWorkOrders([])
        setPlans([])
        return
      }

      const er = row as DbEquipmentRow
      const { data: customerRow } = await supabase
        .from("customers")
        .select("company_name")
        .eq("organization_id", oid)
        .eq("id", er.customer_id)
        .maybeSingle()

      const customerName = (customerRow as { company_name: string } | null)?.company_name ?? "Customer"
      setEq(rowToEquipment(er, customerName))

      let woRes = await supabase
        .from("work_orders")
        .select(WO_LIST_SELECT_WITH_NUM)
        .eq("organization_id", oid)
        .eq("equipment_id", er.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(150)

      if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
        woRes = await supabase
          .from("work_orders")
          .select(WO_LIST_SELECT)
          .eq("organization_id", oid)
          .eq("equipment_id", er.id)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
          .limit(150)
      }
      setWorkOrders(woRes.error ? [] : ((woRes.data ?? []) as AssetWo[]))

      const { data: planData } = await supabase
        .from("maintenance_plans")
        .select("id, name, status, interval_value, interval_unit, next_due_date, equipment_id")
        .eq("organization_id", oid)
        .eq("equipment_id", er.id)
        .eq("is_archived", false)
        .order("next_due_date", { ascending: true, nullsFirst: false })

      setPlans((planData ?? []) as PlanRow[])
    } finally {
      setLoading(false)
    }
  }, [id, activeOrg.status, activeOrg.organizationId])

  useEffect(() => {
    void load()
  }, [load])

  const openWOs = useMemo(
    () => workOrders.filter((w) => w.status !== "completed" && w.status !== "invoiced"),
    [workOrders],
  )
  const completedCount = useMemo(
    () => workOrders.filter((w) => w.status === "completed" || w.status === "invoiced").length,
    [workOrders],
  )
  const activePlanCount = useMemo(
    () => plans.filter((p) => planStatusDbToUi(p.status) === "Active").length,
    [plans],
  )
  const warrantyDays = eq ? daysToDue(eq.warrantyExpiration) : 9999
  const warrantyHasDate = Boolean(eq?.warrantyExpiration?.trim())
  const warrantyKpi = eq ? warrantyKpiLabel(warrantyDays, warrantyHasDate) : "—"
  const warrantySub = !eq
    ? ""
    : !warrantyHasDate
      ? "No expiration on file"
      : warrantyDays < 0
        ? `Expired ${fmtDate(eq.warrantyExpiration)}`
        : `Ends ${fmtDate(eq.warrantyExpiration)}`

  const overviewTimeline = useMemo(() => {
    type Ev = { at: string; label: string; desc: string; accent: "success" | "warning" | "muted" }
    const ev: Ev[] = []
    for (const wo of workOrders) {
      ev.push({
        at: wo.created_at,
        label: `Work order opened · ${formatWorkOrderDisplay(wo.work_order_number, wo.id)}`,
        desc: `${wo.title} · ${woDbStatusLabel(wo.status)}`,
        accent: "muted",
      })
      if (wo.completed_at) {
        ev.push({
          at: wo.completed_at,
          label: `Work order completed · ${formatWorkOrderDisplay(wo.work_order_number, wo.id)}`,
          desc: wo.title,
          accent: "success",
        })
      }
    }
    ev.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    return ev.slice(0, 14).map((e) => ({
      date: new Date(e.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      label: e.label,
      description: e.desc,
      accent: e.accent,
    }))
  }, [workOrders])

  const totalServiceCost = useMemo(
    () => workOrders.reduce((s, w) => s + ((w.total_labor_cents ?? 0) + (w.total_parts_cents ?? 0)) / 100, 0),
    [workOrders],
  )

  if (!id) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">Invalid equipment id.</div>
    )
  }

  if (loading) {
    return <div className="py-24 text-center text-sm text-muted-foreground">Loading equipment…</div>
  }

  if (!eq) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted-foreground text-sm">Equipment not found or not accessible.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/equipment" className="gap-2">
            <ChevronLeft className="w-4 h-4" /> Back to Equipment
          </Link>
        </Button>
      </div>
    )
  }

  const woNew = `/work-orders?action=new-work-order&customerId=${encodeURIComponent(eq.customerId)}&equipmentId=${encodeURIComponent(eq.id)}`
  const quoteNew = `/quotes?action=new-quote&customerId=${encodeURIComponent(eq.customerId)}&equipmentId=${encodeURIComponent(eq.id)}`
  const planNew = `/maintenance-plans?new=1&customerId=${encodeURIComponent(eq.customerId)}&equipmentId=${encodeURIComponent(eq.id)}`

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/equipment">
            <ChevronLeft className="w-4 h-4" />
            Equipment
          </Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium text-foreground truncate">
          {getEquipmentDisplayPrimary({
            id: eq.id,
            name: eq.model,
            equipment_code: eq.equipmentCode,
            serial_number: eq.serialNumber,
            category: eq.category,
          })}
        </span>
      </div>

      <Card className="border-border shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {getEquipmentDisplayPrimary({
                  id: eq.id,
                  name: eq.model,
                  equipment_code: eq.equipmentCode,
                  serial_number: eq.serialNumber,
                  category: eq.category,
                })}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {getEquipmentSecondaryLine(
                  {
                    id: eq.id,
                    name: eq.model,
                    equipment_code: eq.equipmentCode,
                    serial_number: eq.serialNumber,
                    category: eq.category,
                  },
                  eq.customerName,
                )}
                {eq.manufacturer ? ` · ${eq.manufacturer}` : ""}
              </p>
              <Badge variant="secondary" className={cn("text-xs border mt-3", STATUS_COLORS[eq.status])}>
                {eq.status}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button size="sm" variant="outline" asChild>
                <Link href={`/equipment?open=${encodeURIComponent(eq.id)}`} className="gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" /> Drawer
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick actions</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" className="gap-1.5 shadow-sm" asChild>
                <Link href={woNew}>
                  <ClipboardList className="w-3.5 h-3.5" /> New work order
                </Link>
              </Button>
              <Button size="sm" variant="secondary" className="gap-1.5 shadow-sm" asChild>
                <Link href={quoteNew}>
                  <FileText className="w-3.5 h-3.5" /> New quote
                </Link>
              </Button>
              <Button size="sm" variant="secondary" className="gap-1.5 shadow-sm" asChild>
                <Link href={planNew}>
                  <MaintenancePlansBrandTile size="xs" /> New maintenance plan
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(
          [
            {
              label: "Open work orders",
              value: String(openWOs.length),
              sub: "not completed",
              warn: openWOs.length > 0,
            },
            {
              label: "Completed work orders",
              value: String(completedCount),
              sub: "completed or invoiced",
              warn: false,
            },
            {
              label: "Active maintenance plans",
              value: String(activePlanCount),
              sub: "on this asset",
              warn: false,
            },
            {
              label: "Warranty status",
              value: warrantyKpi,
              sub: warrantySub,
              warn: warrantyHasDate && warrantyDays >= 0 && warrantyDays <= 90,
            },
          ] as const
        ).map(({ label, value, sub, warn }) => (
          <div
            key={label}
            className="bg-card rounded-xl border border-border p-4 flex flex-col gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-h-[100px]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold tracking-tight", warn ? "text-[color:var(--status-warning)]" : "text-foreground")}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground leading-snug">{sub}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="bg-card border border-border h-auto flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm gap-1.5">
            <Cpu className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="service" className="text-xs sm:text-sm gap-1.5">
            <Wrench className="w-3.5 h-3.5" /> Service ({workOrders.length})
          </TabsTrigger>
          <TabsTrigger value="plans" className="text-xs sm:text-sm gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Plans ({plans.length})
          </TabsTrigger>
          <TabsTrigger value="quotes" className="text-xs sm:text-sm gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Quotes
          </TabsTrigger>
          <TabsTrigger value="warranty" className="text-xs sm:text-sm gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Warranty
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs sm:text-sm gap-1.5">
            <StickyNote className="w-3.5 h-3.5" /> Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          {overviewTimeline.length > 0 && (
            <Card className="border-border">
              <CardContent className="p-5">
                <DrawerSection title="Recent service activity">
                  <DrawerTimeline items={overviewTimeline} />
                </DrawerSection>
              </CardContent>
            </Card>
          )}
          <Card className="border-border">
            <CardContent className="p-5 space-y-0">
              <DrawerSection title="Equipment">
                <DrawerRow label="Customer" value={<Link href={`/customers/${eq.customerId}`} className="text-primary hover:underline">{eq.customerName}</Link>} />
                <DrawerRow label="Serial" value={eq.serialNumber || "—"} />
                <DrawerRow label="Category" value={eq.category || "—"} />
                <DrawerRow label="Location" value={eq.location || "—"} />
              </DrawerSection>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="service" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total events", value: workOrders.length },
              { label: "Repairs", value: workOrders.filter((w) => (w.type ?? "").toLowerCase() === "repair").length },
              { label: "Total cost", value: fmtCurrency(totalServiceCost) },
            ].map((s) => (
              <div key={s.label} className="bg-muted/30 border border-border rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <Card className="border-border">
            <CardContent className="p-4 space-y-2">
              {workOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No work orders for this equipment.</p>
              ) : (
                workOrders.map((wo) => (
                  <Link
                    key={wo.id}
                    href={`/work-orders?open=${wo.id}`}
                    className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-primary">{formatWorkOrderDisplay(wo.work_order_number, wo.id)}</p>
                      <p className="text-xs font-medium truncate">{wo.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {woDbTypeLabel(wo.type)} · {woDbStatusLabel(wo.status)}
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" asChild>
              <Link href={planNew} className="gap-1.5">
                <CalendarPlus className="w-3.5 h-3.5" /> New plan
              </Link>
            </Button>
          </div>
          <Card className="border-border">
            <CardContent className="p-4 space-y-2">
              {plans.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No maintenance plans on this asset.</p>
              ) : (
                plans.map((p) => (
                  <Link
                    key={p.id}
                    href={`/maintenance-plans?open=${p.id}`}
                    className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {eqPlanIntervalLabel(p)} · Next: {p.next_due_date ? fmtDate(p.next_due_date.slice(0, 10)) : "—"}
                      </p>
                      <Badge variant="secondary" className="text-[10px] mt-1">
                        {planStatusDbToUi(p.status)}
                      </Badge>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotes" className="mt-4">
          <Card className="border-border">
            <CardContent className="p-6 text-center space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Create and track quotes for this asset in the Quotes workspace — this customer and equipment are
                pre-filled when you start a new quote.
              </p>
              <Button asChild>
                <Link href={quoteNew} className="gap-2">
                  <FileText className="w-4 h-4" /> New quote
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warranty" className="mt-4">
          <Card className="border-border">
            <CardContent className="p-5 space-y-4">
              <DrawerSection title="Coverage">
                <DrawerRow label="Expiration" value={warrantyHasDate ? fmtDate(eq.warrantyExpiration) : "—"} />
                <DrawerRow
                  label="Status"
                  value={
                    !warrantyHasDate ? "Unknown" : warrantyDays < 0 ? "Expired" : warrantyDays <= 90 ? "Expiring soon" : "Active"
                  }
                />
                <DrawerRow label="Installed" value={fmtDate(eq.installDate)} />
              </DrawerSection>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card className="border-border">
            <CardContent className="p-5">
              {eq.notes ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{eq.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes on file.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
