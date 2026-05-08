"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { X, Plus, Trash2, Send, FilePen, PackageSearch, AlertTriangle } from "lucide-react"
import { cn, looksLikeUuid } from "@/lib/utils"
import { useInvoices, useQuotes } from "@/lib/quote-invoice-store"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useBillingAccess } from "@/lib/billing-access-context"
import { toastRecordEligibilityBlocked } from "@/lib/billing/guard-toast"
import { formatWorkOrderDisplay, getWorkOrderDisplay } from "@/lib/work-orders/display"
import { missingWorkOrderNumberColumn } from "@/lib/work-orders/postgrest-fallback"
import {
  loadCustomerHierarchy,
  type CustomerHierarchySummary,
} from "@/lib/customers/hierarchy"
import {
  resolveCustomerBillingProfile,
  type CustomerBillingProfile,
} from "@/lib/customers/billing-profile"
import { getEquipmentDisplayPrimary, getEquipmentSecondaryLine } from "@/lib/equipment/display"
import { DRAWER_PANEL_SURFACE } from "@/components/detail-drawer"
import { AddEquipmentModal } from "@/components/equipment/add-equipment-modal"
import type { AdminQuote, InvoiceStatus } from "@/lib/mock-data"
import {
  PAYMENT_TERMS_OPTIONS,
  computeDueDateYmd,
  invoiceTermsCodeLabel,
  resolveEffectiveTermsCode,
  type InvoiceTermsCode,
} from "@/lib/billing/invoice-terms"
import type { CatalogListItemRow } from "@/lib/catalog/catalog-line-snapshots"
import { buildQuoteInvoiceLineSnapshot } from "@/lib/catalog/catalog-line-snapshots"
import { AddFromCatalogDialog } from "@/components/catalog/add-from-catalog-dialog"
import { parseRepairLog } from "@/lib/work-orders/parse-repair-log"

function quoteOptionLabel(q: AdminQuote) {
  const num = q.quoteNumber?.trim()
  const d = (q.description ?? "").trim()
  if (num) {
    if (d) return d.length > 60 ? `${num} — ${d.slice(0, 60)}…` : `${num} — ${d}`
    return num
  }
  const id = q.id.trim()
  if (looksLikeUuid(id)) {
    if (d) return d.length > 72 ? `${d.slice(0, 72)}…` : d
    return "Quote"
  }
  return `${id} — ${d || "Quote"}`
}

// ─── Primitive field components ───────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-foreground mb-1">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )
}

function FieldInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
        "placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors",
        className,
      )}
      {...props}
    />
  )
}

function FieldSelect({ children, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
        "outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

function FieldTextarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
        "placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none",
        className,
      )}
      {...props}
    />
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-destructive">{msg}</p>
}

// ─── Line item types ──────────────────────────────────────────────────────────

interface LineItem {
  id: string
  description: string
  qty: string
  unit: string
  sourceRef?: string
  catalogItemId?: string
  skuSnapshot?: string
  itemTypeSnapshot?: string
  unitLabelSnapshot?: string
}

function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", qty: "1", unit: "" }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n)
}

type CustomerOption = { id: string; company_name: string }
type EquipmentOption = {
  id: string
  name: string
  equipment_code: string | null
  serial_number: string | null
  category: string | null
}
type WorkOrderOption = { id: string; work_order_number?: number | null; title: string }

