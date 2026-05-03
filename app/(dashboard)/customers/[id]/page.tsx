"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import type { Equipment, ServiceHistoryEntry } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  FileText,
  Wrench,
  Calendar,
  ChevronLeft,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Loader2,
} from "lucide-react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { formatWorkOrderDisplay, getWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { intervalFromDb, planStatusDbToUi } from "@/lib/maintenance-plans/db-map"
import type { MaintenancePlanRow } from "@/lib/maintenance-plans/db-map"
import { useQuotes } from "@/lib/quote-invoice-store"
import type { QuoteStatus } from "@/lib/mock-data"

type CustomerStatus = "Active" | "Inactive"

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

const QUOTE_STATUS_CLASS: Record<QuoteStatus, string> = {
  Draft: "bg-muted text-muted-foreground border-border",
  Sent: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  "Pending Approval":
    "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  Approved: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  Declined: "bg-destructive/10 text-destructive border-destructive/30",
  Expired: "bg-muted text-muted-foreground border-border",
}

function fmtQuoteCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
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

const historyTypeIcon: Record<ServiceHistoryEntry["type"], React.ReactNode> = {
  PM: <CheckCircle2 className="w-4 h-4 text-[color:var(--status-success)]" />,
  Repair: <AlertTriangle className="w-4 h-4 text-[color:var(--status-warning)]" />,
  Inspection: <Clock className="w-4 h-4 text-[color:var(--status-info)]" />,
  Install: <CheckCircle2 className="w-4 h-4 text-muted-foreground" />,
}

