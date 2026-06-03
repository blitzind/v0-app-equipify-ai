"use client"

import { useState, useEffect, useRef, useMemo, type ReactNode } from "react"
import Link from "next/link"
import { cn, looksLikeUuid } from "@/lib/utils"
import { useInvoices, useQuotes } from "@/lib/quote-invoice-store"
import { quoteUiAwaitingCustomerDecision } from "@/lib/org-quotes-invoices/quote-approval"
import type { AdminQuote, QuoteStatus } from "@/lib/mock-data"
import { enforceCanCreateRecord } from "@/app/actions/org-create-enforcement"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useBillingAccess } from "@/lib/billing-access-context"
import { useOrgArchivePermissions } from "@/lib/use-org-archive-permissions"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { RestrictedNotice } from "@/components/permissions/restricted-notice"
import { RecentCommunicationsCard } from "@/components/communications/recent-communications-card"
import type { updateOrgQuote } from "@/lib/org-quotes-invoices/repository"
import { formatWorkOrderDisplay, getWorkOrderDisplay } from "@/lib/work-orders/display"
import { computeDueDateYmd } from "@/lib/billing/invoice-terms"
import { normalizeTimeForDb, uiPriorityToDb, uiTypeToDb } from "@/lib/work-orders/db-map"
import type { WorkOrderPriority, WorkOrderType } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer,
  DrawerSection,
  DrawerRow,
  DrawerTimeline,
  DrawerToastStack,
  DRAWER_FIELD_CLASS,
  DRAWER_NESTED_CARD,
  DRAWER_STACKED_MODAL,
  NESTED_OVER_DRAWER_Z,
  type ToastItem,
} from "@/components/detail-drawer"
import {
  CheckCircle2, Download, Send, Pencil, X, Check,
  FileText, Plus, Trash2, Sparkles, RefreshCw, ChevronDown, ThumbsUp, PackageSearch,
  ThumbsDown, DollarSign, FileEdit, Loader2, Wrench, Archive, RotateCcw,
} from "lucide-react"
import { ContactActions } from "@/components/contact-actions"
import { useCustomerOutboundEmails } from "@/hooks/use-customer-outbound-emails"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { buildQuotePdfFilename } from "@/lib/quotes/quote-pdf-filename"
import type { QuoteInvoiceLineItem } from "@/lib/org-quotes-invoices/map"
import type { CatalogListItemRow } from "@/lib/catalog/catalog-line-snapshots"
import { buildQuoteInvoiceLineSnapshot } from "@/lib/catalog/catalog-line-snapshots"
import { AddFromCatalogDialog } from "@/components/catalog/add-from-catalog-dialog"
import { computeBlitzpayQuoteDepositTargetCents } from "@/lib/blitzpay/blitzpay-estimate-deposit-math"
import { buildQuoteRevenueAccelerationInsights } from "@/lib/blitzpay/blitzpay-revenue-acceleration-insights"

let toastCounter = 0

// ─── Design tokens ────────────────────────────────────────────────────────────

