"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

interface AddCustomerModalProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

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

export function AddCustomerModal({ open, onClose, onCreated }: AddCustomerModalProps) {
  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState<Partial<typeof INITIAL>>({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState("")

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError("")
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)

    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setSubmitError("You must be logged in to create a customer.")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("default_organization_id")
        .eq("id", user.id)
        .single()

      if (profileError || !profile?.default_organization_id) {
        setSubmitError(profileError?.message ?? "No default organization found.")
        return
      }

      const orgId = profile.default_organization_id

      const { data: created, error: insertError } = await supabase
        .from("customers")
        .insert({
          company_name: form.company.trim(),
          status: "active",
          organization_id: orgId,
          created_by: user.id,
        })
        .select("id")
        .single()

      if (insertError || !created?.id) {
        setSubmitError(insertError?.message ?? "Could not create customer.")
        return
      }

      const cn = form.contactName.trim()
      const parts = cn.split(/\s+/).filter(Boolean)
      const firstName = parts[0] ?? ""
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : ""

      const { error: contactError } = await supabase.from("customer_contacts").insert({
        organization_id: orgId,
        customer_id: created.id,
        full_name: cn,
        first_name: firstName || null,
        last_name: lastName || null,
        role: "Primary",
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        is_primary: true,
      })

      if (contactError) {
        await supabase.from("customers").delete().eq("id", created.id).eq("organization_id", orgId)
        setSubmitError(contactError.message)
        return
      }

      const hasAddress =
        form.address.trim() &&
        form.city.trim() &&
        form.state.trim() &&
        form.zip.trim()

      if (hasAddress) {
        const { error: locError } = await supabase.from("customer_locations").insert({
          organization_id: orgId,
          customer_id: created.id,
          name: "Primary",
          address_line1: form.address.trim(),
          address_line2: null,
          city: form.city.trim(),
          state: form.state.trim().slice(0, 2),
          postal_code: form.zip.trim(),
          phone: form.phone.trim() || null,
          contact_person: cn,
          is_default: true,
        })
        if (locError) {
          setSubmitError(locError.message)
          return
        }
      }

      setForm(INITIAL)
      onClose()
      onCreated?.()
    } finally {
      setSaving(false)
    }
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
          {submitError && <p className="text-xs text-destructive">{submitError}</p>}
        </form>
      </div>
    </div>
  )
}
