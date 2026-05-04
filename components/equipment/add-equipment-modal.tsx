"use client"

import { useEffect, useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { Button } from "@/components/ui/button"
import { CheckCircle2, X } from "lucide-react"
import { MaintenancePlansBrandTile } from "@/lib/navigation/module-icons"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

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

const EQUIPMENT_TYPES = [
  "HVAC", "Electrical", "Plumbing", "Mechanical", "Refrigeration",
  "Fire Safety", "Security", "Lighting", "Elevator", "Generator",
  "Compressor", "Conveyor", "Pump", "Boiler", "Chiller", "Other",
]

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

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
        "placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors",
        className
      )}
      {...props}
    />
  )
}

function Select({ children, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
        "outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground",
        "placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none",
        className
      )}
      {...props}
    />
  )
}

const INITIAL_FORM = {
  name: "",
  equipmentType: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  customerId: "",
  location: "",
  installDate: "",
  warrantyExpiration: "",
  lastServiceDate: "",
  nextServiceDue: "",
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
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [postSave, setPostSave] = useState<{ customerId: string; equipmentId: string } | null>(null)

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
        .eq("is_archived", false)
        .order("company_name", { ascending: true })

      setCustomers((data as CustomerOption[] | null) ?? [])
    })()
  }, [open, orgStatus, activeOrgId])

  useEffect(() => {
    if (!open) return
    setPostSave(null)
    setForm({
      ...INITIAL_FORM,
      ...(prefilledCustomerId ? { customerId: prefilledCustomerId } : {}),
    })
    setErrors({})
  }, [open, prefilledCustomerId])

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
        serial_number: form.serialNumber.trim() || null,
        status: statusMap[form.status],
        install_date: form.installDate || null,
        warranty_expires_at: form.warrantyExpiration || null,
        last_service_at: form.lastServiceDate || null,
        next_due_at: form.nextServiceDue || null,
        location_label: form.location.trim() || null,
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
        <div className="relative w-full max-w-2xl bg-background rounded-xl border border-border shadow-2xl flex flex-col max-h-[calc(100vh-6rem)]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
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
                  placeholder="e.g. Rooftop Unit #3"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </Field>
              <Field>
                <Label required>Equipment Type</Label>
                <Select value={form.equipmentType} onChange={(e) => set("equipmentType", e.target.value)}>
                  <option value="">Select type...</option>
                  {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
                {errors.equipmentType && <p className="text-xs text-destructive mt-1">{errors.equipmentType}</p>}
              </Field>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>Manufacturer</Label>
                <Input placeholder="e.g. Carrier" value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
              </Field>
              <Field>
                <Label>Model</Label>
                <Input placeholder="e.g. 50XC-060" value={form.model} onChange={(e) => set("model", e.target.value)} />
              </Field>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>Serial Number</Label>
                <Input placeholder="e.g. SN-1234567" value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} />
              </Field>
              <Field>
                <Label required>Customer</Label>
                <Select value={form.customerId} onChange={(e) => set("customerId", e.target.value)}>
                  <option value="">Select customer...</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </Select>
                {errors.customerId && <p className="text-xs text-destructive mt-1">{errors.customerId}</p>}
              </Field>
            </div>

            {/* Row 4 */}
            <Field>
              <Label>Location</Label>
              <Input placeholder="e.g. Rooftop, Building A" value={form.location} onChange={(e) => set("location", e.target.value)} />
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

            {/* Row service interval + status */}
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>Service Interval</Label>
                <Input placeholder="e.g. Every 90 days" value={form.serviceInterval} onChange={(e) => set("serviceInterval", e.target.value)} />
              </Field>
              <Field>
                <Label>Status</Label>
                <Select value={form.status} onChange={(e) => set("status", e.target.value as EquipmentStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>

            {/* Notes */}
            <Field>
              <Label>Notes</Label>
              <Textarea placeholder="Any additional notes about this equipment..." value={form.notes} onChange={(e) => set("notes", e.target.value)} />
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
                  <MaintenancePlansBrandTile size="xs" />
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
        <div className="fixed bottom-6 right-6 z-[240] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium bg-[color:var(--status-success)] text-white animate-in slide-in-from-right-4 fade-in duration-200">
          {toastMsg}
        </div>
      )}
    </>
  )
}
