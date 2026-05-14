"use client"

import { useEffect, useMemo, useState } from "react"
import { enforceCanCreateRecord } from "@/app/actions/org-create-enforcement"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useBillingAccess } from "@/lib/billing-access-context"
import { toastRecordEligibilityBlocked } from "@/lib/billing/guard-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { CalendarPlus, Check, CheckCircle2, ChevronsUpDown, X } from "lucide-react"
import { DRAWER_PANEL_SURFACE } from "@/components/detail-drawer"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { formatCustomerLocationSelectLabel } from "@/lib/customer-locations/format"
import { useEquipmentFormIndustryUi } from "@/hooks/use-equipment-form-industry-ui"
import { useEquipmentTypes, equipmentCategorySelectOptions } from "@/lib/equipment-type-store"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface AddEquipmentModalProps {
  open: boolean
  onClose: () => void
  /** Called with new row id after a successful insert (before modal closes). May return a Promise. */
  onSuccess?: (equipmentId?: string) => void | Promise<void>
  /** When set, customer field is prefilled (e.g. creating equipment from customer context). */
  prefilledCustomerId?: string | null
  /**
   * When true (default), after save show a compact next-step choice (maintenance plan vs done).
   * Set false when this modal is opened from Create/Edit Maintenance Plan (already in that flow).
   */
  offerMaintenancePlanNext?: boolean
  /** Called when user chooses “Create Maintenance Plan” on the success step. Modal closes after this. */
  onCreateMaintenancePlan?: (ctx: { customerId: string; equipmentId: string }) => void
}

const STATUSES = ["Active", "Needs Service", "In Repair", "Out of Service"] as const
type EquipmentStatus = (typeof STATUSES)[number]
type CustomerOption = { id: string; company_name: string }

/** Popover must stack above Add Equipment dialog (`z-[231]`) and in-modal toasts (`z-[240]`). */
const ADD_EQUIPMENT_CUSTOMER_POPOVER_Z = "z-[245]"

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-foreground mb-1">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )
}

function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col", className)}>{children}</div>
}

const INITIAL_FORM = {
  name: "",
  equipmentType: "",
  subcategory: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  customerId: "",
  serviceSiteId: "",
  location: "",
  installDate: "",
  warrantyExpiration: "",
  lastServiceDate: "",
  nextServiceDue: "",
  nextCalibrationDue: "",
  calibrationIntervalMonths: "",
  serviceInterval: "",
  status: "Active" as EquipmentStatus,
  notes: "",
}

type FormState = typeof INITIAL_FORM
type FormErrors = Partial<Record<keyof FormState, string>>

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {}
  if (!form.name.trim()) errors.name = "Equipment name is required"
  if (!form.equipmentType.trim()) errors.equipmentType = "Equipment type is required"
  if (!form.customerId.trim()) errors.customerId = "Customer is required"
  return errors
}

/** Normalize optional date fields for Postgres `date` columns (expects `YYYY-MM-DD`). */
function normalizeOptionalDateInput(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const t = Date.parse(s)
  if (!Number.isNaN(t)) {
    const d = new Date(t)
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, "0")
    const da = String(d.getDate()).padStart(2, "0")
    return `${y}-${mo}-${da}`
  }
  return null
}

/** Non-empty text that is not a valid calendar date (for field-level errors). */
function optionalDateFieldError(raw: string): string | undefined {
  const s = raw.trim()
  if (!s) return undefined
  return normalizeOptionalDateInput(s) === null
    ? "Use a valid date (calendar or YYYY-MM-DD)."
    : undefined
}

