"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useCustomers } from "@/lib/customer-store"
import { useEquipment } from "@/lib/equipment-store"
import { useWorkOrders } from "@/lib/work-order-store"
import { useQuotes, useInvoices } from "@/lib/quote-invoice-store"
import { useMaintenancePlans } from "@/lib/maintenance-store"
import type { Customer, Contact } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import {
  MapPin, Phone, Mail, ClipboardList, FileText, Receipt,
  ExternalLink, Pencil, X, Check, Plus, Trash2, Archive,
  MoreHorizontal, Star,
  Globe, Send, Link2, RotateCcw, Clock, Activity,
  Paintbrush, LayoutGrid, UserCog, ShieldOff, ShieldCheck,
} from "lucide-react"
import type { Location } from "@/lib/mock-data"
import { ContactActions } from "@/components/contact-actions"

let toastCounter = 0

// ─── Shared edit controls ─────────────────────────────────────────────────────

function EditInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
    />
  )
}

function EditTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
    />
  )
}

function EditSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function EditRow({ label, view, editing, children }: { label: string; view: React.ReactNode; editing: boolean; children: React.ReactNode }) {
  return editing ? (
    <div className="flex items-start gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0 pt-1.5 w-28">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  ) : (
    <DrawerRow label={label} value={view} />
  )
}

// ─── Location form ────────────────────────────────────────────────────────────

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]

