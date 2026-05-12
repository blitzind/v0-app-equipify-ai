"use client"

import Link from "next/link"
import { AlertTriangle, Building2, FileText, PlugZap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { PrepareQuickBooksInvoiceSyncPreviewPayload } from "@/components/aiden/prepared-actions/types"
import { cn } from "@/lib/utils"

function fmtMoneyCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function connectionStatusLabel(status: PrepareQuickBooksInvoiceSyncPreviewPayload["qbConnection"]["status"]) {
  switch (status) {
    case "connected":
      return "Connected"
    case "disconnected":
      return "Disconnected"
    case "error":
      return "Error"
    default:
      return "Unknown"
  }
}

export function PreparedQuickBooksInvoiceSyncPreview({ preview }: { preview: PrepareQuickBooksInvoiceSyncPreviewPayload }) {
  const qb = preview.qbConnection

  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card/60 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Building2 className="size-3.5 shrink-0" aria-hidden />
            Customer
          </div>
          <p className="font-medium text-foreground">{preview.customer.companyName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            QuickBooks customer mapping:{" "}
            <span className="font-medium text-foreground">
              {preview.customerMappedToQuickBooks ? "mapped" : "not mapped"}
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card/60 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="size-3.5 shrink-0" aria-hidden />
            Invoice
          </div>
          <p className="font-medium text-foreground">{preview.invoice.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            #{preview.invoice.invoiceNumber} · {preview.invoice.statusUi}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{fmtMoneyCents(preview.invoice.amountCents)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/10 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
          <PlugZap className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          QuickBooks connection
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              qb.status === "connected" && "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
              qb.status === "disconnected" && "bg-muted text-muted-foreground",
              qb.status === "error" && "bg-destructive/15 text-destructive",
              qb.status === "unknown" && "bg-muted text-muted-foreground",
            )}
          >
            {connectionStatusLabel(qb.status)}
          </span>
          {preview.readiness === "ready" || preview.readiness === "degraded" || preview.readiness === "blocked" ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                preview.readiness === "ready" && "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
                preview.readiness === "degraded" && "bg-amber-500/15 text-amber-900 dark:text-amber-100",
                preview.readiness === "blocked" && "bg-destructive/15 text-destructive",
              )}
            >
              Sync readiness: {preview.readiness}
            </span>
          ) : null}
        </div>
        {qb.connectionNeedsAttention ? (
          <div className="mt-3 flex flex-col gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-50">
            <p className="font-medium">Connection needs attention</p>
            <p className="text-muted-foreground">
              Re-authorize or review QuickBooks in Settings before relying on sync.
            </p>
            <Button type="button" variant="secondary" size="sm" className="h-8 w-fit gap-1.5 text-xs" asChild>
              <Link href="/settings/integrations/quickbooks">
                Open QuickBooks settings
              </Link>
            </Button>
          </div>
        ) : null}
        {qb.lastSyncError && !qb.connectionNeedsAttention ? (
          <p className="mt-2 text-[10px] text-muted-foreground">Last sync note: {qb.lastSyncError}</p>
        ) : null}
      </div>

      <div className="rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">What will sync</p>
        <p className="mt-1">{preview.whatWillSyncSummary}</p>
        {preview.unmappedCatalogLineCount > 0 ? (
          <p className="mt-2 text-[10px]">
            Unmapped catalog lines (preview):{" "}
            <span className="font-medium text-foreground">{preview.unmappedCatalogLineCount}</span>
          </p>
        ) : null}
        {preview.existingInvoiceMapping?.quickBooksInvoiceId ? (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            Existing QuickBooks invoice id: {preview.existingInvoiceMapping.quickBooksInvoiceId}
          </p>
        ) : null}
      </div>

      {preview.warnings.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          <ul className="list-inside list-disc space-y-1 text-amber-950 dark:text-amber-50">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Separator />

      <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-950 dark:text-sky-50">
        <strong>No automatic sync.</strong> This card only prepares a preview until you confirm. QuickBooks is updated
        only after you choose &quot;Sync Invoice to QuickBooks&quot; in the confirmation step.
      </p>
    </div>
  )
}
