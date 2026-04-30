"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import type { Equipment, ServiceHistoryEntry } from "@/lib/mock-data"
import { useWorkspaceData } from "@/lib/tenant-store"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  FileText,
  Wrench,
  Calendar,
  ChevronLeft,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react"

const statusColors: Record<Equipment["status"], string> = {
  "Active": "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Needs Service": "bg-[color:var(--status-warning)]/15 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Out of Service": "bg-destructive/15 text-destructive border-destructive/30",
  "In Repair": "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
}

const historyTypeIcon: Record<ServiceHistoryEntry["type"], React.ReactNode> = {
  PM: <CheckCircle2 className="w-4 h-4 text-[color:var(--status-success)]" />,
  Repair: <AlertTriangle className="w-4 h-4 text-[color:var(--status-warning)]" />,
  Inspection: <Clock className="w-4 h-4 text-[color:var(--status-info)]" />,
  Install: <CheckCircle2 className="w-4 h-4 text-muted-foreground" />,
}

function EquipmentRow({ eq }: { eq: Equipment }) {
  const daysToDue = Math.ceil(
    (new Date(eq.nextDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  const dueSoon = daysToDue >= 0 && daysToDue <= 14

  return (
    <Link href={`/equipment/${eq.id}`}>
      <div className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/20 transition-all group cursor-pointer">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
          <Wrench className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">{eq.model}</p>
            <Badge variant="secondary" className={cn("text-xs shrink-0", statusColors[eq.status])}>
              {eq.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {eq.id} &middot; {eq.category} &middot; S/N: {eq.serialNumber}
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end text-right shrink-0">
          <p className={cn("text-xs font-medium", dueSoon ? "text-[color:var(--status-warning)]" : "text-muted-foreground")}>
            {daysToDue < 0 ? "Overdue" : daysToDue === 0 ? "Due today" : `Due in ${daysToDue}d`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{eq.location}</p>
        </div>
        <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </Link>
  )
}

function ServiceTimeline({ entries }: { entries: ServiceHistoryEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="relative pl-6">
      {sorted.map((entry, i) => (
        <div key={entry.id} className="relative mb-6 last:mb-0">
          {/* Vertical line */}
          {i < sorted.length - 1 && (
            <div className="absolute left-[-18px] top-5 bottom-[-24px] w-px bg-border" />
          )}
          {/* Dot */}
          <div className="absolute left-[-22px] top-0.5 flex items-center justify-center w-8 h-8 rounded-full bg-card border border-border">
            {historyTypeIcon[entry.type]}
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {entry.type}
                  </span>
                  <Badge variant="secondary" className="text-xs">{entry.workOrderId}</Badge>
                </div>
                <p className="text-sm font-medium text-foreground mt-1">{entry.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {entry.technician} &middot;{" "}
                  {new Date(entry.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <span className="text-sm font-semibold text-foreground shrink-0">
                ${entry.cost.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { customers, equipment } = useWorkspaceData()
  const customer = customers.find((c) => c.id === id)
  const customerEquipment = useMemo(
    () => equipment.filter((e) => e.customerId === id),
    [equipment, id]
  )

  const allServiceHistory = useMemo(() => {
    return customerEquipment
      .flatMap((eq) =>
        eq.serviceHistory.map((entry) => ({ ...entry, equipmentName: eq.model, equipmentId: eq.id }))
      )
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [customerEquipment])

  const totalContractValue = customer?.contracts.reduce((sum, c) => sum + c.value, 0) ?? 0

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted-foreground text-sm">Customer not found.</p>
        <Link href="/customers">
          <Button variant="outline" size="sm" className="gap-2">
            <ChevronLeft className="w-4 h-4" /> Back to Customers
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/customers">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
            Customers
          </Button>
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium text-foreground">{customer.company}</span>
      </div>

      {/* Header card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary font-bold text-lg shrink-0">
                {customer.company.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground text-balance">{customer.company}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{customer.name} &middot; {customer.id}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs font-medium",
                      customer.status === "Active"
                        ? "bg-[color:var(--status-success)]/15 text-[color:var(--status-success)] border-[color:var(--status-success)]/30"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {customer.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Customer since {new Date(customer.joinedDate).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm">Edit</Button>
              <Button size="sm">+ Work Order</Button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
            {[
              { label: "Equipment", value: customerEquipment.length, icon: Wrench },
              { label: "Open Work Orders", value: customer.openWorkOrders, icon: FileText, warn: customer.openWorkOrders > 0 },
              { label: "Locations", value: customer.locations.length, icon: MapPin },
              { label: "Contract Value", value: `$${totalContractValue.toLocaleString()}`, icon: Building2 },
            ].map(({ label, value, icon: Icon, warn }) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs">{label}</span>
                </div>
                <span className={cn("text-xl font-bold", warn ? "text-[color:var(--status-warning)]" : "text-foreground")}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="equipment">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="equipment">Equipment ({customerEquipment.length})</TabsTrigger>
          <TabsTrigger value="history">Service History ({allServiceHistory.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts & Locations</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Equipment tab */}
        <TabsContent value="equipment" className="mt-4">
          {customerEquipment.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No equipment on file for this customer.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {customerEquipment.map((eq) => (
                <EquipmentRow key={eq.id} eq={eq} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Service History tab */}
        <TabsContent value="history" className="mt-4">
          {allServiceHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No service history on file.</p>
          ) : (
            <div>
              <div className="flex flex-col gap-4">
                {customerEquipment.map((eq) => {
                  if (eq.serviceHistory.length === 0) return null
                  return (
                    <div key={eq.id}>
                      <div className="flex items-center gap-2 mb-3">
                        <Wrench className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground">{eq.model}</span>
                        <span className="text-xs text-muted-foreground">{eq.id}</span>
                      </div>
                      <ServiceTimeline entries={eq.serviceHistory} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Contacts & Locations tab */}
        <TabsContent value="contacts" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contacts</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {customer.contacts.map((contact, i) => (
                  <div key={i} className="flex items-start gap-3 pb-4 border-b border-border last:pb-0 last:border-0">
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted text-muted-foreground font-medium text-xs shrink-0">
                      {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{contact.name}</p>
                      <p className="text-xs text-muted-foreground">{contact.role}</p>
                      <div className="flex flex-col gap-1 mt-2">
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                          <Mail className="w-3.5 h-3.5" />{contact.email}
                        </a>
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                          <Phone className="w-3.5 h-3.5" />{contact.phone}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Locations</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {customer.locations.map((loc) => (
                  <div key={loc.id} className="flex items-start gap-3 pb-3 border-b border-border last:pb-0 last:border-0">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted shrink-0">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{loc.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {loc.address}, {loc.city}, {loc.state} {loc.zip}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Contracts tab */}
        <TabsContent value="contracts" className="mt-4">
          {customer.contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No active contracts.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {customer.contracts.map((contract) => (
                <Card key={contract.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 shrink-0">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{contract.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{contract.id} &middot; {contract.type}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(contract.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {" — "}
                            {new Date(contract.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">${contract.value.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Annual value</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Notes tab */}
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {customer.notes ? (
                <p className="text-sm text-foreground leading-relaxed">{customer.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes on file.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
