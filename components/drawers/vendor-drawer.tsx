"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  DetailDrawer,
  DrawerSection,
  DrawerRow,
  DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import { cn } from "@/lib/utils"
import { Pencil, Check, X, Archive, Trash2, AlertTriangle } from "lucide-react"

let toastCounter = 0

type VendorRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  contact_name: string | null
  billing_address: string | null
  shipping_address: string | null
  notes: string | null
  is_archived: boolean
  archived_at: string | null
}

type Draft = {
  name: string
  email: string
  phone: string
  contactName: string
  billingAddress: string
  shippingAddress: string
  notes: string
}

/** Drawer fields use compact sizing on top of shared Input/Textarea styles */
const fieldControl = "h-8 px-2.5 py-1 text-xs"
const fieldTextarea = "min-h-[76px] resize-none px-2.5 py-2 text-xs leading-relaxed"
const fieldNotesTextarea = "min-h-[96px] resize-none px-2.5 py-2 text-xs leading-relaxed"

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium text-foreground block mb-1.5">{children}</span>
}

function inferShippingSameAsBilling(d: Draft): boolean {
  const b = d.billingAddress.trim()
  const s = d.shippingAddress.trim()
  if (s === "") return true
  return s === b
}

function rowToDraft(v: VendorRow): Draft {
  return {
    name: v.name,
    email: v.email ?? "",
    phone: v.phone ?? "",
    contactName: v.contact_name ?? "",
    billingAddress: v.billing_address ?? "",
    shippingAddress: v.shipping_address ?? "",
    notes: v.notes ?? "",
  }
}

interface Props {
  vendorId: string | null
  onClose: () => void
  onVendorChanged?: () => void
}

