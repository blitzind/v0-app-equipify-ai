"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Loader2, PiggyBank, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { reportRangeFromPreset } from "@/lib/reporting/date-range"
import {
  financialInvoicesReportToCsv,
  type FinancialInvoicesReportPayload,
} from "@/lib/reporting/financial-invoices-report"
import { downloadCsv, rowsToCsv } from "@/lib/reporting/export-csv"
import { equipifyExportFilename } from "@/lib/reporting/export-filename"
import { useToast } from "@/hooks/use-toast"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

const DATE_RANGES = ["Last 30 days", "Last 60 days", "Last 90 days", "Last 6 months", "Last 12 months", "Custom"] as const

const INVOICE_STATUS_OPTS = [
  { value: "all", label: "All workflow statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "void", label: "Void" },
] as const

const PAYMENT_STATUS_OPTS = [
  { value: "all", label: "All payment states" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partially paid" },
  { value: "paid", label: "Paid in full" },
  { value: "overpaid", label: "Overpaid" },
] as const

function fmtUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function FinSection({
  title,
  sub,
  action,
  children,
}: {
  title: string
  sub?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-border shrink-0">
        <div>
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          {sub ? <p className="text-xs text-muted-foreground mt-0.5">{sub}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5 flex-1">{children}</div>
    </div>
  )
}

export type FinancialInvoiceReportSectionProps = {
  organizationId: string | null
  /** Use global report filters from the Reports page. */
  variant: "standalone" | "synced"
  syncedFrom?: string
  syncedTo?: string
  syncedCustomerId?: string
}

export function FinancialInvoiceReportSection({
  organizationId,
  variant,
  syncedFrom,
  syncedTo,
  syncedCustomerId,
}: FinancialInvoiceReportSectionProps) {
  const [dateRange, setDateRange] = useState<string>("Last 90 days")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [customerId, setCustomerId] = useState<string>("all")
  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; company_name: string }>>([])

  const [invoiceStatus, setInvoiceStatus] = useState<string>("all")
  const [paymentStatus, setPaymentStatus] = useState<string>("all")
  const [invoicedInPeriodOnly, setInvoicedInPeriodOnly] = useState(false)
  const [includeArchived, setIncludeArchived] = useState(false)

  const [data, setData] = useState<FinancialInvoicesReportPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const { toast } = useToast()

  const standaloneRange = useMemo(
    () => reportRangeFromPreset(dateRange, customFrom || null, customTo || null),
    [dateRange, customFrom, customTo],
  )

  const { from, to } =
    variant === "synced" && syncedFrom && syncedTo
      ? { from: syncedFrom, to: syncedTo }
      : standaloneRange

  const effectiveCustomerId = variant === "synced" ? (syncedCustomerId ?? "all") : customerId

  useEffect(() => {
    if (variant !== "standalone" || !organizationId) {
      setCustomerOptions([])
      return
    }
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const { data: rows } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("company_name")
      if (cancelled) return
      setCustomerOptions((rows as Array<{ id: string; company_name: string }>) ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [variant, organizationId])

  const load = useCallback(async () => {
    if (!organizationId) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        from,
        to,
        invoicedInPeriodOnly: String(invoicedInPeriodOnly),
        includeArchived: String(includeArchived),
        customerId: effectiveCustomerId,
        invoiceStatus,
        paymentStatus,
      })
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/reports/financial-invoices?${qs}`)
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      setData((await res.json()) as FinancialInvoicesReportPayload)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : "Could not load financial report.")
    } finally {
      setLoading(false)
    }
  }, [
    organizationId,
    from,
    to,
    invoicedInPeriodOnly,
    includeArchived,
    effectiveCustomerId,
    invoiceStatus,
    paymentStatus,
  ])

  useEffect(() => {
    void load()
  }, [load])

  const exportCsv = () => {
    if (!data || exportBusy) return
    setExportBusy(true)
    queueMicrotask(() => {
      try {
        const csv = rowsToCsv(financialInvoicesReportToCsv(data))
        downloadCsv(
          equipifyExportFilename({ slug: "financial-invoices", range: { from: data.from, to: data.to } }),
          csv,
          { utf8Bom: true },
        )
        toast({ title: "CSV ready", description: "Download uses the same rows as the table (subject to the report cap)." })
      } catch (e) {
        toast({
          title: "Could not build CSV",
          description: e instanceof Error ? e.message : "Try again after refresh.",
          variant: "destructive",
        })
      } finally {
        setExportBusy(false)
      }
    })
  }

  if (!organizationId) {
    return (
      <FinSection title="Invoice & payment financials" sub="Select an organization to load this report.">
        <p className="text-sm text-muted-foreground">No organization context.</p>
      </FinSection>
    )
  }

  return (
    <div className="flex flex-col gap-4 print:break-inside-avoid">
      <FinSection
        title="Invoice & payment financials"
        sub="Aging and open balances use invoice due dates; period metrics use issued and payment dates. Based on the most recent invoices loaded (see cap below)."
        action={
          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!data || exportBusy}
              onClick={exportCsv}
              title="UTF-8 CSV with BOM (Excel-friendly)"
            >
              {exportBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Download className="w-3.5 h-3.5" aria-hidden />}{" "}
              CSV
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            {variant === "standalone" ? (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Period</span>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="text-xs border border-border rounded-md px-2 py-1.5 bg-secondary min-w-[140px]"
                  >
                    {DATE_RANGES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                {dateRange === "Custom" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="text-xs border border-border rounded-md px-2 py-1.5 bg-secondary"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="text-xs border border-border rounded-md px-2 py-1.5 bg-secondary"
                    />
                  </div>
                ) : null}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customer</span>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="text-xs border border-border rounded-md px-2 py-1.5 bg-secondary max-w-[220px]"
                  >
                    <option value="all">All customers</option>
                    {customerOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Using Reports filters: <span className="font-medium text-foreground">{from}</span> →{" "}
                <span className="font-medium text-foreground">{to}</span>
                {effectiveCustomerId !== "all" ? (
                  <>
                    {" "}
                    · customer scoped
                  </>
                ) : null}
              </p>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Workflow</span>
              <select
                value={invoiceStatus}
                onChange={(e) => setInvoiceStatus(e.target.value)}
                className="text-xs border border-border rounded-md px-2 py-1.5 bg-secondary max-w-[200px]"
              >
                {INVOICE_STATUS_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Payment</span>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="text-xs border border-border rounded-md px-2 py-1.5 bg-secondary max-w-[200px]"
              >
                {PAYMENT_STATUS_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={invoicedInPeriodOnly}
              onChange={(e) => setInvoicedInPeriodOnly(e.target.checked)}
              className="rounded border-border"
            />
            Limit loaded invoices to those issued in the period (narrows aging and open AR)
          </label>

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded border-border"
            />
            Include archived invoices
          </label>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading financial report…
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          {!loading && !error && !data ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No data.</p>
          ) : null}

          {data ? (
            <>
              {data.truncated ? (
                <div className="rounded-lg border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/5 px-3 py-2 text-xs text-[color:var(--status-warning)]">
                  Showing the {data.summary.invoiceRowCap.toLocaleString()} most recent invoices for this organization.
                  Open balances and aging may be incomplete if older open invoices fall outside this window.
                </div>
              ) : null}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    label: "Invoiced (period)",
                    value: fmtUsd(data.summary.totalInvoicedInPeriodCents),
                    sub: `${data.summary.invoicesIssuedInPeriodCount} invoices issued`,
                  },
                  {
                    label: "Payments (period)",
                    value: fmtUsd(data.summary.paymentsInPeriodCents),
                    sub: "Recorded payment date in range",
                  },
                  {
                    label: "Open balance",
                    value: fmtUsd(data.summary.openBalanceCents),
                    sub: "Receivable excl. draft/void",
                  },
                  {
                    label: "Overdue balance",
                    value: fmtUsd(data.summary.overdueBalanceCents),
                    sub: `As of ${data.asOf}`,
                  },
                ].map((k) => (
                  <div key={k.label} className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">{k.label}</p>
                    <p className="text-lg font-bold text-foreground tabular-nums mt-1">{k.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Aging (open balance)</p>
                  <div className="space-y-2">
                    {(
                      [
                        ["Current / not past due", data.agingBucketsCents.current],
                        ["1–30 days past due", data.agingBucketsCents.d1_30],
                        ["31–60 days past due", data.agingBucketsCents.d31_60],
                        ["61–90 days past due", data.agingBucketsCents.d61_90],
                        ["90+ days past due", data.agingBucketsCents.d90_plus],
                      ] as const
                    ).map(([label, cents]) => (
                      <div key={label} className="flex items-center justify-between text-xs gap-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-semibold tabular-nums text-foreground">{fmtUsd(cents)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Counts (filtered)</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-border p-2">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">Workflow</p>
                      <ul className="mt-1 space-y-0.5 text-muted-foreground">
                        {Object.entries(data.summary.counts.workflow).map(([k, v]) => (
                          <li key={k} className="flex justify-between gap-2">
                            <span>{k}</span>
                            <span className="font-medium text-foreground">{v}</span>
                          </li>
                        ))}
                        {Object.keys(data.summary.counts.workflow).length === 0 ? (
                          <li className="text-muted-foreground/70">No rows</li>
                        ) : null}
                      </ul>
                    </div>
                    <div className="rounded-md border border-border p-2">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">Payment</p>
                      <ul className="mt-1 space-y-0.5 text-muted-foreground">
                        {(["unpaid", "partial", "paid", "overpaid"] as const).map((k) => (
                          <li key={k} className="flex justify-between gap-2">
                            <span>{k}</span>
                            <span className="font-medium text-foreground">{data.summary.counts.allocation[k]}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                  <PiggyBank className="w-3.5 h-3.5" /> Customer rollups
                </p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs min-w-[640px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-left">
                        <th className="px-3 py-2 font-semibold text-muted-foreground">Customer</th>
                        <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Invoiced (period)</th>
                        <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Paid (period)</th>
                        <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Open</th>
                        <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Overdue</th>
                        <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Invoices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.customers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                            No invoice rows match the current filters.
                          </td>
                        </tr>
                      ) : (
                        data.customers.map((c) => (
                          <tr key={c.customerId} className="border-b border-border/60 last:border-0">
                            <td className="px-3 py-2 font-medium text-foreground max-w-[220px] truncate">{c.customerName}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(c.invoicedInPeriodCents)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-[color:var(--status-success)]">
                              {fmtUsd(c.paidInPeriodCents)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtUsd(c.openBalanceCents)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-destructive">{fmtUsd(c.overdueBalanceCents)}</td>
                            <td className="px-3 py-2 text-right">{c.invoiceCount}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Loaded {data.summary.invoicesLoaded.toLocaleString()} invoice row(s). Open balance excludes void and draft;
                partial payments reduce balance using recorded payments (Phase 38). Legacy “Paid” invoices with no payment
                rows count as fully paid.
              </p>
            </>
          ) : null}
        </div>
      </FinSection>
    </div>
  )
}
