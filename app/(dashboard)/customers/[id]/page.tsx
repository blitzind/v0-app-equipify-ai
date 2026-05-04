"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import type { Equipment, EquipmentStatus } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  MapPin,
  Phone,
  Mail,
  FileText,
  Wrench,
  Calendar,
  ChevronLeft,
  ExternalLink,
  Loader2,
  Activity,
  CheckCircle2,
  DollarSign,
  ClipboardList,
  Plus,
  Package,
} from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { formatWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { WO_LIST_SELECT, WO_LIST_SELECT_WITH_NUM } from "@/lib/work-orders/supabase-select"
import { getEquipmentDisplayPrimary, getEquipmentSecondaryLine } from "@/lib/equipment/display"
import { intervalFromDb, planStatusDbToUi } from "@/lib/maintenance-plans/db-map"
import type { MaintenancePlanRow } from "@/lib/maintenance-plans/db-map"
import { MaintenancePlansBrandTile } from "@/lib/navigation/module-icons"

type CustomerStatus = "Active" | "Inactive"

type CustomerOverviewKpi =
  | {
      label: string
      value: string
      sub: string
      icon: ComponentType<{ className?: string }>
      accent: string
      bg: string
    }
  | {
      label: string
      value: string
      sub: string
      kpiVariant: "maintenance-plans"
    }

type CustomerContact = {
  id: string
  name: string
  firstName: string
  lastName: string
  role: string
  email: string
  phone: string
  isPrimary: boolean
}

type CustomerLocation = {
  id: string
  name: string
  address: string
  addressLine2: string
  city: string
  state: string
  zip: string
  phone: string
  contactPerson: string
  notes: string
  isDefault: boolean
}

type CustomerContract = {
  id: string
  name: string
  type: "PM Plan" | "Full Coverage" | "Labor Only" | "Parts & Labor"
  startDate: string
  endDate: string
  value: number
}

type CustomerDetail = {
  id: string
  organizationId: string
  company: string
  name: string
  status: CustomerStatus
  joinedDate: string
  openWorkOrders: number
  notes: string
  contacts: CustomerContact[]
  locations: CustomerLocation[]
  contracts: CustomerContract[]
}

type CustomerPlanRow = {
  id: string
  name: string
  status: string
  interval_value: number
  interval_unit: string
  next_due_date: string | null
  equipment_id: string | null
  created_at?: string
}

type CustomerPlanWoRow = {
  id: string
  work_order_number?: number | null
  title: string
  status: string
  type: string
  scheduled_on: string | null
  maintenance_plan_id: string | null
  created_at: string
}

function planIntervalLabel(row: CustomerPlanRow): string {
  const u = row.interval_unit as MaintenancePlanRow["interval_unit"]
  const { interval, customIntervalDays } = intervalFromDb(row.interval_value, u)
  return interval === "Custom" ? `${customIntervalDays} day cycle` : interval
}

function planEquipmentSubtitle(
  row: CustomerPlanRow,
  equipmentNames: Record<string, string>
): string {
  if (!row.equipment_id) return "No equipment attached"
  return equipmentNames[row.equipment_id] ?? "Equipment"
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

function fmtIsoDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

const statusColors: Record<Equipment["status"], string> = {
  "Active": "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Needs Service": "bg-[color:var(--status-warning)]/15 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Out of Service": "bg-destructive/15 text-destructive border-destructive/30",
  "In Repair": "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
}

function fmtCurrencyCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100,
  )
}

function equipmentRowToUi(row: {
  id: string
  customer_id: string
  equipment_code: string | null
  name: string
  manufacturer: string | null
  category: string | null
  serial_number: string | null
  status: string
  next_due_at: string | null
  location_label: string | null
  install_date: string | null
  warranty_expires_at: string | null
  last_service_at: string | null
  notes: string | null
}, customerName: string): Equipment {
  const statusMap: Record<string, EquipmentStatus> = {
    active: "Active",
    needs_service: "Needs Service",
    out_of_service: "Out of Service",
    in_repair: "In Repair",
  }
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
    status: statusMap[row.status] ?? "Active",
    notes: row.notes ?? "",
    location: row.location_label ?? "",
    photos: [],
    manuals: [],
    serviceHistory: [],
  }
}

type CustomerWoListRow = {
  id: string
  work_order_number?: number | null
  title: string
  status: string
  type: string
  created_at: string
  completed_at: string | null
  total_labor_cents: number
  total_parts_cents: number
}

type ActivityEntry = {
  key: string
  at: string
  title: string
  subtitle: string
  href: string
  icon: "wo_created" | "wo_completed" | "equipment" | "plan"
}