export function VendorDrawer({ vendorId, onClose, onVendorChanged }: Props) {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const [vendor, setVendor] = useState<VendorRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [destructiveBusy, setDestructiveBusy] = useState(false)
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(false)

  const toast = useCallback((message: string, type: "success" | "info" = "success") => {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    if (!vendorId || orgStatus !== "ready" || !organizationId) {
      setVendor(null)
      setEditing(false)
      setDraft(null)
      return
    }
    let cancelled = false
    setLoading(true)
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { data, error } = await supabase
        .from("org_vendors")
        .select(
          "id, name, email, phone, contact_name, billing_address, shipping_address, notes, is_archived, archived_at",
        )
        .eq("id", vendorId)
        .eq("organization_id", organizationId)
        .maybeSingle()
      if (cancelled) return
      setLoading(false)
      if (error || !data) {
        setVendor(null)
        if (error) toast(error.message, "info")
        return
      }
      const v = data as VendorRow
      setVendor(v)
      setEditing(false)
      setDraft(null)
    })()
    return () => {
      cancelled = true
    }
  }, [vendorId, orgStatus, organizationId, toast])

  const open = Boolean(vendorId)

  function startEdit() {
    if (!vendor) return
    const d = rowToDraft(vendor)
    setDraft(d)
    setShippingSameAsBilling(inferShippingSameAsBilling(d))
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft(null)
    setShippingSameAsBilling(false)
  }

  async function saveEdit() {
    if (!vendor || !draft || !organizationId) return
    if (!draft.name.trim()) {
      toast("Vendor name is required.", "info")
      return
    }
    const billingStr = draft.billingAddress.trim() || null
    const shippingStr = (shippingSameAsBilling ? draft.billingAddress : draft.shippingAddress).trim() || null
    setSaving(true)
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase
      .from("org_vendors")
      .update({
        name: draft.name.trim(),
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        contact_name: draft.contactName.trim() || null,
        billing_address: billingStr,
        shipping_address: shippingStr,
        notes: draft.notes.trim() || null,
      })
      .eq("id", vendor.id)
      .eq("organization_id", organizationId)
    setSaving(false)
    if (error) {
      toast(error.message, "info")
      return
    }
    setVendor((prev) =>
      prev
        ? {
            ...prev,
            name: draft.name.trim(),
            email: draft.email.trim() || null,
            phone: draft.phone.trim() || null,
            contact_name: draft.contactName.trim() || null,
            billing_address: billingStr,
            shipping_address: shippingStr,
            notes: draft.notes.trim() || null,
          }
        : null,
    )
    setEditing(false)
    setDraft(null)
    toast("Vendor updated")
    onVendorChanged?.()
  }

  async function confirmArchive() {
    if (!vendor || !organizationId) return
    setDestructiveBusy(true)
    const supabase = createBrowserSupabaseClient()
    const archivedAt = new Date().toISOString()
    const { error } = await supabase
      .from("org_vendors")
      .update({ is_archived: true, archived_at: archivedAt })
      .eq("id", vendor.id)
      .eq("organization_id", organizationId)
    setDestructiveBusy(false)
    setConfirmArchiveOpen(false)
    if (error) {
      toast(error.message, "info")
      return
    }
    setVendor((prev) => (prev ? { ...prev, is_archived: true, archived_at: archivedAt } : null))
    toast("Vendor archived")
    onVendorChanged?.()
  }

  async function confirmRestore() {
    if (!vendor || !organizationId) return
    setDestructiveBusy(true)
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase
      .from("org_vendors")
      .update({ is_archived: false, archived_at: null })
      .eq("id", vendor.id)
      .eq("organization_id", organizationId)
    setDestructiveBusy(false)
    if (error) {
      toast(error.message, "info")
      return
    }
    setVendor((prev) => (prev ? { ...prev, is_archived: false, archived_at: null } : null))
    toast("Vendor restored")
    onVendorChanged?.()
  }

  async function confirmDelete() {
    if (!vendor || !organizationId) return
    setDestructiveBusy(true)
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.from("org_vendors").delete().eq("id", vendor.id).eq("organization_id", organizationId)
    setDestructiveBusy(false)
    setConfirmDeleteOpen(false)
    if (error) {
      toast(error.message, "info")
      return
    }
    toast("Vendor deleted")
    onVendorChanged?.()
    onClose()
  }

  const title = vendor?.name?.trim() || "Vendor"
  const subtitle = vendor?.is_archived ? "Archived" : undefined

  return (
    <>
      <DetailDrawer
        open={open}
        onClose={onClose}
        title={title}
        subtitle={subtitle}
        width="lg"
        badge={
          vendor ? (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                vendor.is_archived
                  ? "bg-muted text-muted-foreground border-border"
                  : "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
              )}
            >
              {vendor.is_archived ? "Archived" : "Active"}
            </Badge>
          ) : null
        }
        actions={
          vendor && !loading ? (
            <div className="flex flex-wrap items-center gap-2 w-full">
              {!editing ? (
                <>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={startEdit} disabled={vendor.is_archived}>
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                  {vendor.is_archived ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={destructiveBusy}
                      onClick={() => void confirmRestore()}
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Restore
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setConfirmArchiveOpen(true)}>
                      <Archive className="w-3.5 h-3.5" />
                      Archive
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" className="gap-1.5 ml-auto" onClick={() => setConfirmDeleteOpen(true)}>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="default" className="gap-1.5" onClick={() => void saveEdit()} disabled={saving}>
                    <Check className="w-3.5 h-3.5" />
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={cancelEdit} disabled={saving}>
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </Button>
                </>
              )}
            </div>
          ) : null
        }
      >
        {loading && (
          <p className="text-xs text-muted-foreground py-4">Loading vendor…</p>
        )}
        {!loading && !vendor && vendorId && (
          <p className="text-xs text-muted-foreground py-4">Vendor not found or you don’t have access.</p>
        )}
        {!loading && vendor && !editing && (
          <>
            <DrawerSection title="Vendor Information">
              <DrawerRow label="Vendor Name" value={vendor.name} />
            </DrawerSection>
            <DrawerSection title="Contact Info">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Contact Name</p>
                  <p className="text-xs font-medium text-foreground break-words">{vendor.contact_name?.trim() || "—"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Email Address</p>
                  <p className="text-xs font-medium text-foreground break-words">
                    {vendor.email?.trim() ? (
                      <a href={`mailto:${vendor.email.trim()}`} className="text-primary hover:underline">
                        {vendor.email.trim()}
                      </a>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Phone Number</p>
                  <p className="text-xs font-medium text-foreground">{vendor.phone?.trim() || "—"}</p>
                </div>
              </div>
            </DrawerSection>
            <DrawerSection title="Addresses">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Billing Address</p>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {vendor.billing_address?.trim() || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Shipping Address</p>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {vendor.shipping_address?.trim() || "—"}
                  </p>
                </div>
              </div>
            </DrawerSection>
            <DrawerSection title="Notes">
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {vendor.notes?.trim() || <span className="italic">No notes.</span>}
              </p>
            </DrawerSection>
          </>
        )}
        {!loading && vendor && editing && draft && (
          <>
            <DrawerSection title="Vendor Information">
              <div>
                <FieldLabel>Vendor Name</FieldLabel>
                <Input
                  className={fieldControl}
                  value={draft.name}
                  onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                  placeholder="e.g. MedSupply Co."
                />
              </div>
            </DrawerSection>
            <DrawerSection title="Contact Info">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <FieldLabel>Contact Name</FieldLabel>
                  <Input
                    className={fieldControl}
                    value={draft.contactName}
                    onChange={(e) => setDraft((d) => (d ? { ...d, contactName: e.target.value } : d))}
                    placeholder="e.g. John Smith"
                  />
                </div>
                <div className="min-w-0">
                  <FieldLabel>Email Address</FieldLabel>
                  <Input
                    className={fieldControl}
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft((d) => (d ? { ...d, email: e.target.value } : d))}
                    placeholder="e.g. john@vendor.com"
                  />
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <FieldLabel>Phone Number</FieldLabel>
                  <Input
                    className={fieldControl}
                    type="tel"
                    value={draft.phone}
                    onChange={(e) => setDraft((d) => (d ? { ...d, phone: e.target.value } : d))}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </DrawerSection>
            <DrawerSection title="Addresses">
              <div className="space-y-3">
                <div>
                  <FieldLabel>Billing Address</FieldLabel>
                  <Textarea
                    className={fieldTextarea}
                    value={draft.billingAddress}
                    onChange={(e) => {
                      const v = e.target.value
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              billingAddress: v,
                              shippingAddress: shippingSameAsBilling ? v : d.shippingAddress,
                            }
                          : d,
                      )
                    }}
                    placeholder="Street, City, State, ZIP"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={shippingSameAsBilling}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setShippingSameAsBilling(checked)
                      if (checked) {
                        setDraft((d) => (d ? { ...d, shippingAddress: d.billingAddress } : d))
                      }
                    }}
                    className="rounded border-border"
                  />
                  Shipping address same as billing
                </label>
                {!shippingSameAsBilling && (
                  <div>
                    <FieldLabel>Shipping Address</FieldLabel>
                    <Textarea
                      className={fieldTextarea}
                      value={draft.shippingAddress}
                      onChange={(e) => setDraft((d) => (d ? { ...d, shippingAddress: e.target.value } : d))}
                      placeholder="Street, City, State, ZIP"
                    />
                  </div>
                )}
              </div>
            </DrawerSection>
            <DrawerSection title="Notes">
              <Textarea
                className={fieldNotesTextarea}
                value={draft.notes}
                onChange={(e) => setDraft((d) => (d ? { ...d, notes: e.target.value } : d))}
                placeholder="Internal notes about this vendor..."
                aria-label="Notes"
              />
            </DrawerSection>
          </>
        )}
      </DetailDrawer>

      {confirmArchiveOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !destructiveBusy && setConfirmArchiveOpen(false)} />
          <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[color:var(--status-warning)]" />
              <h3 className="text-sm font-semibold text-foreground">Archive vendor?</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Archived vendors are hidden from purchase order vendor pickers. You can still view them from the vendors list.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setConfirmArchiveOpen(false)} disabled={destructiveBusy}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void confirmArchive()} disabled={destructiveBusy}>
                {destructiveBusy ? "Archiving…" : "Archive"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !destructiveBusy && setConfirmDeleteOpen(false)} />
          <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-semibold text-foreground">Delete vendor?</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              This permanently removes the vendor record. Purchase orders that reference this vendor will keep their snapshot text but will no longer be linked.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteOpen(false)} disabled={destructiveBusy}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void confirmDelete()} disabled={destructiveBusy}>
                {destructiveBusy ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <DrawerToastStack toasts={toasts} onRemove={removeToast} />
    </>
  )
}
