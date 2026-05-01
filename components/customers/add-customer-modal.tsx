"use client"

import { useState } from "react"
import { useCustomers } from "@/lib/customer-store"
import type { Customer } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AddCustomerModalProps {
  open: boolean
  onClose: () => void
}

let _id = 9000

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-foreground mb-1">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col">{children}</div>
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

const INITIAL = {
  company: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
}

export function AddCustomerModal({ open, onClose }: AddCustomerModalProps) {
  const { addCustomer } = useCustomers()
  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState<Partial<typeof INITIAL>>({})
  const [saving, setSaving] = useState(false)

  if (!open) return null

  function set(field: keyof typeof INITIAL, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const errs: Partial<typeof INITIAL> = {}
    if (!form.company.trim()) errs.company = "Company name is required"
    if (!form.contactName.trim()) errs.contactName = "Contact name is required"
    if (!form.email.trim()) errs.email = "Email is required"
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    const id = `CUS-${String(++_id).padStart(4, "0")}`
    const [firstName = "", ...rest] = form.contactName.trim().split(" ")
    const lastName = rest.join(" ")

    const newCustomer: Customer = {
      id,
      company: form.company.trim(),
      status: "Active",
      joinedDate: new Date().toISOString().split("T")[0],
      totalEquipment: 0,
      totalWorkOrders: 0,
      totalSpent: 0,
      lastService: "",
      rating: 0,
      locations: form.address ? [{
        id: `LOC-${id}-1`,
        name: "Primary Location",
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        isPrimary: true,
      }] : [],
      contacts: [{
        id: `CON-${id}-1`,
        name: form.contactName.trim(),
        firstName,
        lastName,
        role: "Primary Contact",
        email: form.email.trim(),
        phone: form.phone,
        isPrimary: true,
      }],
      equipment: [],
      workOrders: [],
      invoices: [],
      notes: "",
    }

    addCustomer(newCustomer)
    setSaving(false)
    setForm(INITIAL)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-xl border border-border shadow-xl w-full max-w-md max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-semibold text-foreground">Add Customer</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Company */}
          <Field>
            <Label required>Company Name</Label>
            <Input
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
              placeholder="Acme Corp"
            />
            {errors.company && <p className="text-xs text-destructive mt-1">{errors.company}</p>}
          </Field>

          {/* Contact */}
          <Field>
            <Label required>Primary Contact Name</Label>
            <Input
              value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)}
              placeholder="Jane Smith"
            />
            {errors.contactName && <p className="text-xs text-destructive mt-1">{errors.contactName}</p>}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label required>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="jane@acme.com"
              />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </Field>
            <Field>
              <Label>Phone</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="(555) 000-0000"
              />
            </Field>
          </div>

          {/* Location */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Primary Location (optional)</p>
            <div className="space-y-3">
              <Field>
                <Label>Street Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="123 Main St"
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field>
                  <Label>City</Label>
                  <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Austin" />
                </Field>
                <Field>
                  <Label>State</Label>
                  <Input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="TX" maxLength={2} />
                </Field>
                <Field>
                  <Label>ZIP</Label>
                  <Input value={form.zip} onChange={(e) => set("zip", e.target.value)} placeholder="78701" />
                </Field>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Adding..." : "Add Customer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