type LocationDraft = {
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

const EMPTY_LOCATION_DRAFT: LocationDraft = {
  name: "", address: "", addressLine2: "", city: "", state: "", zip: "",
  phone: "", contactPerson: "", notes: "", isDefault: false,
}

interface LocationFormProps {
  title: string
  initial?: LocationDraft
  onSave: (draft: LocationDraft) => void
  onCancel: () => void
}

function LocationForm({ title, initial = EMPTY_LOCATION_DRAFT, onSave, onCancel }: LocationFormProps) {
  const [d, setD] = useState<LocationDraft>(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof LocationDraft, string>>>({})

  function set<K extends keyof LocationDraft>(k: K, v: LocationDraft[K]) {
    setD((prev) => ({ ...prev, [k]: v }))
    setErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  function validate(): boolean {
    const e: typeof errors = {}
    if (!d.name.trim())    e.name    = "Location name is required"
    if (!d.address.trim()) e.address = "Street address is required"
    if (!d.city.trim())    e.city    = "City is required"
    if (!d.state.trim())   e.state   = "State is required"
    if (!d.zip.trim())     e.zip     = "ZIP is required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (validate()) onSave(d)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-background rounded-xl border border-border shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Location Name */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Location Name <span className="text-[color:var(--status-danger)]">*</span>
            </label>
            <EditInput value={d.name} onChange={(v) => set("name", v)} placeholder="e.g. Main Office, Warehouse A" />
            {errors.name && <p className="text-[10px] text-[color:var(--status-danger)] mt-1">{errors.name}</p>}
          </div>

          {/* Street */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Street Address <span className="text-[color:var(--status-danger)]">*</span>
            </label>
            <EditInput value={d.address} onChange={(v) => set("address", v)} placeholder="123 Main St" />
            {errors.address && <p className="text-[10px] text-[color:var(--status-danger)] mt-1">{errors.address}</p>}
          </div>

          {/* Address Line 2 */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Address Line 2</label>
            <EditInput value={d.addressLine2} onChange={(v) => set("addressLine2", v)} placeholder="Suite, Floor, Unit..." />
          </div>

          {/* City / State / ZIP */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                City <span className="text-[color:var(--status-danger)]">*</span>
              </label>
              <EditInput value={d.city} onChange={(v) => set("city", v)} placeholder="City" />
              {errors.city && <p className="text-[10px] text-[color:var(--status-danger)] mt-1">{errors.city}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                State <span className="text-[color:var(--status-danger)]">*</span>
              </label>
              <EditSelect value={d.state} onChange={(v) => set("state", v)} options={["", ...US_STATES]} />
              {errors.state && <p className="text-[10px] text-[color:var(--status-danger)] mt-1">{errors.state}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                ZIP <span className="text-[color:var(--status-danger)]">*</span>
              </label>
              <EditInput value={d.zip} onChange={(v) => set("zip", v)} placeholder="00000" />
              {errors.zip && <p className="text-[10px] text-[color:var(--status-danger)] mt-1">{errors.zip}</p>}
            </div>
          </div>

          {/* Phone / Contact */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Main Phone</label>
              <EditInput value={d.phone} onChange={(v) => set("phone", v)} placeholder="(555) 000-0000" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Contact Person</label>
              <EditInput value={d.contactPerson} onChange={(v) => set("contactPerson", v)} placeholder="Name" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</label>
            <EditTextarea value={d.notes} onChange={(v) => set("notes", v)} placeholder="Access instructions, hours, etc." />
          </div>

          {/* Default toggle */}
          <div className="flex items-center justify-between py-2 border-t border-border/50">
            <div>
              <p className="text-xs font-medium text-foreground">Set as Default Location</p>
              <p className="text-[10px] text-muted-foreground">Used as the default in work orders and equipment</p>
            </div>
            <button
              type="button"
              onClick={() => set("isDefault", !d.isDefault)}
              className={cn(
                "relative w-9 h-5 rounded-full transition-colors shrink-0",
                d.isDefault ? "bg-primary" : "bg-muted-foreground/25"
              )}
              role="switch"
              aria-checked={d.isDefault}
            >
              <span className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                d.isDefault ? "translate-x-4" : "translate-x-0.5"
              )} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/20">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-border bg-background text-foreground hover:bg-muted/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            Save Location
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete confirmation ──────────────────────────────────────────────────────

interface DeleteConfirmProps {
  hasRelatedRecords: boolean
  onArchive: () => void
  onDelete: () => void
  onCancel: () => void
}

function DeleteConfirm({ hasRelatedRecords, onArchive, onDelete, onCancel }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-background rounded-xl border border-border shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            {hasRelatedRecords ? "Archive Location?" : "Delete Location?"}
          </h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {hasRelatedRecords
              ? "This location has related records (equipment, work orders, or invoices). It cannot be permanently deleted. Archive instead to hide it from active dropdowns?"
              : "Are you sure you want to delete this location? This action cannot be undone."}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/20">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-border bg-background text-foreground hover:bg-muted/60 transition-colors"
          >
            Cancel
          </button>
          {hasRelatedRecords ? (
            <button
              onClick={onArchive}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-amber-500 text-white hover:bg-amber-500/90 transition-colors"
            >
              <Archive size={12} /> Archive Location
            </button>
          ) : (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-[color:var(--status-danger)] text-white hover:bg-[color:var(--status-danger)]/90 transition-colors"
            >
              <Trash2 size={12} /> Delete Location
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Props / component ────────────────────────────────────────────────────────

interface CustomerDrawerProps {
  customerId: string | null
  onClose: () => void
}

export function CustomerDrawer({ customerId, onClose }: CustomerDrawerProps) {
  const { customers, updateCustomer, addLocation, updateLocation, removeLocation, archiveLocation } = useCustomers()
  const { equipment } = useEquipment()
  const { workOrders } = useWorkOrders()
  const { quotes: adminQuotes } = useQuotes()
  const { invoices: adminInvoices } = useInvoices()
  const { plans: allPlans } = useMaintenancePlans()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Customer>>({})

  // Location modal state
  const [locationModal, setLocationModal] = useState<"add" | "edit" | null>(null)
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [openLocationMenu, setOpenLocationMenu] = useState<string | null>(null)

  const [portalEnabled, setPortalEnabled] = useState(true)
  const [portalModules, setPortalModules] = useState({
    workOrders: true,
    invoices: true,
    equipment: true,
    quotes: false,
    documents: false,
  })

  const customer = customerId ? customers.find((c) => c.id === customerId) ?? null : null
  const custEquipment = customer ? equipment.filter((e) => e.customerId === customer.id) : []
  const custWOs = customer ? workOrders.filter((w) => w.customerId === customer.id) : []
  const custQuotes = customer ? adminQuotes.filter((q) => q.customerId === customer.id) : []
  const custInvoices = customer ? adminInvoices.filter((i) => i.customerId === customer.id) : []
  const custPlans = customer ? allPlans.filter((p) => p.customerId === customer.id) : []

  useEffect(() => {
    setEditing(false)
    setDraft({})
  }, [customerId])

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function startEdit() {
    if (!customer) return
    setDraft({
      name: customer.name,
      company: customer.company,
      status: customer.status,
      notes: customer.notes,
      contacts: customer.contacts.map((c) => ({ ...c })),
      locations: customer.locations.map((l) => ({ ...l })),
    })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
  }

  function saveEdit() {
    if (!customer) return
    updateCustomer(customer.id, draft)
    setEditing(false)
    setDraft({})
    toast("Customer updated successfully")
  }

  function setField<K extends keyof Customer>(field: K, value: Customer[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  function setContact(idx: number, field: keyof Contact, value: string) {
    const contacts = [...(draft.contacts ?? customer?.contacts ?? [])]
    contacts[idx] = { ...contacts[idx], [field]: value }
    setDraft((prev) => ({ ...prev, contacts }))
  }

  if (!customer) return null

  const currentStatus = (draft.status ?? customer.status)
  const statusCls = currentStatus === "Active"
    ? "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30"
    : "bg-muted text-muted-foreground border-border"

  const openWOs = custWOs.filter((w) => w.status !== "Completed" && w.status !== "Invoiced")

  const contacts = draft.contacts ?? customer.contacts

  return (
    <>
      <DetailDrawer
        open={!!customerId}
        onClose={onClose}
        title={draft.company ?? customer.company}
        subtitle={draft.name ?? customer.name}
        width="lg"
        badge={
          <Badge variant="secondary" className={cn("text-xs border", statusCls)}>
            {currentStatus}
          </Badge>
        }
        actions={
          editing ? (
            <>
              <Button size="sm" variant="default" className="gap-1.5 text-xs cursor-pointer" onClick={saveEdit}>
                <Check className="w-3.5 h-3.5" /> Save Changes
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={cancelEdit}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("New work order created")}>
                <ClipboardList className="w-3.5 h-3.5" /> New Work Order
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("New quote drafted")}>
                <FileText className="w-3.5 h-3.5" /> New Quote
              </Button>
              <Link href={`/customers/${customer.id}`}>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer">
                  <ExternalLink className="w-3.5 h-3.5" /> Full Profile
                </Button>
              </Link>
            </>
          )
        }
      >
        {/* Key stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Equipment", value: customer.equipmentCount, sub: "units" },
            { label: "Open WOs", value: openWOs.length, sub: "active", warn: openWOs.length > 0 },
            { label: "Contracts", value: customer.contracts.length, sub: "active" },
          ].map(({ label, value, warn }) => (
            <div key={label} className="bg-muted/40 rounded-lg p-3 text-center border border-border">
              <p className={cn("text-xl font-bold", warn ? "text-[color:var(--status-warning)]" : "text-foreground")}>{value}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Details */}
        <DrawerSection title="Details">
          <EditRow label="Company" view={customer.company} editing={editing}>
            <EditInput value={draft.company ?? ""} onChange={(v) => setField("company", v)} />
          </EditRow>
          <EditRow label="Contact Name" view={customer.name} editing={editing}>
            <EditInput value={draft.name ?? ""} onChange={(v) => setField("name", v)} />
          </EditRow>
          <EditRow label="Status" view={
            <Badge variant="secondary" className={cn("text-[10px] border", statusCls)}>{customer.status}</Badge>
          } editing={editing}>
            <EditSelect value={draft.status ?? customer.status} onChange={(v) => setField("status", v as Customer["status"])} options={["Active", "Inactive"]} />
          </EditRow>
          <DrawerRow label="Customer Since" value={new Date(customer.joinedDate).toLocaleDateString("en-US", { year: "numeric", month: "long" })} />
          <DrawerRow label="Locations" value={customer.locations.map((l) => l.city).join(", ")} />
        </DrawerSection>

        {/* Contacts */}
        <DrawerSection title="Contacts">
          <div className="space-y-2.5">
            {contacts.map((c, idx) => (
              <div key={c.email} className="flex flex-col gap-0.5 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center justify-between">
                  {editing ? (
                    <div className="flex flex-col gap-1.5 w-full">
                      <div className="grid grid-cols-2 gap-2">
                        <EditInput value={c.name} onChange={(v) => setContact(idx, "name", v)} placeholder="Name" />
                        <EditInput value={c.role} onChange={(v) => setContact(idx, "role", v)} placeholder="Role" />
                      </div>
                      <EditInput value={c.email} onChange={(v) => setContact(idx, "email", v)} placeholder="Email" />
                      <EditInput value={c.phone} onChange={(v) => setContact(idx, "phone", v)} placeholder="Phone" />
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-semibold text-foreground">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground">{c.role}</span>
                    </>
                  )}
                </div>
                {!editing && (
                  <>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <Mail className="w-3 h-3" />{c.email}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />{c.phone}
                    </div>
                    <div className="mt-2">
                      <ContactActions
                        email={{ customerName: customer.company, customerEmail: c.email }}
                        phone={c.phone}
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </DrawerSection>

        {/* Locations */}
        <DrawerSection
          title="Locations"
          action={
            <button
              onClick={() => setLocationModal("add")}
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Plus size={12} /> Add Location
            </button>
          }
        >
          <div className="space-y-2">
            {customer.locations.filter((l) => !l.archived).map((loc) => (
              <div key={loc.id} className="rounded-lg bg-muted/30 border border-border overflow-hidden">
                {/* Location card header */}
                <div className="flex items-start gap-2.5 p-3">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-foreground truncate">{loc.name}</p>
                      {loc.isDefault && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                          <Star size={8} /> Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {loc.address}{loc.addressLine2 ? `, ${loc.addressLine2}` : ""}, {loc.city}, {loc.state} {loc.zip}
                    </p>
                    {loc.contactPerson && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Contact: {loc.contactPerson}</p>
                    )}
                    {loc.phone && (
                      <p className="text-[10px] text-muted-foreground">Phone: {loc.phone}</p>
                    )}
                  </div>

                  {/* Per-location actions */}
                  <div className="flex items-center gap-1 shrink-0 relative">
                    <button
                      onClick={() => {
                        setEditingLocationId(loc.id)
                        setLocationModal("edit")
                      }}
                      className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/60 transition-colors"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                    <button
                      onClick={() => setOpenLocationMenu(openLocationMenu === loc.id ? null : loc.id)}
                      className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="More options"
                    >
                      <MoreHorizontal size={13} />
                    </button>

                    {/* Dropdown menu */}
                    {openLocationMenu === loc.id && (
                      <div className="absolute right-0 top-8 z-50 w-44 rounded-lg border border-border bg-background shadow-lg py-1 text-xs">
                        <button
                          onClick={() => {
                            setOpenLocationMenu(null)
                            updateLocation(customer.id, loc.id, { isDefault: true })
                            // Clear default from other locations
                            customer.locations.forEach((l) => {
                              if (l.id !== loc.id && l.isDefault) {
                                updateLocation(customer.id, l.id, { isDefault: false })
                              }
                            })
                            toast("Default location updated")
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/60 text-foreground transition-colors"
                        >
                          <Star size={12} className="text-muted-foreground" /> Set as Default
                        </button>
                        <button
                          onClick={() => {
                            setOpenLocationMenu(null)
                            setDeleteTarget(loc.id)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)] transition-colors"
                        >
                          <Trash2 size={12} /> Delete / Archive
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Navigate / contact actions */}
                <div className="px-3 pb-3">
                  <ContactActions
                    address={`${loc.address}, ${loc.city}, ${loc.state} ${loc.zip}`}
                    email={customer.contacts[0] ? { customerName: customer.company, customerEmail: customer.contacts[0].email } : undefined}
                    phone={loc.phone ?? customer.contacts[0]?.phone}
                  />
                </div>
              </div>
            ))}

            {customer.locations.filter((l) => !l.archived).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No locations. Add one to get started.</p>
            )}
          </div>
        </DrawerSection>

        {/* Contracts */}
        <DrawerSection title="Contracts">
          <div className="space-y-2">
            {customer.contracts.map((con) => {
              const planMatch = custPlans.find((p) =>
                p.name.toLowerCase().includes(con.name.toLowerCase()) ||
                con.name.toLowerCase().includes(p.name.toLowerCase())
              )
              const href = planMatch ? `/maintenance-plans?open=${planMatch.id}` : `/maintenance-plans`
              return (
                <Link
                  key={con.id}
                  href={href}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 hover:border-primary/30 transition-colors cursor-pointer group"
                >
                  <div>
                    <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{con.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{con.type} · {con.startDate} – {con.endDate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">${con.value.toLocaleString()}</span>
                    <ExternalLink size={11} className="text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                  </div>
                </Link>
              )
            })}
            {customer.contracts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No contracts on file.</p>
            )}
          </div>
        </DrawerSection>

        {/* Equipment */}
        <DrawerSection title={`Equipment (${custEquipment.length})`}>
          <div className="space-y-1.5">
            {custEquipment.slice(0, 5).map((eq) => (
              <Link
                key={eq.id}
                href={`/equipment?open=${eq.id}`}
                className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border hover:bg-muted/50 hover:border-primary/30 transition-colors cursor-pointer group"
              >
                <div>
                  <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{eq.model}</p>
                  <p className="text-[10px] text-muted-foreground">
                    <span className="text-primary font-mono">{eq.id}</span> · {eq.category}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">{eq.status}</Badge>
                  <ExternalLink size={11} className="text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                </div>
              </Link>
            ))}
            {custEquipment.length > 5 && (
              <Link href="/equipment" className="block text-xs text-primary hover:text-primary/80 transition-colors text-center pt-1">
                +{custEquipment.length - 5} more
              </Link>
            )}
            {custEquipment.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No equipment registered.</p>}
          </div>
        </DrawerSection>

        {/* Open Work Orders */}
        <DrawerSection title={`Open Work Orders (${openWOs.length})`}>
          <div className="space-y-1.5">
            {openWOs.slice(0, 4).map((wo) => (
              <Link
                key={wo.id}
                href={`/work-orders?open=${wo.id}`}
                className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border hover:bg-muted/50 hover:border-primary/30 transition-colors cursor-pointer group"
              >
                <div>
                  <p className="text-xs font-semibold font-mono text-primary">{wo.id}</p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[220px]">{wo.description}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] shrink-0">{wo.status}</Badge>
                  <ExternalLink size={11} className="text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                </div>
              </Link>
            ))}
            {openWOs.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No open work orders.</p>}
          </div>
        </DrawerSection>

        {/* Quotes */}
        <DrawerSection title={`Quotes (${custQuotes.length})`}>
          <div className="space-y-1.5">
            {custQuotes.slice(0, 3).map((q) => (
              <Link
                key={q.id}
                href={`/quotes?open=${q.id}`}
                className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border hover:bg-muted/50 hover:border-primary/30 transition-colors cursor-pointer group"
              >
                <div>
                  <p className="text-xs font-semibold font-mono text-primary">{q.id}</p>
                  <p className="text-[10px] text-muted-foreground">{q.status} · {q.createdDate}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">${q.amount.toLocaleString()}</span>
                  <ExternalLink size={11} className="text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                </div>
              </Link>
            ))}
            {custQuotes.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No quotes on file.</p>}
          </div>
        </DrawerSection>

        {/* Invoices */}
        <DrawerSection title={`Invoices (${custInvoices.length})`}>
          <div className="space-y-1.5">
            {custInvoices.slice(0, 3).map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices?open=${inv.id}`}
                className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border hover:bg-muted/50 hover:border-primary/30 transition-colors cursor-pointer group"
              >
                <div>
                  <p className="text-xs font-semibold font-mono text-primary">{inv.id}</p>
                  <p className="text-[10px] text-muted-foreground">{inv.status} · Due {inv.dueDate}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">${inv.amount.toLocaleString()}</span>
                  <ExternalLink size={11} className="text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                </div>
              </Link>
            ))}
            {custInvoices.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No invoices on file.</p>}
          </div>
        </DrawerSection>

        {/* Maintenance Plans */}
        {custPlans.length > 0 && (
          <DrawerSection title={`Maintenance Plans (${custPlans.length})`}>
            <div className="space-y-1.5">
              {custPlans.slice(0, 3).map((plan) => (
                <Link
                  key={plan.id}
                  href={`/maintenance-plans?open=${plan.id}`}
                  className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border hover:bg-muted/50 hover:border-primary/30 transition-colors cursor-pointer group"
                >
                  <div>
                    <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{plan.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      <span className="text-primary font-mono">{plan.id}</span> · {plan.interval} · {plan.status}
                    </p>
                  </div>
                  <ExternalLink size={11} className="text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                </Link>
              ))}
              {custPlans.length > 3 && (
                <Link href="/maintenance-plans" className="block text-xs text-primary hover:text-primary/80 transition-colors text-center pt-1">
                  +{custPlans.length - 3} more
                </Link>
              )}
            </div>
          </DrawerSection>
        )}

        {/* Service history */}
        <DrawerSection title="Service History">
          {custWOs.length > 0 ? (
            <div className="space-y-1">
              {custWOs.slice(0, 6).map((wo) => (
                <Link
                  key={wo.id}
                  href={`/work-orders?open=${wo.id}`}
                  className="flex items-center gap-3 py-2 px-2.5 rounded-md hover:bg-muted/40 transition-colors cursor-pointer group"
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    wo.status === "Completed" ? "bg-[color:var(--status-success)]"
                    : wo.priority === "Critical" ? "bg-[color:var(--status-danger)]"
                    : "bg-muted-foreground/40"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-primary shrink-0">{wo.id}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{wo.scheduledDate || wo.createdAt.slice(0, 10)}</span>
                    </div>
                    <p className="text-xs text-foreground group-hover:text-primary transition-colors truncate">{wo.type} — {wo.equipmentName}</p>
                  </div>
                  <ExternalLink size={11} className="text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No service history.</p>
          )}
        </DrawerSection>

        {/* Portal Access */}
        <DrawerSection title="Portal Access">
          {/* Status bar */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border mb-3">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "w-2 h-2 rounded-full shrink-0",
                portalEnabled ? "bg-[color:var(--status-success)]" : "bg-muted-foreground/40"
              )} />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {portalEnabled ? "Portal Active" : "Portal Disabled"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Last login: Apr 28, 2026 at 3:14 PM
                </p>
              </div>
            </div>
            <button
              onClick={() => { setPortalEnabled((v) => !v); toast(portalEnabled ? "Portal access disabled" : "Portal access enabled") }}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors",
                portalEnabled
                  ? "border-[color:var(--status-danger)]/30 text-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)]/8"
                  : "border-[color:var(--status-success)]/30 text-[color:var(--status-success)] hover:bg-[color:var(--status-success)]/8"
              )}
            >
              {portalEnabled ? <ShieldOff size={12} /> : <ShieldCheck size={12} />}
              {portalEnabled ? "Disable" : "Enable"}
            </button>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { icon: Globe,      label: "View as Customer",   action: "Opened portal preview" },
              { icon: Send,       label: "Send Portal Invite", action: "Portal invite sent" },
              { icon: Link2,      label: "Copy Magic Link",    action: "Magic login link copied" },
              { icon: RotateCcw,  label: "Reset Portal Access",action: "Portal access reset" },
            ].map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                onClick={() => toast(action)}
                disabled={!portalEnabled && label !== "Send Portal Invite"}
                className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-muted/30 text-xs font-medium text-foreground hover:bg-muted/60 hover:border-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon size={13} className="text-muted-foreground shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {/* Activity */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => toast("Viewing portal activity log")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Activity size={12} />
              View portal activity log
            </button>
            <span className="text-muted-foreground/40">·</span>
            <button
              onClick={() => toast("Opening last login details")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Clock size={12} />
              Last login details
            </button>
          </div>

          {/* Admin controls */}
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Admin Controls</p>

            {/* Branding + contacts */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => toast("Opening branding editor")}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 text-xs font-medium text-foreground hover:bg-muted/60 hover:border-primary/30 transition-colors"
              >
                <Paintbrush size={12} className="text-muted-foreground" />
                Edit Branding
              </button>
              <button
                onClick={() => toast("Managing portal contacts")}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 text-xs font-medium text-foreground hover:bg-muted/60 hover:border-primary/30 transition-colors"
              >
                <UserCog size={12} className="text-muted-foreground" />
                Portal Contacts
              </button>
            </div>

            {/* Module toggles */}
            <div className="pt-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Enabled Modules</p>
              <div className="space-y-1.5">
                {(Object.entries(portalModules) as [keyof typeof portalModules, boolean][]).map(([key, enabled]) => {
                  const labels: Record<keyof typeof portalModules, string> = {
                    workOrders: "Work Orders",
                    invoices: "Invoices",
                    equipment: "Equipment",
                    quotes: "Quotes",
                    documents: "Documents",
                  }
                  return (
                    <div key={key} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <LayoutGrid size={11} className="text-muted-foreground" />
                        <span className="text-xs text-foreground">{labels[key]}</span>
                      </div>
                      <button
                        onClick={() => setPortalModules((m) => ({ ...m, [key]: !m[key] }))}
                        className={cn(
                          "relative w-8 h-4 rounded-full transition-colors shrink-0",
                          enabled ? "bg-primary" : "bg-muted-foreground/25"
                        )}
                        role="switch"
                        aria-checked={enabled}
                      >
                        <span className={cn(
                          "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform",
                          enabled ? "translate-x-4" : "translate-x-0.5"
                        )} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </DrawerSection>

        {/* Notes */}
        <DrawerSection title="Notes">
          {editing ? (
            <EditTextarea
              value={draft.notes ?? ""}
              onChange={(v) => setField("notes", v)}
              placeholder="Add notes about this customer..."
            />
          ) : customer.notes ? (
            <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">{customer.notes}</p>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No notes.</p>
          )}
        </DrawerSection>
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      {/* Click-outside to close location menu */}
      {openLocationMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenLocationMenu(null)} />
      )}

      {/* Add Location modal */}
      {locationModal === "add" && (
        <LocationForm
          title="Add Location"
          onCancel={() => setLocationModal(null)}
          onSave={(d) => {
            const newLoc: Location = {
              id: `loc-${Date.now()}`,
              name: d.name,
              address: d.address,
              addressLine2: d.addressLine2 || undefined,
              city: d.city,
              state: d.state,
              zip: d.zip,
              phone: d.phone || undefined,
              contactPerson: d.contactPerson || undefined,
              notes: d.notes || undefined,
              isDefault: d.isDefault,
            }
            // If this is set as default, clear others
            if (d.isDefault) {
              customer.locations.forEach((l) => {
                if (l.isDefault) updateLocation(customer.id, l.id, { isDefault: false })
              })
            }
            addLocation(customer.id, newLoc)
            setLocationModal(null)
            toast("Location added successfully")
          }}
        />
      )}

      {/* Edit Location modal */}
      {locationModal === "edit" && editingLocationId && (() => {
        const loc = customer.locations.find((l) => l.id === editingLocationId)
        if (!loc) return null
        return (
          <LocationForm
            title="Edit Location"
            initial={{
              name: loc.name,
              address: loc.address,
              addressLine2: loc.addressLine2 ?? "",
              city: loc.city,
              state: loc.state,
              zip: loc.zip,
              phone: loc.phone ?? "",
              contactPerson: loc.contactPerson ?? "",
              notes: loc.notes ?? "",
              isDefault: loc.isDefault ?? false,
            }}
            onCancel={() => { setLocationModal(null); setEditingLocationId(null) }}
            onSave={(d) => {
              if (d.isDefault) {
                customer.locations.forEach((l) => {
                  if (l.id !== editingLocationId && l.isDefault) {
                    updateLocation(customer.id, l.id, { isDefault: false })
                  }
                })
              }
              updateLocation(customer.id, editingLocationId, {
                name: d.name,
                address: d.address,
                addressLine2: d.addressLine2 || undefined,
                city: d.city,
                state: d.state,
                zip: d.zip,
                phone: d.phone || undefined,
                contactPerson: d.contactPerson || undefined,
                notes: d.notes || undefined,
                isDefault: d.isDefault,
              })
              setLocationModal(null)
              setEditingLocationId(null)
              toast("Location updated successfully")
            }}
          />
        )
      })()}

      {/* Delete / Archive confirmation */}
      {deleteTarget && (() => {
        const loc = customer.locations.find((l) => l.id === deleteTarget)
        if (!loc) return null
        const hasRelated =
          equipment.some((e) => e.customerId === customer.id) ||
          workOrders.some((w) => w.customerId === customer.id)
        return (
          <DeleteConfirm
            hasRelatedRecords={hasRelated}
            onCancel={() => setDeleteTarget(null)}
            onArchive={() => {
              archiveLocation(customer.id, deleteTarget)
              setDeleteTarget(null)
              toast("Location archived")
            }}
            onDelete={() => {
              removeLocation(customer.id, deleteTarget)
              setDeleteTarget(null)
              toast("Location deleted")
            }}
          />
        )
      })()}
    </>
  )
}