function ActivityTimeline({ items }: { items: ActivityEntry[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No recent activity yet.</p>
  }

  return (
    <div className="relative pl-6">
      {items.map((item, i) => (
        <div key={item.key} className="relative mb-5 last:mb-0">
          {i < items.length - 1 && <div className="absolute left-[-18px] top-5 bottom-[-20px] w-px bg-border" />}
          <div className="absolute left-[-22px] top-0.5 flex items-center justify-center w-8 h-8 rounded-full bg-card border border-border">
            {item.icon === "wo_created" && <ClipboardList className="w-3.5 h-3.5 text-primary" />}
            {item.icon === "wo_completed" && <CheckCircle2 className="w-3.5 h-3.5 text-[color:var(--status-success)]" />}
            {item.icon === "equipment" && <Package className="w-3.5 h-3.5 text-[color:var(--status-info)]" />}
            {item.icon === "plan" && (
              <span className="flex items-center justify-center scale-95">
                <MaintenancePlansBrandTile size="xs" />
              </span>
            )}
          </div>
          <Link href={item.href} className="block group">
            <div className="bg-card/80 border border-border rounded-xl p-4 hover:border-primary/35 hover:bg-muted/20 transition-all">
              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.subtitle}</p>
              <p className="text-[10px] text-muted-foreground/80 mt-2 font-medium uppercase tracking-wide">
                {new Date(item.at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </Link>
        </div>
      ))}
    </div>
  )
}

function EquipmentRow({ eq, customerName }: { eq: Equipment; customerName?: string }) {
  const daysToDue = Math.ceil(
    (new Date(eq.nextDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  const dueSoon = daysToDue >= 0 && daysToDue <= 14

  return (
    <Link href={`/equipment/${eq.id}`}>
      <div className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/20 transition-all group cursor-pointer">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
          <Wrench className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
              {getEquipmentDisplayPrimary({
                id: eq.id,
                name: eq.model,
                equipment_code: eq.equipmentCode,
                serial_number: eq.serialNumber,
                category: eq.category,
              })}
            </p>
            <Badge variant="secondary" className={cn("text-xs shrink-0", statusColors[eq.status])}>
              {eq.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {getEquipmentSecondaryLine(
              {
                id: eq.id,
                name: eq.model,
                equipment_code: eq.equipmentCode,
                serial_number: eq.serialNumber,
                category: eq.category,
              },
              customerName,
            )}
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end text-right shrink-0">
          <p className={cn("text-xs font-medium", dueSoon ? "text-[color:var(--status-warning)]" : "text-muted-foreground")}>
            {daysToDue < 0 ? "Overdue" : daysToDue === 0 ? "Due today" : `Due in ${daysToDue}d`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{eq.location}</p>
        </div>
        <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </Link>
  )
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshToken, setRefreshToken] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [actionError, setActionError] = useState("")
  const [editForm, setEditForm] = useState({
    company: "",
    status: "Active" as CustomerStatus,
    notes: "",
  })
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [locationSaving, setLocationSaving] = useState(false)
  const [locationError, setLocationError] = useState("")
  const [locationForm, setLocationForm] = useState({
    name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    phone: "",
    contact_person: "",
    notes: "",
    is_default: false,
  })
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [contactSaving, setContactSaving] = useState(false)
  const [contactError, setContactError] = useState("")
  const [contactForm, setContactForm] = useState({
    full_name: "",
    first_name: "",
    last_name: "",
    role: "",
    email: "",
    phone: "",
    is_primary: false,
  })

  const [customerPlans, setCustomerPlans] = useState<CustomerPlanRow[]>([])
  const [planEquipmentNames, setPlanEquipmentNames] = useState<Record<string, string>>({})
  const [planLinkedWOs, setPlanLinkedWOs] = useState<CustomerPlanWoRow[]>([])
  const [plansSectionLoading, setPlansSectionLoading] = useState(false)

  const [customerEquipment, setCustomerEquipment] = useState<Equipment[]>([])
  const [customerWorkOrders, setCustomerWorkOrders] = useState<CustomerWoListRow[]>([])
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [lifetimeRevenueCents, setLifetimeRevenueCents] = useState(0)
  const [equipmentCreatedAt, setEquipmentCreatedAt] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    let active = true

    async function loadCustomer() {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (active) {
          setCustomer(null)
          setLoading(false)
        }
        return
      }

      if (orgStatus !== "ready" || !activeOrgId) {
        if (active) {
          setCustomer(null)
          setLoading(false)
        }
        return
      }

      const orgId = activeOrgId

      const { data: customerRow, error: customerError } = await supabase
        .from("customers")
        .select("id, company_name, status, joined_at, notes")
        .eq("id", id)
        .eq("organization_id", orgId)
        .single()

      if (customerError || !customerRow) {
        if (active) {
          setCustomer(null)
          setLoading(false)
        }
        return
      }

      const [{ data: contactsRows }, { data: locationsRows }, { data: contractRows }] =
        await Promise.all([
          supabase
            .from("customer_contacts")
            .select("id, full_name, first_name, last_name, role, email, phone, is_primary")
            .eq("customer_id", id)
            .eq("organization_id", orgId)
            .eq("is_archived", false)
            .order("is_primary", { ascending: false }),
          supabase
            .from("customer_locations")
            .select("id, name, address_line1, address_line2, city, state, postal_code, phone, contact_person, notes, is_default")
            .eq("customer_id", id)
            .eq("organization_id", orgId)
            .eq("is_archived", false),
          supabase
            .from("customer_contracts")
            .select("id, name, contract_type, start_date, end_date, value_cents")
            .eq("customer_id", id)
            .eq("organization_id", orgId),
        ])

      type ContactRow = {
        id: string
        full_name: string | null
        first_name: string | null
        last_name: string | null
        role: string | null
        email: string | null
        phone: string | null
        is_primary: boolean | null
      }
      type LocationRow = {
        id: string
        name: string
        address_line1: string
        address_line2: string | null
        city: string
        state: string
        postal_code: string
        phone: string | null
        contact_person: string | null
        notes: string | null
        is_default: boolean | null
      }
      type ContractRow = {
        id: string
        name: string | null
        contract_type: string | null
        start_date: string | null
        end_date: string | null
        value_cents: number | null
      }

      const contactsTyped = (contactsRows ?? []) as ContactRow[]
      const locationsTyped = (locationsRows ?? []) as LocationRow[]
      const contractsTyped = (contractRows ?? []) as ContractRow[]

      const mapped: CustomerDetail = {
        id: customerRow.id,
        organizationId: orgId,
        company: customerRow.company_name,
        name: contactsRows?.[0]?.full_name ?? customerRow.company_name,
        status: customerRow.status === "inactive" ? "Inactive" : "Active",
        joinedDate: customerRow.joined_at ?? new Date().toISOString().slice(0, 10),
        openWorkOrders: 0,
        notes: customerRow.notes ?? "",
        contacts: contactsTyped.map((c) => ({
          id: c.id,
          name: c.full_name ?? "Unknown",
          firstName: c.first_name ?? "",
          lastName: c.last_name ?? "",
          role: c.role ?? "Contact",
          email: c.email ?? "",
          phone: c.phone ?? "",
          isPrimary: Boolean(c.is_primary),
        })),
        locations: locationsTyped.map((l) => ({
          id: l.id,
          name: l.name,
          address: l.address_line1,
          addressLine2: l.address_line2 ?? "",
          city: l.city,
          state: l.state,
          zip: l.postal_code,
          phone: l.phone ?? "",
          contactPerson: l.contact_person ?? "",
          notes: l.notes ?? "",
          isDefault: Boolean(l.is_default),
        })),
        contracts: contractsTyped.map((contract) => ({
          id: contract.id,
          name: contract.name ?? "Contract",
          type: (contract.contract_type ?? "PM Plan") as CustomerContract["type"],
          startDate: contract.start_date ?? new Date().toISOString().slice(0, 10),
          endDate: contract.end_date ?? new Date().toISOString().slice(0, 10),
          value: Math.floor((contract.value_cents ?? 0) / 100),
        })),
      }

      if (active) {
        setCustomer(mapped)
        setEditForm({
          company: mapped.company,
          status: mapped.status,
          notes: mapped.notes,
        })
        setLoading(false)
      }
    }

    void loadCustomer()

    return () => {
      active = false
    }
  }, [id, refreshToken, orgStatus, activeOrgId])

  useEffect(() => {
    if (!customer) {
      setCustomerEquipment([])
      setCustomerWorkOrders([])
      setLifetimeRevenueCents(0)
      setEquipmentCreatedAt({})
      return
    }

    let active = true
    setMetricsLoading(true)
    const supabase = createBrowserSupabaseClient()

    void (async () => {
      const { data: eqRows, error: eqError } = await supabase
        .from("equipment")
        .select(
          "id, customer_id, equipment_code, name, manufacturer, category, serial_number, status, next_due_at, location_label, install_date, warranty_expires_at, last_service_at, notes, created_at",
        )
        .eq("organization_id", customer.organizationId)
        .eq("customer_id", customer.id)
        .eq("is_archived", false)
        .order("name", { ascending: true })

      if (!active) return

      let woRes = await supabase
        .from("work_orders")
        .select(WO_LIST_SELECT_WITH_NUM)
        .eq("organization_id", customer.organizationId)
        .eq("customer_id", customer.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(200)

      if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
        woRes = await supabase
          .from("work_orders")
          .select(WO_LIST_SELECT)
          .eq("organization_id", customer.organizationId)
          .eq("customer_id", customer.id)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
          .limit(200)
      }

      if (!active) return

      if (eqError) {
        setCustomerEquipment([])
        setEquipmentCreatedAt({})
      } else {
        const rows =
          (eqRows ?? []) as Array<
            Parameters<typeof equipmentRowToUi>[0] & { created_at: string }
          >
        const createdMap: Record<string, string> = {}
        const equipUi: Equipment[] = []
        for (const r of rows) {
          createdMap[r.id] = r.created_at
          const { created_at: _ca, ...rest } = r
          equipUi.push(equipmentRowToUi(rest, customer.company))
        }
        setCustomerEquipment(equipUi)
        setEquipmentCreatedAt(createdMap)
      }

      const wos = (woRes.data ?? []) as CustomerWoListRow[]
      setCustomerWorkOrders(wos)

      const revenue = wos
        .filter((w) => w.status === "completed" || w.status === "invoiced")
        .reduce((sum, w) => sum + (w.total_labor_cents ?? 0) + (w.total_parts_cents ?? 0), 0)
      setLifetimeRevenueCents(revenue)

      if (active) setMetricsLoading(false)
    })()

    return () => {
      active = false
    }
  }, [customer, refreshToken])

  useEffect(() => {
    if (!customer) return
    let active = true

    void (async () => {
      setPlansSectionLoading(true)
      const supabase = createBrowserSupabaseClient()

      const { data: planRows, error: planError } = await supabase
        .from("maintenance_plans")
        .select("id, name, status, interval_value, interval_unit, next_due_date, equipment_id, created_at")
        .eq("organization_id", customer.organizationId)
        .eq("customer_id", customer.id)
        .eq("is_archived", false)
        .order("next_due_date", { ascending: true, nullsFirst: false })

      if (!active) return

      if (planError) {
        setCustomerPlans([])
        setPlanEquipmentNames({})
        setPlanLinkedWOs([])
        setPlansSectionLoading(false)
        return
      }

      const plans = (planRows ?? []) as CustomerPlanRow[]
      setCustomerPlans(plans)

      const eqIds = [
        ...new Set(plans.map((p) => p.equipment_id).filter((id): id is string => Boolean(id))),
      ]
      const names: Record<string, string> = {}
      if (eqIds.length > 0) {
        const { data: eqRows } = await supabase
          .from("equipment")
          .select("id, name")
          .eq("organization_id", customer.organizationId)
          .in("id", eqIds)

        for (const r of (eqRows ?? []) as Array<{ id: string; name: string }>) {
          names[r.id] = r.name
        }
      }
      if (!active) return
      setPlanEquipmentNames(names)

      const planIds = plans.map((p) => p.id)
      if (planIds.length === 0) {
        setPlanLinkedWOs([])
        setPlansSectionLoading(false)
        return
      }

      const custPlanWoSelWithNum =
        "id, work_order_number, title, status, type, scheduled_on, maintenance_plan_id, created_at"
      const custPlanWoSel = custPlanWoSelWithNum.replace("work_order_number, ", "")

      let woRes = await supabase
        .from("work_orders")
        .select(custPlanWoSelWithNum)
        .eq("organization_id", customer.organizationId)
        .eq("customer_id", customer.id)
        .in("maintenance_plan_id", planIds)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(50)

      if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
        woRes = await supabase
          .from("work_orders")
          .select(custPlanWoSel)
          .eq("organization_id", customer.organizationId)
          .eq("customer_id", customer.id)
          .in("maintenance_plan_id", planIds)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
          .limit(50)
      }

      if (!active) return
      setPlanLinkedWOs((woRes.data ?? []) as CustomerPlanWoRow[])
      setPlansSectionLoading(false)
    })()

    return () => {
      active = false
    }
  }, [customer, refreshToken])

  const openWorkOrderCount = useMemo(
    () =>
      customerWorkOrders.filter((w) => w.status !== "completed" && w.status !== "invoiced").length,
    [customerWorkOrders],
  )

  const activityItems = useMemo((): ActivityEntry[] => {
    if (!customer) return []
    const out: ActivityEntry[] = []

    for (const wo of customerWorkOrders) {
      out.push({
        key: `wo-c-${wo.id}`,
        at: wo.created_at,
        title: `Work order ${formatWorkOrderDisplay(wo.work_order_number, wo.id)} created`,
        subtitle: `${wo.title} · ${woDbTypeLabel(wo.type)} · ${woDbStatusLabel(wo.status)}`,
        href: `/work-orders?open=${encodeURIComponent(wo.id)}`,
        icon: "wo_created",
      })
      if (wo.completed_at) {
        out.push({
          key: `wo-x-${wo.id}`,
          at: wo.completed_at,
          title: `Work order ${formatWorkOrderDisplay(wo.work_order_number, wo.id)} completed`,
          subtitle: wo.title,
          href: `/work-orders?open=${encodeURIComponent(wo.id)}`,
          icon: "wo_completed",
        })
      }
    }

    for (const eq of customerEquipment) {
      const cat = equipmentCreatedAt[eq.id]
      if (cat) {
        out.push({
          key: `eq-${eq.id}`,
          at: cat,
          title: `Equipment added: ${getEquipmentDisplayPrimary({
            id: eq.id,
            name: eq.model,
            equipment_code: eq.equipmentCode,
            serial_number: eq.serialNumber,
            category: eq.category,
          })}`,
          subtitle: `${customer.company} · ${eq.status}`,
          href: `/equipment?open=${encodeURIComponent(eq.id)}`,
          icon: "equipment",
        })
      }
    }

    for (const p of customerPlans) {
      if (!p.created_at) continue
      out.push({
        key: `plan-${p.id}`,
        at: p.created_at,
        title: `Maintenance plan: ${p.name}`,
        subtitle: `${planStatusDbToUi(p.status)} · ${planIntervalLabel(p)}`,
        href: `/maintenance-plans?open=${encodeURIComponent(p.id)}`,
        icon: "plan",
      })
    }

    out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    return out.slice(0, 25)
  }, [customer, customerWorkOrders, customerEquipment, equipmentCreatedAt, customerPlans])

  const totalContractValue = customer?.contracts.reduce((sum, c) => sum + c.value, 0) ?? 0

  const activeCustomerPlans = useMemo(
    () => customerPlans.filter((p) => planStatusDbToUi(p.status) === "Active"),
    [customerPlans],
  )
  const inactiveCustomerPlans = useMemo(
    () => customerPlans.filter((p) => planStatusDbToUi(p.status) !== "Active"),
    [customerPlans],
  )

  const planNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of customerPlans) m[p.id] = p.name
    return m
  }, [customerPlans])

  async function handleSaveCustomerEdits(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) return

    setActionError("")
    if (!editForm.company.trim()) {
      setActionError("Company name is required.")
      return
    }

    setSavingEdit(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase
        .from("customers")
        .update({
          company_name: editForm.company.trim(),
          status: editForm.status.toLowerCase(),
          notes: editForm.notes.trim(),
        })
        .eq("id", customer.id)
        .eq("organization_id", customer.organizationId)

      if (error) {
        setActionError(error.message)
        return
      }

      setCustomer((prev) =>
        prev
          ? {
              ...prev,
              company: editForm.company.trim(),
              status: editForm.status,
              notes: editForm.notes.trim(),
            }
          : prev,
      )
      setEditOpen(false)
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleArchiveCustomer() {
    if (!customer) return

    setActionError("")
    setArchiving(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase
        .from("customers")
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
        })
        .eq("id", customer.id)
        .eq("organization_id", customer.organizationId)

      if (error) {
        setActionError(error.message)
        return
      }

      router.push("/customers")
    } finally {
      setArchiving(false)
    }
  }

  function resetLocationForm() {
    setLocationForm({
      name: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      postal_code: "",
      phone: "",
      contact_person: "",
      notes: "",
      is_default: false,
    })
    setEditingLocationId(null)
    setLocationError("")
  }

  function openCreateLocationModal() {
    resetLocationForm()
    setLocationModalOpen(true)
  }

  function openEditLocationModal(location: CustomerLocation) {
    setEditingLocationId(location.id)
    setLocationError("")
    setLocationForm({
      name: location.name,
      address_line1: location.address,
      address_line2: location.addressLine2,
      city: location.city,
      state: location.state,
      postal_code: location.zip,
      phone: location.phone,
      contact_person: location.contactPerson,
      notes: location.notes,
      is_default: location.isDefault,
    })
    setLocationModalOpen(true)
  }

  async function handleSaveLocation(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) return

    setLocationError("")
    if (
      !locationForm.name.trim() ||
      !locationForm.address_line1.trim() ||
      !locationForm.city.trim() ||
      !locationForm.state.trim() ||
      !locationForm.postal_code.trim()
    ) {
      setLocationError("Name, address, city, state, and postal code are required.")
      return
    }

    setLocationSaving(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const payload = {
        organization_id: customer.organizationId,
        customer_id: customer.id,
        name: locationForm.name.trim(),
        address_line1: locationForm.address_line1.trim(),
        address_line2: locationForm.address_line2.trim() || null,
        city: locationForm.city.trim(),
        state: locationForm.state.trim(),
        postal_code: locationForm.postal_code.trim(),
        phone: locationForm.phone.trim() || null,
        contact_person: locationForm.contact_person.trim() || null,
        notes: locationForm.notes.trim() || null,
        is_default: locationForm.is_default,
      }

      const query = editingLocationId
        ? supabase
            .from("customer_locations")
            .update(payload)
            .eq("id", editingLocationId)
            .eq("organization_id", customer.organizationId)
            .eq("customer_id", customer.id)
        : supabase.from("customer_locations").insert(payload)

      const { error } = await query
      if (error) {
        setLocationError(error.message)
        return
      }

      setLocationModalOpen(false)
      resetLocationForm()
      setRefreshToken((v) => v + 1)
    } finally {
      setLocationSaving(false)
    }
  }

  async function handleArchiveLocation(locationId: string) {
    if (!customer) return

    setLocationError("")
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase
      .from("customer_locations")
      .update({ is_archived: true })
      .eq("id", locationId)
      .eq("organization_id", customer.organizationId)
      .eq("customer_id", customer.id)

    if (error) {
      setLocationError(error.message)
      return
    }

    setRefreshToken((v) => v + 1)
  }

  function resetContactForm() {
    setContactForm({
      full_name: "",
      first_name: "",
      last_name: "",
      role: "",
      email: "",
      phone: "",
      is_primary: false,
    })
    setEditingContactId(null)
    setContactError("")
  }

  function openCreateContactModal() {
    resetContactForm()
    setContactModalOpen(true)
  }

  function openEditContactModal(contact: CustomerContact) {
    setEditingContactId(contact.id)
    setContactError("")
    setContactForm({
      full_name: contact.name,
      first_name: contact.firstName,
      last_name: contact.lastName,
      role: contact.role,
      email: contact.email,
      phone: contact.phone,
      is_primary: contact.isPrimary,
    })
    setContactModalOpen(true)
  }

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) return

    setContactError("")
    if (!contactForm.full_name.trim()) {
      setContactError("Full name is required.")
      return
    }

    setContactSaving(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const payload = {
        organization_id: customer.organizationId,
        customer_id: customer.id,
        full_name: contactForm.full_name.trim(),
        first_name: contactForm.first_name.trim() || null,
        last_name: contactForm.last_name.trim() || null,
        role: contactForm.role.trim() || null,
        email: contactForm.email.trim() || null,
        phone: contactForm.phone.trim() || null,
        is_primary: contactForm.is_primary,
      }

      const query = editingContactId
        ? supabase
            .from("customer_contacts")
            .update(payload)
            .eq("id", editingContactId)
            .eq("organization_id", customer.organizationId)
            .eq("customer_id", customer.id)
        : supabase.from("customer_contacts").insert(payload)

      const { error } = await query
      if (error) {
        setContactError(error.message)
        return
      }

      setContactModalOpen(false)
      resetContactForm()
      setRefreshToken((v) => v + 1)
    } finally {
      setContactSaving(false)
    }
  }

  async function handleArchiveContact(contactId: string) {
    if (!customer) return

    setContactError("")
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase
      .from("customer_contacts")
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
      })
      .eq("id", contactId)
      .eq("organization_id", customer.organizationId)
      .eq("customer_id", customer.id)

    if (error) {
      setContactError(error.message)
      return
    }

    setRefreshToken((v) => v + 1)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted-foreground text-sm">Loading customer...</p>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted-foreground text-sm">Customer not found.</p>
        <Link href="/customers">
          <Button variant="outline" size="sm" className="gap-2">
            <ChevronLeft className="w-4 h-4" /> Back to Customers
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/customers">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
            Customers
          </Button>
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium text-foreground">{customer.company}</span>
      </div>

      {/* Header */}
      <Card className="border-border shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-bold text-lg shrink-0 ring-1 ring-primary/15">
                {customer.company.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-foreground tracking-tight text-balance">{customer.company}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {customer.name}
                  <span className="text-muted-foreground/50"> · </span>
                  Customer since{" "}
                  {new Date(customer.joinedDate).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
                </p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs font-medium border",
                      customer.status === "Active"
                        ? "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30"
                        : "bg-muted text-muted-foreground border-border",
                    )}
                  >
                    {customer.status}
                  </Badge>
                  {metricsLoading && (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Syncing metrics…
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Button variant="outline" size="sm" onClick={handleArchiveCustomer} disabled={archiving}>
                {archiving ? "Archiving..." : "Archive"}
              </Button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick actions</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" className="gap-1.5 shadow-sm" asChild>
                <Link
                  href={`/equipment?action=new-equipment&customerId=${encodeURIComponent(customer.id)}`}
                  className="inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> New Equipment
                </Link>
              </Button>
              <Button size="sm" variant="secondary" className="gap-1.5 shadow-sm" asChild>
                <Link
                  href={`/work-orders?action=new-work-order&customerId=${encodeURIComponent(customer.id)}`}
                  className="inline-flex items-center gap-1.5"
                >
                  <ClipboardList className="w-3.5 h-3.5" /> New Work Order
                </Link>
              </Button>
              <Button size="sm" variant="secondary" className="gap-1.5 shadow-sm" asChild>
                <Link
                  href={`/quotes?action=new-quote&customerId=${encodeURIComponent(customer.id)}`}
                  className="inline-flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" /> New Quote
                </Link>
              </Button>
              <Button size="sm" variant="secondary" className="gap-1.5 shadow-sm" asChild>
                <Link
                  href={`/maintenance-plans?new=1&customerId=${encodeURIComponent(customer.id)}`}
                  className="inline-flex items-center gap-1.5"
                >
                  <MaintenancePlansBrandTile size="xs" /> New Maintenance Plan
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-card border border-border h-auto flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="equipment" className="text-xs sm:text-sm">
            Equipment ({customerEquipment.length})
          </TabsTrigger>
          <TabsTrigger value="work-orders" className="text-xs sm:text-sm">
            Work Orders ({customerWorkOrders.length})
          </TabsTrigger>
          <TabsTrigger value="quotes" className="text-xs sm:text-sm">
            Quotes
          </TabsTrigger>
          <TabsTrigger value="maintenance-plans" className="text-xs sm:text-sm">
            Maintenance Plans ({customerPlans.length})
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs sm:text-sm">
            Notes
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(
              [
                {
                  label: "Total Equipment",
                  value: String(customerEquipment.length),
                  sub: "assets on file",
                  icon: Wrench,
                  accent: "text-primary",
                  bg: "bg-primary/10",
                },
                {
                  label: "Open Work Orders",
                  value: String(openWorkOrderCount),
                  sub: "need attention",
                  icon: ClipboardList,
                  accent: openWorkOrderCount > 0 ? "text-[color:var(--status-warning)]" : "text-foreground",
                  bg:
                    openWorkOrderCount > 0
                      ? "bg-[color:var(--status-warning)]/10"
                      : "bg-muted/60",
                },
                {
                  label: "Active Maintenance Plans",
                  value: String(activeCustomerPlans.length),
                  sub: "PM coverage",
                  kpiVariant: "maintenance-plans" as const,
                },
                {
                  label: "Lifetime Revenue",
                  value: lifetimeRevenueCents > 0 ? fmtCurrencyCents(lifetimeRevenueCents) : "—",
                  sub:
                    lifetimeRevenueCents > 0
                      ? "Completed & invoiced labor + parts"
                      : "No completed / invoiced revenue yet",
                  icon: DollarSign,
                  accent: "text-[color:var(--status-info)]",
                  bg: "bg-[color:var(--status-info)]/10",
                },
              ] satisfies CustomerOverviewKpi[]
            ).map((kpi) => (
              <div
                key={kpi.label}
                className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2 justify-between shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-h-[108px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
                    {kpi.label}
                  </p>
                  {"kpiVariant" in kpi ? (
                    <MaintenancePlansBrandTile size="sm" />
                  ) : (
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", kpi.bg)}>
                    <kpi.icon className={cn("w-4 h-4", kpi.accent)} />
                  </div>
                  )}
                </div>
                <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{kpi.value}</p>
                <p className="text-xs text-muted-foreground leading-snug">{kpi.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base">Recent activity</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground font-normal">
                  Latest work orders, equipment, and plans for this account.
                </p>
              </CardHeader>
              <CardContent>
                <ActivityTimeline items={activityItems} />
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">Contacts</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={openCreateContactModal}>
                      Add Contact
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {customer.contacts.map((contact, i) => (
                    <div
                      key={contact.id ?? i}
                      className="flex items-start gap-3 pb-4 border-b border-border last:pb-0 last:border-0"
                    >
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted text-muted-foreground font-medium text-xs shrink-0">
                        {contact.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{contact.name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-muted-foreground">{contact.role}</p>
                          {contact.isPrimary && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 mt-2">
                          <a
                            href={`mailto:${contact.email}`}
                            className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate"
                          >
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            {contact.email}
                          </a>
                          <a
                            href={`tel:${contact.phone}`}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            {contact.phone}
                          </a>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => openEditContactModal(contact)}
                            className="text-xs text-primary hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveContact(contact.id)}
                            className="text-xs text-destructive hover:underline"
                          >
                            Archive
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {customer.contacts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No contacts yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">Locations</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={openCreateLocationModal}>
                      Add Location
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {customer.locations.map((loc) => (
                    <div
                      key={loc.id}
                      className="flex items-start gap-3 pb-3 border-b border-border last:pb-0 last:border-0"
                    >
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted shrink-0">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{loc.name}</p>
                          {loc.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {loc.address}
                          {loc.addressLine2 ? `, ${loc.addressLine2}` : ""}, {loc.city}, {loc.state} {loc.zip}
                        </p>
                        {(loc.contactPerson || loc.phone) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {loc.contactPerson ? `Contact: ${loc.contactPerson}` : ""}
                            {loc.contactPerson && loc.phone ? " · " : ""}
                            {loc.phone ? `Phone: ${loc.phone}` : ""}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => openEditLocationModal(loc)}
                            className="text-xs text-primary hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveLocation(loc.id)}
                            className="text-xs text-destructive hover:underline"
                          >
                            Archive
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {customer.locations.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No locations on file.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Contracts</CardTitle>
                  <p className="text-xs text-muted-foreground font-normal">
                    Annual values from customer_contracts
                    {totalContractValue > 0 ? ` · ${fmtCurrencyCents(totalContractValue * 100)} combined` : ""}.
                  </p>
                </CardHeader>
                <CardContent>
                  {customer.contracts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No contracts on file.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {customer.contracts.map((contract) => (
                        <div
                          key={contract.id}
                          className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border bg-muted/20"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 shrink-0">
                              <FileText className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground">{contract.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{contract.type}</p>
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                {new Date(contract.startDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                                {" — "}
                                {new Date(contract.endDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-foreground">${contract.value.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Annual value</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Equipment tab */}
        <TabsContent value="equipment" className="mt-4">
          {customerEquipment.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No equipment on file for this customer.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {customerEquipment.map((eq) => (
                <EquipmentRow key={eq.id} eq={eq} customerName={customer?.company} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Work Orders tab */}
        <TabsContent value="work-orders" className="mt-4">
          {customerWorkOrders.length === 0 ? (
            <Card className="border border-dashed border-border">
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No work orders for this customer yet.</p>
                <Button size="sm" className="mt-4" asChild>
                  <Link
                    href={`/work-orders?action=new-work-order&customerId=${encodeURIComponent(customer.id)}`}
                    className="gap-1.5 inline-flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create work order
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Work order
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Type
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Revenue
                    </th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customerWorkOrders.map((wo) => (
                    <tr key={wo.id} className="bg-card hover:bg-muted/25 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono text-primary">
                          {formatWorkOrderDisplay(wo.work_order_number, wo.id)}
                        </p>
                        <p className="font-medium text-foreground line-clamp-1 mt-0.5">{wo.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Created {fmtIsoDate(wo.created_at.slice(0, 10))}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          {woDbStatusLabel(wo.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{woDbTypeLabel(wo.type)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {wo.status === "completed" || wo.status === "invoiced"
                          ? fmtCurrencyCents((wo.total_labor_cents ?? 0) + (wo.total_parts_cents ?? 0))
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                          <Link href={`/work-orders?open=${encodeURIComponent(wo.id)}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="quotes" className="mt-4">
          <Card className="border border-dashed border-border">
            <CardContent className="py-12 text-center max-w-lg mx-auto">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-80" />
              <p className="text-sm text-foreground font-medium">Quotes for this customer</p>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Create and track quotes in the Quotes workspace. Customer-specific history will appear here in a future
                release.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-6">
                <Button size="sm" asChild>
                  <Link
                    href={`/quotes?action=new-quote&customerId=${encodeURIComponent(customer.id)}`}
                    className="gap-1.5 inline-flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5" /> New quote
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/quotes">All quotes</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Plans tab */}
        <TabsContent value="maintenance-plans" className="mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <p className="text-sm text-muted-foreground">
              Preventive maintenance agreements and work orders generated from plans for this customer.
            </p>
            <Button size="sm" variant="outline" className="shrink-0 gap-1.5" asChild>
              <Link
                href={`/maintenance-plans?new=1&customerId=${encodeURIComponent(customer.id)}`}
                className="inline-flex items-center gap-1.5"
              >
                <MaintenancePlansBrandTile size="xs" /> Create maintenance plan
              </Link>
            </Button>
          </div>

          {plansSectionLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading plans…
            </div>
          ) : customerPlans.length === 0 ? (
            <Card className="border border-border border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground mb-4">No maintenance plans for this customer yet.</p>
                <Button size="sm" asChild>
                  <Link href={`/maintenance-plans?new=1&customerId=${encodeURIComponent(customer.id)}`}>
                    Create maintenance plan
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-4">
                {activeCustomerPlans.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Active</h3>
                    <div className="flex flex-col gap-2">
                      {activeCustomerPlans.map((plan) => (
                        <Link
                          key={plan.id}
                          href={`/maintenance-plans?open=${plan.id}`}
                          className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/20 transition-all group"
                        >
                          <MaintenancePlansBrandTile size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
                                {plan.name}
                              </p>
                              <Badge
                                variant="secondary"
                                className="text-[10px] shrink-0 bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30"
                              >
                                Active
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {planEquipmentSubtitle(plan, planEquipmentNames)} · {planIntervalLabel(plan)} · Next{" "}
                              {fmtIsoDate(plan.next_due_date)}
                            </p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {inactiveCustomerPlans.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Inactive</h3>
                    <div className="flex flex-col gap-2">
                      {inactiveCustomerPlans.map((plan) => (
                        <Link
                          key={plan.id}
                          href={`/maintenance-plans?open=${plan.id}`}
                          className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/20 transition-all group opacity-95"
                        >
                          <MaintenancePlansBrandTile size="sm" className="opacity-90" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm text-foreground truncate">{plan.name}</p>
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                {planStatusDbToUi(plan.status)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {planEquipmentSubtitle(plan, planEquipmentNames)} · {planIntervalLabel(plan)} · Next{" "}
                              {fmtIsoDate(plan.next_due_date)}
                            </p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Card className="border border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Plan work order history</CardTitle>
                  <p className="text-xs text-muted-foreground font-normal">
                    Work orders linked to this customer&apos;s maintenance plans.
                  </p>
                </CardHeader>
                <CardContent>
                  {planLinkedWOs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No plan-linked work orders yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {planLinkedWOs.map((wo) => (
                        <Link
                          key={wo.id}
                          href={`/work-orders?open=${wo.id}`}
                          className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/30 transition-colors group"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-mono text-primary truncate">{formatWorkOrderDisplay(wo.work_order_number, wo.id)}</p>
                            <p className="text-sm font-medium text-foreground truncate">{wo.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {wo.maintenance_plan_id ? planNameById[wo.maintenance_plan_id] ?? "Plan" : "Plan"} ·{" "}
                              {woDbTypeLabel(wo.type)} · {fmtIsoDate(wo.scheduled_on ?? wo.created_at.slice(0, 10))}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {woDbStatusLabel(wo.status)}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Notes tab */}
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {customer.notes ? (
                <p className="text-sm text-foreground leading-relaxed">{customer.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes on file.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditOpen(false)} />
          <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-xl">
            <form onSubmit={handleSaveCustomerEdits} className="p-5 space-y-4">
              <h3 className="text-base font-semibold text-foreground">Edit Customer</h3>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Company Name</label>
                <input
                  value={editForm.company}
                  onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as CustomerStatus }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={4}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground resize-none"
                />
              </div>

              {actionError && <p className="text-xs text-destructive">{actionError}</p>}

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {locationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setLocationModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-xl">
            <form onSubmit={handleSaveLocation} className="p-5 space-y-4">
              <h3 className="text-base font-semibold text-foreground">
                {editingLocationId ? "Edit Location" : "Add Location"}
              </h3>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Name</label>
                  <input
                    value={locationForm.name}
                    onChange={(e) => setLocationForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Address</label>
                  <input
                    value={locationForm.address_line1}
                    onChange={(e) => setLocationForm((f) => ({ ...f, address_line1: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Address Line 2</label>
                  <input
                    value={locationForm.address_line2}
                    onChange={(e) => setLocationForm((f) => ({ ...f, address_line2: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">City</label>
                    <input
                      value={locationForm.city}
                      onChange={(e) => setLocationForm((f) => ({ ...f, city: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">State</label>
                    <input
                      value={locationForm.state}
                      onChange={(e) => setLocationForm((f) => ({ ...f, state: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Postal Code</label>
                    <input
                      value={locationForm.postal_code}
                      onChange={(e) => setLocationForm((f) => ({ ...f, postal_code: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Phone</label>
                    <input
                      value={locationForm.phone}
                      onChange={(e) => setLocationForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Contact Person</label>
                    <input
                      value={locationForm.contact_person}
                      onChange={(e) => setLocationForm((f) => ({ ...f, contact_person: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
                  <textarea
                    rows={3}
                    value={locationForm.notes}
                    onChange={(e) => setLocationForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground resize-none"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={locationForm.is_default}
                    onChange={(e) => setLocationForm((f) => ({ ...f, is_default: e.target.checked }))}
                  />
                  Set as default location
                </label>
              </div>

              {locationError && <p className="text-xs text-destructive">{locationError}</p>}

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setLocationModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={locationSaving}>
                  {locationSaving ? "Saving..." : "Save Location"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {contactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setContactModalOpen(false)} />
          <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-xl">
            <form onSubmit={handleSaveContact} className="p-5 space-y-4">
              <h3 className="text-base font-semibold text-foreground">
                {editingContactId ? "Edit Contact" : "Add Contact"}
              </h3>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Full Name</label>
                <input
                  value={contactForm.full_name}
                  onChange={(e) => setContactForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">First Name</label>
                  <input
                    value={contactForm.first_name}
                    onChange={(e) => setContactForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Last Name</label>
                  <input
                    value={contactForm.last_name}
                    onChange={(e) => setContactForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Role</label>
                <input
                  value={contactForm.role}
                  onChange={(e) => setContactForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Email</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Phone</label>
                  <input
                    value={contactForm.phone}
                    onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={contactForm.is_primary}
                  onChange={(e) => setContactForm((f) => ({ ...f, is_primary: e.target.checked }))}
                />
                Set as primary contact
              </label>

              {contactError && <p className="text-xs text-destructive">{contactError}</p>}

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setContactModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={contactSaving}>
                  {contactSaving ? "Saving..." : "Save Contact"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
