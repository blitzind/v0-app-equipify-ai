"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Equipment } from "@/lib/mock-data"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { isAssignedWorkOnly, loadAssignedWorkScope } from "@/lib/permissions/technician-scope"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DrawerSection, DrawerRow } from "@/components/detail-drawer"
import { formatWorkOrderDisplay } from "@/lib/work-orders/display"
import { getEquipmentDisplayPrimary, getEquipmentSecondaryLine } from "@/lib/equipment/display"
import {
  fetchCalibrationRecordsForEquipment,
  fetchCertificateAttachmentsForEquipmentHistory,
  fetchDocumentAttachmentsForEquipmentHistory,
  fetchInvoicesForEquipmentAsset,
  fetchWorkOrdersLinkedToEquipment,
  type EquipmentCertificateAttachmentRow,
  type EquipmentCertRow,
  type EquipmentDocumentAttachmentRow,
  type EquipmentInvoiceRow,
} from "@/lib/equipment/equipment-detail-queries"
import { buildEquipmentLifecycleTimeline, sumInvoiceAmountCents } from "@/lib/lifecycle/equipment-timeline"
import { ServiceLifecycleTimeline } from "@/components/lifecycle/service-lifecycle-timeline"
import { RecentCommunicationsCard } from "@/components/communications/recent-communications-card"
import { intervalFromDb, planStatusDbToUi } from "@/lib/maintenance-plans/db-map"
import { summarizeMaintenanceForecast } from "@/lib/maintenance-plans/forecast"
import { formatCustomerLocationSelectLabel } from "@/lib/customer-locations/format"
import type { MaintenancePlanRow } from "@/lib/maintenance-plans/db-map"
import { MaintenanceForecastPanel } from "@/components/maintenance-plans/maintenance-forecast-panel"
import {
  loadEquipmentSignalsByIds,
  type EquipmentSignals,
} from "@/lib/equipment/intelligence-rollup"
import { EquipmentSignalsRow } from "@/components/equipment/equipment-signals-row"
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
  Users,
  Receipt,
  FileBadge2,
  Paperclip,
} from "lucide-react"
import { SlaCoverageBadge, formatSlaCoverageLabel } from "@/components/service-contracts/sla-coverage-badge"
import type { ServiceContractRow } from "@/lib/service-contracts/types"
import { evaluateSlaCoverageLabel, pickBestContract } from "@/lib/service-contracts/coverage"
import type { EquipmentWarrantyRow } from "@/lib/equipment-warranties/types"
import { evaluateWarrantyCoverage, formatWarrantyCoverageLabel } from "@/lib/equipment-warranties/eval"
import { WarrantyCoverageBadge } from "@/components/equipment-warranties/warranty-coverage-badge"
import { EquipmentWarrantyFormDialog } from "@/components/equipment-warranties/equipment-warranty-form-dialog"
import { evaluateReplacementReadiness } from "@/lib/equipment-replacement/eval"
import { ReplacementReadinessPanel } from "@/components/equipment-replacement/replacement-readiness-panel"
import { ReplacementReadinessBadge } from "@/components/equipment-replacement/replacement-readiness-badge"

type DbEquipmentRow = {
  id: string
  organization_id: string
  customer_id: string
  equipment_code: string | null
  name: string
  manufacturer: string | null
  category: string | null
  subcategory: string | null
  serial_number: string | null
  status: "active" | "needs_service" | "out_of_service" | "in_repair"
  install_date: string | null
  warranty_expires_at: string | null
  warranty_expiration_date: string | null
  warranty_start_date: string | null
  last_service_at: string | null
  next_due_at: string | null
  next_calibration_due_at: string | null
  calibration_interval_months: number | null
  location_label: string | null
  customer_location_id: string | null
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
  assigned_technician_id: string | null
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

type EquipmentHistoryFilter = "all" | "service" | "calibration" | "documents" | "billing" | "warranty" | "maintenance" | "notes"
type EquipmentHistoryEvent = {
  id: string
  category: Exclude<EquipmentHistoryFilter, "all">
  at: string
  title: string
  description?: string
  status?: string | null
  href?: string
  sourceType: string
  sourceId: string
  workOrderLabel?: string | null
  technicianLabel?: string | null
}

const HISTORY_FILTERS: Array<{ id: EquipmentHistoryFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "service", label: "Service" },
  { id: "calibration", label: "Calibration" },
  { id: "documents", label: "Documents" },
  { id: "billing", label: "Billing" },
  { id: "warranty", label: "Warranty" },
  { id: "maintenance", label: "Maintenance" },
  { id: "notes", label: "Notes" },
]

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

function formatHistoryDate(raw: string): string {
  if (!raw) return "—"
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function historyTone(category: EquipmentHistoryEvent["category"]): string {
  switch (category) {
    case "service":
      return "bg-primary/10 text-primary border-primary/25"
    case "calibration":
      return "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/25"
    case "documents":
      return "bg-muted text-muted-foreground border-border"
    case "billing":
      return "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/25"
    case "warranty":
      return "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/25"
    case "maintenance":
      return "bg-secondary text-secondary-foreground border-border"
    case "notes":
      return "bg-card text-muted-foreground border-border"
  }
}

function HistoryIcon({ category }: { category: EquipmentHistoryEvent["category"] }) {
  const cls = "h-4 w-4"
  switch (category) {
    case "service":
      return <Wrench className={cls} />
    case "calibration":
      return <FileBadge2 className={cls} />
    case "documents":
      return <Paperclip className={cls} />
    case "billing":
      return <Receipt className={cls} />
    case "warranty":
      return <Shield className={cls} />
    case "maintenance":
      return <Calendar className={cls} />
    case "notes":
      return <StickyNote className={cls} />
  }
}

function warrantyKpiLabel(days: number, hasDate: boolean): string {
  if (!hasDate) return "—"
  if (days < 0) return "Expired"
  if (days <= 90) return "Expiring"
  return "Active"
}

function rowToEquipment(row: DbEquipmentRow, customerName: string): Equipment {
  const warranty =
    row.warranty_expiration_date?.trim() ||
    row.warranty_expires_at?.trim() ||
    ""
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName,
    equipmentCode: row.equipment_code ?? undefined,
    model: row.name,
    manufacturer: row.manufacturer ?? "",
    category: row.category ?? "",
    subcategory: row.subcategory ?? undefined,
    serialNumber: row.serial_number ?? "",
    installDate: row.install_date ?? "",
    warrantyStartDate: row.warranty_start_date?.trim() ? row.warranty_start_date.slice(0, 10) : "",
    warrantyExpiration: warranty,
    lastServiceDate: row.last_service_at ?? "",
    nextDueDate: row.next_due_at ?? "",
    nextCalibrationDue: row.next_calibration_due_at ?? undefined,
    calibrationIntervalMonths: row.calibration_interval_months ?? undefined,
    status: mapDbStatusToUi(row.status),
    notes: row.notes ?? "",
    location: row.location_label ?? "",
    serviceSiteId: row.customer_location_id ?? null,
    photos: [],
    manuals: [],
    serviceHistory: [],
  }
}

