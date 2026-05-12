"use client"

import { Building2, CalendarDays, FileText, Hash, Plus, Trash2, UserCircle, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { InvoicePreviewLineItem, InvoicePreviewPayload } from "@/components/aiden/prepared-actions/types"
import { recalcInvoicePreviewTotals } from "@/components/aiden/prepared-actions/invoice-preview-recalc"
import { PreparedActionWarnings } from "@/components/aiden/prepared-actions/PreparedActionWarnings"
import { cn } from "@/lib/utils"

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function newManualLine(): InvoicePreviewLineItem {
  return {
    kind: "manual",
    description: "New line item",
    quantity: 1,
    unitCents: 0,
    lineTotalCents: 0,
    source: "manual",
  }
}

export function PreparedInvoicePreview({
  preview,
  editable = false,
  onChange,
  previewVariant = "invoice",
}: {
  preview: InvoicePreviewPayload
  editable?: boolean
  onChange?: (next: InvoicePreviewPayload) => void
  /** `quote` adjusts copy for draft quotes from a work order (AIden). */
  previewVariant?: "invoice" | "quote"
}) {
  const customer = preview.customer
  const wo = preview.workOrder
  const lines = preview.lineItems ?? []
  const warnings = preview.warnings ?? []
  const laborLines = lines.filter((l) => l.kind === "labor")
  const partsLines = lines.filter((l) => l.kind === "parts" || l.kind === "materials")
  const feeLines = lines.filter((l) => l.kind === "fee")
  const recommendedLines = lines.filter((l) => l.kind === "recommended")
  const otherLines = lines.filter(
    (l) => !["labor", "parts", "materials", "fee", "recommended"].includes(l.kind),
  )

  const laborTotalCents = laborLines.reduce((s, l) => s + (l.lineTotalCents ?? 0), 0)
  const partsTotalCents = partsLines.reduce((s, l) => s + (l.lineTotalCents ?? 0), 0)

  const technician =
    typeof wo?.assignedTechnicianName === "string" && wo.assignedTechnicianName.trim()
      ? wo.assignedTechnicianName.trim()
      : null

  function apply(next: InvoicePreviewPayload) {
    onChange?.(recalcInvoicePreviewTotals(next))
  }

  function updateLine(index: number, patch: Partial<InvoicePreviewLineItem>) {
    const nextLines = lines.map((l, i) => (i === index ? { ...l, ...patch } : l))
    apply({ ...preview, lineItems: nextLines })
  }

  function removeLine(index: number) {
    apply({ ...preview, lineItems: lines.filter((_, i) => i !== index) })
  }

  function addLine() {
    apply({ ...preview, lineItems: [...lines, newManualLine()] })
  }

  return (
    <div className="space-y-4 text-sm">
      {editable ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-50">
          {previewVariant === "quote" ?
            "Edits apply to this draft quote preview only. The source work order will not be changed."
          : "Edits apply to this draft invoice preview only. The source work order will not be changed."}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card/60 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Building2 className="size-3.5 shrink-0" aria-hidden />
            Customer
          </div>
          <p className="font-medium text-foreground">{customer?.companyName ?? "—"}</p>
          {customer?.billingName ? (
            <p className="text-xs text-muted-foreground">Billing: {customer.billingName}</p>
          ) : null}
          {customer?.id ? (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">ID {customer.id}</p>
          ) : null}
        </div>
        <div className="rounded-lg border border-border bg-card/60 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Wrench className="size-3.5 shrink-0" aria-hidden />
            Source work order
          </div>
          <p className="font-medium text-foreground">{wo?.title ?? "—"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {wo?.workOrderNumber != null ? (
              <span className="inline-flex items-center gap-1">
                <Hash className="size-3" aria-hidden />
                {wo.workOrderNumber}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" aria-hidden />
              {fmtDate(wo?.completedAt)}
              <span className="text-muted-foreground/80">(work order date)</span>
            </span>
          </div>
          {wo?.id ? <p className="mt-1 font-mono text-[10px] text-muted-foreground">ID {wo.id}</p> : null}
          <div className="mt-2 flex items-start gap-2 text-xs">
            <UserCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <span className="font-medium text-foreground">Technician</span>
              <p className="text-muted-foreground">{technician ?? "Not available in this preview."}</p>
            </div>
          </div>
        </div>
      </div>

      {previewVariant === "quote" && (preview.diagnosis?.trim() || preview.recommendedRepairsSummary?.trim()) ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3 text-xs">
          {preview.diagnosis?.trim() ? (
            <div>
              <p className="text-[10px] font-medium uppercase text-muted-foreground">Diagnosis / technician notes</p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{preview.diagnosis.trim()}</p>
            </div>
          ) : null}
          {preview.recommendedRepairsSummary?.trim() ? (
            <div>
              <p className="text-[10px] font-medium uppercase text-muted-foreground">Open checklist (recommended)</p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{preview.recommendedRepairsSummary.trim()}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="size-3.5" aria-hidden />
            Line items
          </div>
          {editable && onChange ? (
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={addLine}>
              <Plus className="size-3.5" aria-hidden />
              Add line
            </Button>
          ) : null}
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Description</th>
                <th className={cn("px-2 py-2 text-right", editable ? "w-16" : "w-14")}>Qty</th>
                {editable ? <th className="w-24 px-2 py-2 text-right">Unit</th> : null}
                <th className="w-24 px-2 py-2 text-right">Total</th>
                {editable ? <th className="w-10 px-1 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={editable ? 5 : 3} className="px-2 py-4 text-center text-muted-foreground">
                    No line items in preview.
                  </td>
                </tr>
              ) : (
                lines.map((line, idx) => (
                  <tr key={`${line.description}-${idx}-${line.kind}`} className="border-t border-border/80">
                    <td className="px-2 py-1.5 align-top">
                      {editable && onChange ? (
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(idx, { description: e.target.value })}
                          className="h-8 text-xs"
                          aria-label={`Line ${idx + 1} description`}
                        />
                      ) : (
                        <>
                          <span className="text-muted-foreground">{line.kind} · </span>
                          {line.description}
                        </>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right align-top tabular-nums">
                      {editable && onChange ? (
                        <Input
                          type="number"
                          min={0.0001}
                          step="any"
                          value={line.quantity}
                          onChange={(e) => {
                            const q = Number(e.target.value)
                            updateLine(idx, { quantity: Number.isFinite(q) && q > 0 ? q : 1 })
                          }}
                          className="h-8 text-right text-xs"
                          aria-label={`Line ${idx + 1} quantity`}
                        />
                      ) : (
                        line.quantity
                      )}
                    </td>
                    {editable && onChange ? (
                      <td className="px-2 py-1.5 text-right align-top tabular-nums">
                        <Input
                          type="number"
                          step="0.01"
                          value={Number((line.unitCents / 100).toFixed(2))}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            const unitCents = Number.isFinite(v) ? Math.round(v * 100) : 0
                            updateLine(idx, { unitCents })
                          }}
                          className="h-8 text-right text-xs"
                          aria-label={`Line ${idx + 1} unit price`}
                        />
                      </td>
                    ) : null}
                    <td className="px-2 py-1.5 text-right tabular-nums align-middle">
                      {fmtMoney((line.lineTotalCents ?? 0) / 100)}
                    </td>
                    {editable && onChange ? (
                      <td className="px-1 py-1.5 align-middle">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove line ${idx + 1}`}
                          onClick={() => removeLine(idx)}
                          disabled={lines.length <= 1}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <p className="text-[10px] font-medium uppercase text-muted-foreground">Labor</p>
          <p className="text-sm font-semibold tabular-nums">{fmtMoney(laborTotalCents / 100)}</p>
          {laborLines.length === 0 ? <p className="text-[10px] text-muted-foreground">No labor lines</p> : null}
        </div>
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <p className="text-[10px] font-medium uppercase text-muted-foreground">Parts &amp; materials</p>
          <p className="text-sm font-semibold tabular-nums">{fmtMoney(partsTotalCents / 100)}</p>
          {partsLines.length === 0 ? <p className="text-[10px] text-muted-foreground">No parts lines</p> : null}
        </div>
      </div>

      {(feeLines.length > 0 || otherLines.length > 0 || recommendedLines.length > 0) && (
        <div className="text-xs text-muted-foreground">
          {feeLines.length > 0 ? <p>Fees included in line items above.</p> : null}
          {recommendedLines.length > 0 ? (
            <p>
              {recommendedLines.length} recommended line(s) from the job checklist — priced at $0 until you enter
              estimate amounts.
            </p>
          ) : null}
          {otherLines.length > 0 ? <p>Other line types: {otherLines.map((l) => l.kind).join(", ")}</p> : null}
        </div>
      )}

      <Separator />

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums font-medium">{fmtMoney(preview.subtotal ?? 0)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Tax estimate</span>
          <span className="tabular-nums font-medium">
            {previewVariant === "quote" || preview.taxEstimate == null ? "—" : fmtMoney(preview.taxEstimate)}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-2 text-base font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{fmtMoney(preview.total ?? 0)}</span>
        </div>
      </div>

      <PreparedActionWarnings warnings={warnings} />

      {editable && onChange ? (
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase text-muted-foreground">Invoice notes</p>
          <Textarea
            value={preview.notes ?? ""}
            onChange={(e) => apply({ ...preview, notes: e.target.value })}
            placeholder={previewVariant === "quote" ? "Optional notes on the draft quote…" : "Optional notes on the draft invoice…"}
            className="min-h-[4rem] resize-y text-xs"
            aria-label={previewVariant === "quote" ? "Quote notes" : "Invoice notes"}
          />
        </div>
      ) : preview.notes?.trim() ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
          <p className="text-[10px] font-medium uppercase text-muted-foreground">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{preview.notes.trim()}</p>
        </div>
      ) : null}

      <p
        className={cn(
          "rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-950 dark:text-sky-50",
        )}
      >
        {previewVariant === "quote" ?
          <>
            This will create a <strong>draft quote only</strong>. Nothing is emailed or sent to the customer
            automatically.
          </>
        : <>
            This will create a <strong>draft invoice only</strong>. Nothing is emailed, charged, sent for payment, or
            synced to QuickBooks automatically.
          </>}
      </p>
    </div>
  )
}
