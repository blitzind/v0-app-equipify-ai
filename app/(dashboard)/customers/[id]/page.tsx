"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import type { Equipment, EquipmentStatus } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ClipboardList,
  Plus,
  Package,
  CalendarPlus,
  Repeat,
  MessageSquare,
} from "lucide-react"
import { enforceCanCreateRecord } from "@/app/actions/org-create-enforcement"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import {
  isAssignedWorkOnly,
  loadAssignedWorkScope,
  type AssignedWorkScope,
} from "@/lib/permissions/technician-scope"
import { formatWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import { WO_LIST_SELECT, WO_LIST_SELECT_WITH_NUM } from "@/lib/work-orders/supabase-select"
import { getEquipmentDisplayPrimary, getEquipmentSecondaryLine } from "@/lib/equipment/display"
import { intervalFromDb, planStatusDbToUi } from "@/lib/maintenance-plans/db-map"
import type { MaintenancePlanRow } from "@/lib/maintenance-plans/db-map"
import { summarizeMaintenanceForecast } from "@/lib/maintenance-plans/forecast"
import { MaintenanceForecastPanel } from "@/components/maintenance-plans/maintenance-forecast-panel"
import type { EquipmentWarrantyRow } from "@/lib/equipment-warranties/types"
import type { WarrantyCoverageLabel } from "@/lib/equipment-warranties/types"
import { evaluateWarrantyCoverage } from "@/lib/equipment-warranties/eval"
import { WarrantyCoverageBadge } from "@/components/equipment-warranties/warranty-coverage-badge"
import type { ReplacementReadinessLabel } from "@/lib/equipment-replacement/types"
import { evaluateReplacementReadiness } from "@/lib/equipment-replacement/eval"
import { ReplacementReadinessBadge } from "@/components/equipment-replacement/replacement-readiness-badge"
import type { EquipmentReliabilityLabel } from "@/lib/equipment-reliability/types"
import { evaluateEquipmentReliability } from "@/lib/equipment-reliability/eval"
import { ReliabilityBadge } from "@/components/equipment-reliability/reliability-badge"
import { MaintenancePlansBrandTile } from "@/lib/navigation/module-icons"
import { useOrgArchivePermissions } from "@/lib/use-org-archive-permissions"
import { CustomerCommunicationTimeline } from "@/components/communications/customer-communication-timeline"
import { RecentCommunicationsCard } from "@/components/communications/recent-communications-card"
import { ContactActions } from "@/components/contact-actions"
import { CUSTOMER_CERT_RELEASE_OPTIONS, modeLabel } from "@/lib/portal/certificate-release-staff"
import {
  CUSTOMER_TERMS_OPTIONS,
  INVOICE_TERMS_CODES,
  type InvoiceTermsCode,
} from "@/lib/billing/invoice-terms"
import {
  loadCustomerHierarchy,
  type CustomerHierarchySummary,
} from "@/lib/customers/hierarchy"
import { CustomerHierarchyCard } from "@/components/customers/customer-hierarchy-card"
import { ManageHierarchyDialog } from "@/components/customers/manage-hierarchy-dialog"
import {
  loadCustomerRollupMetrics,
  type CustomerRollupMetrics,
} from "@/lib/customers/rollup-metrics"
import { CustomerRollupCard } from "@/components/customers/customer-rollup-card"
import { ChildAccountsCard } from "@/components/customers/child-accounts-card"
import { EquipmentCategoryBreakdownCard } from "@/components/equipment/equipment-category-breakdown-card"
import { CustomerPortalCertificateRuleCard } from "@/components/customers/customer-portal-certificate-rule-card"
import { CustomerPortalConsolidatedDocsCard } from "@/components/customers/customer-portal-consolidated-docs-card"
import { CustomerBillingTermsCard } from "@/components/customers/customer-billing-terms-card"
import { CustomerInvoiceAgingCard } from "@/components/customers/customer-invoice-aging-card"
import {
  combineInvoiceAgingSummaries,
  invoicesForCustomerIds,
  summarizeInvoiceAging,
  type InvoiceAgingSummary,
} from "@/lib/billing/invoice-aging"
import { fetchInvoicesForOrganization } from "@/lib/org-quotes-invoices/repository"
import {
  loadEquipmentCategoryBreakdown,
  type EquipmentCategoryBreakdownRow,
} from "@/lib/equipment/intelligence-rollup"
import { loadCustomerRollupTree } from "@/lib/customers/consolidated-rollup"
import { ParentAccountCard } from "@/components/customers/parent-account-card"
import { AidenProductivitySection } from "@/components/aiden/aiden-productivity-section"
import { normalizeAddressFingerprint } from "@/lib/customer-locations/format"
import { buildMultiLocationDashboard } from "@/lib/customers/multi-location-dashboard"
import { CustomerMultiLocationDashboard } from "@/components/customers/customer-multi-location-dashboard"
import {
  ServiceContractFormDialog,
  type ServiceContractFormPayload,
} from "@/components/service-contracts/service-contract-form-dialog"
import { SlaCoverageBadge } from "@/components/service-contracts/sla-coverage-badge"
import type { SlaCoverageLabel } from "@/lib/service-contracts/types"
import { evaluateSlaCoverageLabel, pickBestContract } from "@/lib/service-contracts/coverage"
import type { ServiceContractRow } from "@/lib/service-contracts/types"

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

type CustomerServiceContract = {
  id: string
  name: string
  number: string | null
  coverageType: string
  status: string
  startDate: string
  endDate: string
  locationId: string | null
  equipmentId: string | null
  slaResponseHours: number | null
  slaResolutionHours: number | null
  notes: string | null
}

type CustomerPortalCertMode = "" | "immediate_release" | "release_on_payment" | "manual_release" | "internal_only"

type CustomerPortalConsolidatedMode = "" | "true" | "false"

const CUSTOMER_CONSOLIDATED_DOCS_OPTIONS: Array<{
  value: CustomerPortalConsolidatedMode
  label: string
  helper: string
}> = [
  {
    value: "",
    label: "Use workspace default",
    helper: "Inherits the consolidated documents toggle under Settings → Customer portal.",
  },
  {
    value: "true",
    label: "Force consolidated view on",
    helper:
      "Eligible parent portal users can include child-account documents in the library when hierarchy allows.",
  },
  {
    value: "false",
    label: "Force consolidated view off",
    helper: "Portal users for this account only see documents for this account.",
  },
]

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
  contracts: CustomerServiceContract[]
  isArchived: boolean
  /** null = use organization default */
  portalCertificateReleaseMode: string | null
  certificateReleaseNotes: string | null
  certificateReleaseOverrideReason: string | null
  /** null = inherit workspace default for consolidated portal document rollup (Phase 2). */
  portalConsolidatedDocumentsEnabled: boolean | null
  /** null = use organization default for invoice terms (Phase 2). */
  defaultInvoiceTermsCode: string | null
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
  subcategory: string | null
  serial_number: string | null
  status: string
  next_due_at: string | null
  next_calibration_due_at: string | null
  location_label: string | null
  customer_location_id: string | null
  install_date: string | null
  warranty_start_date: string | null
  warranty_expiration_date: string | null
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
    subcategory: row.subcategory ?? undefined,
    serialNumber: row.serial_number ?? "",
    installDate: row.install_date ?? "",
    warrantyStartDate: row.warranty_start_date?.trim() ? row.warranty_start_date.slice(0, 10) : "",
    warrantyExpiration:
      row.warranty_expiration_date?.trim() || row.warranty_expires_at?.trim() || "",
    lastServiceDate: row.last_service_at ?? "",
    nextDueDate: row.next_due_at ? row.next_due_at.slice(0, 10) : "",
    nextCalibrationDue: row.next_calibration_due_at ? row.next_calibration_due_at.slice(0, 10) : undefined,
    status: statusMap[row.status] ?? "Active",
    notes: row.notes ?? "",
    location: row.location_label ?? "",
    serviceSiteId: row.customer_location_id ?? null,
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
  scheduled_on: string | null
  total_labor_cents: number
  total_parts_cents: number
  customer_location_id: string | null
  equipment_id: string | null
}

type CustomerServiceRequestRow = {
  id: string
  customer_location_id: string | null
  equipment_id: string | null
  status: string
  urgency: string
  issue_summary: string
  created_at: string
  converted_work_order_id: string | null
}

