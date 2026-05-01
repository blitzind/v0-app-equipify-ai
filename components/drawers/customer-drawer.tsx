"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useCustomers } from "@/lib/customer-store"
import { useEquipment } from "@/lib/equipment-store"
import { useWorkOrders } from "@/lib/work-order-store"
import { useQuotes, useInvoices } from "@/lib/quote-invoice-store"
import type { Customer, Contact } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import {
  MapPin, Phone, Mail, ClipboardList, FileText, Receipt,
  ExternalLink, Pencil, X, Check,
} from "lucide-react"
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

// ─── Props / component ────────────────────────────────────────────────────────

interface CustomerDrawerProps {
  customerId: string | null
  onClose: () => void
}

export function CustomerDrawer({ customerId, onClose }: CustomerDrawerProps) {
  const { customers, updateCustomer } = useCustomers()
  const { equipment } = useEquipment()
  const { workOrders } = useWorkOrders()
  const { quotes: adminQuotes } = useQuotes()
  const { invoices: adminInvoices } = useInvoices()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Customer>>({})

  const customer = customerId ? customers.find((c) => c.id === customerId) ?? null : null
  const custEquipment = customer ? equipment.filter((e) => e.customerId === customer.id) : []
  const custWOs = customer ? workOrders.filter((w) => w.customerId === customer.id) : []
  const custQuotes = customer ? adminQuotes.filter((q) => q.customerId === customer.id) : []
  const custInvoices = customer ? adminInvoices.filter((i) => i.customerId === customer.id) : []

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

  const timelineItems = custWOs.slice(0, 6).map((wo) => ({
    date: wo.scheduledDate || wo.createdAt.slice(0, 10),
    label: `${wo.type} — ${wo.equipmentName}`,
    description: wo.description,
    accent: (wo.status === "Completed" ? "success" : wo.priority === "Critical" ? "danger" : "muted") as "success" | "danger" | "muted",
  }))

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
        <DrawerSection title="Locations">
          <div className="space-y-2">
            {customer.locations.map((loc) => (
              <div key={loc.id} className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{loc.name}</p>
                    <p className="text-xs text-muted-foreground">{loc.address}, {loc.city}, {loc.state} {loc.zip}</p>
                  </div>
                </div>
                <ContactActions
                  address={`${loc.address}, ${loc.city}, ${loc.state} ${loc.zip}`}
                  email={customer.contacts[0] ? { customerName: customer.company, customerEmail: customer.contacts[0].email } : undefined}
                  phone={customer.contacts[0]?.phone}
                />
              </div>
            ))}
          </div>
        </DrawerSection>

        {/* Contracts */}
        <DrawerSection title="Contracts">
          <div className="space-y-2">
            {customer.contracts.map((con) => (
              <div key={con.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <p className="text-xs font-semibold text-foreground">{con.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{con.type} · {con.startDate} – {con.endDate}</p>
                </div>
                <span className="text-xs font-bold text-foreground">${con.value.toLocaleString()}</span>
              </div>
            ))}
            {customer.contracts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No contracts on file.</p>
            )}
          </div>
        </DrawerSection>

        {/* Equipment */}
        <DrawerSection title={`Equipment (${custEquipment.length})`}>
          <div className="space-y-1.5">
            {custEquipment.slice(0, 5).map((eq) => (
              <div key={eq.id} className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border">
                <div>
                  <p className="text-xs font-medium text-foreground">{eq.model}</p>
                  <p className="text-[10px] text-muted-foreground">{eq.id} · {eq.category}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{eq.status}</Badge>
              </div>
            ))}
            {custEquipment.length > 5 && <p className="text-xs text-muted-foreground text-center pt-1">+{custEquipment.length - 5} more</p>}
            {custEquipment.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No equipment registered.</p>}
          </div>
        </DrawerSection>

        {/* Open Work Orders */}
        <DrawerSection title={`Open Work Orders (${openWOs.length})`}>
          <div className="space-y-1.5">
            {openWOs.slice(0, 4).map((wo) => (
              <div key={wo.id} className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border">
                <div>
                  <p className="text-xs font-semibold font-mono text-primary">{wo.id}</p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[220px]">{wo.description}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">{wo.status}</Badge>
              </div>
            ))}
            {openWOs.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No open work orders.</p>}
          </div>
        </DrawerSection>

        {/* Quotes */}
        <DrawerSection title={`Quotes (${custQuotes.length})`}>
          <div className="space-y-1.5">
            {custQuotes.slice(0, 3).map((q) => (
              <div key={q.id} className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border">
                <div>
                  <p className="text-xs font-semibold font-mono text-primary">{q.id}</p>
                  <p className="text-[10px] text-muted-foreground">{q.status} · {q.createdDate}</p>
                </div>
                <span className="text-xs font-bold text-foreground">${q.amount.toLocaleString()}</span>
              </div>
            ))}
            {custQuotes.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No quotes on file.</p>}
          </div>
        </DrawerSection>

        {/* Invoices */}
        <DrawerSection title={`Invoices (${custInvoices.length})`}>
          <div className="space-y-1.5">
            {custInvoices.slice(0, 3).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border">
                <div>
                  <p className="text-xs font-semibold font-mono text-primary">{inv.id}</p>
                  <p className="text-[10px] text-muted-foreground">{inv.status} · Due {inv.dueDate}</p>
                </div>
                <span className="text-xs font-bold text-foreground">${inv.amount.toLocaleString()}</span>
              </div>
            ))}
            {custInvoices.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No invoices on file.</p>}
          </div>
        </DrawerSection>

        {/* Service history */}
        <DrawerSection title="Service History">
          {timelineItems.length > 0 ? (
            <DrawerTimeline items={timelineItems} />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No service history.</p>
          )}
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
    </>
  )
}
