"use client"

import { useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"
import type { BulkInvoiceCompletedWorkOrdersPreview } from "@/lib/aiden/actions/resolvers/bulk-invoice-completed-work-orders-types"
import { AIDEN_BULK_DRAFT_INVOICES_CONFIRMATION_PHRASE } from "@/lib/aiden/actions/bulk-invoice-confirmation"
import type { InvoicePreviewPayload } from "@/components/aiden/prepared-actions/types"
import { PreparedInvoicePreview } from "@/components/aiden/prepared-actions/PreparedInvoicePreview"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}

function anomalyLabel(code: string): string {
  switch (code) {
    case "missing_labor":
      return "Missing labor"
    case "missing_parts":
      return "Missing parts"
    case "missing_pricing":
      return "Missing pricing"
    case "missing_billing_contact":
      return "Missing billing contact"
    case "missing_tax_settings":
      return "Missing tax settings"
    case "zero_total":
      return "Zero total"
    case "duplicate_risk":
      return "Duplicate risk"
    case "existing_invoice_link":
      return "Existing invoice"
    default:
      return code
  }
}

export function BulkPreparedInvoicePreview({
  preview,
  excludedWorkOrderIds,
  onExcludedChange,
  editable,
  className,
}: {
  preview: BulkInvoiceCompletedWorkOrdersPreview
  excludedWorkOrderIds: Set<string>
  onExcludedChange: (next: Set<string>) => void
  editable: boolean
  className?: string
}) {
  const [drawerWoId, setDrawerWoId] = useState<string | null>(null)
  const drawerItem = useMemo(
    () => preview.items.find((i) => i.workOrderId === drawerWoId) ?? null,
    [drawerWoId, preview.items],
  )

  const includedRows = useMemo(
    () => preview.items.filter((i) => !excludedWorkOrderIds.has(i.workOrderId)),
    [preview.items, excludedWorkOrderIds],
  )

  const est = useMemo(() => includedRows.reduce((s, i) => s + i.invoicePreview.total, 0), [includedRows])

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
        <p className="font-medium text-foreground">{preview.dateRange.label}</p>
        <p className="mt-1 text-muted-foreground">
          <span className="text-foreground">{includedRows.length}</span> draft invoice
          {includedRows.length === 1 ? "" : "s"} to create · Estimated total{" "}
          <span className="font-medium text-foreground">{formatMoney(est)}</span>
        </p>
        {preview.batchWarnings.length > 0 ? (
          <ul className="mt-2 list-inside list-disc text-amber-700 dark:text-amber-400">
            {preview.batchWarnings.map((w) => (
              <li key={w}>{w.replace(/_/g, " ")}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-[10px] text-muted-foreground">
          Draft invoices only — nothing is emailed or sent automatically. Type{" "}
          <span className="font-mono font-medium text-foreground">{AIDEN_BULK_DRAFT_INVOICES_CONFIRMATION_PHRASE}</span>{" "}
          in the confirmation step to run this batch.
        </p>
      </div>

      <ScrollArea className="h-[min(420px,50vh)] rounded-md border border-border">
        <ul className="divide-y divide-border">
          {preview.items.map((it) => {
            const excluded = excludedWorkOrderIds.has(it.workOrderId)
            const woLabel =
              it.workOrderNumber != null ? `WO #${it.workOrderNumber}` : `WO ${it.workOrderId.slice(0, 8)}…`
            return (
              <li key={it.workOrderId} className="flex flex-col gap-1.5 px-3 py-2.5 text-xs">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id={`bulk-ex-${it.workOrderId}`}
                    checked={!excluded}
                    disabled={!editable}
                    onCheckedChange={(v) => {
                      const next = new Set(excludedWorkOrderIds)
                      if (v === true) next.delete(it.workOrderId)
                      else next.add(it.workOrderId)
                      onExcludedChange(next)
                    }}
                    aria-label={`Include ${woLabel} in batch`}
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`bulk-ex-${it.workOrderId}`} className="cursor-pointer font-medium text-foreground">
                      {woLabel} · {it.customerLabel}
                    </label>
                    <p className="text-[10px] text-muted-foreground">
                      {it.completedAt ? new Date(it.completedAt).toLocaleString() : "—"} ·{" "}
                      {formatMoney(it.invoicePreview.total)}
                    </p>
                    {it.anomalies.length > 0 ? (
                      <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
                        {it.anomalies.map(anomalyLabel).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 gap-0.5 px-2 text-[10px]"
                    onClick={() => setDrawerWoId(it.workOrderId)}
                  >
                    Preview
                    <ChevronRight className="size-3" aria-hidden />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </ScrollArea>

      <Sheet open={drawerWoId != null} onOpenChange={(o) => !o && setDrawerWoId(null)}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
          <SheetHeader className="border-b border-border pb-3">
            <SheetTitle className="text-left text-sm">Per-invoice preview</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 px-1 py-3">
            {drawerItem ?
              <PreparedInvoicePreview preview={drawerItem.invoicePreview as unknown as InvoicePreviewPayload} editable={false} />
            : null}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}