function EquipmentRow({ eq }: { eq: Equipment }) {
  const daysToDue = Math.ceil(
    (new Date(eq.nextDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  const dueSoon = daysToDue >= 0 && daysToDue <= 14

  return (
    <Link href={`/equipment?open=${eq.id}`}>
      <div className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/20 transition-all group cursor-pointer">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
          <Wrench className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">{eq.model}</p>
            <Badge variant="secondary" className={cn("text-xs shrink-0", statusColors[eq.status])}>
              {eq.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {eq.id} &middot; {eq.category} &middot; S/N: {eq.serialNumber}
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

function ServiceTimeline({ entries }: { entries: ServiceHistoryEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="relative pl-6">
      {sorted.map((entry, i) => (
        <div key={entry.id} className="relative mb-6 last:mb-0">
          {/* Vertical line */}
          {i < sorted.length - 1 && (
            <div className="absolute left-[-18px] top-5 bottom-[-24px] w-px bg-border" />
          )}
          {/* Dot */}
          <div className="absolute left-[-22px] top-0.5 flex items-center justify-center w-8 h-8 rounded-full bg-card border border-border">
            {historyTypeIcon[entry.type]}
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {entry.type}
                  </span>
                  <Badge variant="secondary" className="text-xs">{getWorkOrderDisplay({ id: entry.workOrderId })}</Badge>
                </div>
                <p className="text-sm font-medium text-foreground mt-1">{entry.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {entry.technician} &middot;{" "}
                  {new Date(entry.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <span className="text-sm font-semibold text-foreground shrink-0">
                ${entry.cost.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { quotes } = useQuotes()
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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("default_organization_id")
        .eq("id", user.id)
        .single()

      if (profileError || !profile?.default_organization_id) {
        if (active) {
          setCustomer(null)
          setLoading(false)
        }
        return
      }

      const { data: customerRow, error: customerError } = await supabase
        .from("customers")
        .select("id, company_name, status, joined_at, notes")
        .eq("id", id)
        .eq("organization_id", profile.default_organization_id)
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
            .eq("organization_id", profile.default_organization_id)
            .eq("is_archived", false)
            .order("is_primary", { ascending: false }),
          supabase
            .from("customer_locations")
            .select("id, name, address_line1, address_line2, city, state, postal_code, phone, contact_person, notes, is_default")
            .eq("customer_id", id)
            .eq("organization_id", profile.default_organization_id)
            .eq("is_archived", false),
          supabase
            .from("customer_contracts")
            .select("id, name, contract_type, start_date, end_date, value_cents")
            .eq("customer_id", id)
            .eq("organization_id", profile.default_organization_id),
        ])

      const mapped: CustomerDetail = {
        id: customerRow.id,
        organizationId: profile.default_organization_id,
        company: customerRow.company_name,
        name: contactsRows?.[0]?.full_name ?? customerRow.company_name,
        status: customerRow.status === "inactive" ? "Inactive" : "Active",
        joinedDate: customerRow.joined_at ?? new Date().toISOString().slice(0, 10),
        openWorkOrders: 0,
        notes: customerRow.notes ?? "",
        contacts:
          contactsRows?.map((c) => ({
            id: c.id,
            name: c.full_name ?? "Unknown",
            firstName: c.first_name ?? "",
            lastName: c.last_name ?? "",
            role: c.role ?? "Contact",
            email: c.email ?? "",
            phone: c.phone ?? "",
            isPrimary: Boolean(c.is_primary),
          })) ?? [],
        locations:
          locationsRows?.map((l) => ({
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
          })) ?? [],
        contracts:
          contractRows?.map((contract) => ({
            id: contract.id,
            name: contract.name ?? "Contract",
            type: (contract.contract_type ?? "PM Plan") as CustomerContract["type"],
            startDate: contract.start_date ?? new Date().toISOString().slice(0, 10),
            endDate: contract.end_date ?? new Date().toISOString().slice(0, 10),
            value: Math.floor((contract.value_cents ?? 0) / 100),
          })) ?? [],
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
  }, [id, refreshToken])

  useEffect(() => {
    if (!customer) return
    let active = true

    void (async () => {
      setPlansSectionLoading(true)
      const supabase = createBrowserSupabaseClient()

      const { data: planRows, error: planError } = await supabase
        .from("maintenance_plans")
        .select("id, name, status, interval_value, interval_unit, next_due_date, equipment_id")
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

  const customerEquipment = useMemo(
    () => [],
    []
  )

  const allServiceHistory = useMemo(() => {
    return customerEquipment
      .flatMap((eq) =>
        eq.serviceHistory.map((entry) => ({ ...entry, equipmentName: eq.model, equipmentId: eq.id }))
      )
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [customerEquipment])

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

  const customerQuotes = useMemo(() => {
    if (!customer) return []
    return [...quotes]
      .filter((q) => q.customerId === customer.id)
      .sort((a, b) => b.createdDate.localeCompare(a.createdDate))
  }, [quotes, customer])

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

      {/* Header card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary font-bold text-lg shrink-0">
                {customer.company.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground text-balance">{customer.company}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{customer.name} &middot; {customer.id}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs font-medium",
                      customer.status === "Active"
                        ? "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {customer.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Customer since {new Date(customer.joinedDate).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/maintenance-plans?new=1&customerId=${encodeURIComponent(customer.id)}`}
                  className="gap-1.5 inline-flex items-center"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Maintenance Plan
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleArchiveCustomer} disabled={archiving}>
                {archiving ? "Archiving..." : "Archive"}
              </Button>
              <Button size="sm">+ Work Order</Button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
            {[
              { label: "Equipment", value: customerEquipment.length, icon: Wrench },
              { label: "Open Work Orders", value: customer.openWorkOrders, icon: FileText, warn: customer.openWorkOrders > 0 },
              { label: "Locations", value: customer.locations.length, icon: MapPin },
              { label: "Contract Value", value: `$${totalContractValue.toLocaleString()}`, icon: Building2 },
            ].map(({ label, value, icon: Icon, warn }) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs">{label}</span>
                </div>
                <span className={cn("text-xl font-bold", warn ? "text-[color:var(--status-warning)]" : "text-foreground")}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="equipment">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="equipment">Equipment ({customerEquipment.length})</TabsTrigger>
          <TabsTrigger value="quotes">Quotes ({customerQuotes.length})</TabsTrigger>
          <TabsTrigger value="maintenance-plans">Maintenance Plans ({customerPlans.length})</TabsTrigger>
          <TabsTrigger value="history">Service History ({allServiceHistory.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts & Locations</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Equipment tab */}
        <TabsContent value="equipment" className="mt-4">
          {customerEquipment.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No equipment on file for this customer.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {customerEquipment.map((eq) => (
                <EquipmentRow key={eq.id} eq={eq} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Quotes tab — in-app quote store (same customer id as Supabase) */}
        <TabsContent value="quotes" className="mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <p className="text-sm text-muted-foreground">
              Quotes created for this customer from the Quotes workspace. Open a row to view details or create a work order.
            </p>
            <Button size="sm" variant="outline" className="shrink-0 gap-1.5" asChild>
              <Link href="/quotes" className="inline-flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> All quotes
              </Link>
            </Button>
          </div>
          {customerQuotes.length === 0 ? (
            <Card className="border border-border border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No quotes linked to this customer yet.</p>
                <Button size="sm" className="mt-4" asChild>
                  <Link href="/quotes">Create quote</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Quote
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Expires
                    </th>
                    <th className="w-28" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customerQuotes.map((q) => (
                    <tr key={q.id} className="bg-card hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground line-clamp-1">{q.description}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">{q.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-semibold", QUOTE_STATUS_CLASS[q.status])}
                        >
                          {q.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{fmtQuoteCurrency(q.amount)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{fmtIsoDate(q.expiresDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                          <Link href={`/quotes?open=${encodeURIComponent(q.id)}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                <ShieldCheck className="w-3.5 h-3.5" /> Create maintenance plan
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
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
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
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted text-muted-foreground shrink-0">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
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

        {/* Service History tab */}
        <TabsContent value="history" className="mt-4">
          {allServiceHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No service history on file.</p>
          ) : (
            <div>
              <div className="flex flex-col gap-4">
                {customerEquipment.map((eq) => {
                  if (eq.serviceHistory.length === 0) return null
                  return (
                    <div key={eq.id}>
                      <div className="flex items-center gap-2 mb-3">
                        <Wrench className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground">{eq.model}</span>
                        <span className="text-xs text-muted-foreground">{eq.id}</span>
                      </div>
                      <ServiceTimeline entries={eq.serviceHistory} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Contacts & Locations tab */}
        <TabsContent value="contacts" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
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
                  <div key={i} className="flex items-start gap-3 pb-4 border-b border-border last:pb-0 last:border-0">
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted text-muted-foreground font-medium text-xs shrink-0">
                      {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{contact.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">{contact.role}</p>
                        {contact.isPrimary && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 mt-2">
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                          <Mail className="w-3.5 h-3.5" />{contact.email}
                        </a>
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                          <Phone className="w-3.5 h-3.5" />{contact.phone}
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
              </CardContent>
            </Card>

            <Card>
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
                  <div key={loc.id} className="flex items-start gap-3 pb-3 border-b border-border last:pb-0 last:border-0">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted shrink-0">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{loc.name}</p>
                        {loc.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {loc.address}
                        {loc.addressLine2 ? `, ${loc.addressLine2}` : ""}
                        , {loc.city}, {loc.state} {loc.zip}
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Contracts tab */}
        <TabsContent value="contracts" className="mt-4">
          {customer.contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No active contracts.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {customer.contracts.map((contract) => (
                <Card key={contract.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 shrink-0">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{contract.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{contract.id} &middot; {contract.type}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(contract.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {" — "}
                            {new Date(contract.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">${contract.value.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Annual value</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
