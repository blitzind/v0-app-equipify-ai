"use client"

/**
 * Invoicing Phase 2 — Invoice source panel.
 *
 * Shows the service activity an invoice originated from: linked work orders
 * (display number, type, technician, scheduled / completed dates, equipment,
 * service location), the count of available + released certificates, and a
 * compact summary that helps office staff trace the invoice back to the
 * service appointment.
 *
 * Uses `lib/billing/invoice-source.ts` which is tenant-scoped and
 * schema-drift safe (junction table + legacy column fallback).
 */

import * as React from "react"
import Link from "next/link"
import { CalendarDays, ClipboardList, FileText, MapPin, ShieldCheck, UserCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import {
  buildInvoiceSourceSummary,
  formatInvoiceSourceDate,
  type InvoiceSourceSummary,
} from "@/lib/billing/invoice-source"

const BILLING_STATE_LABELS: Record<string, string> = {
  not_billable: "Not billable",
  ready_for_billing: "Ready for billing",
  invoiced: "Invoiced",
  paid: "Paid",
}

export type InvoiceSourcePanelProps = {
  organizationId: string
  invoiceId: string
  legacyWorkOrderId?: string | null
  className?: string
}

export function InvoiceSourcePanel({
  organizationId,
  invoiceId,
  legacyWorkOrderId,
  className,
}: InvoiceSourcePanelProps) {
  const [summary, setSummary] = React.useState<InvoiceSourceSummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    if (!organizationId || !invoiceId) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createBrowserSupabaseClient()
        const data = await buildInvoiceSourceSummary(supabase, {
          organizationId,
          invoiceId,
          legacyWorkOrderId: legacyWorkOrderId ?? null,
        })
        if (cancelled) return
        setSummary(data)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Could not load source.")
        setSummary(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, invoiceId, legacyWorkOrderId])

  if (loading) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
        <p className="text-xs text-muted-foreground">Loading service source…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
        <p className="text-xs text-destructive">{error}</p>
      </div>
    )
  }
  if (!summary) return null

  const { workOrders, certificateTotal, certificateReleasedCount, primaryServiceLocation } = summary
  const hasWorkOrders = workOrders.length > 0

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <ClipboardList className="w-3 h-3" /> Linked service work
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasWorkOrders
              ? `Linked to ${workOrders.length} service visit${workOrders.length === 1 ? "" : "s"}.`
              : "Standalone invoice — not linked to a service visit."}
          </p>
        </div>
        {certificateTotal > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground shrink-0">
            <FileText className="w-3 h-3" aria-hidden />
            {certificateTotal} cert{certificateTotal === 1 ? "" : "s"}
            {certificateReleasedCount > 0 ? (
              <span className="ml-1 text-[10px] text-[color:var(--status-success)]">
                ({certificateReleasedCount} released)
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      {hasWorkOrders ? (
        <ul className="divide-y divide-border/60 -mx-1">
          {workOrders.map((wo) => (
            <li key={wo.id} className="px-1 py-2.5 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/work-orders?open=${wo.id}`}
                  className="text-xs font-mono font-medium text-primary hover:underline truncate"
                >
                  {wo.display}
                </Link>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                  {wo.statusLabel}
                  {wo.billingState && BILLING_STATE_LABELS[wo.billingState] ? (
                    <span className="ml-1 rounded border border-border px-1 py-px text-[9px] uppercase tracking-wide">
                      {BILLING_STATE_LABELS[wo.billingState]}
                    </span>
                  ) : null}
                </span>
              </div>
              <p className="text-xs text-foreground truncate" title={wo.title}>
                {wo.title}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" aria-hidden />
                  {wo.completedAt
                    ? `Completed ${formatInvoiceSourceDate(wo.completedAt)}`
                    : wo.scheduledOn
                      ? `Scheduled ${formatInvoiceSourceDate(wo.scheduledOn)}`
                      : "No date"}
                </span>
                {wo.technicianName ? (
                  <span className="inline-flex items-center gap-1">
                    <UserCircle2 className="w-3 h-3" aria-hidden />
                    {wo.technicianName}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 truncate">
                  <ShieldCheck className="w-3 h-3" aria-hidden />
                  {wo.equipmentName}
                </span>
                {wo.serviceLocation ? (
                  <span className="inline-flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3" aria-hidden />
                    {wo.serviceLocation}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground py-1">
          This invoice is not linked to a service visit. Link a work order to surface technician,
          location, and certificate context here.
        </p>
      )}

      {primaryServiceLocation && hasWorkOrders ? (
        <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
          Primary service location: <span className="text-foreground font-medium">{primaryServiceLocation}</span>
        </p>
      ) : null}
    </div>
  )
}