type WorkOrderInvoicePrefill = {
  id: string
  display: string
  title: string
  serviceDate: string | null
  technicianName: string | null
  locationLabel: string | null
  hadPricedItems: boolean
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface NewInvoiceModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (id: string, status: InvoiceStatus) => void
  initialWorkOrderId?: string
  initialCalibrationRecordId?: string
  prefilledCatalogItem?: {
    catalogItemId: string
    name: string
    description?: string | null
    unitPrice: number
    partNumber?: string | null
  } | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewInvoiceModal({
  open,
  onClose,
  onSuccess,
  initialWorkOrderId,
  initialCalibrationRecordId,
  prefilledCatalogItem = null,
}: NewInvoiceModalProps) {
  const { addInvoiceFromPayload } = useInvoices()
  const { quotes } = useQuotes()
  const activeQuotes = useMemo(() => quotes.filter((q) => !q.isArchived), [quotes])
  const prevOpenRef = useRef(false)
  const { organizationId: activeOrgId, status: orgContextStatus } = useActiveOrganization()
  const { standardCreateEligibility } = useBillingAccess()
  const organizationId = orgContextStatus === "ready" ? activeOrgId : null

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([])
  const [equipmentLoading, setEquipmentLoading] = useState(false)
  const [workOrderOptions, setWorkOrderOptions] = useState<WorkOrderOption[]>([])
  const [workOrdersLoading, setWorkOrdersLoading] = useState(false)
  const [addEquipmentOpen, setAddEquipmentOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)

  const [customerId, setCustomerId] = useState("")
  const [customerHierarchy, setCustomerHierarchy] = useState<CustomerHierarchySummary | null>(null)
  const [billingProfile, setBillingProfile] = useState<CustomerBillingProfile | null>(null)
  const [workOrderPrefill, setWorkOrderPrefill] = useState<WorkOrderInvoicePrefill | null>(null)
  const [workOrderId, setWorkOrderId] = useState("")
  const [quoteId, setQuoteId] = useState("")
  const [equipmentId, setEquipmentId] = useState("")
  const [title, setTitle] = useState("")
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()])
  const [discount, setDiscount] = useState("")
  const [tax, setTax] = useState("")
  const [issuedAt, setIssuedAt] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [termsCode, setTermsCode] = useState<InvoiceTermsCode>("net_30")
  const [termsCustomDays, setTermsCustomDays] = useState(30)
  /** Whether the user manually edited the terms (so we don't override on customer change). */
  const [termsManuallySet, setTermsManuallySet] = useState(false)
  /** Resolved customer / org defaults — drives the inline helper text. */
  const [customerTermsDefault, setCustomerTermsDefault] = useState<string | null>(null)
  const [orgTermsDefault, setOrgTermsDefault] = useState<string | null>(null)
  /** Cert count tied to the selected work order (Phase 2 visibility). */
  const [linkedCertCount, setLinkedCertCount] = useState<number | null>(null)
  const [linkedCertReleasedCount, setLinkedCertReleasedCount] = useState<number | null>(null)
  const [notes, setNotes] = useState("")
  const [internalNotes, setInternalNotes] = useState("")
  const [poNumber, setPoNumber] = useState("")
  const [calibrationRecordId, setCalibrationRecordId] = useState("")
  const [status, setStatus] = useState<InvoiceStatus>("Draft")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const refreshEquipmentForCustomer = useCallback(
    async (opts?: { organizationId: string; customerId: string; selectEquipmentId?: string }) => {
      const orgId = opts?.organizationId ?? organizationId
      const custId = opts?.customerId ?? customerId
      const selectId = opts?.selectEquipmentId
      if (!orgId || !custId) return

      const supabase = createBrowserSupabaseClient()
      const { data: eqRows, error: eqError } = await supabase
        .from("equipment")
        .select("id, name, equipment_code, serial_number, category")
        .eq("organization_id", orgId)
        .eq("customer_id", custId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("name")

      if (eqError) {
        setEquipmentList([])
        return
      }
      const list = (eqRows as EquipmentOption[]) ?? []
      setEquipmentList(list)
      if (selectId && list.some((e) => e.id === selectId)) {
        setEquipmentId(selectId)
      }
    },
    [organizationId, customerId],
  )

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const hasPrefill = Boolean(initialWorkOrderId || initialCalibrationRecordId || prefilledCatalogItem?.catalogItemId)
      const today = new Date().toISOString().split("T")[0]
      setIssuedAt(today)
      setTermsCode("net_30")
      setTermsCustomDays(30)
      setTermsManuallySet(false)
      setLinkedCertCount(null)
      setLinkedCertReleasedCount(null)
      setCustomerTermsDefault(null)
      setOrgTermsDefault(null)
      setWorkOrderPrefill(null)
      if (!hasPrefill) {
        setCustomerId("")
        setWorkOrderId("")
        setQuoteId("")
        setEquipmentId("")
        setTitle("")
        setLineItems([newLineItem()])
        setDiscount("")
        setTax("")
        setNotes("")
        setInternalNotes("")
        setPoNumber("")
        setStatus("Draft")
      }
      if (prefilledCatalogItem?.catalogItemId && !initialWorkOrderId && !initialCalibrationRecordId) {
        const desc =
          prefilledCatalogItem.name.trim() +
          (prefilledCatalogItem.partNumber?.trim() ? ` — PN ${prefilledCatalogItem.partNumber.trim()}` : "")
        setLineItems([
          {
            id: crypto.randomUUID(),
            description: desc,
            qty: "1",
            unit: String(prefilledCatalogItem.unitPrice ?? 0),
            catalogItemId: prefilledCatalogItem.catalogItemId,
          },
        ])
      }
      setCalibrationRecordId(initialCalibrationRecordId ?? "")
      setErrors({})
      setLoadError(null)
      setSubmitting(false)
      setAddEquipmentOpen(false)
    }
    prevOpenRef.current = open
    if (!open) {
      setAddEquipmentOpen(false)
    }
  }, [open, initialWorkOrderId, initialCalibrationRecordId, prefilledCatalogItem])

  useEffect(() => {
    if (!open || !issuedAt) return
    setDueDate(computeDueDateYmd(issuedAt, termsCode, termsCustomDays))
  }, [open, issuedAt, termsCode, termsCustomDays])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const supabase = createBrowserSupabaseClient()

    void (async () => {
      setLoadError(null)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || cancelled) {
        if (!cancelled) setCustomers([])
        return
      }

      if (orgContextStatus !== "ready" || !activeOrgId) {
        if (!cancelled) {
          setCustomers([])
          setLoadError(
            orgContextStatus === "ready" && !activeOrgId ? "No organization selected." : null,
          )
        }
        return
      }

      const orgId = activeOrgId

      const { data: custRows, error: custError } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("company_name")

      if (custError || cancelled) {
        if (!cancelled) setLoadError(custError?.message ?? "Failed to load customers.")
        return
      }

      if (!cancelled) setCustomers((custRows as CustomerOption[]) ?? [])
    })()

    return () => {
      cancelled = true
    }
  }, [open, orgContextStatus, activeOrgId])

  useEffect(() => {
    if (!open || !organizationId || !initialWorkOrderId) return
    let cancelled = false
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { data: wo, error } = await supabase
        .from("work_orders")
        .select("id, work_order_number, customer_id, equipment_id, title, scheduled_on, completed_at, assigned_user_id, assigned_technician_id, total_labor_cents, total_parts_cents, repair_log")
        .eq("organization_id", organizationId)
        .eq("id", initialWorkOrderId)
        .maybeSingle()
      if (cancelled || error || !wo) return
      const row = wo as {
        id: string
        work_order_number?: number | null
        customer_id: string
        equipment_id: string | null
        title: string
        scheduled_on: string | null
        completed_at: string | null
        assigned_user_id: string | null
        assigned_technician_id?: string | null
        total_labor_cents: number | null
        total_parts_cents: number | null
        repair_log: unknown
      }
      const [lineRes, techRes, profileRes, equipmentRes] = await Promise.all([
        supabase
          .from("work_order_line_items")
          .select("id, description, quantity, unit_cost_cents, catalog_item_id")
          .eq("organization_id", organizationId)
          .eq("work_order_id", row.id)
          .order("created_at", { ascending: true }),
        row.assigned_technician_id
          ? supabase
              .from("technicians")
              .select("full_name")
              .eq("organization_id", organizationId)
              .eq("id", row.assigned_technician_id)
              .maybeSingle()
          : row.assigned_user_id
            ? supabase.from("profiles").select("full_name, email").eq("id", row.assigned_user_id).maybeSingle()
            : Promise.resolve({ data: null }),
        resolveCustomerBillingProfile(supabase, { organizationId, customerId: row.customer_id }).catch(() => null),
        row.equipment_id
          ? supabase
              .from("equipment")
              .select("location_label")
              .eq("organization_id", organizationId)
              .eq("id", row.equipment_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      if (cancelled) return
      setCustomerId(row.customer_id)
      if (row.equipment_id) setEquipmentId(row.equipment_id)
      setWorkOrderId(row.id)
      const display = getWorkOrderDisplay({ id: row.id, workOrderNumber: row.work_order_number ?? undefined })
      setTitle((prev) => (prev.trim() ? prev : `Invoice — ${display}`))
      const serviceDate = row.completed_at ?? row.scheduled_on ?? null
      const techData = techRes.data as { full_name?: string | null; email?: string | null } | null
      const technicianName = techData?.full_name?.trim() || techData?.email?.trim() || null
      const equipmentData = equipmentRes.data as { location_label?: string | null } | null
      const billing = profileRes as CustomerBillingProfile | null
      if (billing?.defaultPoNumber) setPoNumber((prev) => prev || billing.defaultPoNumber || "")
      const repairLog = parseRepairLog(row.repair_log)
      const pricedLines = (lineRes.data ?? []) as Array<{
        id: string
        description: string
        quantity: string | number
        unit_cost_cents: number | null
        catalog_item_id?: string | null
      }>
      const generated: LineItem[] = pricedLines
        .filter((li) => li.description?.trim())
        .map((li) => ({
          id: crypto.randomUUID(),
          description: `${li.description.trim()} (${display})`,
          qty: String(typeof li.quantity === "number" ? li.quantity : Number.parseFloat(String(li.quantity)) || 1),
          unit: String((li.unit_cost_cents ?? 0) / 100),
          sourceRef: `work_order_line_item:${li.id}`,
          catalogItemId: li.catalog_item_id ?? undefined,
        }))
      if (generated.length === 0 && repairLog.laborHours > 0 && (row.total_labor_cents ?? 0) > 0) {
        generated.push({
          id: crypto.randomUUID(),
          description: `Labor — ${display}`,
          qty: String(repairLog.laborHours),
          unit: String((row.total_labor_cents ?? 0) / 100 / repairLog.laborHours),
          sourceRef: `work_order:${row.id}:labor`,
        })
      }
      if (generated.length === 0) {
        generated.push({
          id: crypto.randomUUID(),
          description: `Service visit — ${display}${row.title.trim() ? ` — ${row.title.trim()}` : ""}`,
          qty: "1",
          unit: "0",
          sourceRef: `work_order:${row.id}`,
        })
      }
      setLineItems(generated)
      setWorkOrderPrefill({
        id: row.id,
        display,
        title: row.title.trim() || "Service visit",
        serviceDate,
        technicianName,
        locationLabel: equipmentData?.location_label?.trim() || null,
        hadPricedItems: generated.some((li) => (parseFloat(li.unit) || 0) > 0),
      })
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, initialWorkOrderId])

  useEffect(() => {
    if (!open || !organizationId || !customerId) {
      if (!customerId) {
        setEquipmentList([])
        setWorkOrderOptions([])
        setEquipmentLoading(false)
        setWorkOrdersLoading(false)
      }
      return
    }

    let cancelled = false
    setEquipmentLoading(true)
    setWorkOrdersLoading(true)
    const supabase = createBrowserSupabaseClient()

    void (async () => {
      const woSelectWithNum = "id, work_order_number, title"
      const woSelect = "id, title"

      const [eqRes, woResFirst] = await Promise.all([
        supabase
          .from("equipment")
          .select("id, name, equipment_code, serial_number, category")
          .eq("organization_id", organizationId)
          .eq("customer_id", customerId)
          .eq("status", "active")
          .is("archived_at", null)
          .order("name"),
        supabase
          .from("work_orders")
          .select(woSelectWithNum)
          .eq("organization_id", organizationId)
          .eq("customer_id", customerId)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(100),
      ])

      let woRes = woResFirst
      if (woRes.error && missingWorkOrderNumberColumn(woRes.error)) {
        woRes = await supabase
          .from("work_orders")
          .select(woSelect)
          .eq("organization_id", organizationId)
          .eq("customer_id", customerId)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(100)
      }

      if (cancelled) return

      if (!eqRes.error) {
        setEquipmentList((eqRes.data as EquipmentOption[]) ?? [])
      } else {
        setEquipmentList([])
      }
      setEquipmentLoading(false)

      if (!woRes.error) {
        setWorkOrderOptions((woRes.data as WorkOrderOption[]) ?? [])
      } else {
        setWorkOrderOptions([])
      }
      setWorkOrdersLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [open, organizationId, customerId])

  // Phase 1: load hierarchy summary for the selected customer so we can warn
  // when no usable billing address is on file (invoice will fall back to the
  // default service location). Non-blocking; failure -> no banner.
  useEffect(() => {
    if (!open || !organizationId || !customerId) {
      setCustomerHierarchy(null)
      setBillingProfile(null)
      return
    }
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const summary = await loadCustomerHierarchy(supabase, {
        organizationId,
        customerId,
      }).catch(() => null)
      const profile = await resolveCustomerBillingProfile(supabase, {
        organizationId,
        customerId,
      }).catch(() => null)
      if (cancelled) return
      setCustomerHierarchy(summary)
      setBillingProfile(profile)
      if (profile?.defaultPoNumber) setPoNumber((prev) => prev || profile.defaultPoNumber || "")
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, customerId])

  // Invoicing Phase 2: resolve effective payment terms.
  // Reads the org default + customer override (schema-drift safe) and, when
  // the user hasn't manually edited the terms select, preselects the most
  // specific value: customer override → org default → built-in fallback.
  useEffect(() => {
    if (!open || !organizationId) return
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      let custCode: string | null = null
      let orgCode: string | null = null

      if (customerId) {
        const cRes = await supabase
          .from("customers")
          .select("default_invoice_terms_code")
          .eq("organization_id", organizationId)
          .eq("id", customerId)
          .maybeSingle()
        if (!cRes.error) {
          custCode = (cRes.data as { default_invoice_terms_code?: string | null } | null)
            ?.default_invoice_terms_code ?? null
        }
      }

      const oRes = await supabase
        .from("organizations")
        .select("default_invoice_terms_code")
        .eq("id", organizationId)
        .maybeSingle()
      if (!oRes.error) {
        orgCode = (oRes.data as { default_invoice_terms_code?: string | null } | null)
          ?.default_invoice_terms_code ?? null
      }

      if (cancelled) return
      setCustomerTermsDefault(custCode)
      setOrgTermsDefault(orgCode)

      if (!termsManuallySet) {
        const next = resolveEffectiveTermsCode({ customerCode: custCode, organizationCode: orgCode })
        if (next !== "custom") setTermsCode(next)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, customerId, termsManuallySet])

  // Invoicing Phase 2: surface certificate availability for the selected work
  // order so staff know how many certificates are on the linked job and how
  // many have already been released to the customer portal.
  useEffect(() => {
    if (!open || !organizationId || !workOrderId) {
      setLinkedCertCount(null)
      setLinkedCertReleasedCount(null)
      return
    }
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const total = await supabase
        .from("calibration_records")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("work_order_id", workOrderId)
      if (cancelled) return
      setLinkedCertCount(total.error ? null : total.count ?? 0)

      const released = await supabase
        .from("calibration_records")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("work_order_id", workOrderId)
        .not("portal_released_at", "is", null)
      if (cancelled) return
      // Phase 1 column may be missing on legacy DBs.
      setLinkedCertReleasedCount(released.error ? null : released.count ?? 0)
    })()
    return () => {
      cancelled = true
    }
  }, [open, organizationId, workOrderId])

  // ── Auto-fill from quote ──
  useEffect(() => {
    if (!quoteId) return
    const q = activeQuotes.find((qt) => qt.id === quoteId)
    if (!q) return
    if (q.customerId) setCustomerId(q.customerId)
    if (q.equipmentId) setEquipmentId(q.equipmentId)
    if (q.workOrderId) setWorkOrderId(q.workOrderId)
    setTitle(q.description || "")
    if (q.lineItems?.length) {
      setLineItems(
        q.lineItems.map((li) => ({
          id: crypto.randomUUID(),
          description: li.description,
          qty: String(li.qty),
          unit: String(li.unit),
        })),
      )
    }
    if (q.notes) setNotes(q.notes)
  }, [quoteId, activeQuotes])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !addEquipmentOpen && !catalogOpen) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, addEquipmentOpen, catalogOpen])

  const subtotal = lineItems.reduce((sum, li) => {
    const qty = parseFloat(li.qty) || 0
    const unit = parseFloat(li.unit) || 0
    return sum + qty * unit
  }, 0)
  const discountAmt = discount ? subtotal * (parseFloat(discount) / 100) : 0
  const taxAmt = tax ? (subtotal - discountAmt) * (parseFloat(tax) / 100) : 0
  const total = subtotal - discountAmt + taxAmt

  const updateLineItem = useCallback((id: string, field: keyof LineItem, value: string) => {
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, [field]: value } : li)))
  }, [])
  const addLineItem = useCallback(() => setLineItems((prev) => [...prev, newLineItem()]), [])
  const removeLineItem = useCallback((id: string) => {
    setLineItems((prev) => prev.filter((li) => li.id !== id))
  }, [])

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!customerId) errs.customerId = "Customer is required."
    if (!title.trim()) errs.title = "Invoice title is required."
    if (!issuedAt) errs.issuedAt = "Issue date is required."
    if (!dueDate) errs.dueDate = "Due date is required."
    const hasItem = lineItems.some((li) => li.description.trim())
    if (!hasItem) errs.lineItems = "At least one line item with a description is required."
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(submitStatus: InvoiceStatus) {
    if (!validate()) return
    if (!organizationId) {
      setErrors((e) => ({ ...e, customerId: "Select an organization first." }))
      return
    }
    if (toastRecordEligibilityBlocked(standardCreateEligibility)) return
    setSubmitting(true)
    const lineItemsJson = lineItems
      .filter((li) => li.description.trim())
      .map((li) => {
        const row: {
          description: string
          qty: number
          unit: number
          source_ref?: string
          catalog_item_id?: string
          sku?: string
          item_type?: string
          unit_label?: string
        } = {
          description: li.description.trim(),
          qty: parseFloat(li.qty) || 1,
          unit: parseFloat(li.unit) || 0,
        }
        if (li.catalogItemId) row.catalog_item_id = li.catalogItemId
        if (li.skuSnapshot) row.sku = li.skuSnapshot
        if (li.itemTypeSnapshot) row.item_type = li.itemTypeSnapshot
        if (li.unitLabelSnapshot) row.unit_label = li.unitLabelSnapshot
        if (li.sourceRef) row.source_ref = li.sourceRef
        return row
      })
    const { id, error: saveError } = await addInvoiceFromPayload({
      customerId,
      equipmentId: equipmentId || null,
      workOrderId: workOrderId || null,
      quoteId: quoteId || null,
      calibrationRecordId: calibrationRecordId.trim() || null,
      title: title.trim(),
      amountCents: Math.round(total * 100),
      status: submitStatus,
      issuedAt,
      dueDate,
      paidAt: null,
      lineItems: lineItemsJson,
      notes: notes.trim() ? notes.trim() : null,
      internalNotes: internalNotes.trim() ? internalNotes.trim() : null,
      termsCode,
      termsCustomDays: termsCode === "custom" ? termsCustomDays : null,
      billingCustomerId: billingProfile?.billingCustomerId ?? null,
      billingName: billingProfile?.billingName ?? null,
      billingContactName: billingProfile?.billingContactName ?? null,
      billingContactEmail: billingProfile?.billingContactEmail ?? null,
      billingContactPhone: billingProfile?.billingContactPhone ?? null,
      billingAddressLine1: billingProfile?.addressLine1 ?? null,
      billingAddressLine2: billingProfile?.addressLine2 ?? null,
      billingCity: billingProfile?.city ?? null,
      billingState: billingProfile?.state ?? null,
      billingPostalCode: billingProfile?.postalCode ?? null,
      billingCountry: billingProfile?.country ?? null,
      poNumber: poNumber.trim() || null,
      invoiceInstructions: billingProfile?.invoiceInstructions ?? null,
    })
    setSubmitting(false)
    if (saveError) {
      setErrors((e) => ({ ...e, _submit: saveError }))
      return
    }
    if (id) onSuccess?.(id, submitStatus)
    onClose()
  }

  function handleCatalogPick(row: CatalogListItemRow, qty: number) {
    const snap = buildQuoteInvoiceLineSnapshot(row, qty)
    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: snap.description,
        qty: String(snap.qty),
        unit: String(snap.unit),
        catalogItemId: snap.catalog_item_id,
        skuSnapshot: snap.sku,
        itemTypeSnapshot: snap.item_type,
        unitLabelSnapshot: snap.unit_label,
      },
    ])
  }

  function handleOpenAddEquipment() {
    if (!customerId) return
    setAddEquipmentOpen(true)
  }

  function handleAddEquipmentClose() {
    setAddEquipmentOpen(false)
  }

  async function handleAddEquipmentSuccess(newId?: string) {
    if (organizationId && customerId) {
      await refreshEquipmentForCustomer({
        organizationId,
        customerId,
        selectEquipmentId: newId,
      })
    }
  }

  if (!open) return null

  const invoiceEquipmentCustomerName = customers.find((c) => c.id === customerId)?.company_name ?? ""
  const filteredQuotes = customerId ? activeQuotes.filter((q) => q.customerId === customerId) : activeQuotes
  const invoicePanelVisible = open && !addEquipmentOpen

  return (
    <>
      {invoicePanelVisible && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create New Invoice"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => !submitting && onClose()}
          />

          <div
            className={cn(
              "relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl",
              DRAWER_PANEL_SURFACE,
            )}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-[#25324C] shrink-0">
              <div>
                <h2 className="text-base font-semibold text-foreground">Create New Invoice</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Fill in the details below to create an invoice.</p>
              </div>
              <button
                onClick={() => !submitting && onClose()}
                disabled={submitting}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {(loadError || errors._submit) && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {loadError ?? errors._submit}
                </p>
              )}

              {calibrationRecordId.trim() ? (
                <div className="rounded-lg border border-[color:var(--status-success)]/30 bg-[color:var(--status-success)]/10 px-3 py-2.5 text-sm text-foreground">
                  <span className="font-medium text-[color:var(--status-success)]">Certificate completed</span>
                  <span className="text-muted-foreground"> — this invoice is linked to the work order certificate.</span>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>Customer</Label>
                  <FieldSelect
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value)
                      setEquipmentId("")
                      setWorkOrderId("")
                      setQuoteId("")
                    }}
                  >
                    <option value="">Select customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </FieldSelect>
                  <FieldError msg={errors.customerId} />
                  {customerHierarchy?.billingAddressMissing ? (
                    <div className="mt-2 flex items-start gap-1.5 rounded-md border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10 px-2 py-1.5 text-[11px] text-[color:var(--status-warning)]">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      <span>
                        No billing address on file. The invoice will use the
                        default service location until a billing address is added
                        in the customer record.
                      </span>
                    </div>
                  ) : null}
                </div>
                <div>
                  <Label>Equipment</Label>
                  <FieldSelect
                    value={equipmentId}
                    onChange={(e) => setEquipmentId(e.target.value)}
                    disabled={!customerId || equipmentLoading || equipmentList.length === 0}
                  >
                    <option value="">
                      {!customerId
                        ? "Select customer first"
                        : equipmentLoading
                          ? "Loading equipment…"
                          : equipmentList.length === 0
                            ? "No equipment yet"
                            : "Select equipment…"}
                    </option>
                    {equipmentList.map((e) => (
                      <option key={e.id} value={e.id}>
                        {getEquipmentDisplayPrimary(e)} — {getEquipmentSecondaryLine(e, invoiceEquipmentCustomerName)}
                      </option>
                    ))}
                  </FieldSelect>
                  {customerId && !equipmentLoading && equipmentList.length === 0 && (
                    <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-3 space-y-2 mt-2">
                      <p className="text-sm text-muted-foreground">No equipment found for this customer.</p>
                      <button
                        type="button"
                        onClick={handleOpenAddEquipment}
                        className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        + Add Equipment
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Related Work Order</Label>
                  <FieldSelect
                    value={workOrderId}
                    onChange={(e) => setWorkOrderId(e.target.value)}
                    disabled={!customerId || workOrdersLoading}
                  >
                    <option value="">{workOrdersLoading ? "Loading…" : "None"}</option>
                    {workOrderOptions.map((wo) => (
                      <option key={wo.id} value={wo.id}>
                        {formatWorkOrderDisplay(wo.work_order_number, wo.id)} — {wo.title}
                      </option>
                    ))}
                  </FieldSelect>
                  {workOrderId && linkedCertCount !== null && linkedCertCount > 0 ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {linkedCertCount} certificate{linkedCertCount === 1 ? "" : "s"} on linked job
                      {linkedCertReleasedCount !== null && linkedCertReleasedCount > 0
                        ? ` · ${linkedCertReleasedCount} released`
                        : ""}
                      .
                    </p>
                  ) : null}
                  {workOrderPrefill ? (
                    <div className="mt-2 rounded-md border border-border bg-muted/25 px-2 py-1.5 text-[11px] text-muted-foreground">
                      <p className="font-semibold text-foreground">{workOrderPrefill.display} · {workOrderPrefill.title}</p>
                      <p>
                        {[
                          workOrderPrefill.serviceDate ? `Service ${new Date(workOrderPrefill.serviceDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : null,
                          workOrderPrefill.technicianName,
                          workOrderPrefill.locationLabel,
                        ].filter(Boolean).join(" · ") || "Service context linked to this invoice."}
                      </p>
                    </div>
                  ) : null}
                </div>
                <div>
                  <Label>Related Quote</Label>
                  <FieldSelect value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
                    <option value="">None</option>
                    {filteredQuotes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {quoteOptionLabel(q)}
                      </option>
                    ))}
                  </FieldSelect>
                  {quoteId && (
                    <p className="mt-1 text-[10px] text-[color:var(--status-info)]">
                      Line items auto-filled from selected quote.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label required>Invoice Title</Label>
                <FieldInput
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. HVAC Repair — April 2026"
                />
                <FieldError msg={errors.title} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <Label required>Line Items</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCatalogOpen(true)}
                      disabled={orgContextStatus !== "ready" || !activeOrgId}
                      className="flex items-center gap-1 text-xs font-medium rounded-md border border-border bg-background px-2.5 py-1 text-foreground hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <PackageSearch className="w-3.5 h-3.5" /> Add from catalog
                    </button>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add item
                    </button>
                  </div>
                </div>
                {workOrderPrefill && !workOrderPrefill.hadPricedItems ? (
                  <div className="mb-3 rounded-md border border-dashed border-border bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
                    This work order did not have priced labor or parts, so a draft service line was added at $0. Edit pricing here only if you intend to invoice it.
                  </div>
                ) : null}

                <div className="grid grid-cols-[1fr_60px_90px_80px_32px] gap-2 mb-1.5 px-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Description</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-center">Qty</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Unit Price</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Total</span>
                  <span />
                </div>

                <div className="space-y-2">
                  {lineItems.map((li) => {
                    const rowTotal = (parseFloat(li.qty) || 0) * (parseFloat(li.unit) || 0)
                    return (
                      <div key={li.id} className="grid grid-cols-[1fr_60px_90px_80px_32px] gap-2 items-center">
                        <FieldInput
                          value={li.description}
                          onChange={(e) => updateLineItem(li.id, "description", e.target.value)}
                          placeholder="Description"
                        />
                        <FieldInput
                          type="number"
                          min="1"
                          value={li.qty}
                          onChange={(e) => updateLineItem(li.id, "qty", e.target.value)}
                          className="text-center"
                        />
                        <FieldInput
                          type="number"
                          min="0"
                          step="0.01"
                          value={li.unit}
                          onChange={(e) => updateLineItem(li.id, "unit", e.target.value)}
                          placeholder="0.00"
                          className="text-right"
                        />
                        <div className="text-right text-sm font-medium text-foreground ds-tabular">
                          {rowTotal > 0 ? (
                            fmtCurrency(rowTotal)
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLineItem(li.id)}
                          disabled={lineItems.length === 1}
                          className="flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Remove line item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
                <FieldError msg={errors.lineItems} />

                <div className="mt-3 border-t border-border pt-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="ds-tabular">{fmtCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Discount</span>
                      <div className="relative w-20">
                        <FieldInput
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                          placeholder="0"
                          className="pr-5 text-right text-xs py-1"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground ds-tabular">
                      {discountAmt > 0 ? `- ${fmtCurrency(discountAmt)}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Tax</span>
                      <div className="relative w-20">
                        <FieldInput
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={tax}
                          onChange={(e) => setTax(e.target.value)}
                          placeholder="0"
                          className="pr-5 text-right text-xs py-1"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground ds-tabular">
                      {taxAmt > 0 ? `+ ${fmtCurrency(taxAmt)}` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-foreground border-t border-border pt-2 mt-1">
                    <span>Total</span>
                    <span className="ds-tabular">{fmtCurrency(total)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label required>Issue Date</Label>
                  <FieldInput type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
                  <FieldError msg={errors.issuedAt} />
                </div>
                <div>
                  <Label required>Due Date</Label>
                  <FieldInput
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={issuedAt || undefined}
                  />
                  <FieldError msg={errors.dueDate} />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Updates when issue date or payment terms change; you can override manually.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Terms</Label>
                  <FieldSelect
                    value={termsCode}
                    onChange={(e) => {
                      setTermsCode(e.target.value as InvoiceTermsCode)
                      setTermsManuallySet(true)
                    }}
                  >
                    {PAYMENT_TERMS_OPTIONS.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.label}
                      </option>
                    ))}
                  </FieldSelect>
                  {customerId ? (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {customerTermsDefault
                        ? `Default for this customer: ${invoiceTermsCodeLabel(customerTermsDefault)}.`
                        : orgTermsDefault
                          ? `Workspace default: ${invoiceTermsCodeLabel(orgTermsDefault)}.`
                          : "Workspace default not set — using Net 30 fallback."}
                    </p>
                  ) : null}
                </div>
                {termsCode === "custom" ? (
                  <div>
                    <Label required>Custom net days</Label>
                    <FieldInput
                      type="number"
                      min={1}
                      max={365}
                      value={termsCustomDays}
                      onChange={(e) => {
                        setTermsCustomDays(parseInt(e.target.value, 10) || 1)
                        setTermsManuallySet(true)
                      }}
                    />
                  </div>
                ) : (
                  <div aria-hidden className="hidden sm:block" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <FieldSelect value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)}>
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                  </FieldSelect>
                </div>
              </div>

              {billingProfile ? (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Billing &amp; PO</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {billingProfile.inheritedFromParent
                          ? `Using parent billing from ${billingProfile.billingCustomerName}.`
                          : "Using this customer's billing settings."}
                      </p>
                    </div>
                    {billingProfile.poRequiredBeforeInvoice && !poNumber.trim() ? (
                      <span className="rounded-full border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--status-warning)]">
                        PO needed
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>PO number</Label>
                      <FieldInput
                        value={poNumber}
                        onChange={(e) => setPoNumber(e.target.value)}
                        placeholder={billingProfile.poRequired ? "Required by customer" : "Optional"}
                      />
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      <p className="font-medium text-foreground">{billingProfile.billingName}</p>
                      <p>
                        {[billingProfile.addressLine1, billingProfile.city, billingProfile.state, billingProfile.postalCode]
                          .filter(Boolean)
                          .join(", ") || "No billing address on file."}
                      </p>
                    </div>
                  </div>
                  {billingProfile.poRequiredBeforeInvoice && !poNumber.trim() ? (
                    <div className="flex items-start gap-2 rounded-md border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10 px-2 py-1.5 text-[11px] text-[color:var(--status-warning)]">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      <span>This customer requires a PO before invoicing. You can still save a draft.</span>
                    </div>
                  ) : null}
                  {billingProfile.invoiceInstructions ? (
                    <div className="rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">Invoice instructions:</span>{" "}
                      {billingProfile.invoiceInstructions}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div>
                <Label>Notes</Label>
                <FieldTextarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Customer-facing notes…"
                />
              </div>

              <div>
                <Label>Internal Notes</Label>
                <FieldTextarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Internal team notes (not visible to customer)…"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0 bg-muted/30">
              <button
                type="button"
                onClick={() => !submitting && onClose()}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit("Draft")}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
              >
                <FilePen className="w-3.5 h-3.5" />
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit("Sent")}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-cta text-cta-foreground hover:bg-cta-hover active:bg-cta-active transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Send Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      <AddFromCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        organizationId={organizationId}
        onPick={handleCatalogPick}
      />

      <AddEquipmentModal
        open={addEquipmentOpen}
        onClose={handleAddEquipmentClose}
        onSuccess={(id) => void handleAddEquipmentSuccess(id)}
        prefilledCustomerId={customerId || null}
        offerMaintenancePlanNext={false}
      />
    </>
  )
}
