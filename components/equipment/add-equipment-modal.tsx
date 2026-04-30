"use client"

import { useState } from "react"
import { useEquipment } from "@/lib/equipment-store"
import { customers } from "@/lib/mock-data"
import type { Equipment } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AddEquipmentModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const EQUIPMENT_TYPES = [
  "HVAC", "Electrical", "Plumbing", "Mechanical", "Refrigeration",
  "Fire Safety", "Security", "Lighting", "Elevator", "Generator",
  "Compressor", "Conveyor", "Pump", "Boiler", "Chiller", "Other",
]

const STATUSES = ["Active", "Needs Service", "In Repair", "Out of Service"] as const

let idCounter = 1000

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
  status: "Active" as Equipment["status"],
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

export function AddEquipmentModal({ open, onClose, onSuccess }: AddEquipmentModalProps) {
  const { addEquipment } = useEquipment()
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function handleClose() {
    setForm(INITIAL_FORM)
    setErrors({})
    onClose()
  }

  function handleSave() {
    const errs = validate(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    const customer = customers.find((c) => c.id === form.customerId)
    const newId = `EQ-${String(++idCounter).padStart(4, "0")}`
    const today = new Date().toISOString().slice(0, 10)

    const newEquipment: Equipment = {
      id: newId,
      customerId: form.customerId,
      customerName: customer?.company ?? "",
      model: form.model || form.name,
      manufacturer: form.manufacturer,
      category: form.equipmentType,
      serialNumber: form.serialNumber,
      installDate: form.installDate || today,
      warrantyExpiration: form.warrantyExpiration || "",
      lastServiceDate: form.lastServiceDate || today,
      nextDueDate: form.nextServiceDue || today,
      status: form.status,
      notes: form.notes,
      location: form.location,
      photos: [],
      manuals: [],
      serviceHistory: [],
    }

    addEquipment(newEquipment)
    setToastMsg("Equipment added successfully")
    setTimeout(() => setToastMsg(null), 3500)
    handleClose()
    onSuccess?.()
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add Equipment"
        className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 pb-8"
      >
        <div className="relative w-full max-w-2xl bg-background rounded-xl border border-border shadow-2xl flex flex-col max-h-[calc(100vh-6rem)]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div>
              <h2 className="text-base font-semibold text-foreground">Add Equipment</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Fill in the details to register new equipment.</p>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable body */}
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
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
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
                <Select value={form.status} onChange={(e) => set("status", e.target.value as Equipment["status"])}>
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

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
            <Button variant="outline" onClick={handleClose} className="cursor-pointer">Cancel</Button>
            <Button onClick={handleSave} className="cursor-pointer">Save Equipment</Button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium bg-[color:var(--status-success)] text-white animate-in slide-in-from-right-4 fade-in duration-200">
          {toastMsg}
        </div>
      )}
    </>
  )
}