const AI_BG     = "bg-[color:var(--ds-info-bg)]"
const AI_BORDER = "border-[color:var(--ds-info-border)]"
const AI_TEXT   = "text-[color:var(--ds-info-text)]"
const AI_SUBTLE = "text-[color:var(--ds-info-subtle)]"

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<QuoteStatus, { className: string }> = {
  "Draft":            { className: "bg-muted text-muted-foreground border-border" },
  "Sent":             { className: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30" },
  "Pending Approval": { className: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30" },
  "Approved":         { className: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30" },
  "Declined":         { className: "bg-destructive/10 text-destructive border-destructive/30" },
  "Expired":          { className: "bg-muted text-muted-foreground border-border" },
}

const ALL_STATUSES: QuoteStatus[] = ["Draft", "Sent", "Pending Approval", "Approved", "Declined", "Expired"]

const ALL_BLITZPAY_QUOTE_DEPOSIT_MODES = ["none", "acceptance", "fixed", "percentage", "full_prepay"] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function fmtCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

type QuoteStaffBlitzpayPricing = {
  depositTargetCents: number
  depositCollectedCents: number
  remainingQuoteCents: number
  convenienceFeeCents: number
  totalChargeCents: number
  disclosureCopy: string
  financingReady: boolean
  financingMessage: string
}

function quoteDrawerTitle(q: AdminQuote): string {
  const quoteNumber = q.quoteNumber?.trim()
  if (quoteNumber) return quoteNumber
  const id = q.id.trim()
  if (looksLikeUuid(id)) {
    const d = q.description.trim()
    if (d) return d.length > 56 ? `${d.slice(0, 56)}…` : d
    return "Quote"
  }
  return "Quote"
}

type LineItem = QuoteInvoiceLineItem

// ─── AI mock generators ───────────────────────────────────────────────────────

function generateQuoteDraft(quote: AdminQuote): string {
  const total = fmtCurrency(quote.amount)
  return `Dear ${quote.customerName},\n\nThank you for reaching out to us regarding your ${quote.equipmentName}. We are pleased to present this service quote for your review.\n\nBased on our initial assessment, the proposed scope of work includes ${quote.description.toLowerCase()}. Our team will ensure all work is completed to manufacturer specifications and industry standards.\n\nThis quote is valid for 30 days from the issue date. Please review the attached line items totaling ${total} and let us know if you have any questions or would like to proceed.\n\nWe look forward to serving you.`
}

function generatePricingRecommendation(quote: AdminQuote): { text: string; rows: { label: string; value: string }[] } {
  const base = quote.amount
  const competitive = Math.round(base * 0.97)
  const premium     = Math.round(base * 1.12)
  const pmBundle    = Math.round(base * 0.90)

  return {
    text: `Based on similar jobs for ${quote.equipmentName} in this market segment, the current quote of ${fmtCurrency(base)} is well-positioned. Consider the pricing options below based on your goals for this customer.`,
    rows: [
      { label: "Competitive (close faster)",    value: fmtCurrency(competitive) },
      { label: "Current quote",                 value: fmtCurrency(base) },
      { label: "Premium (higher margin)",       value: fmtCurrency(premium) },
      { label: "PM plan bundle discount",       value: fmtCurrency(pmBundle) + " + recurring" },
    ],
  }
}

// ─── AI Tools Panel ───────────────────────────────────────────────────────────

type AITool = "draft" | "pricing" | null

interface AIResult {
  tool: AITool
  text: string
  rows?: { label: string; value: string }[]
}

function QuoteAIToolsPanel({
  quote,
  onApplyDraft,
  onApplyPricing,
}: {
  quote: AdminQuote
  onApplyDraft: (text: string) => void
  onApplyPricing: (amount: number) => void
}) {
  const [activeTool, setActiveTool] = useState<AITool>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AIResult | null>(null)
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null)
  const [appliedTool, setAppliedTool] = useState<AITool>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function runTool(tool: AITool) {
    if (loading) return
    setActiveTool(tool)
    setLoading(true)
    setResult(null)
    setFeedback(null)
    setAppliedTool(null)

    timerRef.current = setTimeout(() => {
      if (!tool) return
      if (tool === "draft") {
        setResult({ tool, text: generateQuoteDraft(quote) })
      } else if (tool === "pricing") {
        const rec = generatePricingRecommendation(quote)
        setResult({ tool, text: rec.text, rows: rec.rows })
      }
      setLoading(false)
    }, 1700)
  }

  function regenerate() {
    if (activeTool) runTool(activeTool)
  }

  // Extract numeric amount from pricing row label
  function applyPricingRow(value: string) {
    const num = parseInt(value.replace(/[^0-9]/g, ""), 10)
    if (!isNaN(num)) {
      onApplyPricing(num)
      setAppliedTool("pricing")
    }
  }

  const tools: { id: AITool; icon: React.ReactNode; label: string; sub: string }[] = [
    {
      id: "draft",
      icon: <FileEdit className="w-3.5 h-3.5" />,
      label: "Generate Quote Draft",
      sub: "Write a professional email for this quote",
    },
    {
      id: "pricing",
      icon: <DollarSign className="w-3.5 h-3.5" />,
      label: "Recommend Pricing",
      sub: "Compare pricing options for this job",
    },
  ]

  return (
    <div className={cn("rounded-xl border overflow-hidden", AI_BG, AI_BORDER)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="w-5 h-5 rounded bg-[color:var(--ds-info-subtle)] flex items-center justify-center shrink-0">
          <Sparkles className="w-2.5 h-2.5 text-white" aria-hidden />
        </div>
        <span className={cn("text-xs font-semibold", AI_TEXT)}>AI Tools</span>
        <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ml-0.5 bg-[color:var(--ds-info-subtle)] text-white border-transparent">
          AI
        </span>
      </div>

      {/* Tool buttons */}
      <div className={cn("grid grid-cols-1 gap-px border-t", AI_BORDER)}>
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => runTool(t.id)}
            disabled={loading}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer",
              "hover:bg-[color:var(--ds-info-border)]/30 disabled:opacity-50 disabled:cursor-not-allowed",
              activeTool === t.id && result ? "bg-[color:var(--ds-info-border)]/20" : "",
            )}
          >
            <span className={cn("shrink-0 mt-0.5", AI_SUBTLE)}>{t.icon}</span>
            <span className="flex-1 min-w-0">
              <span className={cn("block text-xs font-semibold", AI_TEXT)}>{t.label}</span>
              <span className="block text-[10px] text-muted-foreground mt-0.5">{t.sub}</span>
            </span>
            {loading && activeTool === t.id && (
              <RefreshCw className={cn("w-3.5 h-3.5 shrink-0 animate-spin", AI_SUBTLE)} />
            )}
            {activeTool !== t.id && (
              <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 -rotate-90", AI_SUBTLE)} />
            )}
          </button>
        ))}
      </div>

      {/* Result panel */}
      {(loading || result) && (
        <div className={cn("border-t px-4 py-3 space-y-3", AI_BORDER)}>
          {loading ? (
            <div className="space-y-2" aria-label="Generating...">
              <div className="h-2.5 rounded bg-[color:var(--ds-info-border)] animate-pulse w-full" />
              <div className="h-2.5 rounded bg-[color:var(--ds-info-border)] animate-pulse w-5/6" />
              <div className="h-2.5 rounded bg-[color:var(--ds-info-border)] animate-pulse w-3/4" />
            </div>
          ) : result ? (
            <>
              {/* Text output */}
              <div className={cn("rounded-lg border p-3 space-y-1.5", AI_BORDER, "bg-[color:var(--ds-info-border)]/10")}>
                {result.text.split("\n").filter(Boolean).map((p, i) => (
                  <p key={i} className={cn("text-xs leading-relaxed", AI_TEXT)}>{p}</p>
                ))}
              </div>

              {/* Pricing rows */}
              {result.rows && result.rows.length > 0 && (
                <div className={cn("rounded-lg border divide-y overflow-hidden", AI_BORDER)}>
                  {result.rows.map((row, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 px-3 py-2 group"
                    >
                      <span className={cn("text-[10px] font-medium opacity-70", AI_TEXT)}>{row.label}</span>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] font-semibold", AI_TEXT)}>{row.value}</span>
                        {!row.value.includes("recurring") && (
                          <button
                            type="button"
                            onClick={() => applyPricingRow(row.value)}
                            className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all cursor-pointer",
                              "opacity-0 group-hover:opacity-100",
                              AI_BORDER, AI_TEXT,
                              "hover:bg-[color:var(--ds-info-border)]/30",
                            )}
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Draft apply button */}
              {result.tool === "draft" && (
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "w-full text-xs gap-1.5 cursor-pointer border",
                    AI_BORDER, AI_TEXT,
                    "hover:bg-[color:var(--ds-info-border)]/30 bg-transparent",
                    appliedTool === "draft" && "opacity-60",
                  )}
                  onClick={() => {
                    onApplyDraft(result.text)
                    setAppliedTool("draft")
                  }}
                  disabled={appliedTool === "draft"}
                >
                  {appliedTool === "draft" ? (
                    <><Check className="w-3.5 h-3.5" /> Applied to Notes</>
                  ) : (
                    <><FileEdit className="w-3.5 h-3.5" /> Apply to Notes</>
                  )}
                </Button>
              )}

              {/* Feedback + regenerate row */}
              <div className={cn("flex items-center justify-between gap-2 pt-1 border-t", AI_BORDER)}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFeedback("up")}
                    className={cn(
                      "p-1 rounded transition-colors cursor-pointer",
                      feedback === "up"
                        ? "text-[color:var(--ds-info-subtle)]"
                        : "text-muted-foreground hover:text-[color:var(--ds-info-subtle)]",
                    )}
                    aria-label="Good result"
                  >
                    <ThumbsUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedback("down")}
                    className={cn(
                      "p-1 rounded transition-colors cursor-pointer",
                      feedback === "down"
                        ? "text-destructive"
                        : "text-muted-foreground hover:text-destructive",
                    )}
                    aria-label="Poor result"
                  >
                    <ThumbsDown className="w-3 h-3" />
                  </button>
                  {feedback && (
                    <span className="text-[10px] text-muted-foreground ml-1">
                      {feedback === "up" ? "Thanks for the feedback!" : "We'll improve this."}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={regenerate}
                  disabled={loading}
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-semibold cursor-pointer",
                    AI_TEXT, "hover:underline disabled:opacity-40 transition-all",
                  )}
                >
                  <RefreshCw className={cn("w-2.5 h-2.5", loading && "animate-spin")} />
                  Regenerate
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ─── Edit controls ────────────────────────────────────────────────────────────

function EditInput({ value, onChange, type = "text", placeholder, className }: {
  value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(DRAWER_FIELD_CLASS, "w-full focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors", className)}
    />
  )
}

function EditSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(DRAWER_FIELD_CLASS, "w-full cursor-pointer focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors")}
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function EditTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(DRAWER_FIELD_CLASS, "w-full resize-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors")}
    />
  )
}

function EditRow({ label, view, editing, children }: {
  label: string; view: React.ReactNode; editing: boolean; children: React.ReactNode
}) {
  return editing ? (
    <div className="flex items-start gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0 pt-1.5 w-28">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  ) : (
    <DrawerRow label={label} value={view} />
  )
}

// ─── Line items ───────────────────────────────────────────────────────────────