type CustomerInvoiceMlRow = {
  amount_cents: number
  status: string
  equipment_id: string | null
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
            {item.icon === "plan" && <Repeat className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
          <Link href={item.href} className="block group">
            <div className="bg-card/80 border border-border rounded-xl p-4 hover:border-primary/35 ds-hover-list-row-xs transition-all">
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

function EquipmentRow({
  eq,
  customerName,
  serviceSiteLabel,
  warrantyLabel,
  replacementLabel,
  reliabilityLabel,
}: {
  eq: Equipment
  customerName?: string
  serviceSiteLabel?: string | null
  warrantyLabel?: WarrantyCoverageLabel | null
  replacementLabel?: ReplacementReadinessLabel | null
  reliabilityLabel?: EquipmentReliabilityLabel | null
}) {
  const daysToDue = Math.ceil(
    (new Date(eq.nextDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  const dueSoon = daysToDue >= 0 && daysToDue <= 14

  return (
    <Link href={`/equipment/${eq.id}`}>
      <div className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/40 ds-hover-list-row-xs transition-all group cursor-pointer">
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
            {warrantyLabel ?
              <WarrantyCoverageBadge label={warrantyLabel} className="shrink-0" />
            : null}
            {replacementLabel && replacementLabel !== "healthy" ?
              <ReplacementReadinessBadge label={replacementLabel} className="normal-case shrink-0" />
            : null}
            {reliabilityLabel && reliabilityLabel !== "stable" ?
              <ReliabilityBadge label={reliabilityLabel} className="normal-case shrink-0" />
            : null}
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
          <div className="text-xs text-muted-foreground mt-0.5 text-right max-w-[200px]">
            {serviceSiteLabel ?
              <p className="truncate" title={serviceSiteLabel}>
                {serviceSiteLabel}
              </p>
            : null}
            {eq.location ?
              <p className="truncate">{eq.location}</p>
            : !serviceSiteLabel ?
              <p>—</p>
            : null}
          </div>
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
  const { permissions } = useOrgPermissions()
  const { canArchiveRestore } = useOrgArchivePermissions()
  const assignedOnlyView = isAssignedWorkOnly(permissions)
  const canManageCustomerRecords = !assignedOnlyView
  const canViewCustomerFinancials = permissions.canViewFinancials || permissions.canViewBilling
  const canViewQuotes = permissions.canViewQuotes
  const canManageServiceContracts = permissions.canManageDispatch
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
    portalCertificateRelease: "" as CustomerPortalCertMode,
    certificateReleaseNotes: "",
    certificateReleaseOverrideReason: "",
    portalConsolidatedDocuments: "" as CustomerPortalConsolidatedMode,
    /** Empty string = use organization default (Phase 2). */
    defaultInvoiceTermsCode: "",
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

  const [serviceContractFormOpen, setServiceContractFormOpen] = useState(false)
  const [editingServiceContractId, setEditingServiceContractId] = useState<string | null>(null)

  const [customerPlans, setCustomerPlans] = useState<CustomerPlanRow[]>([])
  const [planEquipmentNames, setPlanEquipmentNames] = useState<Record<string, string>>({})
  const [planLinkedWOs, setPlanLinkedWOs] = useState<CustomerPlanWoRow[]>([])
  const [plansSectionLoading, setPlansSectionLoading] = useState(false)

  const [customerEquipment, setCustomerEquipment] = useState<Equipment[]>([])
  const [customerEquipmentWarranties, setCustomerEquipmentWarranties] = useState<EquipmentWarrantyRow[]>([])
  const [customerWorkOrders, setCustomerWorkOrders] = useState<CustomerWoListRow[]>([])
  const [technicianScope, setTechnicianScope] = useState<AssignedWorkScope | null>(null)
  const [customerServiceRequests, setCustomerServiceRequests] = useState<CustomerServiceRequestRow[]>([])
  const [customerInvoicesForMl, setCustomerInvoicesForMl] = useState<CustomerInvoiceMlRow[] | null>(null)
  const [intakeMetricsLoading, setIntakeMetricsLoading] = useState(false)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [lifetimeRevenueCents, setLifetimeRevenueCents] = useState(0)
  const [equipmentCreatedAt, setEquipmentCreatedAt] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState("overview")
  const [hierarchySummary, setHierarchySummary] = useState<CustomerHierarchySummary | null>(null)
  const [hierarchyLoading, setHierarchyLoading] = useState(false)
  const [hierarchyDialogOpen, setHierarchyDialogOpen] = useState(false)
  const [rollupMetrics, setRollupMetrics] = useState<CustomerRollupMetrics | null>(null)
  const [equipmentBreakdown, setEquipmentBreakdown] = useState<EquipmentCategoryBreakdownRow[] | null>(null)
  const [equipmentBreakdownLoading, setEquipmentBreakdownLoading] = useState(false)
  const [equipmentBreakdownIncludesChildren, setEquipmentBreakdownIncludesChildren] = useState(false)
  const [rollupLoading, setRollupLoading] = useState(false)
  /** Invoicing Phase 3 — invoice aging summary (single + consolidated). */
  const [invoiceAgingSelf, setInvoiceAgingSelf] = useState<InvoiceAgingSummary | null>(null)
  const [invoiceAgingConsolidated, setInvoiceAgingConsolidated] =
    useState<InvoiceAgingSummary | null>(null)
  const [invoiceAgingLoading, setInvoiceAgingLoading] = useState(false)
  const [invoiceAgingChildCount, setInvoiceAgingChildCount] = useState(0)
  const [locationSearch, setLocationSearch] = useState("")
  const [equipmentSiteFilter, setEquipmentSiteFilter] = useState<string>("all")
  const [workOrderSiteFilter, setWorkOrderSiteFilter] = useState<string>("all")
  /** Parent accounts only: merge sub-account rows into equipment / WO / SR lists (RLS + assigned scope still apply). */
  const [includeChildAccountsInTables, setIncludeChildAccountsInTables] = useState(false)

  const locationLabelById = useMemo(() => {
    const m = new Map<string, string>()
    if (!customer) return m
    for (const l of customer.locations) {
      m.set(l.id, `${l.name} — ${l.city}, ${l.state}`)
    }
    return m
  }, [customer])

  const locationMetrics = useMemo(() => {
    const m: Record<string, { equipment: number; workOrders: number; openWorkOrders: number }> = {}
    if (!customer) return m
    for (const loc of customer.locations) {
      m[loc.id] = { equipment: 0, workOrders: 0, openWorkOrders: 0 }
    }
    for (const eq of customerEquipment) {
      const sid = eq.serviceSiteId ?? null
      if (sid && m[sid]) m[sid].equipment += 1
    }
    const woSite = (wo: CustomerWoListRow) => {
      if (wo.customer_location_id) return wo.customer_location_id
      if (wo.equipment_id) {
        const eq = customerEquipment.find((e) => e.id === wo.equipment_id)
        return eq?.serviceSiteId ?? null
      }
      return null
    }
    for (const wo of customerWorkOrders) {
      const sid = woSite(wo)
      if (!sid || !m[sid]) continue
      m[sid].workOrders += 1
      if (wo.status !== "completed" && wo.status !== "invoiced") m[sid].openWorkOrders += 1
    }
    return m
  }, [customer, customerEquipment, customerWorkOrders])

  const visibleLocations = useMemo(() => {
    if (!customer) return []
    const q = locationSearch.trim().toLowerCase()
    if (!q) return customer.locations
    return customer.locations.filter((l) => {
      const blob = [l.name, l.address, l.addressLine2, l.city, l.state, l.zip].join(" ").toLowerCase()
      return blob.includes(q)
    })
  }, [customer, locationSearch])

  const filteredEquipment = useMemo(() => {
    if (equipmentSiteFilter === "all") return customerEquipment
    if (equipmentSiteFilter === "unassigned") {
      return customerEquipment.filter((e) => !e.serviceSiteId)
    }
    return customerEquipment.filter((e) => e.serviceSiteId === equipmentSiteFilter)
  }, [customerEquipment, equipmentSiteFilter])

  const equipmentWarrantyEvalById = useMemo(() => {
    const byEq = new Map<string, EquipmentWarrantyRow[]>()
    for (const w of customerEquipmentWarranties) {
      const list = byEq.get(w.equipment_id) ?? []
      list.push(w)
      byEq.set(w.equipment_id, list)
    }
    const map = new Map<string, ReturnType<typeof evaluateWarrantyCoverage>>()
    for (const eq of customerEquipment) {
      const ev = evaluateWarrantyCoverage({
        records: byEq.get(eq.id) ?? [],
        equipmentFallback: {
          start: eq.warrantyStartDate?.trim() ? eq.warrantyStartDate.slice(0, 10) : null,
          end: eq.warrantyExpiration?.trim() ? eq.warrantyExpiration.slice(0, 10) : null,
          manufacturerLabel: eq.manufacturer,
        },
      })
      map.set(eq.id, ev)
    }
    return map
  }, [customerEquipment, customerEquipmentWarranties])

  const equipmentReplacementById = useMemo(() => {
    const wosByEq = new Map<string, CustomerWoListRow[]>()
    for (const w of customerWorkOrders) {
      if (!w.equipment_id) continue
      const list = wosByEq.get(w.equipment_id) ?? []
      list.push(w)
      wosByEq.set(w.equipment_id, list)
    }
    const map = new Map<string, ReturnType<typeof evaluateReplacementReadiness>>()
    for (const eq of customerEquipment) {
      const wEv = equipmentWarrantyEvalById.get(eq.id)
      if (!wEv) continue
      const plansForEq = customerPlans.filter((p) => p.equipment_id === eq.id)
      map.set(
        eq.id,
        evaluateReplacementReadiness({
          installDateYmd: eq.installDate?.trim() ? eq.installDate.slice(0, 10) : null,
          equipmentStatus: eq.status,
          warranty: wEv,
          workOrders: (wosByEq.get(eq.id) ?? []).map((wo) => ({
            created_at: wo.created_at,
            completed_at: wo.completed_at,
            status: wo.status,
          })),
          equipmentNextDueYmd: eq.nextDueDate?.trim() ? eq.nextDueDate.slice(0, 10) : null,
          maintenancePlans: plansForEq.map((p) => ({ status: p.status, next_due_date: p.next_due_date })),
        }),
      )
    }
    return map
  }, [customerEquipment, customerWorkOrders, customerPlans, equipmentWarrantyEvalById])

  const equipmentReliabilityById = useMemo(() => {
    const wosByEq = new Map<string, CustomerWoListRow[]>()
    for (const w of customerWorkOrders) {
      if (!w.equipment_id) continue
      const list = wosByEq.get(w.equipment_id) ?? []
      list.push(w)
      wosByEq.set(w.equipment_id, list)
    }
    const map = new Map<string, ReturnType<typeof evaluateEquipmentReliability>>()
    for (const eq of customerEquipment) {
      map.set(
        eq.id,
        evaluateEquipmentReliability(
          (wosByEq.get(eq.id) ?? []).map((wo) => ({
            created_at: wo.created_at,
            completed_at: wo.completed_at,
            status: wo.status,
            type: wo.type,
            title: wo.title,
          })),
        ),
      )
    }
    return map
  }, [customerEquipment, customerWorkOrders])

  useEffect(() => {
    if (!customer?.organizationId || customerEquipment.length === 0) {
      setCustomerEquipmentWarranties([])
      return
    }
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const ids = customerEquipment.map((e) => e.id)
      const { data, error } = await supabase
        .from("org_equipment_warranties")
        .select("*")
        .eq("organization_id", customer.organizationId)
        .in("equipment_id", ids)
      if (cancelled) return
      if (error) {
        setCustomerEquipmentWarranties([])
        return
      }
      setCustomerEquipmentWarranties((data ?? []) as EquipmentWarrantyRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [customer?.organizationId, customerEquipment])

  const filteredWorkOrders = useMemo(() => {
    if (workOrderSiteFilter === "all") return customerWorkOrders
    const woSite = (wo: CustomerWoListRow) => {
      if (wo.customer_location_id) return wo.customer_location_id
      if (wo.equipment_id) {
        const eq = customerEquipment.find((e) => e.id === wo.equipment_id)
        return eq?.serviceSiteId ?? null
      }
      return null
    }
    if (workOrderSiteFilter === "unassigned") {
      return customerWorkOrders.filter((w) => !woSite(w))
    }
    return customerWorkOrders.filter((w) => woSite(w) === workOrderSiteFilter)
  }, [customerWorkOrders, customerEquipment, workOrderSiteFilter])

  const scopedServiceRequests = useMemo(() => {
    if (!assignedOnlyView || !technicianScope) return customerServiceRequests
    const eqSet = new Set(technicianScope.equipmentIds)
    const woSet = new Set(technicianScope.workOrderIds)
    const scopedLocs = new Set<string>()
    for (const eq of customerEquipment) {
      if (eqSet.has(eq.id) && eq.serviceSiteId) scopedLocs.add(eq.serviceSiteId)
    }
    for (const w of customerWorkOrders) {
      if (!woSet.has(w.id)) continue
      let lid: string | null = w.customer_location_id
      if (!lid && w.equipment_id) {
        const e = customerEquipment.find((x) => x.id === w.equipment_id)
        lid = e?.serviceSiteId ?? null
      }
      if (lid) scopedLocs.add(lid)
    }
    return customerServiceRequests.filter(
      (sr) =>
        (sr.equipment_id && eqSet.has(sr.equipment_id)) ||
        (sr.converted_work_order_id && woSet.has(sr.converted_work_order_id)) ||
        (sr.customer_location_id ? scopedLocs.has(sr.customer_location_id) : false),
    )
  }, [
    assignedOnlyView,
    technicianScope,
    customerEquipment,
    customerWorkOrders,
    customerServiceRequests,
  ])

  const multiLocationDashboard = useMemo(() => {
    if (!customer) return null
    const locations = customer.locations.map((l) => ({
      id: l.id,
      name: l.name,
      addressLine: [l.address, l.addressLine2, `${l.city}, ${l.state} ${l.zip}`].filter(Boolean).join(", "),
      isDefault: l.isDefault,
    }))
    const equipmentMl = customerEquipment.map((e) => ({
      id: e.id,
      customer_location_id: e.serviceSiteId,
      last_service_at: e.lastServiceDate || null,
      next_due_at: e.nextDueDate || null,
      next_calibration_due_at: e.nextCalibrationDue || null,
    }))
    const woMl = customerWorkOrders.map((w) => ({
      id: w.id,
      status: w.status,
      customer_location_id: w.customer_location_id,
      equipment_id: w.equipment_id,
      completed_at: w.completed_at,
      scheduled_on: w.scheduled_on,
    }))
    const planMl = customerPlans.map((p) => ({
      equipment_id: p.equipment_id,
      next_due_date: p.next_due_date,
      status: p.status,
    }))
    let invoicesMl = customerInvoicesForMl
    if (assignedOnlyView && technicianScope && invoicesMl) {
      const eqSet = new Set(technicianScope.equipmentIds)
      invoicesMl = invoicesMl.filter((inv) => !inv.equipment_id || eqSet.has(inv.equipment_id))
    }
    return buildMultiLocationDashboard({
      locations,
      equipment: equipmentMl,
      workOrders: woMl,
      maintenancePlans: planMl,
      serviceRequests: scopedServiceRequests.map((sr) => ({
        id: sr.id,
        customer_location_id: sr.customer_location_id,
        equipment_id: sr.equipment_id,
        status: sr.status,
        urgency: sr.urgency,
        issue_summary: sr.issue_summary,
        created_at: sr.created_at,
        converted_work_order_id: sr.converted_work_order_id,
      })),
      invoices: canViewCustomerFinancials ? invoicesMl : null,
    })
  }, [
    customer,
    customerEquipment,
    customerWorkOrders,
    customerPlans,
    scopedServiceRequests,
    customerInvoicesForMl,
    canViewCustomerFinancials,
    assignedOnlyView,
    technicianScope,
  ])

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
          setTechnicianScope(null)
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
      if (assignedOnlyView) {
        const scope = await loadAssignedWorkScope(supabase, { organizationId: orgId, userId: user.id })
        if (!scope.customerIds.includes(id)) {
          if (active) {
            setCustomer(null)
            setTechnicianScope(null)
            setLoading(false)
          }
          return
        }
        if (active) setTechnicianScope(scope)
      } else if (active) {
        setTechnicianScope(null)
      }

      const customerSelectAttempts = [
        // Includes Phase 2 consolidated docs column when migration applied.
        "id, company_name, status, joined_at, notes, archived_at, portal_certificate_release_mode, certificate_release_notes, certificate_release_override_reason, default_invoice_terms_code, portal_consolidated_documents_enabled",
        // Phase 2 includes default_invoice_terms_code (added in service_lifecycle_phase1).
        "id, company_name, status, joined_at, notes, archived_at, portal_certificate_release_mode, certificate_release_notes, certificate_release_override_reason, default_invoice_terms_code",
        // Schema-drift fallback for environments missing the Phase 1 column.
        "id, company_name, status, joined_at, notes, archived_at, portal_certificate_release_mode",
      ]
      let customerRow: Record<string, unknown> | null = null
      let customerError: { message: string } | null = null
      for (const sel of customerSelectAttempts) {
        const res = await supabase
          .from("customers")
          .select(sel)
          .eq("id", id)
          .eq("organization_id", orgId)
          .single()
        if (!res.error) {
          customerRow = res.data as Record<string, unknown>
          customerError = null
          break
        }
        customerError = res.error
      }
      if (customerError || !customerRow) {
        if (active) {
          setCustomer(null)
          setTechnicianScope(null)
          setLoading(false)
        }
        return
      }

      const [{ data: contactsRows }, { data: locationsRows }, contractRes] = await Promise.all([
        supabase
          .from("customer_contacts")
          .select("id, full_name, first_name, last_name, role, email, phone, is_primary")
          .eq("customer_id", id)
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .order("is_primary", { ascending: false }),
        supabase
          .from("customer_locations")
          .select("id, name, address_line1, address_line2, city, state, postal_code, phone, contact_person, notes, is_default")
          .eq("customer_id", id)
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .order("is_default", { ascending: false })
          .order("name", { ascending: true }),
        supabase
          .from("org_service_contracts")
          .select(
            "id, contract_name, contract_number, coverage_type, status, start_date, end_date, customer_location_id, equipment_id, sla_response_hours, sla_resolution_hours, notes",
          )
          .eq("customer_id", id)
          .eq("organization_id", orgId)
          .order("start_date", { ascending: false }),
      ])
      const contractRows = contractRes.error ? [] : contractRes.data

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
        contract_name: string | null
        contract_number: string | null
        coverage_type: string | null
        status: string | null
        start_date: string | null
        end_date: string | null
        customer_location_id: string | null
        equipment_id: string | null
        sla_response_hours: number | null
        sla_resolution_hours: number | null
        notes: string | null
      }

      const contactsTyped = (contactsRows ?? []) as ContactRow[]
      const locationsTyped = (locationsRows ?? []) as LocationRow[]
      const contractsTyped = (contractRows ?? []) as ContractRow[]

      const customerRowTyped = customerRow as {
        id: string
        company_name: string
        status: string
        joined_at: string | null
        notes: string | null
        archived_at: string | null
        portal_certificate_release_mode?: string | null
        certificate_release_notes?: string | null
        certificate_release_override_reason?: string | null
        default_invoice_terms_code?: string | null
        portal_consolidated_documents_enabled?: boolean | null
      }
      const custPortalMode = customerRowTyped.portal_certificate_release_mode
      const custTermsCode = (customerRowTyped.default_invoice_terms_code ?? "").trim()
      const custConsolidated =
        typeof customerRowTyped.portal_consolidated_documents_enabled === "boolean"
          ? customerRowTyped.portal_consolidated_documents_enabled
          : null
      const mapped: CustomerDetail = {
        id: customerRowTyped.id,
        organizationId: orgId,
        company: customerRowTyped.company_name,
        name: contactsRows?.[0]?.full_name ?? customerRowTyped.company_name,
        status: customerRowTyped.status === "inactive" ? "Inactive" : "Active",
        joinedDate: customerRowTyped.joined_at ?? new Date().toISOString().slice(0, 10),
        openWorkOrders: 0,
        notes: customerRowTyped.notes ?? "",
        portalCertificateReleaseMode:
          custPortalMode === "immediate_release" ||
          custPortalMode === "release_on_payment" ||
          custPortalMode === "manual_release" ||
          custPortalMode === "internal_only"
            ? custPortalMode
            : null,
        certificateReleaseNotes: customerRowTyped.certificate_release_notes ?? null,
        certificateReleaseOverrideReason: customerRowTyped.certificate_release_override_reason ?? null,
        portalConsolidatedDocumentsEnabled: custConsolidated,
        defaultInvoiceTermsCode: custTermsCode || null,
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
          name: contract.contract_name ?? "Contract",
          number: contract.contract_number,
          coverageType: contract.coverage_type ?? "other",
          status: contract.status ?? "draft",
          startDate: contract.start_date ?? new Date().toISOString().slice(0, 10),
          endDate: contract.end_date ?? new Date().toISOString().slice(0, 10),
          locationId: contract.customer_location_id,
          equipmentId: contract.equipment_id,
          slaResponseHours: contract.sla_response_hours,
          slaResolutionHours: contract.sla_resolution_hours,
          notes: contract.notes,
        })),
        isArchived: Boolean(customerRowTyped.archived_at),
      }

      if (active) {
        setCustomer(mapped)
        setEditForm({
          company: mapped.company,
          status: mapped.status,
          notes: mapped.notes,
          portalCertificateRelease:
            mapped.portalCertificateReleaseMode === "immediate_release" ||
            mapped.portalCertificateReleaseMode === "release_on_payment" ||
            mapped.portalCertificateReleaseMode === "manual_release" ||
            mapped.portalCertificateReleaseMode === "internal_only"
              ? mapped.portalCertificateReleaseMode
              : "",
          certificateReleaseNotes: mapped.certificateReleaseNotes ?? "",
          certificateReleaseOverrideReason: mapped.certificateReleaseOverrideReason ?? "",
          portalConsolidatedDocuments:
            mapped.portalConsolidatedDocumentsEnabled === true
              ? "true"
              : mapped.portalConsolidatedDocumentsEnabled === false
                ? "false"
                : "",
          defaultInvoiceTermsCode: mapped.defaultInvoiceTermsCode ?? "",
        })
        setLoading(false)
      }
    }

    void loadCustomer()

    return () => {
      active = false
    }
  }, [id, refreshToken, orgStatus, activeOrgId, assignedOnlyView])

  useEffect(() => {
    if (!canViewCustomerFinancials && (activeTab === "quotes" || activeTab === "billing")) {
      setActiveTab("overview")
    }
    if (assignedOnlyView && activeTab === "maintenance-plans") {
      setActiveTab("overview")
    }
  }, [activeTab, assignedOnlyView, canViewCustomerFinancials])

  // Hierarchy + billing/service summary (Phase 1) — non-blocking.
  useEffect(() => {
    let cancelled = false
    if (!id || orgStatus !== "ready" || !activeOrgId) {
      setHierarchySummary(null)
      setHierarchyLoading(false)
      return
    }
    setHierarchyLoading(true)
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const summary = await loadCustomerHierarchy(supabase, {
        organizationId: activeOrgId,
        customerId: id,
      }).catch(() => null)
      if (cancelled) return
      setHierarchySummary(summary)
      setHierarchyLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, refreshToken, activeOrgId, orgStatus])

  // Phase 2 rollup metrics — only computed for parent accounts (childCount > 0).
  // Loads in parallel with the hierarchy summary so the rollup card can
  // appear alongside the existing overview without blocking the page.
  useEffect(() => {
    let cancelled = false
    if (!hierarchySummary || hierarchySummary.childCount === 0) {
      setRollupMetrics(null)
      setRollupLoading(false)
      return
    }
    setRollupLoading(true)
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const metrics = await loadCustomerRollupMetrics(supabase, {
        organizationId: hierarchySummary.organizationId,
        rootCustomerId: hierarchySummary.customerId,
        maxDepth: 1,
        includeFinancialRollup: canViewCustomerFinancials,
        includeQuotesRollup: canViewQuotes,
      }).catch(() => null)
      if (cancelled) return
      setRollupMetrics(metrics)
      setRollupLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [hierarchySummary, refreshToken, canViewCustomerFinancials, canViewQuotes])

  // Invoicing Phase 3 — invoice aging for this customer (and consolidated
  // rollup when this account has sub-accounts).
  useEffect(() => {
    let cancelled = false
    if (!customer || !canViewCustomerFinancials) {
      setInvoiceAgingSelf(null)
      setInvoiceAgingConsolidated(null)
      setInvoiceAgingChildCount(0)
      setInvoiceAgingLoading(false)
      return () => {
        cancelled = true
      }
    }
    setInvoiceAgingLoading(true)
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const isParent = Boolean(hierarchySummary && hierarchySummary.childCount > 0)

      let consolidatedIds: string[] = [customer.id]
      if (isParent) {
        const tree = await loadCustomerRollupTree(supabase, {
          organizationId: customer.organizationId,
          rootCustomerId: customer.id,
          maxDepth: 1,
        }).catch(() => [])
        if (tree.length > 0) consolidatedIds = tree.map((n) => n.id)
      }

      const { invoices } = await fetchInvoicesForOrganization(supabase, customer.organizationId, {
        visibility: "active",
      })
      if (cancelled) return

      const selfRows = invoicesForCustomerIds(invoices, [customer.id])
      const selfSummary = summarizeInvoiceAging(selfRows)

      let consolidatedSummary: InvoiceAgingSummary | null = null
      if (isParent && consolidatedIds.length > 1) {
        const consolidatedRows = invoicesForCustomerIds(invoices, consolidatedIds)
        consolidatedSummary = combineInvoiceAgingSummaries([summarizeInvoiceAging(consolidatedRows)])
      }

      setInvoiceAgingSelf(selfSummary)
      setInvoiceAgingConsolidated(consolidatedSummary)
      setInvoiceAgingChildCount(isParent ? Math.max(consolidatedIds.length - 1, 0) : 0)
      setInvoiceAgingLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [customer, hierarchySummary, refreshToken, canViewCustomerFinancials])

  // Equipment Intelligence Phase 2 — category breakdown for this customer.
  // For parent accounts we expand to the full rollup tree (self + descendants);
  // for standalone or child accounts we scope to the customer alone.
  useEffect(() => {
    let cancelled = false
    if (!customer) {
      setEquipmentBreakdown(null)
      setEquipmentBreakdownIncludesChildren(false)
      setEquipmentBreakdownLoading(false)
      return
    }
    setEquipmentBreakdownLoading(true)
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const isParent = Boolean(
        hierarchySummary && hierarchySummary.childCount > 0,
      )
      let customerIds: string[] = [customer.id]
      if (isParent) {
        const tree = await loadCustomerRollupTree(supabase, {
          organizationId: customer.organizationId,
          rootCustomerId: customer.id,
          maxDepth: 1,
        }).catch(() => [])
        if (tree.length > 0) customerIds = tree.map((n) => n.id)
      }
      const rows = await loadEquipmentCategoryBreakdown(supabase, {
        organizationId: customer.organizationId,
        customerIds,
        since: null,
      }).catch(() => [] as EquipmentCategoryBreakdownRow[])
      if (cancelled) return
      setEquipmentBreakdown(rows)
      setEquipmentBreakdownIncludesChildren(isParent && customerIds.length > 1)
      setEquipmentBreakdownLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [customer, hierarchySummary, refreshToken])

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
      const {
        data: { user },
      } = await supabase.auth.getUser()
      let scope: AssignedWorkScope | null = null
      if (assignedOnlyView && user) {
        scope = await loadAssignedWorkScope(supabase, {
          organizationId: customer.organizationId,
          userId: user.id,
        })
      }

      const expandChildren =
        includeChildAccountsInTables && (hierarchySummary?.childCount ?? 0) > 0
      let targetCustomerIds = [customer.id]
      if (expandChildren) {
        const tree = await loadCustomerRollupTree(supabase, {
          organizationId: customer.organizationId,
          rootCustomerId: customer.id,
          maxDepth: 1,
        }).catch(() => [])
        if (tree.length > 0) targetCustomerIds = tree.map((t) => t.id)
      }

      let eqQuery = supabase
        .from("equipment")
        .select(
          "id, customer_id, equipment_code, name, manufacturer, category, subcategory, serial_number, status, next_due_at, next_calibration_due_at, location_label, customer_location_id, install_date, warranty_start_date, warranty_expiration_date, warranty_expires_at, last_service_at, notes, created_at",
        )
        .eq("organization_id", customer.organizationId)
        .is("archived_at", null)
        .order("name", { ascending: true })
      eqQuery =
        targetCustomerIds.length === 1 ?
          eqQuery.eq("customer_id", targetCustomerIds[0]!)
        : eqQuery.in("customer_id", targetCustomerIds)

      const { data: eqRows, error: eqError } = await eqQuery

      if (!active) return

      let woRes =
        targetCustomerIds.length === 1 ?
          await supabase
            .from("work_orders")
            .select(WO_LIST_SELECT_WITH_NUM)
            .eq("organization_id", customer.organizationId)
            .eq("customer_id", targetCustomerIds[0]!)
            .is("archived_at", null)
            .order("created_at", { ascending: false })
            .limit(400)
        : await supabase
            .from("work_orders")
            .select(WO_LIST_SELECT_WITH_NUM)
            .eq("organization_id", customer.organizationId)
            .in("customer_id", targetCustomerIds)
            .is("archived_at", null)
            .order("created_at", { ascending: false })
            .limit(400)

      if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
        woRes =
          targetCustomerIds.length === 1 ?
            await supabase
              .from("work_orders")
              .select(WO_LIST_SELECT)
              .eq("organization_id", customer.organizationId)
              .eq("customer_id", targetCustomerIds[0]!)
              .is("archived_at", null)
              .order("created_at", { ascending: false })
              .limit(400)
          : await supabase
              .from("work_orders")
              .select(WO_LIST_SELECT)
              .eq("organization_id", customer.organizationId)
              .in("customer_id", targetCustomerIds)
              .is("archived_at", null)
              .order("created_at", { ascending: false })
              .limit(400)
      }

      if (!active) return

      let equipRowsRaw =
        (eqRows ?? []) as Array<Parameters<typeof equipmentRowToUi>[0] & { created_at: string }>
      let wos = (woRes.data ?? []) as CustomerWoListRow[]

      if (scope) {
        const eqSet = new Set(scope.equipmentIds)
        const woSet = new Set(scope.workOrderIds)
        equipRowsRaw = equipRowsRaw.filter((r) => eqSet.has(r.id))
        wos = wos.filter(
          (w) => woSet.has(w.id) || (w.equipment_id ? eqSet.has(w.equipment_id) : false),
        )
      }

      if (eqError) {
        setCustomerEquipment([])
        setEquipmentCreatedAt({})
      } else {
        const createdMap: Record<string, string> = {}
        const equipUi: Equipment[] = []
        for (const r of equipRowsRaw) {
          createdMap[r.id] = r.created_at
          const { created_at: _ca, ...rest } = r
          equipUi.push(equipmentRowToUi(rest, customer.company))
        }
        setCustomerEquipment(equipUi)
        setEquipmentCreatedAt(createdMap)
      }

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
  }, [customer, refreshToken, assignedOnlyView, includeChildAccountsInTables, hierarchySummary])

  useEffect(() => {
    if (!customer) {
      setCustomerServiceRequests([])
      setCustomerInvoicesForMl(null)
      setIntakeMetricsLoading(false)
      return
    }

    let active = true
    setIntakeMetricsLoading(true)
    const supabase = createBrowserSupabaseClient()

    void (async () => {
      const expandChildren =
        includeChildAccountsInTables && (hierarchySummary?.childCount ?? 0) > 0
      let targetCustomerIds = [customer.id]
      if (expandChildren) {
        const tree = await loadCustomerRollupTree(supabase, {
          organizationId: customer.organizationId,
          rootCustomerId: customer.id,
          maxDepth: 1,
        }).catch(() => [])
        if (tree.length > 0) targetCustomerIds = tree.map((t) => t.id)
      }

      let srQuery = supabase
        .from("org_service_requests")
        .select(
          "id, customer_location_id, equipment_id, status, urgency, issue_summary, created_at, converted_work_order_id",
        )
        .eq("organization_id", customer.organizationId)
        .order("created_at", { ascending: false })
        .limit(600)
      srQuery =
        targetCustomerIds.length === 1 ?
          srQuery.eq("customer_id", targetCustomerIds[0]!)
        : srQuery.in("customer_id", targetCustomerIds)

      const { data: srRows, error: srErr } = await srQuery

      if (!active) return

      if (srErr) {
        setCustomerServiceRequests([])
      } else {
        setCustomerServiceRequests((srRows ?? []) as CustomerServiceRequestRow[])
      }

      if (canViewCustomerFinancials) {
        let invQuery = supabase
          .from("org_invoices")
          .select("amount_cents, status, equipment_id")
          .eq("organization_id", customer.organizationId)
        invQuery =
          targetCustomerIds.length === 1 ?
            invQuery.eq("customer_id", targetCustomerIds[0]!)
          : invQuery.in("customer_id", targetCustomerIds)
        const { data: invRows, error: invErr } = await invQuery
        if (!active) return
        if (invErr) {
          setCustomerInvoicesForMl([])
        } else {
          setCustomerInvoicesForMl((invRows ?? []) as CustomerInvoiceMlRow[])
        }
      } else {
        setCustomerInvoicesForMl(null)
      }

      if (active) setIntakeMetricsLoading(false)
    })()

    return () => {
      active = false
    }
  }, [customer, refreshToken, canViewCustomerFinancials, includeChildAccountsInTables, hierarchySummary])

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
        .is("archived_at", null)
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
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(50)

      if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
        woRes = await supabase
          .from("work_orders")
          .select(custPlanWoSel)
          .eq("organization_id", customer.organizationId)
          .eq("customer_id", customer.id)
          .in("maintenance_plan_id", planIds)
          .is("archived_at", null)
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

  const equipmentComplianceSummary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    let overduePm = 0
    let overdueCal = 0
    for (const e of customerEquipment) {
      if (e.nextDueDate?.trim() && e.nextDueDate < today) overduePm++
      const nc = e.nextCalibrationDue?.trim()
      if (nc && nc < today) overdueCal++
    }
    return { overduePm, overdueCal }
  }, [customerEquipment])

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

  const customerContractCoverageHint = useMemo(() => {
    if (!customer?.id) return null
    const rows: ServiceContractRow[] = customer.contracts.map((c) => ({
      id: c.id,
      organization_id: customer.organizationId,
      customer_id: customer.id,
      customer_location_id: c.locationId,
      equipment_id: c.equipmentId,
      contract_name: c.name,
      contract_number: c.number,
      start_date: c.startDate,
      end_date: c.endDate,
      status: c.status as ServiceContractRow["status"],
      coverage_type: c.coverageType as ServiceContractRow["coverage_type"],
      sla_response_hours: c.slaResponseHours,
      sla_resolution_hours: c.slaResolutionHours,
      notes: c.notes,
    }))
    const nowIso = new Date().toISOString()
    const best = pickBestContract(rows, {
      customerId: customer.id,
      openedAtIso: nowIso,
      lifecycleStatus: "open",
    })
    const ev = evaluateSlaCoverageLabel(best, {
      customerId: customer.id,
      openedAtIso: nowIso,
      lifecycleStatus: "open",
    })
    return ev.label as SlaCoverageLabel
  }, [customer])

  const activeCustomerPlans = useMemo(
    () => customerPlans.filter((p) => planStatusDbToUi(p.status) === "Active"),
    [customerPlans],
  )
  const inactiveCustomerPlans = useMemo(
    () => customerPlans.filter((p) => planStatusDbToUi(p.status) !== "Active"),
    [customerPlans],
  )

  const customerPmForecastSummary = useMemo(() => {
    if (!customer) return null
    return summarizeMaintenanceForecast(
      customerPlans.map((p) => ({
        id: p.id,
        status: p.status,
        next_due_date: p.next_due_date,
        is_archived: false,
        customer_id: customer.id,
        customer_name: customer.company,
        equipment_id: p.equipment_id,
        equipment_name: p.equipment_id ? planEquipmentNames[p.equipment_id] ?? "Equipment" : "",
      })),
    )
  }, [customer, customerPlans, planEquipmentNames])

  const customerPmContractHint = useMemo(() => {
    if (!customer) return null
    const today = new Date().toISOString().slice(0, 10)
    const hit = customer.contracts.some(
      (c) =>
        c.status === "active" &&
        c.startDate.slice(0, 10) <= today &&
        c.endDate.slice(0, 10) >= today,
    )
    return hit
      ? "Active service agreement on file — align preventive visits with any contract response or resolution targets."
      : null
  }, [customer])

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
      const desiredTerms = editForm.defaultInvoiceTermsCode.trim()
      const validTermsCode =
        desiredTerms === ""
          ? null
          : (INVOICE_TERMS_CODES as readonly string[]).includes(desiredTerms)
            ? desiredTerms
            : null

      // Schema-drift safe write: drop the new column when the DB hasn't
      // applied the Phase 1 migration yet (very rare in deployed envs).
      const updateRowFull: Record<string, unknown> = {
        company_name: editForm.company.trim(),
        status: editForm.status.toLowerCase(),
        notes: editForm.notes.trim(),
        default_invoice_terms_code: validTermsCode,
      }
      let { error } = await supabase
        .from("customers")
        .update(updateRowFull)
        .eq("id", customer.id)
        .eq("organization_id", customer.organizationId)
      if (error && /default_invoice_terms_code/i.test(error.message)) {
        const fallback: Record<string, unknown> = { ...updateRowFull }
        delete fallback.default_invoice_terms_code
        const retry = await supabase
          .from("customers")
          .update(fallback)
          .eq("id", customer.id)
          .eq("organization_id", customer.organizationId)
        error = retry.error
      }

      if (error) {
        setActionError(error.message)
        return
      }

      const pr = await fetch(
        `/api/organizations/${encodeURIComponent(customer.organizationId)}/customers/${encodeURIComponent(customer.id)}/portal-certificate-release`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portal_certificate_release_mode:
              editForm.portalCertificateRelease === "" ? null : editForm.portalCertificateRelease,
            certificate_release_notes: editForm.certificateReleaseNotes,
            certificate_release_override_reason: editForm.certificateReleaseOverrideReason,
          }),
        },
      )
      const prBody = (await pr.json().catch(() => ({}))) as {
        error?: string
        portal_certificate_release_mode?: string | null
      }
      if (!pr.ok) {
        setActionError(prBody.error ?? "Could not update certificate release rule.")
        return
      }

      const cd = await fetch(
        `/api/organizations/${encodeURIComponent(customer.organizationId)}/customers/${encodeURIComponent(customer.id)}/portal-consolidated-documents`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            portal_consolidated_documents_enabled:
              editForm.portalConsolidatedDocuments === ""
                ? null
                : editForm.portalConsolidatedDocuments === "true",
          }),
        },
      )
      const cdBody = (await cd.json().catch(() => ({}))) as {
        error?: string
        portal_consolidated_documents_enabled?: boolean | null
      }
      if (!cd.ok) {
        setActionError(cdBody.error ?? "Could not update consolidated document access.")
        return
      }

      const nextPortal =
        prBody.portal_certificate_release_mode === "immediate_release" ||
        prBody.portal_certificate_release_mode === "release_on_payment" ||
        prBody.portal_certificate_release_mode === "manual_release" ||
        prBody.portal_certificate_release_mode === "internal_only"
          ? prBody.portal_certificate_release_mode
          : null

      const nextConsolidated =
        typeof cdBody.portal_consolidated_documents_enabled === "boolean"
          ? cdBody.portal_consolidated_documents_enabled
          : null

      setCustomer((prev) =>
        prev
          ? {
              ...prev,
              company: editForm.company.trim(),
              status: editForm.status,
              notes: editForm.notes.trim(),
              portalCertificateReleaseMode: nextPortal,
              certificateReleaseNotes: editForm.certificateReleaseNotes.trim() || null,
              certificateReleaseOverrideReason: editForm.certificateReleaseOverrideReason.trim() || null,
              portalConsolidatedDocumentsEnabled: nextConsolidated,
              defaultInvoiceTermsCode: validTermsCode,
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { error } = await supabase
        .from("customers")
        .update({
          archived_at: new Date().toISOString(),
          archived_by: user?.id ?? null,
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

  async function handleRestoreCustomer() {
    if (!customer) return

    setActionError("")
    setArchiving(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase
        .from("customers")
        .update({
          archived_at: null,
          archived_by: null,
          archive_reason: null,
        })
        .eq("id", customer.id)
        .eq("organization_id", customer.organizationId)

      if (error) {
        setActionError(error.message)
        return
      }

      setCustomer((prev) => (prev ? { ...prev, isArchived: false } : prev))
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

    const addrFingerprint = normalizeAddressFingerprint({
      address_line1: locationForm.address_line1,
      address_line2: locationForm.address_line2,
      city: locationForm.city,
      state: locationForm.state,
      postal_code: locationForm.postal_code,
    })
    const duplicateAddress = customer.locations.some((l) => {
      if (editingLocationId && l.id === editingLocationId) return false
      return (
        normalizeAddressFingerprint({
          address_line1: l.address,
          address_line2: l.addressLine2,
          city: l.city,
          state: l.state,
          postal_code: l.zip,
        }) === addrFingerprint
      )
    })
    if (duplicateAddress) {
      const ok = window.confirm(
        "Another service site for this customer already matches this address. Save anyway if this is intentional (for example, a distinct suite or building name)?",
      )
      if (!ok) return
    }

    setLocationSaving(true)
    try {
      const body = {
        name: locationForm.name.trim(),
        address: locationForm.address_line1.trim(),
        addressLine2: locationForm.address_line2.trim() || null,
        city: locationForm.city.trim(),
        state: locationForm.state.trim(),
        zip: locationForm.postal_code.trim(),
        phone: locationForm.phone.trim() || null,
        contactPerson: locationForm.contact_person.trim() || null,
        notes: locationForm.notes.trim() || null,
        isDefault: locationForm.is_default,
      }

      const url = editingLocationId
        ? `/api/organizations/${encodeURIComponent(customer.organizationId)}/customers/${encodeURIComponent(customer.id)}/locations/${encodeURIComponent(editingLocationId)}`
        : `/api/organizations/${encodeURIComponent(customer.organizationId)}/customers/${encodeURIComponent(customer.id)}/locations`

      const res = await fetch(url, {
        method: editingLocationId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { message?: string }
      if (!res.ok) {
        setLocationError(json.message ?? "Could not save location.")
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

    const { count: eqDep } = await supabase
      .from("equipment")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", customer.organizationId)
      .eq("customer_id", customer.id)
      .eq("customer_location_id", locationId)
      .is("archived_at", null)

    const { count: woDep } = await supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", customer.organizationId)
      .eq("customer_id", customer.id)
      .eq("customer_location_id", locationId)
      .is("archived_at", null)

    const nEq = eqDep ?? 0
    const nWo = woDep ?? 0
    if (nEq + nWo > 0) {
      const ok = window.confirm(
        `This site is referenced by ${nEq} equipment row(s) and ${nWo} work order(s) with an explicit site link. Archive it anyway? Historical records stay intact; prefer archive over delete when sites are in use.`,
      )
      if (!ok) return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase
      .from("customer_locations")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: user?.id ?? null,
      })
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
      if (!editingContactId) {
        const gate = await enforceCanCreateRecord(customer.organizationId, "customer")
        if (!gate.ok) {
          setContactError(gate.message)
          return
        }
      }
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
                  {customer.isArchived ? (
                    <Badge variant="outline" className="text-[10px] font-semibold bg-muted text-muted-foreground border-border">
                      Archived
                    </Badge>
                  ) : null}
                  {/* Phase 2 hierarchy chip — sits in the existing header badge row. */}
                  {hierarchySummary?.childCount && hierarchySummary.childCount > 0 ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-semibold border border-primary/30 bg-primary/10 text-primary"
                      title={`${hierarchySummary.childCount} sub-account${hierarchySummary.childCount === 1 ? "" : "s"}`}
                    >
                      Parent · {hierarchySummary.childCount}
                    </Badge>
                  ) : null}
                  {hierarchySummary?.parent ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-semibold border border-[color:var(--status-info)]/30 bg-[color:var(--status-info)]/10 text-[color:var(--status-info)]"
                      title={`Sub-account of ${hierarchySummary.parent.companyName}`}
                    >
                      Sub-account
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className="text-[10px] font-normal border-border text-muted-foreground">
                    Portal certs:{" "}
                    {customer.portalCertificateReleaseMode
                      ? modeLabel(customer.portalCertificateReleaseMode)
                      : "Organization default"}
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
              {canManageCustomerRecords && !customer.isArchived ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!customer) return
                    setEditForm({
                      company: customer.company,
                      status: customer.status,
                      notes: customer.notes,
                      portalCertificateRelease:
                        customer.portalCertificateReleaseMode === "immediate_release" ||
                        customer.portalCertificateReleaseMode === "release_on_payment" ||
                        customer.portalCertificateReleaseMode === "manual_release" ||
                        customer.portalCertificateReleaseMode === "internal_only"
                          ? customer.portalCertificateReleaseMode
                          : "",
                      certificateReleaseNotes: customer.certificateReleaseNotes ?? "",
                      certificateReleaseOverrideReason: customer.certificateReleaseOverrideReason ?? "",
                      portalConsolidatedDocuments:
                        customer.portalConsolidatedDocumentsEnabled === true
                          ? "true"
                          : customer.portalConsolidatedDocumentsEnabled === false
                            ? "false"
                            : "",
                      defaultInvoiceTermsCode: customer.defaultInvoiceTermsCode ?? "",
                    })
                    setEditOpen(true)
                  }}
                >
                  Edit
                </Button>
              ) : null}
              {canManageCustomerRecords && canArchiveRestore ? (
                customer.isArchived ? (
                  <Button variant="outline" size="sm" onClick={() => void handleRestoreCustomer()} disabled={archiving}>
                    {archiving ? "Restoring..." : "Restore"}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => void handleArchiveCustomer()} disabled={archiving}>
                    {archiving ? "Archiving..." : "Archive"}
                  </Button>
                )
              ) : null}
            </div>
          </div>

          {canManageCustomerRecords && !customer.isArchived ? (
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
                    <CalendarPlus className="w-3.5 h-3.5" /> New Maintenance Plan
                  </Link>
                </Button>
              </div>
            </div>
          ) : !canManageCustomerRecords ? (
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Technician access is read-only for customer account management. Open assigned work orders to update job workflow details.
              </p>
            </div>
          ) : (
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground">
                This customer is archived. Restore the customer to create new equipment, work orders, quotes, or plans.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AidenProductivitySection
        organizationId={customer.organizationId}
        mode="customer"
        customerId={customer.id}
      />

      {/* Phase 2: Parent account context (sub-account view only). */}
      {hierarchySummary?.parent ? (
        <ParentAccountCard
          organizationId={hierarchySummary.organizationId}
          customerId={hierarchySummary.customerId}
          parentId={hierarchySummary.parent.id}
        />
      ) : null}

      {hierarchySummary && hierarchySummary.childCount > 0 ?
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="include-child-rows" className="text-sm font-medium text-foreground">
              Include sub-accounts in lists
            </Label>
            <p className="text-xs text-muted-foreground">
              Merge direct sub-accounts into equipment, work orders, service requests, and invoice-driven overview
              metrics (one level). Sub-account service sites are not combined into this account’s location list. Portal
              access is unchanged.
            </p>
          </div>
          <Switch
            id="include-child-rows"
            checked={includeChildAccountsInTables}
            onCheckedChange={setIncludeChildAccountsInTables}
          />
        </div>
      : null}

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
          {canViewCustomerFinancials ? (
            <>
              <TabsTrigger value="quotes" className="text-xs sm:text-sm">
                Quotes
              </TabsTrigger>
              <TabsTrigger value="billing" className="text-xs sm:text-sm">
                Billing
                {invoiceAgingSelf && invoiceAgingSelf.overdueCount > 0 ? (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 px-1.5 text-[10px] font-semibold text-destructive">
                    {invoiceAgingSelf.overdueCount}
                  </span>
                ) : null}
              </TabsTrigger>
            </>
          ) : null}
          {!assignedOnlyView ? (
            <TabsTrigger value="maintenance-plans" className="text-xs sm:text-sm">
              Maintenance Plans ({customerPlans.length})
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="communications" className="text-xs sm:text-sm gap-1">
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            Communications
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs sm:text-sm">
            Notes
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* Phase 2 parent rollup — only renders when this account has sub-accounts. */}
          {hierarchySummary?.childCount && hierarchySummary.childCount > 0 ? (
            <CustomerRollupCard
              metrics={rollupMetrics}
              loading={rollupLoading}
              rootCompanyName={customer.company}
              financialRollupEnabled={canViewCustomerFinancials}
              quotesRollupEnabled={canViewQuotes}
            />
          ) : null}

          <CustomerMultiLocationDashboard
            summary={multiLocationDashboard?.summary ?? null}
            locationCards={multiLocationDashboard?.locationCards ?? []}
            showFinancials={canViewCustomerFinancials}
            loading={metricsLoading || intakeMetricsLoading || plansSectionLoading}
            customerId={customer.id}
            onSelectLocation={(locId, mode) => {
              if (mode === "equipment") {
                setEquipmentSiteFilter(locId)
                setActiveTab("equipment")
              } else {
                setWorkOrderSiteFilter(locId)
                setActiveTab("work-orders")
              }
            }}
          />

          {/* Phase 2: Portal certificate release clarity */}
          {canManageCustomerRecords && activeOrgId ? (
            <CustomerPortalCertificateRuleCard
              organizationId={activeOrgId}
              customerMode={customer.portalCertificateReleaseMode}
            />
          ) : null}

          {canManageCustomerRecords && activeOrgId ? (
            <CustomerPortalConsolidatedDocsCard
              organizationId={activeOrgId}
              customerOverride={customer.portalConsolidatedDocumentsEnabled}
            />
          ) : null}

          {/* Invoicing Phase 2: Customer billing terms clarity */}
          {canViewCustomerFinancials && activeOrgId ? (
            <CustomerBillingTermsCard
              organizationId={activeOrgId}
              customerTermsCode={customer.defaultInvoiceTermsCode}
            />
          ) : null}

          {/* Equipment Intelligence Phase 2 — category breakdown */}
          {equipmentBreakdown !== null && equipmentBreakdown.length > 0 ? (
            <EquipmentCategoryBreakdownCard
              rows={equipmentBreakdown}
              loading={equipmentBreakdownLoading}
              title="Equipment intelligence"
              subtitle={
                equipmentBreakdownIncludesChildren
                  ? `Service load and revenue grouped by equipment type, including all sub-accounts.`
                  : `Service load and revenue grouped by equipment type for this account.`
              }
            />
          ) : null}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(
              [
                {
                  label: "Total Equipment",
                  value: String(customerEquipment.length),
                  sub:
                    equipmentComplianceSummary.overduePm > 0 || equipmentComplianceSummary.overdueCal > 0
                      ? `${equipmentComplianceSummary.overduePm > 0 ? `${equipmentComplianceSummary.overduePm} PM overdue` : ""}${
                          equipmentComplianceSummary.overduePm > 0 && equipmentComplianceSummary.overdueCal > 0 ? " · " : ""
                        }${equipmentComplianceSummary.overdueCal > 0 ? `${equipmentComplianceSummary.overdueCal} calibration overdue` : ""}`
                      : "assets on file",
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
                ...(canViewCustomerFinancials
                  ? [
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
                      } satisfies CustomerOverviewKpi,
                    ]
                  : []),
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
                          {contact.email?.trim() ? (
                            <a
                              href={`mailto:${contact.email}`}
                              className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate"
                            >
                              <Mail className="w-3.5 h-3.5 shrink-0" />
                              {contact.email}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">No email on file</span>
                          )}
                          <a
                            href={`tel:${contact.phone}`}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            {contact.phone}
                          </a>
                        </div>
                        <div className="mt-2 flex justify-start">
                          <ContactActions
                            email={
                              contact.email?.trim()
                                ? { customerName: customer.company, customerEmail: contact.email }
                                : undefined
                            }
                            phone={contact.phone}
                            equipify={
                              orgStatus === "ready" && activeOrgId
                                ? {
                                    organizationId: activeOrgId,
                                    customerId: customer.id,
                                    customerLabel: customer.company,
                                    defaultRecipientEmail: contact.email?.trim() || undefined,
                                    contactId: contact.id,
                                  }
                                : undefined
                            }
                          />
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

              <CustomerHierarchyCard
                summary={hierarchySummary}
                loading={hierarchyLoading}
                companyName={customer.company}
                onManage={canArchiveRestore ? () => setHierarchyDialogOpen(true) : undefined}
              />

              {/* Phase 2: child-accounts table — only on parent accounts. */}
              {hierarchySummary?.childCount && hierarchySummary.childCount > 0 ? (
                <ChildAccountsCard
                  organizationId={hierarchySummary.organizationId}
                  parentCustomerId={hierarchySummary.customerId}
                  parentCompanyName={customer.company}
                  showUnpaidInvoices={canViewCustomerFinancials}
                />
              ) : null}

              <Card className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">Service locations</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={openCreateLocationModal}>
                      Add Location
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground font-normal">
                    Service / dispatch addresses for this account. Billing terms and tax defaults live on the customer
                    record; the default service site is a common bill-to fallback when billing matches service.
                  </p>
                  {customer.locations.length > 0 && (
                    <div className="pt-2">
                      <Input
                        placeholder="Search sites by name or address…"
                        value={locationSearch}
                        onChange={(e) => setLocationSearch(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {visibleLocations.map((loc) => {
                    const metrics = locationMetrics[loc.id] ?? {
                      equipment: 0,
                      workOrders: 0,
                      openWorkOrders: 0,
                    }
                    return (
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
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            Service site
                          </span>
                          {loc.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              Primary default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {loc.address}
                          {loc.addressLine2 ? `, ${loc.addressLine2}` : ""}, {loc.city}, {loc.state} {loc.zip}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                          {metrics.equipment} equipment · {metrics.workOrders} work orders
                          {metrics.openWorkOrders > 0 ? ` · ${metrics.openWorkOrders} open` : ""}
                        </p>
                        {(loc.contactPerson || loc.phone) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {loc.contactPerson ? `Contact: ${loc.contactPerson}` : ""}
                            {loc.contactPerson && loc.phone ? " · " : ""}
                            {loc.phone ? `Phone: ${loc.phone}` : ""}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
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
                          <Link
                            href={`/work-orders?action=new-work-order&customerId=${encodeURIComponent(customer.id)}`}
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            New work order
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setEquipmentSiteFilter(loc.id)
                              setActiveTab("equipment")
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            View equipment
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWorkOrderSiteFilter(loc.id)
                              setActiveTab("work-orders")
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            View work orders
                          </button>
                          <Link
                            href={`/communications/service-requests?focusCustomer=${encodeURIComponent(customer.id)}&focusLocation=${encodeURIComponent(loc.id)}`}
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            Service requests
                          </Link>
                        </div>
                      </div>
                    </div>
                    )
                  })}
                  {customer.locations.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No locations on file.</p>
                  )}
                  {customer.locations.length > 0 && visibleLocations.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No sites match your search.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="pb-2 flex flex-row flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Service contracts</CardTitle>
                    <p className="text-xs text-muted-foreground font-normal mt-0.5">
                      Coverage scope, SLA targets, and term dates. Expired or inactive contracts do not apply to new
                      work.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {customerContractCoverageHint ? (
                      <SlaCoverageBadge label={customerContractCoverageHint} />
                    ) : null}
                    {canManageServiceContracts && activeOrgId ?
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs"
                        onClick={() => {
                          setEditingServiceContractId(null)
                          setServiceContractFormOpen(true)
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add contract
                      </Button>
                    : null}
                  </div>
                </CardHeader>
                <CardContent>
                  {customer.contracts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No service contracts yet.
                      {canManageServiceContracts ?
                        " Use Add contract to record coverage and SLA targets."
                      : ""}
                    </p>
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
                              <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                                {contract.coverageType.replace(/_/g, " ")} · {contract.status}
                                {contract.number ? ` · #${contract.number}` : ""}
                              </p>
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
                              {(contract.slaResponseHours != null || contract.slaResolutionHours != null) ?
                                <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                                  SLA:{" "}
                                  {contract.slaResponseHours != null ?
                                    `${contract.slaResponseHours}h response`
                                  : "— response"}
                                  {" · "}
                                  {contract.slaResolutionHours != null ?
                                    `${contract.slaResolutionHours}h resolution`
                                  : "— resolution"}
                                </p>
                              : null}
                              {contract.locationId || contract.equipmentId ?
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  {contract.locationId ? "Scoped to one service site. " : ""}
                                  {contract.equipmentId ? "Scoped to one equipment record." : ""}
                                </p>
                              : (
                                <p className="text-[11px] text-muted-foreground mt-1">Customer-wide coverage.</p>
                              )}
                            </div>
                          </div>
                          {canManageServiceContracts ?
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs shrink-0"
                              onClick={() => {
                                setEditingServiceContractId(contract.id)
                                setServiceContractFormOpen(true)
                              }}
                            >
                              Edit
                            </Button>
                          : null}
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
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <span className="text-xs text-muted-foreground">Site</span>
                <select
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm min-w-[200px]"
                  value={equipmentSiteFilter}
                  onChange={(e) => setEquipmentSiteFilter(e.target.value)}
                >
                  <option value="all">All service sites</option>
                  <option value="unassigned">No linked site</option>
                  {(customer?.locations ?? []).map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              {filteredEquipment.length === 0 ?
                <p className="text-sm text-muted-foreground text-center py-8">No equipment for this site filter.</p>
              : filteredEquipment.map((eq) => (
                <EquipmentRow
                  key={eq.id}
                  eq={eq}
                  customerName={customer?.company}
                  serviceSiteLabel={eq.serviceSiteId ? locationLabelById.get(eq.serviceSiteId) ?? null : null}
                  warrantyLabel={equipmentWarrantyEvalById.get(eq.id)?.label ?? null}
                  replacementLabel={equipmentReplacementById.get(eq.id)?.label ?? null}
                  reliabilityLabel={equipmentReliabilityById.get(eq.id)?.label ?? null}
                />
              ))
              }
            </div>
          )}
        </TabsContent>

        {/* Work Orders tab */}
        <TabsContent value="work-orders" className="mt-4">
          {customerWorkOrders.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground">Site</span>
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-sm min-w-[200px]"
                value={workOrderSiteFilter}
                onChange={(e) => setWorkOrderSiteFilter(e.target.value)}
              >
                <option value="all">All service sites</option>
                <option value="unassigned">Unassigned / inherited only</option>
                {(customer?.locations ?? []).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
          ) : filteredWorkOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No work orders for this site filter.</p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <table className="w-full text-sm">
                <thead className="ds-thead-bg-strong border-b border-border">
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Site
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Revenue
                    </th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredWorkOrders.map((wo) => (
                    <tr key={wo.id} className="bg-card ds-hover-list-row-sm">
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
                      <td className="px-4 py-3 text-muted-foreground max-w-[220px]">
                        {(() => {
                          const sid =
                            wo.customer_location_id ??
                            (wo.equipment_id ?
                              customerEquipment.find((e) => e.id === wo.equipment_id)?.serviceSiteId
                            : null)
                          if (!sid) return <span className="text-xs">—</span>
                          const lbl = locationLabelById.get(sid)
                          return (
                            <span className="text-xs line-clamp-2" title={lbl ?? sid}>
                              {lbl ?? "Site"}
                            </span>
                          )
                        })()}
                      </td>
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

        {/* Invoicing Phase 3 — Billing aging tab */}
        <TabsContent value="billing" className="mt-4 space-y-6">
          {activeOrgId ? (
            <CustomerBillingTermsCard
              organizationId={activeOrgId}
              customerTermsCode={customer.defaultInvoiceTermsCode}
            />
          ) : null}

          {invoiceAgingConsolidated ? (
            <CustomerInvoiceAgingCard
              summary={invoiceAgingConsolidated}
              loading={invoiceAgingLoading}
              consolidated
              childCount={invoiceAgingChildCount}
              invoicesHref={`/invoices?customerId=${encodeURIComponent(customer.id)}`}
            />
          ) : null}
          <CustomerInvoiceAgingCard
            summary={
              invoiceAgingSelf ?? {
                unpaidCount: 0,
                overdueCount: 0,
                draftPendingCount: 0,
                paidLast12moCount: 0,
                totalCount: 0,
                openBalanceCents: 0,
                overdueBalanceCents: 0,
                draftPendingBalanceCents: 0,
                paidLast12moBalanceCents: 0,
                buckets: {
                  current: 0,
                  bucket0_30: 0,
                  bucket31_60: 0,
                  bucket61_90: 0,
                  bucket90Plus: 0,
                },
                oldestOpenIssueDate: null,
                newestPaidDate: null,
              }
            }
            loading={invoiceAgingLoading}
            invoicesHref={`/invoices?customerId=${encodeURIComponent(customer.id)}`}
          />

          {hierarchySummary?.billingAddressMissing ? (
            <div className="rounded-lg border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10 p-3 text-xs text-[color:var(--status-warning)] flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
              <span>
                No billing address on file. New invoices fall back to the default service location.
                Add a billing address in <span className="font-medium">Edit customer → Billing address</span>.
              </span>
            </div>
          ) : null}
          {!customer.defaultInvoiceTermsCode ? (
            <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
              This customer is using the workspace default for payment terms. Configure terms in
              <span className="text-foreground font-medium"> Edit customer → Default invoice payment terms</span>{" "}
              or update the workspace default in <span className="text-foreground font-medium">Settings → Billing</span>.
            </div>
          ) : null}
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
                <CalendarPlus className="w-3.5 h-3.5" /> Create maintenance plan
              </Link>
            </Button>
          </div>

          {customerPmForecastSummary && customerPlans.length > 0 ? (
            <MaintenanceForecastPanel
              variant="compact"
              summary={customerPmForecastSummary}
              contractHint={customerPmContractHint}
              className="mb-4"
            />
          ) : null}

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
                          className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/40 ds-hover-list-row-xs transition-all group"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50">
                            <Repeat className="h-5 w-5 text-muted-foreground" />
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
                          className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/40 ds-hover-list-row-xs transition-all group opacity-95"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50">
                            <Repeat className="h-5 w-5 text-muted-foreground" />
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
                          className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border hover:border-primary/40 ds-hover-list-row group"
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

        {/* Communications timeline */}
        <TabsContent value="communications" className="mt-4 space-y-4">
          {orgStatus === "ready" && activeOrgId ? (
            <RecentCommunicationsCard
              customerId={customer.id}
              limit={10}
              title="Recent communications"
              description="Cross-channel feed of automation runs, AI drafts, and customer-facing emails. Click any item for the full delivery details."
            />
          ) : null}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary shrink-0" />
                Notification timeline (legacy view)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orgStatus === "ready" && activeOrgId ? (
                <CustomerCommunicationTimeline organizationId={activeOrgId} customerId={customer.id} />
              ) : (
                <p className="text-sm text-muted-foreground">Select an organization to load communications.</p>
              )}
            </CardContent>
          </Card>
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

      {hierarchySummary ? (
        <ManageHierarchyDialog
          open={hierarchyDialogOpen}
          onClose={() => setHierarchyDialogOpen(false)}
          onSaved={() => setRefreshToken((n) => n + 1)}
          organizationId={hierarchySummary.organizationId}
          customerId={hierarchySummary.customerId}
          customerCompany={customer?.company ?? ""}
          initialParent={
            hierarchySummary.parent
              ? { id: hierarchySummary.parent.id, companyName: hierarchySummary.parent.companyName }
              : null
          }
          initialBilling={{
            billingName: hierarchySummary.billingAddress.billingName,
            sameAsService: hierarchySummary.billingAddress.inheritsFromDefaultLocation,
            attention: hierarchySummary.billingAddress.attention,
            contactName: hierarchySummary.billingAddress.contactName,
            email: hierarchySummary.billingAddress.email,
            phone: hierarchySummary.billingAddress.phone,
            line1: hierarchySummary.billingAddress.line1,
            line2: hierarchySummary.billingAddress.line2,
            city: hierarchySummary.billingAddress.city,
            state: hierarchySummary.billingAddress.state,
            postalCode: hierarchySummary.billingAddress.postalCode,
            country: hierarchySummary.billingAddress.country,
            notes: hierarchySummary.billingAddress.notes,
            behavior: hierarchySummary.billingAddress.behavior,
            poRequired: hierarchySummary.billingAddress.poRequired,
            poRequiredBeforeService: hierarchySummary.billingAddress.poRequiredBeforeService,
            poRequiredBeforeInvoice: hierarchySummary.billingAddress.poRequiredBeforeInvoice,
            defaultPoNumber: hierarchySummary.billingAddress.defaultPoNumber,
            invoiceInstructions: hierarchySummary.billingAddress.invoiceInstructions,
            invoiceDeliveryPreference: hierarchySummary.billingAddress.invoiceDeliveryPreference,
            defaultPaymentTermsKey: hierarchySummary.billingAddress.defaultPaymentTermsKey,
            defaultPaymentTermsDays: hierarchySummary.billingAddress.defaultPaymentTermsDays,
            defaultPaymentTermsLabel: hierarchySummary.billingAddress.defaultPaymentTermsLabel,
            taxExempt: hierarchySummary.billingAddress.taxExempt,
            taxExemptionId: hierarchySummary.billingAddress.taxExemptionId,
            taxExemptionNotes: hierarchySummary.billingAddress.taxExemptionNotes,
            defaultTaxBasis: hierarchySummary.billingAddress.defaultTaxBasis,
            defaultTaxCategory: hierarchySummary.billingAddress.defaultTaxCategory,
          }}
        />
      ) : null}

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

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Certificate release rule for this customer
                </label>
                <select
                  value={editForm.portalCertificateRelease}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      portalCertificateRelease: e.target.value as CustomerPortalCertMode,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  aria-describedby="cust-portal-cert-help"
                >
                  {CUSTOMER_CERT_RELEASE_OPTIONS.map((o) => (
                    <option key={o.value === "" ? "inherit" : o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p id="cust-portal-cert-help" className="text-[11px] text-muted-foreground mt-1">
                  {
                    CUSTOMER_CERT_RELEASE_OPTIONS.find((o) => o.value === editForm.portalCertificateRelease)
                      ?.helper
                  }
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Release override reason
                  </label>
                  <input
                    value={editForm.certificateReleaseOverrideReason}
                    onChange={(e) => setEditForm((f) => ({ ...f, certificateReleaseOverrideReason: e.target.value }))}
                    placeholder="Why this customer differs from default"
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Release notes
                  </label>
                  <input
                    value={editForm.certificateReleaseNotes}
                    onChange={(e) => setEditForm((f) => ({ ...f, certificateReleaseNotes: e.target.value }))}
                    placeholder="Internal certificate release notes"
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Consolidated portal documents
                </label>
                <select
                  value={editForm.portalConsolidatedDocuments}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      portalConsolidatedDocuments: e.target.value as CustomerPortalConsolidatedMode,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  aria-describedby="cust-portal-consolidated-help"
                >
                  {CUSTOMER_CONSOLIDATED_DOCS_OPTIONS.map((o) => (
                    <option key={o.value === "" ? "inherit" : o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p id="cust-portal-consolidated-help" className="text-[11px] text-muted-foreground mt-1">
                  {
                    CUSTOMER_CONSOLIDATED_DOCS_OPTIONS.find((o) => o.value === editForm.portalConsolidatedDocuments)
                      ?.helper
                  }
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Default invoice payment terms
                </label>
                <select
                  value={editForm.defaultInvoiceTermsCode}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      defaultInvoiceTermsCode: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  aria-describedby="cust-invoice-terms-help"
                >
                  {CUSTOMER_TERMS_OPTIONS.map((o) => (
                    <option key={o.code === "" ? "inherit" : o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p id="cust-invoice-terms-help" className="text-[11px] text-muted-foreground mt-1">
                  {
                    CUSTOMER_TERMS_OPTIONS.find((o) => o.code === editForm.defaultInvoiceTermsCode)
                      ?.helper
                  }
                </p>
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

      {activeOrgId && customer ?
        <ServiceContractFormDialog
          open={serviceContractFormOpen}
          onOpenChange={(o) => {
            setServiceContractFormOpen(o)
            if (!o) setEditingServiceContractId(null)
          }}
          organizationId={activeOrgId}
          customerId={customer.id}
          locations={customer.locations.map((l) => ({ id: l.id, name: l.name }))}
          existing={
            editingServiceContractId ?
              (() => {
                const c = customer.contracts.find((x) => x.id === editingServiceContractId)
                if (!c) return null
                return {
                  id: c.id,
                  contract_name: c.name,
                  contract_number: c.number,
                  start_date: c.startDate,
                  end_date: c.endDate,
                  status: c.status as ServiceContractFormPayload["status"],
                  coverage_type: c.coverageType as ServiceContractFormPayload["coverage_type"],
                  customer_location_id: c.locationId,
                  equipment_id: c.equipmentId,
                  sla_response_hours: c.slaResponseHours,
                  sla_resolution_hours: c.slaResolutionHours,
                  notes: c.notes,
                }
              })()
            : null
          }
          onSaved={() => setRefreshToken((n) => n + 1)}
        />
      : null}
    </div>
  )
}
