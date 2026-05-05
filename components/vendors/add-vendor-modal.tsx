"use client"

import { useState, useEffect, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X } from "lucide-react"
import { enforceCanCreateRecord } from "@/app/actions/org-create-enforcement"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"

export type VendorSavedPayload = {
  id: string
  name: string
  email: string | null
  phone: string | null
  contact_name: string | null
  billing_address: string | null
  shipping_address: string | null
}

export type AddVendorModalProps = {
  open: boolean
  onClose: () => void
  /** After successful insert */
  onSaved?: (vendor: VendorSavedPayload) => void
  /** Prefill name (e.g. from PO vendor search) */
  initialName?: string
  /** Stack above slide-out drawers (z-[101]) */
  stackAboveDrawer?: boolean
}

const EMPTY_DRAFT = {
  name: "",
  email: "",
  phone: "",
  contactName: "",
  billingAddress: "",
  shippingAddress: "",
}

export function AddVendorModal({
  open,
  onClose,
  onSaved,
  initialName = "",
  stackAboveDrawer = false,
}: AddVendorModalProps) {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const [mounted, setMounted] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    setDraft({ ...EMPTY_DRAFT, name: initialName ?? "" })
    setShippingSameAsBilling(false)
    setError(null)
  }, [open, initialName])

  if (!mounted || !open) return null

  const zOverlay = stackAboveDrawer ? "z-[120]" : "z-[70]"

  async function handleSave() {
    setError(null)
    if (orgStatus !== "ready" || !organizationId) {
      setError("Organization is still loading. Please try again.")
      return
    }
    if (!draft.name.trim()) {
      setError("Vendor name is required.")
      return
    }
    const gate = await enforceCanCreateRecord(organizationId, "vendor")
    if (!gate.ok) {
      setError(gate.message)
      return
    }
    setSaving(true)
    const supabase = createBrowserSupabaseClient()
    const billing = draft.billingAddress.trim() || null
    const shipping = shippingSameAsBilling
      ? billing
      : draft.shippingAddress.trim() || null
    const { data, error: insertError } = await supabase
      .from("org_vendors")
      .insert({
        organization_id: organizationId,
        name: draft.name.trim(),
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        contact_name: draft.contactName.trim() || null,
        billing_address: billing,
        shipping_address: shipping,
      })
      .select("id, name, email, phone, contact_name, billing_address, shipping_address")
      .maybeSingle()
    setSaving(false)
    if (insertError || !data) {
      setError(insertError?.message ?? "Could not save vendor.")
      return
    }
    onSaved?.(data as VendorSavedPayload)
    onClose()
  }

  const shell = (
    <div className={`fixed inset-0 ${zOverlay} flex items-center justify-center p-4`}>
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
        aria-hidden
      />
      <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90dvh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold text-foreground">Add Vendor</h3>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2.5 py-2">
              {error}
            </p>
          )}
          <Input
            placeholder="Vendor Name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <Input
            type="email"
            placeholder="Email"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
          />
          <Input
            placeholder="Phone"
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
          />
          <Input
            placeholder="Contact Name"
            value={draft.contactName}
            onChange={(e) => setDraft((d) => ({ ...d, contactName: e.target.value }))}
          />
          <Input
            placeholder="Billing Address"
            value={draft.billingAddress}
            onChange={(e) => {
              const v = e.target.value
              setDraft((d) => ({
                ...d,
                billingAddress: v,
                shippingAddress: shippingSameAsBilling ? v : d.shippingAddress,
              }))
            }}
          />
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={shippingSameAsBilling}
              onChange={(e) => {
                const checked = e.target.checked
                setShippingSameAsBilling(checked)
                if (checked) {
                  setDraft((d) => ({ ...d, shippingAddress: d.billingAddress }))
                }
              }}
            />
            Shipping address same as billing address
          </label>
          <Input
            placeholder="Shipping Address"
            value={shippingSameAsBilling ? draft.billingAddress : draft.shippingAddress}
            disabled={shippingSameAsBilling}
            onChange={(e) => setDraft((d) => ({ ...d, shippingAddress: e.target.value }))}
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <Button size="sm" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void handleSave()} disabled={saving || !draft.name.trim()}>
            {saving ? "Saving..." : "Save Vendor"}
          </Button>
        </div>
      </div>
    </div>
  )

  return createPortal(shell, document.body)
}