function EquipmentHistoryTimeline({
  events,
  filter,
  onFilterChange,
}: {
  events: EquipmentHistoryEvent[]
  filter: EquipmentHistoryFilter
  onFilterChange: (filter: EquipmentHistoryFilter) => void
}) {
  const visible = filter === "all" ? events : events.filter((event) => event.category === filter)
  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Equipment history</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Device-level service, calibration, document, billing, warranty, and maintenance events.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {HISTORY_FILTERS.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={filter === item.id ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => onFilterChange(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No history events yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Linked work orders, certificates, invoices, attachments, and maintenance activity will appear here.
            </p>
          </div>
        ) : (
          <div className="relative space-y-3">
            <div className="absolute left-4 top-2 bottom-2 w-px bg-border" aria-hidden />
            {visible.map((event) => {
              const body = (
                <div className="relative flex gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition-colors hover:border-primary/30">
                  <div className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background", historyTone(event.category))}>
                    <HistoryIcon category={event.category} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{event.title}</p>
                      <Badge variant="outline" className={cn("text-[10px] capitalize", historyTone(event.category))}>
                        {event.category}
                      </Badge>
                      {event.status ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {event.status}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatHistoryDate(event.at)}</p>
                    {event.description ? (
                      <p className="mt-1 text-sm text-muted-foreground leading-snug">{event.description}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {event.workOrderLabel ? <span>{event.workOrderLabel}</span> : null}
                      {event.technicianLabel ? <span>Technician: {event.technicianLabel}</span> : null}
                      <span>{event.sourceType}</span>
                    </div>
                  </div>
                  {event.href ? <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                </div>
              )
              return event.href ? (
                <Link key={event.id} href={event.href} className="block">
                  {body}
                </Link>
              ) : (
                <div key={event.id}>{body}</div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>()
  const id = typeof params.id === "string" ? params.id : ""
  const activeOrg = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const assignedOnlyView = isAssignedWorkOnly(permissions)
  const canManageEquipmentRecords = !assignedOnlyView
  const canManageEquipmentWarranties = permissions.canManageDispatch
  const canViewEquipmentFinancials = permissions.canViewFinancials || permissions.canViewBilling || permissions.canViewQuotes

  const [loading, setLoading] = useState(true)
  const [eq, setEq] = useState<Equipment | null>(null)
  const [workOrders, setWorkOrders] = useState<AssetWo[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [invoiceRows, setInvoiceRows] = useState<EquipmentInvoiceRow[]>([])
  const [certificateLines, setCertificateLines] = useState<
    { id: string; created_at: string; templateName: string | null; workOrderLabel: string | null; workOrderId: string | null }[]
  >([])
  const [documentRows, setDocumentRows] = useState<EquipmentDocumentAttachmentRow[]>([])
  const [certificateAttachmentRows, setCertificateAttachmentRows] = useState<EquipmentCertificateAttachmentRow[]>([])
  const [techProfiles, setTechProfiles] = useState<Record<string, string>>({})
  const [signals, setSignals] = useState<EquipmentSignals | null>(null)
  const [serviceSiteSummary, setServiceSiteSummary] = useState<string | null>(null)
  const [tab, setTab] = useState("overview")
  const [historyFilter, setHistoryFilter] = useState<EquipmentHistoryFilter>("all")
  const [equipmentContractEval, setEquipmentContractEval] = useState<ReturnType<
    typeof evaluateSlaCoverageLabel
  > | null>(null)
  const [warrantyRecords, setWarrantyRecords] = useState<EquipmentWarrantyRow[]>([])
  const [warrantyRecordsError, setWarrantyRecordsError] = useState<string | null>(null)
  const [warrantyFormOpen, setWarrantyFormOpen] = useState(false)
  const [warrantyEdit, setWarrantyEdit] = useState<EquipmentWarrantyRow | null>(null)
  const [warrantyRefreshToken, setWarrantyRefreshToken] = useState(0)

  const load = useCallback(async () => {
    if (!id) {
      setEq(null)
      setServiceSiteSummary(null)
      setWorkOrders([])
      setPlans([])
      setInvoiceRows([])
      setCertificateLines([])
      setDocumentRows([])
      setCertificateAttachmentRows([])
      setTechProfiles({})
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
        setServiceSiteSummary(null)
        setWorkOrders([])
        setPlans([])
        setInvoiceRows([])
        setCertificateLines([])
        setDocumentRows([])
        setCertificateAttachmentRows([])
        setTechProfiles({})
        return
      }
      if (activeOrg.status !== "ready" || !activeOrg.organizationId) {
        setEq(null)
        setServiceSiteSummary(null)
        return
      }
      const oid = activeOrg.organizationId
      if (assignedOnlyView) {
        const scope = await loadAssignedWorkScope(supabase, { organizationId: oid, userId: user.id })
        if (!scope.equipmentIds.includes(id)) {
          setEq(null)
          setServiceSiteSummary(null)
          setWorkOrders([])
          setPlans([])
          setInvoiceRows([])
          setCertificateLines([])
          setDocumentRows([])
          setCertificateAttachmentRows([])
          setTechProfiles({})
          return
        }
      }

      const { data: row, error } = await supabase
        .from("equipment")
        .select(
          "id, organization_id, customer_id, equipment_code, name, manufacturer, category, subcategory, serial_number, status, install_date, warranty_start_date, warranty_expires_at, warranty_expiration_date, last_service_at, next_due_at, next_calibration_due_at, calibration_interval_months, location_label, customer_location_id, notes",
        )
        .eq("id", id)
        .eq("organization_id", oid)
        .is("archived_at", null)
        .maybeSingle()

      if (error || !row) {
        setEq(null)
        setServiceSiteSummary(null)
        setWorkOrders([])
        setPlans([])
        setInvoiceRows([])
        setCertificateLines([])
        setDocumentRows([])
        setCertificateAttachmentRows([])
        setTechProfiles({})
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

      if (er.customer_location_id) {
        const { data: locRow } = await supabase
          .from("customer_locations")
          .select("name, address_line1, address_line2, city, state, postal_code")
          .eq("organization_id", oid)
          .eq("id", er.customer_location_id)
          .is("archived_at", null)
          .maybeSingle()
        const lr = locRow as {
          name: string
          address_line1: string
          address_line2: string | null
          city: string
          state: string
          postal_code: string
        } | null
        setServiceSiteSummary(
          lr ?
            formatCustomerLocationSelectLabel({
              name: lr.name,
              address_line1: lr.address_line1,
              address_line2: lr.address_line2,
              city: lr.city,
              state: lr.state,
              postal_code: lr.postal_code,
            })
          : null,
        )
      } else {
        setServiceSiteSummary(null)
      }

      const { rows: woMerged, error: woErr } = await fetchWorkOrdersLinkedToEquipment(supabase, oid, er.id)
      const woList = (woErr ? [] : woMerged) as AssetWo[]
      setWorkOrders(woList)

      const techIds = [...new Set(woList.map((w) => w.assigned_technician_id).filter(Boolean))] as string[]
      if (techIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", techIds)
        const map: Record<string, string> = {}
        for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null }>) {
          map[p.id] = p.full_name?.trim() || "Technician"
        }
        setTechProfiles(map)
      } else {
        setTechProfiles({})
      }

      const woIds = woList.map((w) => w.id)
      const [{ rows: invs }, { rows: certs }] = await Promise.all([
        fetchInvoicesForEquipmentAsset(supabase, oid, er.id, woIds),
        fetchCalibrationRecordsForEquipment(supabase, oid, er.id),
      ])
      setInvoiceRows(invs)

      const templateIds = [...new Set(certs.map((c) => c.template_id))]
      const tplMap: Record<string, string> = {}
      if (templateIds.length > 0) {
        const { data: tplRows } = await supabase
          .from("calibration_templates")
          .select("id, name")
          .eq("organization_id", oid)
          .in("id", templateIds)
        for (const t of (tplRows ?? []) as Array<{ id: string; name: string }>) tplMap[t.id] = t.name
      }

      const woIdsCert = [...new Set(certs.map((c) => c.work_order_id))]
      const woMap: Record<string, { work_order_number?: number | null; title: string }> = {}
      if (woIdsCert.length > 0) {
        const { data: wcert } = await supabase
          .from("work_orders")
          .select("id, work_order_number, title")
          .eq("organization_id", oid)
          .in("id", woIdsCert)
        for (const w of (wcert ?? []) as AssetWo[]) {
          woMap[w.id] = { work_order_number: w.work_order_number, title: w.title }
        }
      }

      setCertificateLines(
        certs.map((c: EquipmentCertRow) => {
          const wo = woMap[c.work_order_id]
          const woLbl = wo
            ? `${formatWorkOrderDisplay(wo.work_order_number, c.work_order_id)} · ${wo.title}`
            : null
          return {
            id: c.id,
            created_at: c.created_at,
            templateName: tplMap[c.template_id] ?? null,
            workOrderLabel: woLbl,
            workOrderId: c.work_order_id,
          }
        }),
      )

      const certIds = certs.map((c) => c.id)
      const [{ rows: docs }, { rows: certUploads }] = await Promise.all([
        fetchDocumentAttachmentsForEquipmentHistory(supabase, oid, er.id, {
          workOrderIds: woIds,
          calibrationRecordIds: certIds,
        }),
        fetchCertificateAttachmentsForEquipmentHistory(supabase, oid, er.id, woIds),
      ])
      setDocumentRows(docs)
      setCertificateAttachmentRows(certUploads)

      const { data: planData } = await supabase
        .from("maintenance_plans")
        .select("id, name, status, interval_value, interval_unit, next_due_date, equipment_id")
        .eq("organization_id", oid)
        .eq("equipment_id", er.id)
        .is("archived_at", null)
        .order("next_due_date", { ascending: true, nullsFirst: false })

      setPlans((planData ?? []) as PlanRow[])
    } finally {
      setLoading(false)
    }
  }, [id, activeOrg.status, activeOrg.organizationId, assignedOnlyView])

  useEffect(() => {
    let cancelled = false
    if (!eq?.id || activeOrg.status !== "ready" || !activeOrg.organizationId) {
      setSignals(null)
      return () => {
        cancelled = true
      }
    }
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const m = await loadEquipmentSignalsByIds(supabase, {
        organizationId: activeOrg.organizationId,
        equipmentIds: [eq.id],
      })
      if (cancelled) return
      setSignals(m.get(eq.id) ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [eq?.id, activeOrg.status, activeOrg.organizationId])

  useEffect(() => {
    if (!eq?.id || activeOrg.status !== "ready" || !activeOrg.organizationId) {
      setEquipmentContractEval(null)
      return
    }
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const { data, error } = await supabase
        .from("org_service_contracts")
        .select("*")
        .eq("organization_id", activeOrg.organizationId)
        .eq("customer_id", eq.customerId)
      if (cancelled || error) {
        if (!cancelled) setEquipmentContractEval(null)
        return
      }
      const nowIso = new Date().toISOString()
      const best = pickBestContract((data ?? []) as ServiceContractRow[], {
        customerId: eq.customerId,
        locationId: eq.serviceSiteId,
        equipmentId: eq.id,
        openedAtIso: nowIso,
        lifecycleStatus: "open",
      })
      if (!cancelled) {
        setEquipmentContractEval(
          evaluateSlaCoverageLabel(best, {
            customerId: eq.customerId,
            locationId: eq.serviceSiteId,
            equipmentId: eq.id,
            openedAtIso: nowIso,
            lifecycleStatus: "open",
          }),
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eq?.id, eq?.customerId, eq?.serviceSiteId, activeOrg.status, activeOrg.organizationId])

  useEffect(() => {
    if (!eq?.id || activeOrg.status !== "ready" || !activeOrg.organizationId) {
      setWarrantyRecords([])
      setWarrantyRecordsError(null)
      return
    }
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const { data, error } = await supabase
        .from("org_equipment_warranties")
        .select("*")
        .eq("organization_id", activeOrg.organizationId)
        .eq("equipment_id", eq.id)
        .order("end_date", { ascending: false })
      if (cancelled) return
      if (error) {
        setWarrantyRecords([])
        setWarrantyRecordsError(
          error.code === "42P01"
            ? "Warranty records are unavailable until database migrations are applied."
            : error.message,
        )
        return
      }
      setWarrantyRecords((data ?? []) as EquipmentWarrantyRow[])
      setWarrantyRecordsError(null)
    })()
    return () => {
      cancelled = true
    }
  }, [eq?.id, activeOrg.organizationId, activeOrg.status, warrantyRefreshToken])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (assignedOnlyView && tab === "plans") setTab("overview")
    if (!canViewEquipmentFinancials && tab === "quotes") setTab("overview")
  }, [assignedOnlyView, canViewEquipmentFinancials, tab])

  const equipmentPmForecast = useMemo(() => {
    if (!eq) return null
    return summarizeMaintenanceForecast(
      plans.map((p) => ({
        id: p.id,
        status: p.status,
        next_due_date: p.next_due_date,
        is_archived: false,
        customer_id: eq.customerId,
        customer_name: eq.customerName,
        equipment_id: eq.id,
        equipment_name: eq.name,
      })),
    )
  }, [eq, plans])

  const equipmentPmContractHint = useMemo(() => {
    if (!equipmentContractEval) return null
    return `Service contract posture: ${formatSlaCoverageLabel(equipmentContractEval.label)}.`
  }, [equipmentContractEval])

  const openWOs = useMemo(
    () => workOrders.filter((w) => w.status !== "completed" && w.status !== "invoiced"),
    [workOrders],
  )
  const completedCount = useMemo(
    () => workOrders.filter((w) => w.status === "completed" || w.status === "invoiced").length,
    [workOrders],
  )
  const warrantyEval = useMemo(() => {
    if (!eq) return null
    return evaluateWarrantyCoverage({
      records: warrantyRecords,
      equipmentFallback: {
        start: eq.warrantyStartDate?.trim() ? eq.warrantyStartDate.slice(0, 10) : null,
        end: eq.warrantyExpiration?.trim() ? eq.warrantyExpiration.slice(0, 10) : null,
        manufacturerLabel: eq.manufacturer,
      },
    })
  }, [eq, warrantyRecords])

  const replacementReadiness = useMemo(() => {
    if (!eq || !warrantyEval) return null
    return evaluateReplacementReadiness({
      installDateYmd: eq.installDate?.trim() ? eq.installDate.slice(0, 10) : null,
      equipmentStatus: eq.status,
      warranty: warrantyEval,
      workOrders: workOrders.map((w) => ({
        created_at: w.created_at,
        completed_at: w.completed_at,
        status: w.status,
      })),
      equipmentNextDueYmd: eq.nextDueDate?.trim() ? eq.nextDueDate.slice(0, 10) : null,
      maintenancePlans: plans.map((p) => ({
        status: p.status,
        next_due_date: p.next_due_date,
      })),
    })
  }, [eq, warrantyEval, workOrders, plans])

  const warrantyDays = eq ? daysToDue(eq.warrantyExpiration) : 9999
  const warrantyHasDate = Boolean(eq?.warrantyExpiration?.trim())
  const warrantyKpi = warrantyEval ? formatWarrantyCoverageLabel(warrantyEval.label) : eq ? warrantyKpiLabel(warrantyDays, warrantyHasDate) : "—"
  const warrantySub = !eq
    ? ""
    : warrantyEval?.endDate
      ? `${warrantyEval.provider ? `${warrantyEval.provider} · ` : ""}Ends ${fmtDate(warrantyEval.endDate)}`
    : !warrantyHasDate
      ? "No warranty coverage on file"
      : warrantyDays < 0
        ? `Expired ${fmtDate(eq.warrantyExpiration)}`
        : `Ends ${fmtDate(eq.warrantyExpiration)}`
  const warrantyKpiWarn = Boolean(warrantyEval?.label === "expiring_soon")

  const equipmentLifecycleEvents = useMemo(() => {
    if (!eq) return []
    return buildEquipmentLifecycleTimeline(
      {
        installDate: eq.installDate,
        warrantyExpires: eq.warrantyExpiration,
        nextDueAt: eq.nextDueDate,
        nextCalibrationDueAt: eq.nextCalibrationDue,
      },
      workOrders.map((w) => ({
        id: w.id,
        created_at: w.created_at,
        completed_at: w.completed_at,
        title: w.title,
        type: w.type,
        status: w.status,
        work_order_number: w.work_order_number,
        maintenance_plan_id: w.maintenance_plan_id,
        total_parts_cents: w.total_parts_cents,
        total_labor_cents: w.total_labor_cents,
        technicianLabel: w.assigned_technician_id ? techProfiles[w.assigned_technician_id] ?? null : null,
      })),
      invoiceRows.map((inv) => ({
        id: inv.id,
        issued_at: inv.issued_at,
        title: inv.title ?? "",
        status: inv.status,
        amount_cents: inv.amount_cents,
        invoice_number: inv.invoice_number,
      })),
      certificateLines.map((c) => ({
        id: c.id,
        created_at: c.created_at,
        templateName: c.templateName,
        workOrderLabel: c.workOrderLabel,
      })),
      plans.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        next_due_date: p.next_due_date,
      })),
    )
  }, [eq, workOrders, techProfiles, invoiceRows, certificateLines, plans])

  const historyEvents = useMemo<EquipmentHistoryEvent[]>(() => {
    if (!eq) return []
    const events: EquipmentHistoryEvent[] = []
    const woById = new Map(workOrders.map((wo) => [wo.id, wo]))
    const todayYmd = new Date().toISOString().slice(0, 10)

    if (eq.installDate?.trim()) {
      events.push({
        id: "equipment-install",
        category: "maintenance",
        at: eq.installDate,
        title: "Equipment installed / recorded",
        description: [eq.manufacturer, eq.location].filter(Boolean).join(" · ") || undefined,
        sourceType: "Equipment",
        sourceId: eq.id,
      })
    }

    if (eq.notes?.trim()) {
      events.push({
        id: "equipment-notes",
        category: "notes",
        at: eq.installDate || workOrders[0]?.created_at || new Date().toISOString(),
        title: "Equipment notes",
        description: eq.notes.trim(),
        sourceType: "Equipment",
        sourceId: eq.id,
      })
    }

    if (eq.warrantyExpiration?.trim()) {
      const ymd = eq.warrantyExpiration.slice(0, 10)
      events.push({
        id: "equipment-warranty",
        category: "warranty",
        at: ymd,
        title: ymd < todayYmd ? "Warranty expired" : "Warranty expiration scheduled",
        description: ymd < todayYmd ? "Coverage period has ended." : "Coverage remains active until this date.",
        status: warrantyKpi,
        sourceType: "Equipment",
        sourceId: eq.id,
      })
    }

    for (const wo of workOrders) {
      const woLabel = formatWorkOrderDisplay(wo.work_order_number, wo.id)
      const technicianLabel = wo.assigned_technician_id ? techProfiles[wo.assigned_technician_id] ?? null : null
      events.push({
        id: `wo-${wo.id}-created`,
        category: "service",
        at: wo.created_at,
        title: "Work order created",
        description: wo.title,
        status: woDbStatusLabel(wo.status),
        href: `/work-orders?open=${encodeURIComponent(wo.id)}`,
        sourceType: "Work order",
        sourceId: wo.id,
        workOrderLabel: woLabel,
        technicianLabel,
      })

      if (wo.scheduled_on?.trim()) {
        events.push({
          id: `wo-${wo.id}-scheduled`,
          category: "service",
          at: wo.scheduled_on,
          title: "Service scheduled",
          description: wo.title,
          status: woDbTypeLabel(wo.type),
          href: `/work-orders?open=${encodeURIComponent(wo.id)}`,
          sourceType: "Work order",
          sourceId: wo.id,
          workOrderLabel: woLabel,
          technicianLabel,
        })
      }

      if (technicianLabel) {
        events.push({
          id: `wo-${wo.id}-assigned`,
          category: "service",
          at: wo.scheduled_on || wo.created_at,
          title: "Technician assigned",
          description: wo.title,
          href: `/work-orders?open=${encodeURIComponent(wo.id)}`,
          sourceType: "Work order",
          sourceId: wo.id,
          workOrderLabel: woLabel,
          technicianLabel,
        })
      }

      if (wo.completed_at) {
        events.push({
          id: `wo-${wo.id}-completed`,
          category: "service",
          at: wo.completed_at,
          title: "Service completed",
          description: wo.title,
          status: woDbStatusLabel(wo.status),
          href: `/work-orders?open=${encodeURIComponent(wo.id)}`,
          sourceType: "Work order",
          sourceId: wo.id,
          workOrderLabel: woLabel,
          technicianLabel,
        })
      }
    }

    for (const cert of certificateLines) {
      const wo = cert.workOrderId ? woById.get(cert.workOrderId) : undefined
      events.push({
        id: `cert-${cert.id}`,
        category: "calibration",
        at: cert.created_at,
        title: "Calibration / certificate created",
        description: [cert.templateName?.trim() || "Certificate", cert.workOrderLabel?.trim()].filter(Boolean).join(" · "),
        href: cert.workOrderId ? `/work-orders?open=${encodeURIComponent(cert.workOrderId)}&tab=certificates` : undefined,
        sourceType: "Calibration record",
        sourceId: cert.id,
        workOrderLabel: cert.workOrderLabel,
        technicianLabel: wo?.assigned_technician_id ? techProfiles[wo.assigned_technician_id] ?? null : null,
      })
    }

    for (const upload of certificateAttachmentRows) {
      const wo = woById.get(upload.work_order_id)
      events.push({
        id: `cert-upload-${upload.id}`,
        category: "documents",
        at: upload.uploaded_at,
        title: "Certificate uploaded",
        description: upload.file_name,
        href: `/work-orders?open=${encodeURIComponent(upload.work_order_id)}&tab=certificates`,
        sourceType: "Certificate attachment",
        sourceId: upload.id,
        workOrderLabel: wo ? formatWorkOrderDisplay(wo.work_order_number, wo.id) : null,
        technicianLabel: wo?.assigned_technician_id ? techProfiles[wo.assigned_technician_id] ?? null : null,
      })
    }

    for (const doc of documentRows) {
      const docMetadata =
        doc.metadata_json && typeof doc.metadata_json === "object" && !Array.isArray(doc.metadata_json)
          ? (doc.metadata_json as Record<string, unknown>)
          : {}
      if (typeof docMetadata.certificate_attachment_id === "string") continue
      const relatedWo =
        doc.related_entity_type === "work_order"
          ? woById.get(doc.related_entity_id)
          : doc.related_entity_type === "calibration_record"
            ? woById.get(certificateLines.find((cert) => cert.id === doc.related_entity_id)?.workOrderId ?? "")
            : undefined
      events.push({
        id: `doc-${doc.id}`,
        category: "documents",
        at: doc.uploaded_at,
        title: "Attachment uploaded",
        description: doc.file_name,
        status: doc.portal_release_status?.replace(/_/g, " "),
        href: relatedWo ? `/work-orders?open=${encodeURIComponent(relatedWo.id)}&tab=attachments` : undefined,
        sourceType: doc.related_entity_type.replace(/_/g, " "),
        sourceId: doc.related_entity_id,
        workOrderLabel: relatedWo ? formatWorkOrderDisplay(relatedWo.work_order_number, relatedWo.id) : null,
      })
    }

    for (const inv of invoiceRows) {
      const linkedWo = inv.linked_work_order_ids?.[0] ? woById.get(inv.linked_work_order_ids[0]) : undefined
      events.push({
        id: `invoice-${inv.id}`,
        category: "billing",
        at: inv.issued_at || new Date().toISOString(),
        title: "Invoice created / linked",
        description: [inv.invoice_number?.trim() || inv.title?.trim() || "Invoice", inv.amount_cents != null ? fmtCurrency(inv.amount_cents / 100) : null]
          .filter(Boolean)
          .join(" · "),
        status: invoiceUiStatus(inv.status),
        href: `/invoices?open=${encodeURIComponent(inv.id)}`,
        sourceType: "Invoice",
        sourceId: inv.id,
        workOrderLabel: linkedWo ? formatWorkOrderDisplay(linkedWo.work_order_number, linkedWo.id) : null,
      })
    }

    for (const plan of plans) {
      events.push({
        id: `plan-${plan.id}`,
        category: "maintenance",
        at: plan.next_due_date || new Date().toISOString(),
        title: plan.next_due_date && plan.next_due_date.slice(0, 10) < todayYmd ? "Maintenance due / overdue" : "Maintenance plan due",
        description: `${plan.name} · ${eqPlanIntervalLabel(plan)}`,
        status: planStatusDbToUi(plan.status),
        href: `/maintenance-plans?open=${encodeURIComponent(plan.id)}`,
        sourceType: "Maintenance plan",
        sourceId: plan.id,
      })
    }

    return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [eq, workOrders, techProfiles, warrantyKpi, certificateLines, certificateAttachmentRows, documentRows, invoiceRows, plans])

  const lastServiceDate = useMemo(() => {
    const dates = [
      ...(eq?.lastServiceDate ? [eq.lastServiceDate] : []),
      ...workOrders.map((wo) => wo.completed_at).filter((date): date is string => Boolean(date)),
    ]
    return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? ""
  }, [eq?.lastServiceDate, workOrders])

  const lastCalibrationDate = useMemo(() => {
    return certificateLines
      .map((cert) => cert.created_at)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? ""
  }, [certificateLines])

  const nextDueDate = useMemo(() => {
    const candidates = [
      eq?.nextDueDate,
      eq?.nextCalibrationDue,
      ...plans.map((plan) => plan.next_due_date),
    ].filter((date): date is string => Boolean(date?.trim()))
    return candidates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? ""
  }, [eq?.nextCalibrationDue, eq?.nextDueDate, plans])

  const invoicedRevenueCents = useMemo(() => sumInvoiceAmountCents(invoiceRows), [invoiceRows])

  const technicianRollup = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of workOrders) {
      const tid = w.assigned_technician_id
      if (!tid) continue
      const label = techProfiles[tid] ?? "Technician"
      m.set(label, (m.get(label) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [workOrders, techProfiles])

  const totalServiceCost = useMemo(
    () => workOrders.reduce((s, w) => s + ((w.total_labor_cents ?? 0) + (w.total_parts_cents ?? 0)) / 100, 0),
    [workOrders],
  )

  function invoiceUiStatus(db: string | null): string {
    if (!db) return "—"
    const x = db.toLowerCase()
    if (x === "paid" || x === "sent" || x === "draft" || x === "void" || x === "overdue") {
      return db.charAt(0).toUpperCase() + db.slice(1).toLowerCase()
    }
    return db.replace(/_/g, " ")
  }

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

  async function handleDeleteWarranty(warrantyId: string) {
    if (!activeOrg.organizationId) return
    if (!globalThis.confirm("Remove this warranty record from the asset?")) return
    const res = await fetch(
      `/api/organizations/${encodeURIComponent(activeOrg.organizationId)}/equipment-warranties/${encodeURIComponent(warrantyId)}`,
      { method: "DELETE" },
    )
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      globalThis.alert(j.error ?? "Could not remove warranty.")
      return
    }
    setWarrantyRefreshToken((n) => n + 1)
  }

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
              {serviceSiteSummary ?
                <p className="text-xs text-muted-foreground mt-1.5 leading-snug max-w-2xl">{serviceSiteSummary}</p>
              : null}
              <Badge variant="secondary" className={cn("text-xs border mt-3", STATUS_COLORS[eq.status])}>
                {eq.status}
              </Badge>
              <EquipmentSignalsRow signals={signals} size="md" className="mt-3" />
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button size="sm" variant="outline" asChild>
                <Link href={`/equipment?open=${encodeURIComponent(eq.id)}`} className="gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" /> Drawer
                </Link>
              </Button>
            </div>
          </div>

          {canManageEquipmentRecords ? (
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
                  <CalendarPlus className="w-3.5 h-3.5" /> New maintenance plan
                </Link>
              </Button>
            </div>
          </div>
          ) : (
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Technician access is read-only for equipment management. Open assigned work orders to update job workflow details.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {(
          [
            {
              label: "Total WOs",
              value: String(workOrders.length),
              sub: `${completedCount} completed`,
              warn: false,
            },
            {
              label: "Last service",
              value: lastServiceDate ? fmtDate(lastServiceDate.slice(0, 10)) : "—",
              sub: lastServiceDate ? "most recent completion" : "No completed service",
              warn: false,
            },
            {
              label: "Last calibration",
              value: lastCalibrationDate ? fmtDate(lastCalibrationDate.slice(0, 10)) : "—",
              sub: `${certificateLines.length} certificate${certificateLines.length === 1 ? "" : "s"}`,
              warn: false,
            },
            {
              label: "Next due",
              value: nextDueDate ? fmtDate(nextDueDate.slice(0, 10)) : "—",
              sub: nextDueDate && daysToDue(nextDueDate.slice(0, 10)) < 0 ? "overdue" : "service/cal/PM",
              warn: Boolean(nextDueDate && daysToDue(nextDueDate.slice(0, 10)) < 0),
            },
            {
              label: "Open issues",
              value: String(openWOs.length),
              sub: "not completed",
              warn: openWOs.length > 0,
            },
            {
              label: "Warranty status",
              value: warrantyKpi,
              sub: warrantySub,
              warn: warrantyKpiWarn,
            },
          ] as const
        ).map(({ label, value, sub, warn }) => (
          <div
            key={label}
            className="bg-card rounded-xl border border-border p-4 flex flex-col gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-h-[100px]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={cn("text-xl font-bold tracking-tight leading-tight", warn ? "text-[color:var(--status-warning)]" : "text-foreground")}>
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
          <TabsTrigger value="history" className="text-xs sm:text-sm gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> History ({historyEvents.length})
          </TabsTrigger>
          <TabsTrigger value="service" className="text-xs sm:text-sm gap-1.5">
            <Wrench className="w-3.5 h-3.5" /> Service ({workOrders.length})
          </TabsTrigger>
          {!assignedOnlyView ? (
            <TabsTrigger value="plans" className="text-xs sm:text-sm gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Plans ({plans.length})
            </TabsTrigger>
          ) : null}
          {canViewEquipmentFinancials ? (
            <TabsTrigger value="quotes" className="text-xs sm:text-sm gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Quotes
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="warranty" className="text-xs sm:text-sm gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Warranty
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs sm:text-sm gap-1.5">
            <StickyNote className="w-3.5 h-3.5" /> Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          <ServiceLifecycleTimeline title="Equipment timeline" events={equipmentLifecycleEvents} />

          {equipmentContractEval ?
            <Card className="border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <CardContent className="p-5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Service contract coverage
                  </p>
                  {equipmentContractEval.contractName ?
                    <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                      {equipmentContractEval.contractName}
                    </p>
                  : <p className="text-sm text-muted-foreground mt-0.5">No active scoped contract for this asset.</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on active agreements for this customer, site, and equipment. SLA clock is illustrative for
                    open work.
                  </p>
                </div>
                <SlaCoverageBadge label={equipmentContractEval.label} />
              </CardContent>
            </Card>
          : null}

          {warrantyEval ?
            <Card className="border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <CardContent className="p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Manufacturer / asset warranty
                    </p>
                    <p className="text-sm text-foreground mt-0.5">
                      {warrantyEval.provider ?? "No provider on file"}
                      {warrantyEval.referenceNumber ? ` · Ref ${warrantyEval.referenceNumber}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Records override equipment warranty dates when active. Operational view only — not a claims
                      system.
                    </p>
                    {warrantyRecordsError ?
                      <p className="text-xs text-destructive mt-2">{warrantyRecordsError}</p>
                    : null}
                  </div>
                  <WarrantyCoverageBadge label={warrantyEval.label} />
                </div>
                {canManageEquipmentWarranties ?
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => {
                        setWarrantyEdit(null)
                        setWarrantyFormOpen(true)
                      }}
                    >
                      Add warranty record
                    </Button>
                  </div>
                : null}
                {warrantyRecords.length > 0 ?
                  <ul className="text-xs space-y-2 border-t border-border pt-3">
                    {warrantyRecords.slice(0, 4).map((w) => (
                      <li key={w.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          <span className="font-medium text-foreground">{w.warranty_provider}</span>
                          {" · "}
                          {w.end_date.slice(0, 10)}
                          {w.status !== "active" ? ` · ${w.status}` : ""}
                        </span>
                        {canManageEquipmentWarranties ?
                          <span className="flex gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] px-2"
                              onClick={() => {
                                setWarrantyEdit(w)
                                setWarrantyFormOpen(true)
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] px-2 text-destructive"
                              onClick={() => void handleDeleteWarranty(w.id)}
                            >
                              Remove
                            </Button>
                          </span>
                        : null}
                      </li>
                    ))}
                  </ul>
                : !warrantyRecordsError ?
                  <p className="text-xs text-muted-foreground border-t border-border pt-3">
                    No structured warranty records yet — asset warranty dates on the Warranty tab still apply when
                    present.
                  </p>
                : null}
              </CardContent>
            </Card>
          : null}

          <div className="grid md:grid-cols-2 gap-4">
            {canViewEquipmentFinancials ? (
            <Card className="border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[color:var(--status-info)]" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue (invoiced)</p>
                </div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{fmtCurrency(invoicedRevenueCents / 100)}</p>
                <p className="text-xs text-muted-foreground leading-snug">
                  Sum of invoice totals linked to this asset. Repair vs PM breakdown uses work order type on the Service tab.
                </p>
              </CardContent>
            </Card>
            ) : null}
            <Card className="border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Technician familiarity</p>
                </div>
                {technicianRollup.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No assigned technician history on work orders yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {technicianRollup.slice(0, 6).map(([name, count]) => (
                      <li key={name} className="flex justify-between text-sm gap-2">
                        <span className="text-foreground truncate">{name}</span>
                        <span className="text-muted-foreground tabular-nums shrink-0">{count} WO{count === 1 ? "" : "s"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {equipmentPmForecast && plans.length > 0 ? (
            <MaintenanceForecastPanel
              variant="compact"
              summary={equipmentPmForecast}
              contractHint={equipmentPmContractHint}
              replacementHintSlot={
                replacementReadiness ?
                  <div className="border-t border-border pt-2 mt-2 space-y-1">
                    <p className="text-[10px] font-semibold text-foreground flex flex-wrap items-center gap-2">
                      <span>Replacement readiness</span>
                      <ReplacementReadinessBadge label={replacementReadiness.label} className="normal-case" />
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      {replacementReadiness.reasons.slice(0, 2).join(" · ")}
                    </p>
                  </div>
                : null
              }
            />
          ) : null}

          {replacementReadiness ?
            <ReplacementReadinessPanel result={replacementReadiness} variant="card" />
          : null}

          <Card className="border-border">
            <CardContent className="p-5 space-y-0">
              <DrawerSection title="Compliance & maintenance">
                <DrawerRow
                  label="Calibration due"
                  value={
                    eq.nextCalibrationDue?.trim()
                      ? `${fmtDate(eq.nextCalibrationDue)}${daysToDue(eq.nextCalibrationDue) < 0 ? " · Overdue" : ""}`
                      : "—"
                  }
                />
                <DrawerRow
                  label="Calibration interval"
                  value={
                    eq.calibrationIntervalMonths != null && eq.calibrationIntervalMonths > 0
                      ? `${eq.calibrationIntervalMonths} months`
                      : "—"
                  }
                />
                <DrawerRow label="Certificates on file" value={String(certificateLines.length)} />
              </DrawerSection>
            </CardContent>
          </Card>

          {canViewEquipmentFinancials && invoiceRows.length > 0 ? (
            <Card className="border-border">
              <CardContent className="p-5 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Invoices</p>
                <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {invoiceRows.slice(0, 8).map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/invoices?open=${encodeURIComponent(inv.id)}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors"
                    >
                      <span className="font-medium text-foreground truncate">
                        {inv.invoice_number?.trim() || inv.title?.trim() || "Invoice"}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {inv.amount_cents != null ? fmtCurrency(inv.amount_cents / 100) : "—"} · {invoiceUiStatus(inv.status)}
                      </span>
                    </Link>
                  ))}
                </div>
                {invoiceRows.length > 8 ? (
                  <p className="text-[10px] text-muted-foreground">Showing 8 of {invoiceRows.length} invoices.</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border">
            <CardContent className="p-5 space-y-0">
              <DrawerSection title="Equipment">
                <DrawerRow label="Customer" value={<Link href={`/customers/${eq.customerId}`} className="text-primary hover:underline">{eq.customerName}</Link>} />
                <DrawerRow label="Serial" value={eq.serialNumber || "—"} />
                <DrawerRow
                  label="Category"
                  value={
                    [eq.category?.trim(), eq.subcategory?.trim()].filter(Boolean).join(" › ") || "—"
                  }
                />
                <DrawerRow label="Manufacturer" value={eq.manufacturer?.trim() || "—"} />
                <DrawerRow label="Location" value={eq.location || "—"} />
              </DrawerSection>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <EquipmentHistoryTimeline
            events={historyEvents}
            filter={historyFilter}
            onFilterChange={setHistoryFilter}
          />
        </TabsContent>

        <TabsContent value="service" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total events", value: workOrders.length },
              { label: "Repairs", value: workOrders.filter((w) => (w.type ?? "").toLowerCase() === "repair").length },
              ...(canViewEquipmentFinancials ? [{ label: "Total cost", value: fmtCurrency(totalServiceCost) }] : []),
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
          <RecentCommunicationsCard
            entityType="equipment"
            entityId={eq.id}
            customerId={eq.customerId}
            limit={4}
            title="Recent communications"
            description="Service confirmations, certificate releases, and automation runs tied to this asset."
          />
        </TabsContent>

        <TabsContent value="plans" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" asChild>
              <Link href={planNew} className="gap-1.5">
                <CalendarPlus className="w-3.5 h-3.5" /> New plan
              </Link>
            </Button>
          </div>
          {equipmentPmForecast && plans.length > 0 ? (
            <MaintenanceForecastPanel
              variant="compact"
              summary={equipmentPmForecast}
              contractHint={equipmentPmContractHint}
              replacementHintSlot={
                replacementReadiness ?
                  <div className="border-t border-border pt-2 mt-2 space-y-1">
                    <p className="text-[10px] font-semibold text-foreground flex flex-wrap items-center gap-2">
                      <span>Replacement readiness</span>
                      <ReplacementReadinessBadge label={replacementReadiness.label} className="normal-case" />
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      {replacementReadiness.reasons.slice(0, 2).join(" · ")}
                    </p>
                  </div>
                : null
              }
            />
          ) : null}
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

        <TabsContent value="warranty" className="mt-4 space-y-4">
          <Card className="border-border">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Effective coverage</p>
                {warrantyEval ? <WarrantyCoverageBadge label={warrantyEval.label} /> : null}
              </div>
              <DrawerSection title="Asset warranty dates (equipment profile)">
                <DrawerRow
                  label="Warranty start"
                  value={eq.warrantyStartDate?.trim() ? fmtDate(eq.warrantyStartDate) : "—"}
                />
                <DrawerRow label="Expiration" value={warrantyHasDate ? fmtDate(eq.warrantyExpiration) : "—"} />
                <DrawerRow
                  label="Profile status"
                  value={
                    !warrantyHasDate ? "Unknown" : warrantyDays < 0 ? "Expired" : warrantyDays <= 90 ? "Expiring soon" : "Active"
                  }
                />
                <DrawerRow label="Installed" value={fmtDate(eq.installDate)} />
              </DrawerSection>
              {warrantyRecordsError ?
                <p className="text-xs text-destructive">{warrantyRecordsError}</p>
              : null}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Warranty records</p>
                {canManageEquipmentWarranties ?
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      setWarrantyEdit(null)
                      setWarrantyFormOpen(true)
                    }}
                  >
                    Add record
                  </Button>
                : null}
              </div>
              {warrantyRecords.length === 0 ?
                <p className="text-xs text-muted-foreground">No structured warranty records for this asset.</p>
              : (
                <ul className="space-y-3">
                  {warrantyRecords.map((w) => (
                    <li
                      key={w.id}
                      className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium text-foreground">{w.warranty_provider}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {w.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">
                        {w.start_date ? `${w.start_date.slice(0, 10)} → ` : ""}
                        {w.end_date.slice(0, 10)}
                        {w.reference_number ? ` · Ref ${w.reference_number}` : ""}
                      </p>
                      {w.coverage_summary ?
                        <p className="text-muted-foreground">{w.coverage_summary}</p>
                      : null}
                      {canManageEquipmentWarranties ?
                        <div className="flex gap-2 pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={() => {
                              setWarrantyEdit(w)
                              setWarrantyFormOpen(true)
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] text-destructive"
                            onClick={() => void handleDeleteWarranty(w.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      : null}
                    </li>
                  ))}
                </ul>
              )}
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

      {activeOrg.organizationId ?
        <EquipmentWarrantyFormDialog
          open={warrantyFormOpen}
          onOpenChange={(v) => {
            setWarrantyFormOpen(v)
            if (!v) setWarrantyEdit(null)
          }}
          organizationId={activeOrg.organizationId}
          equipmentId={eq.id}
          existing={warrantyEdit}
          onSaved={() => setWarrantyRefreshToken((n) => n + 1)}
        />
      : null}
    </div>
  )
}