function EditableLineItems({
  items,
  onChange,
  extraActions,
}: {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
  extraActions?: ReactNode
}) {
  function updateItem(idx: number, field: keyof LineItem, raw: string) {
    onChange(items.map((item, i) =>
      i !== idx ? item : { ...item, [field]: field === "description" ? raw : parseFloat(raw) || 0 }
    ))
  }
  function addItem() { onChange([...items, { description: "", qty: 1, unit: 0 }]) }
  function removeItem(idx: number) { onChange(items.filter((_, i) => i !== idx)) }
  const total = items.reduce((s, i) => s + i.qty * i.unit, 0)

  return (
    <div className="space-y-2">
      <div className={cn(DRAWER_NESTED_CARD, "overflow-hidden")}>
        <table className="w-full text-xs">
          <thead className="ds-thead-bg-subtle">
            <tr>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-14">Qty</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-20">Unit</th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Total</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item, i) => (
              <tr key={i} className="bg-transparent dark:bg-[#111724]/35">
                <td className="px-2 py-1.5"><EditInput value={item.description} onChange={(v) => updateItem(i, "description", v)} placeholder="Item description" /></td>
                <td className="px-2 py-1.5"><EditInput type="number" value={item.qty} onChange={(v) => updateItem(i, "qty", v)} className="text-right" /></td>
                <td className="px-2 py-1.5"><EditInput type="number" value={item.unit} onChange={(v) => updateItem(i, "unit", v)} className="text-right" /></td>
                <td className="px-2 py-1.5 text-right font-medium text-foreground">{fmtCurrency(item.qty * item.unit)}</td>
                <td className="px-2 py-1.5 text-center">
                  <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer" aria-label="Remove line item">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="ds-tfoot-bg-subtle border-t border-border">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right font-semibold text-foreground text-xs uppercase tracking-wide">Total</td>
              <td className="px-2 py-2 text-right font-bold text-foreground">{fmtCurrency(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {extraActions}
        <button onClick={addItem} className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer font-medium">
          <Plus className="w-3.5 h-3.5" /> Add Line Item
        </button>
      </div>
    </div>
  )
}

function ReadOnlyLineItems({ items, total }: { items: LineItem[]; total: number }) {
  return (
    <div className={cn(DRAWER_NESTED_CARD, "overflow-hidden")}>
      <table className="w-full text-xs">
        <thead className="ds-thead-bg-subtle">
          <tr>
            <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-10">Qty</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Unit</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item, i) => (
            <tr key={i} className="bg-transparent dark:bg-[#111724]/35">
              <td className="px-3 py-2 text-foreground">{item.description}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{item.qty}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{fmtCurrency(item.unit)}</td>
              <td className="px-3 py-2 text-right font-medium text-foreground">{fmtCurrency(item.qty * item.unit)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="ds-tfoot-bg-subtle border-t border-border">
          <tr>
            <td colSpan={3} className="px-3 py-2 text-right font-semibold text-foreground text-xs uppercase tracking-wide">Total</td>
            <td className="px-3 py-2 text-right font-bold text-foreground">{fmtCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Props / component ────────────────────────────────────────────────────────

interface QuoteDrawerProps {
  quoteId: string | null
  onClose: () => void
}

export function QuoteDrawer({ quoteId, onClose }: QuoteDrawerProps) {
  const { organizationId: activeOrgId, status: orgStatus } = useActiveOrganization()
  const { standardCreateEligibility } = useBillingAccess()
  const { canArchiveRestore } = useOrgArchivePermissions()
  const { quotes, updateQuote, archiveQuote, restoreQuote, refreshQuotes } = useQuotes()
  const { addInvoiceFromPayload, invoices } = useInvoices()
  // Phase 2 (Permissions): hide quote mutation actions for non-edit roles.
  const { permissions: quoteOrgPermissions } = useOrgPermissions()
  const canEditQuotes = quoteOrgPermissions.canEditQuotes
  const canStaffBlitzpayQuote =
    quoteOrgPermissions.canEditQuotes && quoteOrgPermissions.canViewFinancials
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<AdminQuote>>({})
  const [draftItems, setDraftItems] = useState<LineItem[]>([])
  const [convertingToWo, setConvertingToWo] = useState(false)
  const [convertingToInvoice, setConvertingToInvoice] = useState(false)
  const [quoteEmailOpen, setQuoteEmailOpen] = useState(false)
  const [quoteEmailTo, setQuoteEmailTo] = useState("")
  const [quoteEmailNote, setQuoteEmailNote] = useState("")
  const [quoteEmailBusy, setQuoteEmailBusy] = useState(false)
  const [downloadPdfBusy, setDownloadPdfBusy] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false)
  const [blitzpayQuotePricing, setBlitzpayQuotePricing] = useState<QuoteStaffBlitzpayPricing | null>(null)
  const [blitzpayQuoteLinks, setBlitzpayQuoteLinks] = useState<Array<{ id: string; status: string }>>([])
  const [blitzpayQuoteBusy, setBlitzpayQuoteBusy] = useState(false)
  const [blitzpayPctDraft, setBlitzpayPctDraft] = useState("")
  const [financingOrgSnapshot, setFinancingOrgSnapshot] = useState<{
    financingEnabled: boolean
    installmentPlansEnabled: boolean
  } | null>(null)

  const quote = quoteId ? quotes.find((q) => q.id === quoteId) ?? null : null

  const quoteRevenueInsights = useMemo(() => {
    if (!quote || !financingOrgSnapshot) return []
    const quoteAmountCents = Math.round(quote.amount * 100)
    const mode = quote.blitzpayDepositMode ?? "none"
    const targetRes = computeBlitzpayQuoteDepositTargetCents({
      quoteAmountCents,
      mode,
      fixedCents: quote.blitzpayDepositFixedCents,
      percentageBps: quote.blitzpayDepositPercentageBps,
    })
    return buildQuoteRevenueAccelerationInsights({
      orgFinancingEnabled: financingOrgSnapshot.financingEnabled,
      orgInstallmentPlansEnabled: financingOrgSnapshot.installmentPlansEnabled,
      quoteAmountCents,
      depositCollectedCents: quote.blitzpayDepositCollectedCents ?? 0,
      depositTargetCents: targetRes.ok ? targetRes.targetPayCents : null,
      financingReady: Boolean(quote.blitzpayFinancingReady),
    })
  }, [quote, financingOrgSnapshot])

  const { emails: quoteCustomerEmails } = useCustomerOutboundEmails(
    orgStatus === "ready" ? activeOrgId : null,
    quote?.customerId ?? null,
  )
  const quoteMailtoEmail = quoteCustomerEmails[0]

  const linkedInvoice = useMemo(() => {
    if (!quote) return null
    return invoices.find((inv) => inv.quoteId === quote.id && !inv.isArchived) ?? null
  }, [invoices, quote])

  async function handleDownloadQuotePdf() {
    if (!quote || downloadPdfBusy) return
    const oid = activeOrgId?.trim()
    if (!oid || orgStatus !== "ready") {
      toast(orgStatus === "ready" && !oid ? "No organization selected." : "Loading organization…", "info")
      return
    }
    setDownloadPdfBusy(true)
    try {
      const url = `/api/organizations/${encodeURIComponent(oid)}/quotes/${encodeURIComponent(quote.id)}/pdf`
      const res = await fetch(url, { credentials: "include", cache: "no-store" })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string }
        toast(typeof j.message === "string" ? j.message : "Could not download PDF.", "info")
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get("Content-Disposition")
      let name = buildQuotePdfFilename(quote.quoteNumber?.trim() || "Quote")
      const m = cd?.match(/filename="([^"]+)"/i)
      if (m?.[1]) name = m[1].trim()
      const href = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = href
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(href)
      toast("Quote PDF downloaded")
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not download PDF.", "info")
    } finally {
      setDownloadPdfBusy(false)
    }
  }

  useEffect(() => {
    setEditing(false)
    setDraft({})
    setDraftItems([])
    setBlitzpayPctDraft("")
  }, [quoteId])

  useEffect(() => {
    if (!quote || !activeOrgId || orgStatus !== "ready" || !canStaffBlitzpayQuote || quote.isArchived) {
      setBlitzpayQuotePricing(null)
      setBlitzpayQuoteLinks([])
      return
    }
    let cancelled = false
    void (async () => {
      const [prRes, liRes] = await Promise.all([
        fetch(
          `/api/organizations/${encodeURIComponent(activeOrgId)}/quotes/${encodeURIComponent(quote.id)}/blitzpay/prepare-pay`,
        ),
        fetch(
          `/api/organizations/${encodeURIComponent(activeOrgId)}/quotes/${encodeURIComponent(quote.id)}/blitzpay/payment-link`,
        ),
      ])
      const prJson = (await prRes.json().catch(() => ({}))) as { pricing?: QuoteStaffBlitzpayPricing }
      const liJson = (await liRes.json().catch(() => ({}))) as { links?: Array<{ id: string; status: string }> }
      if (cancelled) return
      if (prRes.ok && prJson.pricing) setBlitzpayQuotePricing(prJson.pricing)
      else setBlitzpayQuotePricing(null)
      if (liRes.ok && Array.isArray(liJson.links)) setBlitzpayQuoteLinks(liJson.links.map((l) => ({ id: l.id, status: l.status })))
      else setBlitzpayQuoteLinks([])
    })()
    return () => {
      cancelled = true
    }
  }, [quote, activeOrgId, orgStatus, canStaffBlitzpayQuote])

  useEffect(() => {
    if (!activeOrgId || orgStatus !== "ready" || !canStaffBlitzpayQuote) {
      setFinancingOrgSnapshot(null)
      return
    }
    let cancelled = false
    void (async () => {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(activeOrgId)}/blitzpay/financing/summary`,
        { credentials: "include", cache: "no-store" },
      )
      const j = (await res.json().catch(() => ({}))) as {
        org?: { financingEnabled?: boolean; installmentPlansEnabled?: boolean }
      }
      if (cancelled) return
      if (!res.ok || !j.org) {
        setFinancingOrgSnapshot(null)
        return
      }
      setFinancingOrgSnapshot({
        financingEnabled: Boolean(j.org.financingEnabled),
        installmentPlansEnabled: Boolean(j.org.installmentPlansEnabled),
      })
    })()
    return () => {
      cancelled = true
    }
  }, [activeOrgId, orgStatus, canStaffBlitzpayQuote])

  function toast(message: string, tone: "success" | "info" = "success") {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function startEdit() {
    if (!quote || quote.isArchived) return
    setDraft({
      status: quote.status,
      expiresDate: quote.expiresDate,
      notes: quote.notes,
      internalNotes: quote.internalNotes ?? "",
      blitzpayDepositMode: quote.blitzpayDepositMode ?? "none",
      blitzpayDepositFixedCents: quote.blitzpayDepositFixedCents ?? null,
      blitzpayDepositPercentageBps: quote.blitzpayDepositPercentageBps ?? null,
      blitzpayFinancingReady: quote.blitzpayFinancingReady ?? false,
    })
    setDraftItems(quote.lineItems.map((li) => ({ ...li })))
    setBlitzpayPctDraft(
      quote.blitzpayDepositPercentageBps != null && Number(quote.blitzpayDepositPercentageBps) > 0
        ? String(Number(quote.blitzpayDepositPercentageBps) / 100)
        : "",
    )
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
    setDraftItems([])
    setCatalogPickerOpen(false)
    setBlitzpayPctDraft("")
  }

  function appendCatalogLineFromPicker(row: CatalogListItemRow, qty: number) {
    const snap = buildQuoteInvoiceLineSnapshot(row, qty)
    setDraftItems((prev) => [...prev, snap])
  }

  async function saveEdit() {
    if (!quote) return
    const newTotal = draftItems.reduce((s, i) => s + i.qty * i.unit, 0)
    const internal = (draft.internalNotes ?? "").trim()
    const lineItems = draftItems.map((li) => {
      const row: QuoteInvoiceLineItem = {
        description: li.description,
        qty: li.qty,
        unit: li.unit,
      }
      if (li.catalog_item_id) row.catalog_item_id = li.catalog_item_id
      if (li.sku) row.sku = li.sku
      if (li.item_type) row.item_type = li.item_type
      if (li.unit_label) row.unit_label = li.unit_label
      return row
    })
    const nextStatus = (draft.status ?? quote.status) as QuoteStatus
    const depMode = (draft.blitzpayDepositMode ?? quote.blitzpayDepositMode ?? "none") as
      | "none"
      | "acceptance"
      | "fixed"
      | "percentage"
      | "full_prepay"
    let pctBps: number | null = draft.blitzpayDepositPercentageBps ?? quote.blitzpayDepositPercentageBps ?? null
    if (depMode === "percentage") {
      const n = Number(blitzpayPctDraft.trim())
      if (Number.isFinite(n) && n > 0 && n <= 100) {
        pctBps = Math.round(n * 100)
      }
    }
    const patch: Parameters<typeof updateOrgQuote>[3] = {
      status: nextStatus,
      expiresAt: draft.expiresDate ?? quote.expiresDate,
      notes: (draft.notes ?? quote.notes) || "",
      internalNotes: internal || undefined,
      lineItems,
      amountCents: Math.round(newTotal * 100),
      blitzpayDepositMode: depMode,
      blitzpayDepositFixedCents:
        draft.blitzpayDepositFixedCents !== undefined ? draft.blitzpayDepositFixedCents : quote.blitzpayDepositFixedCents ?? null,
      blitzpayDepositPercentageBps:
        depMode === "percentage" ? pctBps : draft.blitzpayDepositPercentageBps ?? quote.blitzpayDepositPercentageBps ?? null,
      blitzpayFinancingReady: draft.blitzpayFinancingReady ?? quote.blitzpayFinancingReady ?? false,
    }
    if (nextStatus === "Sent" && !quote.sentDate) {
      patch.sentAt = new Date().toISOString()
    }
    const { error } = await updateQuote(quote.id, patch)
    if (error) {
      toast(`Could not save: ${error}`, "info")
      return
    }
    setEditing(false)
    setDraft({})
    setDraftItems([])
    toast("Quote updated successfully")
  }

  function setField<K extends keyof AdminQuote>(field: K, value: AdminQuote[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  // AI apply callbacks
  function handleApplyDraft(text: string) {
    if (!quote) return
    if (!editing) {
      setDraft({
        status: quote.status,
        expiresDate: quote.expiresDate,
        notes: text,
        internalNotes: quote.internalNotes ?? "",
      })
      setDraftItems(quote.lineItems.map((li) => ({ ...li })))
      setEditing(true)
    } else {
      setDraft((prev) => ({ ...prev, notes: text }))
    }
    toast("Draft applied to notes — review and save")
  }

  async function handleConvertToWorkOrder() {
    if (!quote || quote.workOrderId) return
    if (!quote.customerId || !quote.equipmentId) {
      toast("Link equipment on this quote before creating a work order.")
      return
    }
    if (!standardCreateEligibility.ok) {
      toast(standardCreateEligibility.message, "info")
      return
    }
    if (!activeOrgId) {
      toast("No organization selected.")
      return
    }
    const convertGate = await enforceCanCreateRecord(activeOrgId, "work_order")
    if (!convertGate.ok) {
      toast(convertGate.message, "info")
      return
    }
    setConvertingToWo(true)
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast("You must be signed in to create a work order.")
      setConvertingToWo(false)
      return
    }
    if (orgStatus !== "ready" || !activeOrgId) {
      toast(orgStatus === "ready" && !activeOrgId ? "No organization selected." : "Loading organization…")
      setConvertingToWo(false)
      return
    }
    const orgId = activeOrgId
    const scheduled = quote.expiresDate || new Date().toISOString().slice(0, 10)
    const priority: WorkOrderPriority = "Normal"
    const woType: WorkOrderType = "Repair"
    const quoteTitle = quote.description.trim().slice(0, 500) || "Work from quote"
    const problemReported = quoteTitle
    const { data: inserted, error } = await supabase
      .from("work_orders")
      .insert({
        organization_id: orgId,
        customer_id: quote.customerId,
        equipment_id: quote.equipmentId,
        title: quoteTitle,
        status: "open",
        priority: uiPriorityToDb(priority),
        type: uiTypeToDb(woType),
        scheduled_on: scheduled,
        scheduled_time: normalizeTimeForDb("08:00"),
        notes: quote.notes?.trim() || null,
        problem_reported: problemReported,
        assigned_user_id: user.id,
        repair_log: {
          problemReported,
          diagnosis: "",
          partsUsed: [],
          laborHours: 0,
          technicianNotes: "",
          photos: [],
          signatureDataUrl: "",
          signedBy: "",
          signedAt: "",
        },
      })
      .select("id, work_order_number")
      .single()
    setConvertingToWo(false)
    if (error) {
      toast(`Could not create work order: ${error.message}`)
      return
    }
    const row = inserted as { id: string; work_order_number?: number | null } | null
    const newId = row?.id
    if (!newId) {
      toast("Work order was not created.")
      return
    }
    const { error: linkErr } = await updateQuote(quote.id, { workOrderId: newId })
    if (linkErr) {
      toast(`Work order created but quote link failed: ${linkErr}`, "info")
      return
    }
    toast(`Work order ${formatWorkOrderDisplay(row.work_order_number, newId)} created from quote`)
  }

  function openQuoteEmailModal() {
    if (!quote) return
    setQuoteEmailTo(`billing@${quote.customerName.toLowerCase().replace(/\s+/g, "")}.com`)
    setQuoteEmailNote("")
    setQuoteEmailOpen(true)
  }

  async function sendQuoteEmail() {
    if (!quote) return
    if (orgStatus !== "ready" || !activeOrgId) {
      toast(orgStatus === "ready" && !activeOrgId ? "No organization selected." : "Loading organization…", "info")
      return
    }
    const trimmed = quoteEmailTo.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast("Enter a valid recipient email address.", "info")
      return
    }
    setQuoteEmailBusy(true)
    try {
      const alreadySent = quote.status === "Sent" || Boolean(quote.sentDate)
      const res = await fetch("/api/email/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: activeOrgId,
          quoteId: quote.id,
          to: trimmed,
          message: quoteEmailNote.trim() || undefined,
          variant: alreadySent ? "resend" : "send",
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        toast(typeof data.message === "string" ? data.message : "Could not send email.", "info")
        return
      }
      await refreshQuotes()
      setQuoteEmailOpen(false)
      toast(
        alreadySent ? "Quote resent to the customer by email." : "Quote sent to the customer by email.",
      )
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not send email.", "info")
    } finally {
      setQuoteEmailBusy(false)
    }
  }

  async function handleConvertToInvoice() {
    if (!quote) return
    setConvertingToInvoice(true)
    const issuedAt = new Date().toISOString().split("T")[0]
    const dueDate = computeDueDateYmd(issuedAt, "net_30")
    const lineItemsJson = quote.lineItems
      .filter((li) => li.description.trim())
      .map((li) => ({
        description: li.description.trim(),
        qty: li.qty,
        unit: li.unit,
      }))
    const fallbackLine =
      lineItemsJson.length > 0
        ? lineItemsJson
        : [{ description: quote.description.trim() || "Invoice from quote", qty: 1, unit: quote.amount }]
    const { id, error } = await addInvoiceFromPayload({
      customerId: quote.customerId,
      equipmentId: quote.equipmentId || null,
      workOrderId: quote.workOrderId || null,
      quoteId: quote.id,
      calibrationRecordId: null,
      title: quote.description.trim() || "Invoice from quote",
      amountCents: Math.round(quote.amount * 100),
      status: "Draft",
      issuedAt,
      dueDate,
      paidAt: null,
      lineItems: fallbackLine,
      notes: quote.notes?.trim() ? quote.notes.trim() : null,
      internalNotes: quote.internalNotes?.trim() ? quote.internalNotes.trim() : null,
      termsCode: "net_30",
      termsCustomDays: null,
    })
    setConvertingToInvoice(false)
    if (error) {
      toast(`Could not create invoice: ${error}`, "info")
      return
    }
    if (id && activeOrgId) {
      try {
        const cr = await fetch(
          `/api/organizations/${encodeURIComponent(activeOrgId)}/quotes/${encodeURIComponent(quote.id)}/blitzpay/apply-deposit-credit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoiceId: id }),
          },
        )
        const cj = (await cr.json().catch(() => ({}))) as { appliedCents?: number; message?: string }
        if (cr.ok && typeof cj.appliedCents === "number" && cj.appliedCents > 0) {
          toast(`Invoice created; applied $${(cj.appliedCents / 100).toFixed(2)} estimate deposit credit.`)
        } else {
          toast("Invoice created from quote")
        }
      } catch {
        toast("Invoice created from quote")
      }
      await refreshQuotes()
    } else {
      toast("Invoice created from quote")
    }
    if (id) onClose()
  }

  async function confirmArchiveQuote() {
    if (!quote) return
    setArchiveBusy(true)
    const { error } = await archiveQuote(quote.id)
    setArchiveBusy(false)
    setArchiveOpen(false)
    if (error) {
      toast(`Could not archive: ${error}`, "info")
      return
    }
    toast("Quote archived")
    onClose()
  }

  async function confirmRestoreQuote() {
    if (!quote) return
    setRestoreBusy(true)
    const { error } = await restoreQuote(quote.id)
    setRestoreBusy(false)
    if (error) {
      toast(`Could not restore: ${error}`, "info")
      return
    }
    toast("Quote restored")
  }

  function handleApplyPricing(amount: number) {
    // Update total by scaling all line items proportionally
    if (!quote) return
    const scale = amount / (quote.amount || 1)
    const scaledItems = quote.lineItems.map((li) => ({
      ...li,
      unit: Math.round(li.unit * scale),
    }))
    if (!editing) {
      setDraft({
        status: quote.status,
        expiresDate: quote.expiresDate,
        notes: quote.notes,
        internalNotes: quote.internalNotes ?? "",
      })
      setDraftItems(scaledItems)
      setEditing(true)
    } else {
      setDraftItems(scaledItems)
    }
    toast(`Pricing updated to ${fmtCurrency(amount)} — review and save`)
  }

  async function staffQuoteBlitzpayHostedCheckout() {
    if (!quote || !activeOrgId) return
    setBlitzpayQuoteBusy(true)
    try {
      const r = await fetch(
        `/api/organizations/${encodeURIComponent(activeOrgId)}/quotes/${encodeURIComponent(quote.id)}/blitzpay/prepare-pay`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      )
      const j = (await r.json().catch(() => ({}))) as { url?: string; message?: string }
      if (!r.ok) {
        toast(typeof j.message === "string" ? j.message : "Could not start checkout.", "info")
        return
      }
      if (typeof j.url === "string" && j.url) {
        window.location.href = j.url
      } else {
        toast("Checkout URL missing.", "info")
      }
    } finally {
      setBlitzpayQuoteBusy(false)
    }
  }

  async function staffCreateQuoteBlitzpayPaymentLink() {
    if (!quote || !activeOrgId) return
    setBlitzpayQuoteBusy(true)
    try {
      const r = await fetch(
        `/api/organizations/${encodeURIComponent(activeOrgId)}/quotes/${encodeURIComponent(quote.id)}/blitzpay/payment-link`,
        { method: "POST" },
      )
      const j = (await r.json().catch(() => ({}))) as { link?: { url?: string }; message?: string; error?: string }
      if (!r.ok) {
        toast(typeof j.message === "string" ? j.message : "Could not create payment link.", "info")
        return
      }
      const url = j.link?.url
      if (typeof url === "string" && url) {
        await navigator.clipboard.writeText(url).catch(() => {})
        toast("Payment link copied to clipboard.")
      } else {
        toast("Payment link created.")
      }
      const liRes = await fetch(
        `/api/organizations/${encodeURIComponent(activeOrgId)}/quotes/${encodeURIComponent(quote.id)}/blitzpay/payment-link`,
      )
      const liJson = (await liRes.json().catch(() => ({}))) as { links?: Array<{ id: string; status: string }> }
      if (liRes.ok && Array.isArray(liJson.links)) {
        setBlitzpayQuoteLinks(liJson.links.map((l) => ({ id: l.id, status: l.status })))
      }
    } finally {
      setBlitzpayQuoteBusy(false)
    }
  }

  if (!quote) return null

  const canCreateWorkOrder =
    !quote.workOrderId &&
    Boolean(quote.customerId) &&
    Boolean(quote.equipmentId) &&
    quote.status !== "Declined" &&
    quote.status !== "Expired"

  const currentStatus = (draft.status ?? quote.status) as QuoteStatus
  const alreadySent =
    quote.status === "Sent" || quote.status === "Pending Approval" || Boolean(quote.sentDate)

  const portalDecisionLabel = quote.customerPortalDecisionAt
    ? fmtDate(quote.customerPortalDecisionAt.slice(0, 10))
    : null

  const timelineItems = [
    { date: fmtDate(quote.createdDate), label: "Quote created", description: `Created by ${quote.createdBy}`, accent: "muted" as const },
    ...(quote.sentDate ? [{ date: fmtDate(quote.sentDate), label: "Quote sent to customer", accent: "muted" as const }] : []),
    ...(currentStatus === "Approved" ?
      [{
        date: portalDecisionLabel ?? "—",
        label: "Customer approved quote",
        description: portalDecisionLabel ? "Recorded from portal or updated by your team" : undefined,
        accent: "success" as const,
      }]
    : []),
    ...(currentStatus === "Declined" ?
      [{
        date: portalDecisionLabel ?? "—",
        label: "Customer declined quote",
        description: quote.portalCustomerNote?.trim() || undefined,
        accent: "danger" as const,
      }]
    : []),
    ...(currentStatus === "Expired" ? [{ date: fmtDate(quote.expiresDate), label: "Quote expired", accent: "danger" as const }] : []),
  ]

  return (
    <>
      <DetailDrawer
        open={!!quoteId}
        onClose={onClose}
        title={quoteDrawerTitle(quote)}
        subtitle={
          quote.equipmentName
            ? `${quote.customerName} · ${quote.equipmentName}`
            : quote.customerName
        }
        width="lg"
        badge={
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className={cn("text-[10px] font-semibold", STATUS_CONFIG[currentStatus].className)}>
              {currentStatus}
            </Badge>
            {quote.isArchived ? (
              <Badge variant="outline" className="text-[10px] font-semibold bg-muted text-muted-foreground border-border">
                Archived
              </Badge>
            ) : null}
          </div>
        }
        actions={
          editing ? (
            <>
              <Button size="sm" variant="default" className="gap-1.5 text-xs cursor-pointer" onClick={() => void saveEdit()}>
                <Check className="w-3.5 h-3.5" /> Save Changes
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={cancelEdit}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
            </>
          ) : quote.isArchived ? (
            canArchiveRestore ? (
              <Button
                size="sm"
                variant="default"
                className="gap-1.5 text-xs cursor-pointer"
                disabled={restoreBusy}
                onClick={() => void confirmRestoreQuote()}
              >
                {restoreBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Restore
              </Button>
            ) : null
          ) : !canEditQuotes ? (
            <RestrictedNotice
              inline
              capability="canEditQuotes"
              title="Quote actions are restricted to other roles."
            />
          ) : (
            <>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
              {(quote.status === "Draft" ||
                quote.status === "Sent" ||
                quote.status === "Pending Approval") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs cursor-pointer"
                  disabled={quoteEmailBusy}
                  onClick={() => openQuoteEmailModal()}
                >
                  <Send className="w-3.5 h-3.5" /> {alreadySent ? "Resend Quote" : "Email to Customer"}
                </Button>
              )}
              {canCreateWorkOrder && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs cursor-pointer"
                  disabled={convertingToWo}
                  onClick={() => void handleConvertToWorkOrder()}
                >
                  {convertingToWo ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wrench className="w-3.5 h-3.5" />
                  )}
                  Create Work Order
                </Button>
              )}
              {quote.status === "Approved" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs cursor-pointer"
                  disabled={convertingToInvoice}
                  onClick={() => void handleConvertToInvoice()}
                >
                  {convertingToInvoice ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" /> Convert to Invoice
                    </>
                  )}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs cursor-pointer"
                type="button"
                disabled={downloadPdfBusy}
                onClick={() => void handleDownloadQuotePdf()}
              >
                {downloadPdfBusy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Downloading…
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs cursor-pointer text-destructive border-destructive/40 hover:bg-destructive/10 disabled:opacity-50"
                disabled={!canArchiveRestore}
                title={!canArchiveRestore ? "Owner, admin, or manager role required" : undefined}
                onClick={() => setArchiveOpen(true)}
              >
                <Archive className="w-3.5 h-3.5" /> Archive
              </Button>
            </>
          )
        }
      >
        <div className="-mx-5 -my-5 min-h-full bg-muted/40 px-5 py-5 space-y-5 dark:bg-[#0B111E]">
          {/* AI Tools */}
          {!editing && !quote.isArchived && (
            <QuoteAIToolsPanel
              quote={quote}
              onApplyDraft={handleApplyDraft}
              onApplyPricing={handleApplyPricing}
            />
          )}

          <DrawerSection title="Quote Details">
            <div className={cn(DRAWER_NESTED_CARD, "mb-3 flex flex-wrap gap-2 p-3")}>
              {quoteUiAwaitingCustomerDecision(quote.status) ? (
                <Badge variant="outline" className="text-[10px] font-semibold border-[color:var(--status-warning)]/40 bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)]">
                  Awaiting customer decision
                </Badge>
              ) : null}
              {quote.status === "Approved" && !quote.workOrderId && quote.equipmentId ? (
                <Badge variant="outline" className="text-[10px] font-semibold border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100">
                  Ready — create work order
                </Badge>
              ) : null}
              {quote.status === "Approved" && quote.workOrderId ? (
                <Badge variant="outline" className="text-[10px] font-semibold border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100">
                  Work order linked
                </Badge>
              ) : null}
              {quote.status === "Approved" && linkedInvoice ? (
                <Badge variant="outline" className="text-[10px] font-semibold border-violet-500/30 bg-violet-500/10 text-violet-900 dark:text-violet-100">
                  Invoice linked
                </Badge>
              ) : null}
              {quote.status === "Approved" && !linkedInvoice && canEditQuotes ? (
                <Badge variant="outline" className="text-[10px] font-semibold border-border text-muted-foreground">
                  Ready — convert to invoice when billing
                </Badge>
              ) : null}
            </div>
            <div className={cn(DRAWER_NESTED_CARD, "p-4 space-y-1")}>
              <DrawerRow label="Customer" value={
                <Link href={`/customers?open=${quote.customerId}`} className="text-primary hover:underline cursor-pointer font-medium">
                  {quote.customerName}
                </Link>
              } />
              <div className="py-1">
                <ContactActions
                  email={
                    quoteMailtoEmail
                      ? { customerName: quote.customerName, customerEmail: quoteMailtoEmail }
                      : undefined
                  }
                  equipify={
                    orgStatus === "ready" && activeOrgId
                      ? {
                          organizationId: activeOrgId,
                          customerId: quote.customerId,
                          customerLabel: quote.customerName,
                          defaultRecipientEmail: quoteMailtoEmail,
                        }
                      : undefined
                  }
                />
              </div>
              <DrawerRow
                label="Equipment"
                value={
                  quote.equipmentId ? (
                    <Link href={`/equipment?open=${quote.equipmentId}`} className="text-primary hover:underline cursor-pointer font-medium">
                      {quote.equipmentName?.trim() || "Equipment"}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground text-sm">No equipment on this quote</span>
                  )
                }
              />
              <DrawerRow label="Created By" value={quote.createdBy} />
              <DrawerRow label="Created" value={fmtDate(quote.createdDate)} />
              <EditRow label="Expires" view={
                <span className={quote.status === "Expired" ? "text-destructive font-semibold" : ""}>{fmtDate(quote.expiresDate)}</span>
              } editing={editing}>
                <EditInput type="date" value={draft.expiresDate ?? ""} onChange={(v) => setField("expiresDate", v)} />
              </EditRow>
              <EditRow label="Status" view={
                <Badge variant="outline" className={cn("text-[10px] font-semibold", STATUS_CONFIG[quote.status].className)}>{quote.status}</Badge>
              } editing={editing}>
                <EditSelect value={draft.status ?? quote.status} onChange={(v) => setField("status", v as QuoteStatus)} options={ALL_STATUSES} />
              </EditRow>
              {quote.workOrderId && (
                <DrawerRow label="Work Order" value={
                  <Link href={`/work-orders?open=${quote.workOrderId}`} className="text-primary font-mono hover:underline cursor-pointer">
                    {getWorkOrderDisplay({ id: quote.workOrderId, workOrderNumber: quote.workOrderNumber })}
                  </Link>
                } />
              )}
            </div>
          </DrawerSection>

          {canStaffBlitzpayQuote && orgStatus === "ready" && activeOrgId && !quote.isArchived ? (
            <DrawerSection title="BlitzPay (estimate)">
              <div className={cn(DRAWER_NESTED_CARD, "space-y-3 p-4 text-xs")}>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Hosted checkout for deposits or full prepay. Deposits book to the estimate ledger and can be applied as
                  invoice credit when you convert to billing.
                </p>
                {editing ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Deposit mode</p>
                    <EditSelect
                      value={String(draft.blitzpayDepositMode ?? quote.blitzpayDepositMode ?? "none")}
                      onChange={(v) =>
                        setField(
                          "blitzpayDepositMode",
                          v as NonNullable<AdminQuote["blitzpayDepositMode"]>,
                        )
                      }
                      options={[...ALL_BLITZPAY_QUOTE_DEPOSIT_MODES]}
                    />
                    {(draft.blitzpayDepositMode ?? quote.blitzpayDepositMode) === "fixed" ||
                    (draft.blitzpayDepositMode ?? quote.blitzpayDepositMode) === "acceptance" ? (
                      <label className="block space-y-1">
                        <span className="text-[10px] text-muted-foreground">Fixed deposit (cents, min 50)</span>
                        <EditInput
                          type="number"
                          value={
                            draft.blitzpayDepositFixedCents != null
                              ? String(draft.blitzpayDepositFixedCents)
                              : quote.blitzpayDepositFixedCents != null
                                ? String(quote.blitzpayDepositFixedCents)
                                : ""
                          }
                          onChange={(v) => {
                            const t = v.trim()
                            if (!t) {
                              setField("blitzpayDepositFixedCents", null)
                              return
                            }
                            const n = Math.round(Number(t))
                            setField("blitzpayDepositFixedCents", Number.isFinite(n) ? n : null)
                          }}
                        />
                      </label>
                    ) : null}
                    {(draft.blitzpayDepositMode ?? quote.blitzpayDepositMode) === "percentage" ? (
                      <label className="block space-y-1">
                        <span className="text-[10px] text-muted-foreground">Deposit percent (1–100)</span>
                        <EditInput
                          type="number"
                          value={blitzpayPctDraft}
                          onChange={(v) => setBlitzpayPctDraft(v)}
                        />
                      </label>
                    ) : null}
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.blitzpayFinancingReady ?? quote.blitzpayFinancingReady)}
                        onChange={(e) => setField("blitzpayFinancingReady", e.target.checked)}
                      />
                      <span>Financing-ready flag (messaging only; no lending integrations yet)</span>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-1 text-[11px]">
                    <DrawerRow label="Deposit mode" value={quote.blitzpayDepositMode ?? "none"} />
                    <DrawerRow
                      label="Deposit collected"
                      value={fmtCents(quote.blitzpayDepositCollectedCents ?? 0)}
                    />
                    <DrawerRow
                      label="Remaining on quote"
                      value={fmtCents(quote.blitzpayRemainingQuoteCents ?? Math.round(quote.amount * 100))}
                    />
                    <DrawerRow
                      label="Financing-ready"
                      value={quote.blitzpayFinancingReady ? "Yes" : "No"}
                    />
                    {quote.blitzpayConvertedInvoiceId ? (
                      <DrawerRow
                        label="Converted invoice"
                        value={
                          <Link
                            className="text-primary hover:underline"
                            href={`/invoices?open=${encodeURIComponent(quote.blitzpayConvertedInvoiceId)}`}
                          >
                            Open invoice
                          </Link>
                        }
                      />
                    ) : null}
                  </div>
                )}
                {blitzpayQuotePricing ? (
                  <div className="rounded-md border border-border/80 p-2 space-y-1 text-[11px]">
                    <p className="font-semibold text-foreground">Next checkout preview</p>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Collectible now</span>
                      <span className="tabular-nums">{fmtCents(blitzpayQuotePricing.depositTargetCents)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Est. processing fee</span>
                      <span className="tabular-nums">{fmtCents(blitzpayQuotePricing.convenienceFeeCents)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Customer pays</span>
                      <span className="tabular-nums font-medium">{fmtCents(blitzpayQuotePricing.totalChargeCents)}</span>
                    </div>
                    <p className="text-muted-foreground pt-1 leading-relaxed">{blitzpayQuotePricing.financingMessage}</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    Pricing preview unavailable (check BlitzPay is on, Connect is ready, and deposit mode is valid).
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-8 text-xs"
                    disabled={blitzpayQuoteBusy || (quote.blitzpayDepositMode ?? "none") === "none"}
                    onClick={() => void staffQuoteBlitzpayHostedCheckout()}
                  >
                    {blitzpayQuoteBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Open hosted checkout"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={blitzpayQuoteBusy || (quote.blitzpayDepositMode ?? "none") === "none"}
                    onClick={() => void staffCreateQuoteBlitzpayPaymentLink()}
                  >
                    Create payment link
                  </Button>
                </div>
                {blitzpayQuoteLinks.length > 0 ? (
                  <div className="space-y-1 pt-2 border-t border-border/60">
                    <p className="text-[10px] font-semibold text-muted-foreground">Recent links</p>
                    <ul className="space-y-1 font-mono text-[10px]">
                      {blitzpayQuoteLinks.slice(0, 5).map((l) => (
                        <li key={l.id} className="flex justify-between gap-2">
                          <span className="truncate">{l.id.slice(0, 8)}…</span>
                          <span className="shrink-0 text-muted-foreground">{l.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {quoteRevenueInsights.length > 0 ? (
                  <div className="pt-2 border-t border-border/60 space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground">Revenue acceleration (read-only)</p>
                    <ul className="space-y-1.5">
                      {quoteRevenueInsights.map((i) => (
                        <li key={i.code} className="rounded border border-border/60 p-2 text-[10px]">
                          <p className="font-medium text-foreground">{i.title}</p>
                          <p className="text-muted-foreground mt-0.5 leading-relaxed">{i.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </DrawerSection>
          ) : null}

          {quote.customerPortalDecisionAt || quote.portalCustomerNote?.trim() ? (
            <DrawerSection title="Customer approval (portal)">
              <div className={cn(DRAWER_NESTED_CARD, "space-y-3 p-4 text-sm")}>
                {quote.customerPortalDecisionAt ? (
                  <DrawerRow
                    label="Portal decision time"
                    value={new Date(quote.customerPortalDecisionAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  />
                ) : null}
                {quote.portalCustomerNote?.trim() ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Customer message
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                      {quote.portalCustomerNote}
                    </p>
                  </div>
                ) : null}
              </div>
            </DrawerSection>
          ) : null}

          <DrawerSection title="Description">
            <div className={cn(DRAWER_NESTED_CARD, "p-4")}>
              <p className="text-xs text-muted-foreground leading-relaxed">{quote.description}</p>
            </div>
          </DrawerSection>

          <DrawerSection title="Line Items">
            <div className={cn(DRAWER_NESTED_CARD, "p-4")}>
              {editing ? (
                <EditableLineItems
                  items={draftItems}
                  onChange={setDraftItems}
                  extraActions={
                    orgStatus === "ready" && activeOrgId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => setCatalogPickerOpen(true)}
                      >
                        <PackageSearch className="w-3.5 h-3.5" />
                        Add from catalog
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <ReadOnlyLineItems items={quote.lineItems} total={quote.amount} />
              )}
            </div>
          </DrawerSection>

          <DrawerSection title="Notes">
            <div className={cn(DRAWER_NESTED_CARD, "p-4")}>
              {editing ? (
                <EditTextarea value={draft.notes ?? ""} onChange={(v) => setField("notes", v)} placeholder="Add notes..." />
              ) : quote.notes ? (
                <p className="text-xs text-muted-foreground leading-relaxed">{quote.notes}</p>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3">No notes.</p>
              )}
            </div>
          </DrawerSection>

          <DrawerSection title="Internal Notes">
            <div className={cn(DRAWER_NESTED_CARD, "p-4")}>
              {editing ? (
                <EditTextarea
                  value={draft.internalNotes ?? ""}
                  onChange={(v) => setField("internalNotes", v)}
                  placeholder="Internal team notes…"
                />
              ) : quote.internalNotes ? (
                <p className="text-xs text-muted-foreground leading-relaxed">{quote.internalNotes}</p>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3">No internal notes.</p>
              )}
            </div>
          </DrawerSection>

          <DrawerSection title="Timeline">
            <div className={cn(DRAWER_NESTED_CARD, "p-4")}>
              <DrawerTimeline items={timelineItems} />
            </div>
          </DrawerSection>

          <DrawerSection title="Recent communications">
            <RecentCommunicationsCard
              entityType="quote"
              entityId={quote.id}
              limit={4}
              title="Recent communications"
              description="Quote emails, follow-ups, and automation activity for this quote."
            />
          </DrawerSection>
        </div>
      </DetailDrawer>

      {quoteEmailOpen && quote ? (
        <div className={cn("fixed inset-0 flex items-center justify-center p-4", NESTED_OVER_DRAWER_Z)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !quoteEmailBusy && setQuoteEmailOpen(false)} />
          <div className={cn(DRAWER_STACKED_MODAL, "relative z-[1] max-w-lg")}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />{" "}
                {alreadySent ? "Resend quote by email" : "Email quote to customer"}
              </h3>
              <button
                type="button"
                onClick={() => !quoteEmailBusy && setQuoteEmailOpen(false)}
                disabled={quoteEmailBusy}
                className="p-1 rounded hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">
                  To
                </label>
                <input
                  type="email"
                  value={quoteEmailTo}
                  onChange={(e) => setQuoteEmailTo(e.target.value)}
                  className={cn(DRAWER_FIELD_CLASS, "w-full px-3 py-2 focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors")}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">
                  Optional note (appended to email)
                </label>
                <textarea
                  rows={5}
                  value={quoteEmailNote}
                  onChange={(e) => setQuoteEmailNote(e.target.value)}
                  className={cn(DRAWER_FIELD_CLASS, "w-full px-3 py-2 resize-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors")}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                A PDF copy of the quote will be attached to this email.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <Button size="sm" variant="outline" onClick={() => setQuoteEmailOpen(false)} disabled={quoteEmailBusy} className="text-xs">
                Cancel
              </Button>
              <Button size="sm" variant="default" onClick={() => void sendQuoteEmail()} disabled={quoteEmailBusy} className="text-xs gap-1.5">
                {quoteEmailBusy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Send email
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this quote?</AlertDialogTitle>
            <AlertDialogDescription>
              Archived quotes are hidden from the default quotes list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveBusy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={archiveBusy} onClick={() => void confirmArchiveQuote()}>
              {archiveBusy ? "Archiving…" : "Archive"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddFromCatalogDialog
        open={catalogPickerOpen}
        onOpenChange={setCatalogPickerOpen}
        organizationId={orgStatus === "ready" ? activeOrgId : null}
        onPick={(row, qty) => appendCatalogLineFromPicker(row, qty)}
      />

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
