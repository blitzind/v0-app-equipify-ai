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
import { CalendarPlus, CheckCircle2, X } from "lucide-react"
import { DRAWER_PANEL_SURFACE } from "@/components/detail-drawer"
import { BR_STACK_CLEAR_AIDEN } from "@/lib/layout/aiden-safe-area"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { formatCustomerLocationSelectLabel } from "@/lib/customer-locations/format"
import { useEquipmentFormIndustryUi } from "@/hooks/use-equipment-form-industry-ui"
import { useEquipmentTypes, equipmentCategorySelectOptions } from "@/lib/equipment-type-store"

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
  if (!form.equipmentType) errors.equipmentType = "Equipment type is required"
  if (!form.customerId) errors.customerId = "Customer is required"
  return errors
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
  const { types: orgEquipmentTypes, loading: equipmentTypesLoading } = useEquipmentTypes()
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [postSave, setPostSave] = useState<{ customerId: string; equipmentId: string } | null>(null)
  const [serviceSiteOptions, setServiceSiteOptions] = useState<Array<{ id: string; label: string }>>([])

  useEffect(() => {
    if (!open || orgStatus !== "ready" || !activeOrgId) {
      if (!open) setCustomers([])
      return
    }
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
        const stillValid = opts.some((o) => o.id === prev.serviceSiteId)
        if (stillValid) return prev
        const def = rows.find((r) => r.is_default)?.id ?? opts[0]?.id ?? ""
        return { ...prev, serviceSiteId: def }
      })
    })()
  }, [open, orgStatus, activeOrgId, form.customerId])

  const equipmentTypeOptions = useMemo(
    () => equipmentCategorySelectOptions(orgEquipmentTypes, form.equipmentType),
    [orgEquipmentTypes, form.equipmentType],
  )

  useEffect(() => {
    if (!open) return
    setForm((prev) => {
      const v = prev.equipmentType.trim()
      if (!v) return prev
      if (orgEquipmentTypes.some((t) => t.name === v)) return prev
      return { ...prev, equipmentType: "" }
    })
  }, [open, orgEquipmentTypes])

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function handleClose() {
    setPostSave(null)
    setForm(INITIAL_FORM)
    setErrors({})
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
    const errs = validate(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    if (toastRecordEligibilityBlocked(equipmentCreateEligibility)) return

    if (!activeOrgId) {
      toast({ variant: "destructive", title: "Cannot add equipment", description: "No organization selected." })
      return
    }

    const serverGate = await enforceCanCreateRecord(activeOrgId, "equipment")
    if (!serverGate.ok) {
      toast({ variant: "destructive", title: "Cannot add equipment", description: serverGate.message })
      return
    }

    setSaving(true)
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSaving(false)
      setToastMsg("You must be logged in.")
      setTimeout(() => setToastMsg(null), 3500)
      return
    }

    if (orgStatus !== "ready" || !activeOrgId) {
      setSaving(false)
      setToastMsg(
        orgStatus === "ready" && !activeOrgId ? "No organization selected." : "Loading organization…"
      )
      setTimeout(() => setToastMsg(null), 3500)
      return
    }

    const statusMap: Record<EquipmentStatus, "active" | "needs_service" | "in_repair" | "out_of_service"> = {
      Active: "active",
      "Needs Service": "needs_service",
      "In Repair": "in_repair",
      "Out of Service": "out_of_service",
    }

    const { data: inserted, error } = await supabase
      .from("equipment")
      .insert({
        organization_id: activeOrgId,
        customer_id: form.customerId,
        name: (form.model || form.name).trim(),
        manufacturer: form.manufacturer.trim() || null,
        category: form.equipmentType.trim(),
        subcategory: form.subcategory.trim() || null,
        serial_number: form.serialNumber.trim() || null,
        status: statusMap[form.status],
        install_date: form.installDate || null,
        warranty_expires_at: form.warrantyExpiration || null,
        last_service_at: form.lastServiceDate || null,
        next_due_at: form.nextServiceDue || null,
        next_calibration_due_at: form.nextCalibrationDue.trim() ? form.nextCalibrationDue.trim() : null,
        calibration_interval_months: (() => {
          const n = parseInt(form.calibrationIntervalMonths.trim(), 10)
          return Number.isFinite(n) && n > 0 ? n : null
        })(),
        location_label: form.location.trim() || null,
        customer_location_id: form.serviceSiteId.trim() || null,
        notes: form.notes.trim() || null,
      })
      .select("id")
      .single()

    if (error) {
      setSaving(false)
      setToastMsg(error.message)
      setTimeout(() => setToastMsg(null), 3500)
      return
    }

    const newId = (inserted as { id: string } | null)?.id

    setSaving(false)
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
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
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
        className="fixed inset-0 z-[230] flex items-start justify-center pt-12 px-4 pb-8"
      >
        <div
          className={cn(
            "relative w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[calc(100vh-6rem)]",
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
                <NativeSelect
                  value={form.equipmentType}
                  onChange={(e) => set("equipmentType", e.target.value)}
                  disabled={equipmentTypesLoading}
                  aria-invalid={Boolean(errors.equipmentType)}
                >
                  {equipmentTypesLoading ? (
                    <option value="">Loading types…</option>
                  ) : (
                    <>
                      <option value="">Select type...</option>
                      {equipmentTypeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </>
                  )}
                </NativeSelect>
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
                <NativeSelect
                  value={form.customerId}
                  onChange={(e) => set("customerId", e.target.value)}
                  aria-invalid={Boolean(errors.customerId)}
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </NativeSelect>
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
                <Input type="date" value={form.installDate} onChange={(e) => set("installDate", e.target.value)} />
              </Field>
              <Field>
                <Label>Warranty Expiration</Label>
                <Input type="date" value={form.warrantyExpiration} onChange={(e) => set("warrantyExpiration", e.target.value)} />
              </Field>
              <Field>
                <Label>Last Service Date</Label>
                <Input type="date" value={form.lastServiceDate} onChange={(e) => set("lastServiceDate", e.target.value)} />
              </Field>
              <Field>
                <Label>Next Service Due</Label>
                <Input type="date" value={form.nextServiceDue} onChange={(e) => set("nextServiceDue", e.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>{ui.calibrationDueLabel}</Label>
                <Input type="date" value={form.nextCalibrationDue} onChange={(e) => set("nextCalibrationDue", e.target.value)} />
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
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
            {postSave ? (
              <>
                <Button variant="outline" onClick={handleDoneAfterSave} className="cursor-pointer w-full sm:w-auto">
                  Done
                </Button>
                <Button onClick={handleCreatePlanAfterSave} className="cursor-pointer gap-2 w-full sm:w-auto">
                  <CalendarPlus className="h-4 w-4 shrink-0" />
                  Create Maintenance Plan
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose} className="cursor-pointer">
                  Cancel
                </Button>
                <Button onClick={handleSave} className="cursor-pointer" disabled={saving}>
                  {saving ? "Saving..." : "Save Equipment"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div
          className={cn(
            BR_STACK_CLEAR_AIDEN,
            "z-[240] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium bg-[color:var(--status-success)] text-white animate-in slide-in-from-right-4 fade-in duration-200",
          )}
        >
          {toastMsg}
        </div>
      )}
    </>
  )
}
