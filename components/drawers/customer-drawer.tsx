"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { customers, equipment, workOrders, adminQuotes, adminInvoices } from "@/lib/mock-data"
import type { Customer } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import {
  MapPin, Phone, Mail, Building2, Wrench, ClipboardList, FileText, Receipt,
  CheckCircle2, ExternalLink, CalendarDays,
} from "lucide-react"

let toastCounter = 0

interface CustomerDrawerProps {
  customerId: string | null
  onClose: () => void
}

export function CustomerDrawer({ customerId, onClose }: CustomerDrawerProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const customer = customerId ? customers.find((c) => c.id === customerId) ?? null : null
  const custEquipment = customer ? equipment.filter((e) => e.customerId === customer.id) : []
  const custWOs = customer ? workOrders.filter((w) => w.customerId === customer.id) : []
  const custQuotes = customer ? adminQuotes.filter((q) => q.customerId === customer.id) : []
  const custInvoices = customer ? adminInvoices.filter((i) => i.customerId === customer.id) : []

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  if (!customer) return null

  const statusCls = customer.status === "Active"
    ? "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30"
    : "bg-muted text-muted-foreground border-border"

  const openWOs = custWOs.filter((w) => w.status !== "Completed" && w.status !== "Invoiced")

  const timelineItems = [
    ...custWOs.slice(0, 6).map((wo) => ({
      date: wo.scheduledDate || wo.createdAt.slice(0, 10),
      label: `${wo.type} — ${wo.equipmentName}`,
      description: wo.description,
      accent: (wo.status === "Completed" ? "success" : wo.priority === "Critical" ? "danger" : "muted") as "success" | "danger" | "muted",
    })),
  ]

  return (
    <>
      <DetailDrawer
        open={!!customerId}
        onClose={onClose}
        title={customer.company}
        subtitle={customer.name}
        width="lg"
        badge={
          <Badge variant="secondary" className={cn("text-xs border", statusCls)}>
            {customer.status}
          </Badge>
        }
        actions={
          <>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast("New work order created")}>
              <ClipboardList className="w-3.5 h-3.5" /> New Work Order
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast("New quote drafted")}>
              <FileText className="w-3.5 h-3.5" /> New Quote
            </Button>
            <Link href={`/customers/${customer.id}`}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <ExternalLink className="w-3.5 h-3.5" /> Full Profile
              </Button>
            </Link>
          </>
        }
      >
        {/* Key stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Equipment", value: customer.equipmentCount, sub: "units" },
            { label: "Open WOs", value: openWOs.length, sub: "active", warn: openWOs.length > 0 },
            { label: "Contracts", value: customer.contracts.length, sub: "active" },
          ].map(({ label, value, sub, warn }) => (
            <div key={label} className="bg-muted/40 rounded-lg p-3 text-center border border-border">
              <p className={cn("text-xl font-bold", warn ? "text-[color:var(--status-warning)]" : "text-foreground")}>{value}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Details */}
        <DrawerSection title="Details">
          <DrawerRow label="Customer Since" value={new Date(customer.joinedDate).toLocaleDateString("en-US", { year: "numeric", month: "long" })} />
          <DrawerRow label="Locations" value={customer.locations.map((l) => l.city).join(", ")} />
        </DrawerSection>

        {/* Contacts */}
        <DrawerSection title="Contacts">
          <div className="space-y-2.5">
            {customer.contacts.map((c) => (
              <div key={c.email} className="flex flex-col gap-0.5 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">{c.role}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <Mail className="w-3 h-3" />{c.email}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="w-3 h-3" />{c.phone}
                </div>
              </div>
            ))}
          </div>
        </DrawerSection>

        {/* Locations */}
        <DrawerSection title="Locations">
          <div className="space-y-2">
            {customer.locations.map((loc) => (
              <div key={loc.id} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border border-border">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-foreground">{loc.name}</p>
                  <p className="text-xs text-muted-foreground">{loc.address}, {loc.city}, {loc.state} {loc.zip}</p>
                </div>
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
            {custEquipment.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-1">+{custEquipment.length - 5} more</p>
            )}
            {custEquipment.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No equipment registered.</p>
            )}
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
            {openWOs.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No open work orders.</p>
            )}
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
            {custQuotes.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No quotes on file.</p>
            )}
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
            {custInvoices.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No invoices on file.</p>
            )}
          </div>
        </DrawerSection>

        {/* Service history timeline */}
        <DrawerSection title="Service History">
          {timelineItems.length > 0 ? (
            <DrawerTimeline items={timelineItems} />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No service history.</p>
          )}
        </DrawerSection>

        {/* Notes */}
        {customer.notes && (
          <DrawerSection title="Notes">
            <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
              {customer.notes}
            </p>
          </DrawerSection>
        )}
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