function friendlyInsertError(message: string): string {
  const m = message.trim()
  if (!m) return "Could not save equipment. Please try again."
  const ml = m.toLowerCase()
  if (ml.includes("row-level security") || ml.includes("violates row-level security") || m.includes("42501")) {
    return "Save failed: your account does not have permission to insert equipment for this workspace (for example, support-session access may not allow this action). Try as a workspace owner or admin, or contact support."
  }
  if (m.includes("violates foreign key")) {
    return "Save failed: linked customer or site is no longer valid. Pick the customer again and retry."
  }
  if (m.includes("invalid input syntax for type date")) {
    return "Save failed: a date field was not in YYYY-MM-DD form. Clear the date or re-pick it from the calendar."
  }
  if (m.length > 220) return `${m.slice(0, 217)}…`
  return m
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function equipmentSaveDebug(
  message: string,
  details?: Record<string, unknown>,
  activeOrgId: string | null | undefined = undefined,
) {
  if (process.env.NEXT_PUBLIC_DEBUG_EQUIPMENT_SAVE !== "true") return
  if (typeof window === "undefined") return
  const orgHint =
    activeOrgId && activeOrgId.length > 12 ? `…${activeOrgId.slice(-8)}` : activeOrgId === null || activeOrgId === undefined ? "(none)" : activeOrgId
  console.info("[equipify:equipment-save]", message, { ...details, organizationIdHint: orgHint })
}

export function AddEquipmentModal({
  open,
  onClose,
  onSuccess,
  prefilledCustomerId = null,
  offerMaintenancePlanNext = true,
  onCreateMaintenancePlan,
}: AddEquipmentModalProps) {
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const { equipmentCreateEligibility } = useBillingAccess()
  const { ui } = useEquipmentFormIndustryUi(activeOrgId ?? null, orgStatus === "ready", open)
  const { types: orgEquipmentTypes, loading: equipmentTypesLoading, error: equipmentTypesQueryError } =
    useEquipmentTypes()
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [postSave, setPostSave] = useState<{ customerId: string; equipmentId: string } | null>(null)
  const [serviceSiteOptions, setServiceSiteOptions] = useState<Array<{ id: string; label: string }>>([])

  useEffect(() => {
    if (!open || orgStatus !== "ready" || !activeOrgId) {
      if (!open) {
        setCustomers([])
        setCustomersLoading(false)
        setCustomerPopoverOpen(false)
      }
      return
    }
    setCustomersLoading(true)
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", activeOrgId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("company_name", { ascending: true })

      setCustomers((data as CustomerOption[] | null) ?? [])
      setCustomersLoading(false)
    })()
  }, [open, orgStatus, activeOrgId])

  useEffect(() => {
    if (!open) return
    setPostSave(null)
    setServiceSiteOptions([])
    setForm({
      ...INITIAL_FORM,
      ...(prefilledCustomerId ? { customerId: prefilledCustomerId } : {}),
    })
    setErrors({})
    setSaveError(null)
  }, [open, prefilledCustomerId])

  useEffect(() => {
    if (!open || orgStatus !== "ready" || !activeOrgId || !form.customerId) {
      setServiceSiteOptions([])
      return
    }
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { data, error } = await supabase
        .from("customer_locations")
        .select("id, name, address_line1, address_line2, city, state, postal_code, is_default")
        .eq("organization_id", activeOrgId)
        .eq("customer_id", form.customerId)
        .is("archived_at", null)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true })
      if (error) {
        setServiceSiteOptions([])
        return
      }
      const rows =
        (data ?? []) as Array<{
          id: string
          name: string
          address_line1: string
          address_line2: string | null
          city: string
          state: string
          postal_code: string
          is_default: boolean | null
        }>
      const opts = rows.map((r) => ({
        id: r.id,
        label: formatCustomerLocationSelectLabel({
          name: r.name,
          address_line1: r.address_line1,
          address_line2: r.address_line2,
          city: r.city,
          state: r.state,
          postal_code: r.postal_code,
        }),
      }))
      setServiceSiteOptions(opts)
      setForm((prev) => {
        if (opts.length === 0) return { ...prev, serviceSiteId: "" }
        if (opts.some((o) => o.id === prev.serviceSiteId)) return prev
        if (!prev.serviceSiteId.trim()) return { ...prev, serviceSiteId: "" }
        const def = rows.find((r) => r.is_default)?.id ?? opts[0]?.id ?? ""
        return { ...prev, serviceSiteId: def }
      })
    })()
  }, [open, orgStatus, activeOrgId, form.customerId])

  const equipmentTypeOptions = useMemo(
    () => equipmentCategorySelectOptions(orgEquipmentTypes, form.equipmentType),
    [orgEquipmentTypes, form.equipmentType],
  )

  const selectedCustomerLabel = useMemo(() => {
    if (!form.customerId.trim()) return "Select customer…"
    const fromList = customers.find((c) => c.id === form.customerId)
    if (fromList) return fromList.company_name
    if (customersLoading) return "Loading customers…"
    return "Selected customer"
  }, [form.customerId, customers, customersLoading])

  /**
   * After types load, clear a draft type only if it does not match any DB-backed type name.
   * Skip while the list is empty during fetch — otherwise Safari/slow networks clear the user's pick.
   */
  useEffect(() => {
    if (!open || equipmentTypesLoading || orgEquipmentTypes.length === 0) return
    setForm((prev) => {
      const v = prev.equipmentType.trim()
      if (!v) return prev
      if (orgEquipmentTypes.some((t) => t.name === v)) return prev
      return { ...prev, equipmentType: "" }
    })
  }, [open, equipmentTypesLoading, orgEquipmentTypes])

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function handleClose() {
    setPostSave(null)
    setForm(INITIAL_FORM)
    setErrors({})
    setSaveError(null)
    setCustomerPopoverOpen(false)
    onClose()
  }

  function handleDoneAfterSave() {
    handleClose()
  }

  function handleCreatePlanAfterSave() {
    if (postSave) {
      onCreateMaintenancePlan?.(postSave)
    }
    handleClose()
  }

  async function handleSave() {
    equipmentSaveDebug("handler_enter", {}, activeOrgId)
    setSaveError(null)

    const errs = validate(form)
    const dateKeys = [
      "installDate",
      "warrantyExpiration",
      "lastServiceDate",
      "nextServiceDue",
      "nextCalibrationDue",
    ] as const satisfies readonly (keyof FormState)[]
    for (const key of dateKeys) {
      const msg = optionalDateFieldError(form[key])
      if (msg) errs[key] = msg
    }

    const cid = form.customerId.trim()
    if (cid && !UUID_RE.test(cid)) {
      errs.customerId = "Customer selection is invalid. Open the customer list and pick a customer again."
    } else if (cid && !customersLoading && customers.length > 0 && !customers.some((c) => c.id === cid)) {
      errs.customerId =
        "Selected customer is not in the loaded list for this workspace. Re-select the customer (search again) and save."
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      const line = Object.values(errs).filter(Boolean).join(" · ")
      setSaveError(line)
      equipmentSaveDebug("validation_failed", { fields: Object.keys(errs) }, activeOrgId)
      toast({
        variant: "destructive",
        title: "Fix the highlighted fields",
        description: line,
      })
      return
    }

    if (!equipmentCreateEligibility.ok) {
      setSaveError(equipmentCreateEligibility.message)
      equipmentSaveDebug("blocked_eligibility", { reason: equipmentCreateEligibility.reason }, activeOrgId)
      toastRecordEligibilityBlocked(equipmentCreateEligibility)
      return
    }

    if (!activeOrgId) {
      const msg = "No organization selected."
      setSaveError(msg)
      toast({ variant: "destructive", title: "Cannot add equipment", description: msg })
      return
    }

    setSaving(true)
    try {
      equipmentSaveDebug("enforce_start", {}, activeOrgId)
      let serverGate: Awaited<ReturnType<typeof enforceCanCreateRecord>>
      try {
        serverGate = await enforceCanCreateRecord(activeOrgId, "equipment")
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not verify permission to save equipment (server action failed)."
        setSaveError(msg)
        toast({ variant: "destructive", title: "Cannot save equipment", description: msg })
        equipmentSaveDebug("enforce_threw", { message: msg }, activeOrgId)
        return
      }

      if (!serverGate.ok) {
        equipmentSaveDebug(
          "enforce_error",
          { code: serverGate.code, httpStatus: serverGate.httpStatus },
          activeOrgId,
        )
        setSaveError(serverGate.message)
        toast({ variant: "destructive", title: "Cannot add equipment", description: serverGate.message })
        return
      }

      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        const msg = "You must be logged in to save equipment."
        setSaveError(msg)
        toast({ variant: "destructive", title: "Sign in required", description: msg })
        return
      }

      if (orgStatus !== "ready" || !activeOrgId) {
        const msg =
          orgStatus === "ready" && !activeOrgId ? "No organization selected." : "Workspace is still loading. Try again in a moment."
        setSaveError(msg)
        toast({ variant: "destructive", title: "Cannot save yet", description: msg })
        return
      }

      const statusMap: Record<EquipmentStatus, "active" | "needs_service" | "in_repair" | "out_of_service"> = {
        Active: "active",
        "Needs Service": "needs_service",
        "In Repair": "in_repair",
        "Out of Service": "out_of_service",
      }

      const installDate = normalizeOptionalDateInput(form.installDate)
      const warrantyExpiration = normalizeOptionalDateInput(form.warrantyExpiration)
      const lastServiceDate = normalizeOptionalDateInput(form.lastServiceDate)
      const nextServiceDue = normalizeOptionalDateInput(form.nextServiceDue)
      const nextCalibrationDue = normalizeOptionalDateInput(form.nextCalibrationDue)

      const insertPayload = {
        organization_id: activeOrgId,
        customer_id: cid,
        name: (form.model || form.name).trim(),
        manufacturer: form.manufacturer.trim() || null,
        category: form.equipmentType.trim(),
        subcategory: form.subcategory.trim() || null,
        serial_number: form.serialNumber.trim() || null,
        status: statusMap[form.status],
        install_date: installDate,
        warranty_expires_at: warrantyExpiration,
        last_service_at: lastServiceDate,
        next_due_at: nextServiceDue,
        next_calibration_due_at: nextCalibrationDue,
        calibration_interval_months: (() => {
          const n = parseInt(form.calibrationIntervalMonths.trim(), 10)
          return Number.isFinite(n) && n > 0 ? n : null
        })(),
        location_label: form.location.trim() || null,
        customer_location_id: form.serviceSiteId.trim() || null,
        notes: form.notes.trim() || null,
      }

      equipmentSaveDebug("insert_start", { payloadKeys: Object.keys(insertPayload) }, activeOrgId)

      const { data: inserted, error } = await supabase
        .from("equipment")
        .insert(insertPayload)
        .select("id")
        .maybeSingle()

      equipmentSaveDebug("insert_finished", { hasError: Boolean(error), hasRow: Boolean(inserted?.id) }, activeOrgId)

      if (error) {
        const msg = friendlyInsertError(error.message ?? "Unknown error")
        setSaveError(msg)
        toast({ variant: "destructive", title: "Could not save equipment", description: msg })
        return
      }

      const newId = inserted?.id
      if (!newId) {
        const msg =
          "Save did not return a new equipment row. This usually means insert permission was denied or blocked after validation."
        setSaveError(msg)
        toast({ variant: "destructive", title: "Could not save equipment", description: msg })
        return
      }

      await Promise.resolve(onSuccess?.(newId))

      if (offerMaintenancePlanNext && newId && form.customerId && onCreateMaintenancePlan) {
        toast({
          title: "Equipment added",
          description: "You can start a maintenance plan for this asset next.",
        })
        setPostSave({ customerId: form.customerId, equipmentId: newId })
        return
      }

      if (!offerMaintenancePlanNext) {
        handleClose()
        return
      }

      toast({
        title: "Equipment added",
        description: "The new asset is available in your equipment list.",
      })
      handleClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unexpected error while saving equipment."
      setSaveError(msg)
      toast({ variant: "destructive", title: "Could not save equipment", description: msg })
      equipmentSaveDebug("handler_unexpected", { message: msg }, activeOrgId)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop — stay below dialog so taps hit controls on mobile Safari */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        className="fixed inset-0 z-[230] bg-black/50 backdrop-blur-[2px]"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={postSave ? "Equipment saved" : "Add Equipment"}
        className="fixed inset-0 z-[231] flex items-start justify-center pt-10 sm:pt-12 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pointer-events-none"
      >
        <div
          className={cn(
            "relative w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[calc(100dvh-5rem)] pointer-events-auto",
            DRAWER_PANEL_SURFACE,
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-[#25324C] shrink-0">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {postSave ? "Equipment saved" : "Add Equipment"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {postSave
                  ? "Choose what you'd like to do next."
                  : "Fill in the details to register new equipment."}
              </p>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Success step (no form clutter) */}
          {postSave ? (
            <div className="flex flex-col items-center text-center px-6 py-10 sm:py-12">
              <CheckCircle2 className="w-12 h-12 text-[color:var(--status-success)] mb-4 shrink-0" aria-hidden />
              <p className="text-sm font-medium text-foreground max-w-sm">
                {(form.model || form.name).trim() || "Equipment"} is registered.
              </p>
              <p className="text-xs text-muted-foreground mt-2 max-w-sm">
                Create a maintenance plan now, or return to your workspace.
              </p>
            </div>
          ) : (
          /* Scrollable body */
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {equipmentTypesQueryError ? (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                Equipment types could not be loaded: {equipmentTypesQueryError}. You can still type a category below
                if the field is shown. If this persists under support access, your session may lack read access to
                organization equipment types.
              </p>
            ) : null}
            {/* Row 1 */}
            <div className="grid grid-cols-2 gap-4">
              <Field className="col-span-2 sm:col-span-1">
                <Label required>Equipment Name</Label>
                <Input
                  placeholder={ui.placeholders.name}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </Field>
              <Field>
                <Label required>Equipment Type</Label>
                {equipmentTypesLoading ? (
                  <NativeSelect
                    value={form.equipmentType}
                    onChange={(e) => set("equipmentType", e.target.value)}
                    disabled
                    aria-invalid={Boolean(errors.equipmentType)}
                  >
                    <option value="">Loading types…</option>
                  </NativeSelect>
                ) : orgEquipmentTypes.length === 0 ? (
                  <>
                    <Input
                      placeholder="Category / type name"
                      value={form.equipmentType}
                      onChange={(e) => set("equipmentType", e.target.value)}
                      aria-invalid={Boolean(errors.equipmentType)}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      No configured equipment types for this workspace — enter a category name (same as you would pick
                      from the list).
                    </p>
                  </>
                ) : (
                  <NativeSelect
                    value={form.equipmentType}
                    onChange={(e) => set("equipmentType", e.target.value)}
                    aria-invalid={Boolean(errors.equipmentType)}
                  >
                    <option value="">Select type...</option>
                    {equipmentTypeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </NativeSelect>
                )}
                {errors.equipmentType && <p className="text-xs text-destructive mt-1">{errors.equipmentType}</p>}
              </Field>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>Manufacturer</Label>
                <Input
                  placeholder={ui.placeholders.manufacturer}
                  value={form.manufacturer}
                  onChange={(e) => set("manufacturer", e.target.value)}
                />
              </Field>
              <Field>
                <Label>Model</Label>
                <Input placeholder={ui.placeholders.model} value={form.model} onChange={(e) => set("model", e.target.value)} />
              </Field>
            </div>

            <Field>
              <Label>Subcategory (optional)</Label>
              <Input
                placeholder={ui.placeholders.subcategory}
                value={form.subcategory}
                onChange={(e) => set("subcategory", e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">{ui.subcategoryHint}</p>
            </Field>

            {/* Row 3 */}
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>Serial Number</Label>
                <Input
                  placeholder={ui.placeholders.serialNumber}
                  value={form.serialNumber}
                  onChange={(e) => set("serialNumber", e.target.value)}
                />
              </Field>
              <Field>
                <Label required>Customer</Label>
                <Popover modal={false} open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerPopoverOpen}
                      aria-invalid={errors.customerId ? true : undefined}
                      disabled={!activeOrgId || orgStatus !== "ready"}
                      className={cn(
                        "h-9 w-full justify-between font-normal",
                        errors.customerId &&
                          "border-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
                      )}
                    >
                      <span className="truncate text-left">{selectedCustomerLabel}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className={cn("w-[var(--radix-popover-trigger-width)] p-0", ADD_EQUIPMENT_CUSTOMER_POPOVER_Z)}
                    align="start"
                  >
                    {customersLoading ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">Loading customers…</div>
                    ) : customers.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">No customers found</div>
                    ) : (
                      <Command>
                        <CommandInput placeholder="Search customers…" />
                        <CommandList>
                          <CommandEmpty>No customers found</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="__clear_customer"
                              onPointerDown={(e) => {
                                e.preventDefault()
                              }}
                              onSelect={() => {
                                set("customerId", "")
                                setCustomerPopoverOpen(false)
                              }}
                            >
                              <Check
                                className={cn("mr-2 h-4 w-4", !form.customerId.trim() ? "opacity-100" : "opacity-0")}
                              />
                              <span className="truncate text-muted-foreground">Select customer…</span>
                            </CommandItem>
                            {customers.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.company_name} ${c.id}`}
                                onPointerDown={(e) => {
                                  e.preventDefault()
                                }}
                                onSelect={() => {
                                  set("customerId", c.id)
                                  setCustomerPopoverOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    form.customerId === c.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <span className="truncate">{c.company_name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    )}
                  </PopoverContent>
                </Popover>
                {errors.customerId && <p className="text-xs text-destructive mt-1">{errors.customerId}</p>}
              </Field>
            </div>

            {/* Row 4 */}
            {form.customerId && serviceSiteOptions.length > 0 && (
              <Field>
                <Label>Service site</Label>
                <NativeSelect
                  value={form.serviceSiteId}
                  onChange={(e) => set("serviceSiteId", e.target.value)}
                >
                  <option value="">Select site…</option>
                  {serviceSiteOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-[10px] text-muted-foreground mt-1">{ui.serviceSiteLocationHint}</p>
              </Field>
            )}
            <Field>
              <Label>Room / area label</Label>
              <Input
                placeholder={ui.placeholders.location}
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </Field>

            {/* Dates row */}
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>Install Date</Label>
                <Input
                  type="date"
                  value={form.installDate}
                  onChange={(e) => set("installDate", e.target.value)}
                  aria-invalid={Boolean(errors.installDate)}
                />
                {errors.installDate && <p className="text-xs text-destructive mt-1">{errors.installDate}</p>}
              </Field>
              <Field>
                <Label>Warranty Expiration</Label>
                <Input
                  type="date"
                  value={form.warrantyExpiration}
                  onChange={(e) => set("warrantyExpiration", e.target.value)}
                  aria-invalid={Boolean(errors.warrantyExpiration)}
                />
                {errors.warrantyExpiration && (
                  <p className="text-xs text-destructive mt-1">{errors.warrantyExpiration}</p>
                )}
              </Field>
              <Field>
                <Label>Last Service Date</Label>
                <Input
                  type="date"
                  value={form.lastServiceDate}
                  onChange={(e) => set("lastServiceDate", e.target.value)}
                  aria-invalid={Boolean(errors.lastServiceDate)}
                />
                {errors.lastServiceDate && (
                  <p className="text-xs text-destructive mt-1">{errors.lastServiceDate}</p>
                )}
              </Field>
              <Field>
                <Label>Next Service Due</Label>
                <Input
                  type="date"
                  value={form.nextServiceDue}
                  onChange={(e) => set("nextServiceDue", e.target.value)}
                  aria-invalid={Boolean(errors.nextServiceDue)}
                />
                {errors.nextServiceDue && <p className="text-xs text-destructive mt-1">{errors.nextServiceDue}</p>}
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>{ui.calibrationDueLabel}</Label>
                <Input
                  type="date"
                  value={form.nextCalibrationDue}
                  onChange={(e) => set("nextCalibrationDue", e.target.value)}
                  aria-invalid={Boolean(errors.nextCalibrationDue)}
                />
                {errors.nextCalibrationDue && (
                  <p className="text-xs text-destructive mt-1">{errors.nextCalibrationDue}</p>
                )}
              </Field>
              <Field>
                <Label>Calibration interval (months)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder={ui.calibrationIntervalPlaceholder}
                  value={form.calibrationIntervalMonths}
                  onChange={(e) => set("calibrationIntervalMonths", e.target.value)}
                />
              </Field>
            </div>

            {/* Row service interval + status */}
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>Service Interval</Label>
                <Input
                  placeholder={ui.placeholders.serviceInterval}
                  value={form.serviceInterval}
                  onChange={(e) => set("serviceInterval", e.target.value)}
                />
              </Field>
              <Field>
                <Label>Status</Label>
                <NativeSelect value={form.status} onChange={(e) => set("status", e.target.value as EquipmentStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </NativeSelect>
              </Field>
            </div>

            {/* Notes */}
            <Field>
              <Label>Notes</Label>
              <Textarea
                rows={3}
                className="resize-none"
                placeholder={ui.placeholders.notes}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </div>
          )}

          {/* Footer */}
          <div className="flex flex-col gap-2 px-6 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border shrink-0">
            {saveError && !postSave ? (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {saveError}
              </p>
            ) : null}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 py-3">
            {postSave ? (
              <>
                <Button type="button" variant="outline" onClick={handleDoneAfterSave} className="cursor-pointer w-full sm:w-auto">
                  Done
                </Button>
                <Button type="button" onClick={handleCreatePlanAfterSave} className="cursor-pointer gap-2 w-full sm:w-auto">
                  <CalendarPlus className="h-4 w-4 shrink-0" />
                  Create Maintenance Plan
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handleClose} className="cursor-pointer">
                  Cancel
                </Button>
                <Button type="button" onClick={() => void handleSave()} className="cursor-pointer min-h-10" disabled={saving}>
                  {saving ? "Saving…" : "Save Equipment"}
                </Button>
              </>
            )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
