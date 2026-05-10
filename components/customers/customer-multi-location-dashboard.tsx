"use client"

import type { ElementType } from "react"
import {
  AlertTriangle,
  Building2,
  Calendar,
  ClipboardList,
  MapPin,
  Package,
  Receipt,
  Wrench,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { MultiLocationCardModel, MultiLocationSummary } from "@/lib/customers/multi-location-dashboard"

function fmtCurrencyCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100,
  )
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function SummaryTile({
  label,
  value,
  sub,
  icon: Icon,
  className,
}: {
  label: string
  value: string
  sub?: string
  icon: ElementType
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex flex-col gap-1 min-h-[88px]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
      </div>
      <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
      {sub ? <p className="text-[11px] text-muted-foreground leading-snug">{sub}</p> : null}
    </div>
  )
}

export function CustomerMultiLocationDashboard({
  summary,
  locationCards,
  showFinancials,
  loading,
  onSelectLocation,
  customerId,
  canManageBillingAddress,
  billingAddressUsesServiceLocation,
  onApplyBillingLocation,
}: {
  summary: MultiLocationSummary | null
  locationCards: MultiLocationCardModel[]
  showFinancials: boolean
  loading: boolean
  onSelectLocation: (locationId: string, mode: "equipment" | "work-orders") => void
  customerId: string
  canManageBillingAddress: boolean
  /** When false (custom bill-to), cards still offer "Use as billing" to switch back to a site. */
  billingAddressUsesServiceLocation: boolean
  onApplyBillingLocation: (locationId: string | null) => void | Promise<void>
}) {
  if (loading || !summary) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Multi-location operations
          </CardTitle>
          <CardDescription>Loading location metrics…</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const srHref = `/communications/service-requests?focusCustomer=${encodeURIComponent(customerId)}`

  return (
    <div className="space-y-4" data-customer-location-dashboard>
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Multi-location operations
              </CardTitle>
              <CardDescription>
                Service sites, equipment, work, and intake — structured for future map and routing views (
                <span className="font-mono text-[11px]">data-location-id</span> on each card).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <SummaryTile
              label="Service sites"
              value={String(summary.totalLocations)}
              sub={`${summary.activeLocations} active`}
              icon={MapPin}
            />
            <SummaryTile
              label="Equipment"
              value={String(summary.equipmentCount)}
              sub={
                summary.unassignedEquipmentCount > 0
                  ? `${summary.unassignedEquipmentCount} unassigned to a site`
                  : "On file for this account"
              }
              icon={Package}
            />
            <SummaryTile
              label="Open work orders"
              value={String(summary.openWorkOrders)}
              icon={Wrench}
              className={summary.openWorkOrders > 0 ? "border-amber-500/25 bg-amber-500/[0.04]" : undefined}
            />
            <SummaryTile
              label="Open requests"
              value={String(summary.openServiceRequests)}
              sub={
                summary.urgentServiceRequests > 0 || summary.needsInfoServiceRequests > 0
                  ? `${summary.urgentServiceRequests} urgent/high · ${summary.needsInfoServiceRequests} need info`
                  : "Service intake queue"
              }
              icon={ClipboardList}
            />
            <SummaryTile
              label="Upcoming (60d)"
              value={String(summary.upcomingServiceOrMaintenanceCount)}
              sub="Visits & due dates"
              icon={Calendar}
            />
            {showFinancials ?
              <SummaryTile
                label="Unpaid invoices"
                value={
                  summary.unpaidInvoiceCents != null && summary.unpaidInvoiceCents > 0
                    ? fmtCurrencyCents(summary.unpaidInvoiceCents)
                    : "—"
                }
                sub="Customer balance (all sites)"
                icon={Receipt}
              />
            : <SummaryTile label="Invoices" value="—" sub="Requires billing access" icon={Receipt} />}
          </div>

          {summary.convertedServiceRequests > 0 ?
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{summary.convertedServiceRequests}</span> service
              request{summary.convertedServiceRequests === 1 ? "" : "s"} converted to work orders (all sites).
            </p>
          : null}
        </CardContent>
      </Card>

      {locationCards.length === 0 ?
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">
          Add service locations to unlock per-site performance cards.
        </p>
      : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {locationCards.map((loc) => (
            <article
              key={loc.locationId}
              data-location-id={loc.locationId}
              data-map-lat=""
              data-map-lng=""
              className={cn(
                "rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex flex-col overflow-hidden",
                "transition-colors hover:border-primary/30",
              )}
            >
              <div className="p-4 border-b border-border/80 bg-muted/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{loc.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{loc.addressLine}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {loc.isDefault ?
                      <Badge variant="secondary" className="text-[10px]">
                        Primary
                      </Badge>
                    : null}
                    {loc.isBillingSite ?
                      <Badge
                        variant="outline"
                        className="text-[10px] border-primary/40 text-primary bg-primary/5"
                      >
                        Billing
                      </Badge>
                    : null}
                  </div>
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-3 text-sm">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Equipment</dt>
                    <dd className="font-semibold tabular-nums">{loc.equipmentCount}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Open WOs</dt>
                    <dd className="font-semibold tabular-nums">{loc.openWorkOrders}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last service</dt>
                    <dd className="font-medium">{fmtDate(loc.lastServiceDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Next due</dt>
                    <dd className="font-medium">{fmtDate(loc.nextDueDate)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Service requests</dt>
                    <dd className="mt-0.5 flex flex-wrap gap-1.5">
                      {loc.openServiceRequests > 0 ?
                        <Badge variant="outline" className="text-[10px]">
                          {loc.openServiceRequests} open
                        </Badge>
                      : null}
                      {loc.newOrUrgentServiceRequests > 0 ?
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {loc.newOrUrgentServiceRequests} urgent
                        </Badge>
                      : null}
                      {loc.awaitingInfoServiceRequests > 0 ?
                        <Badge variant="secondary" className="text-[10px]">
                          {loc.awaitingInfoServiceRequests} need info
                        </Badge>
                      : null}
                      {loc.convertedServiceRequests > 0 ?
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-800 dark:text-emerald-200">
                          {loc.convertedServiceRequests} converted
                        </Badge>
                      : null}
                      {loc.linkedWorkOrdersFromConvertedSr > 0 ?
                        <span className="text-[10px] text-muted-foreground">
                          {loc.linkedWorkOrdersFromConvertedSr} linked WO
                        </span>
                      : null}
                    </dd>
                  </div>
                  {showFinancials && loc.invoiceBalanceCents != null && loc.invoiceBalanceCents > 0 ?
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Site-linked balance</dt>
                      <dd className="font-semibold tabular-nums">{fmtCurrencyCents(loc.invoiceBalanceCents)}</dd>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        From invoices tied to equipment at this site.
                      </p>
                    </div>
                  : null}
                </dl>

                {loc.previewServiceRequests.length > 0 ?
                  <div className="text-xs border-t border-border pt-2 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Recent intake
                    </p>
                    {loc.previewServiceRequests.map((sr) => (
                      <div key={sr.id} className="flex items-start justify-between gap-2">
                        <p className="text-muted-foreground line-clamp-2">{sr.summary}</p>
                        <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                          {sr.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                : null}

                <div className="flex flex-wrap gap-2 pt-1 mt-auto border-t border-border">
                  {canManageBillingAddress ?
                    <Button
                      type="button"
                      variant={loc.isBillingSite ? "secondary" : "outline"}
                      size="sm"
                      className="h-8 text-xs"
                      disabled={Boolean(loc.isBillingSite && billingAddressUsesServiceLocation)}
                      onClick={() => {
                        if (loc.isBillingSite && billingAddressUsesServiceLocation) return
                        const target = loc.isDefault ? null : loc.locationId
                        void onApplyBillingLocation(target)
                      }}
                    >
                      {loc.isBillingSite && billingAddressUsesServiceLocation ?
                        "Billing address"
                      : "Use as billing address"}
                    </Button>
                  : null}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => onSelectLocation(loc.locationId, "equipment")}
                  >
                    Equipment
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => onSelectLocation(loc.locationId, "work-orders")}
                  >
                    Work orders
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" asChild>
                    <a
                      href={`${srHref}&focusLocation=${encodeURIComponent(loc.locationId)}`}
                      className="inline-flex items-center"
                    >
                      Requests
                    </a>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
