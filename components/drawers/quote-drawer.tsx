"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { cn, looksLikeUuid } from "@/lib/utils"
import { useInvoices, useQuotes } from "@/lib/quote-invoice-store"
import type { AdminQuote, QuoteStatus } from "@/lib/mock-data"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import type { updateOrgQuote } from "@/lib/org-quotes-invoices/repository"
import { formatWorkOrderDisplay, getWorkOrderDisplay } from "@/lib/work-orders/display"
import { normalizeTimeForDb, uiPriorityToDb, uiTypeToDb } from "@/lib/work-orders/db-map"
import type { WorkOrderPriority, WorkOrderType } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import {
  CheckCircle2, Download, Send, Pencil, X, Check,
  FileText, Plus, Trash2, Sparkles, RefreshCw, ChevronDown, ThumbsUp,
  ThumbsDown, DollarSign, FileEdit, Loader2, Wrench, Archive,
} from "lucide-react"
import { ContactActions } from "@/components/contact-actions"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
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

type LineItem = { description: string; qty: number; unit: number }

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
      className={cn(
        "w-full rounded border border-border bg-white px-2 py-1 text-xs text-foreground outline-none",
        "focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors",
        className,
      )}
    />
  )
}

function EditSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-border bg-white px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
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
      className="w-full rounded border border-border bg-white px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
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

function EditableLineItems({ items, onChange }: { items: LineItem[]; onChange: (items: LineItem[]) => void }) {
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
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
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
              <tr key={i} className="bg-white">
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
          <tfoot className="bg-muted/30 border-t border-border">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right font-semibold text-foreground text-xs uppercase tracking-wide">Total</td>
              <td className="px-2 py-2 text-right font-bold text-foreground">{fmtCurrency(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <button onClick={addItem} className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer font-medium">
        <Plus className="w-3.5 h-3.5" /> Add Line Item
      </button>
    </div>
  )
}

function ReadOnlyLineItems({ items, total }: { items: LineItem[]; total: number }) {
  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/30">
          <tr>
            <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-10">Qty</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Unit</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item, i) => (
            <tr key={i} className="bg-white">
              <td className="px-3 py-2 text-foreground">{item.description}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{item.qty}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{fmtCurrency(item.unit)}</td>
              <td className="px-3 py-2 text-right font-medium text-foreground">{fmtCurrency(item.qty * item.unit)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/30 border-t border-border">
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
  const { quotes, updateQuote, archiveQuote } = useQuotes()
  const { addInvoiceFromPayload } = useInvoices()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<AdminQuote>>({})
  const [draftItems, setDraftItems] = useState<LineItem[]>([])
  const [convertingToWo, setConvertingToWo] = useState(false)
  const [convertingToInvoice, setConvertingToInvoice] = useState(false)
  const [sendingQuote, setSendingQuote] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveBusy, setArchiveBusy] = useState(false)

  const quote = quoteId ? quotes.find((q) => q.id === quoteId) ?? null : null

  useEffect(() => {
    setEditing(false)
    setDraft({})
    setDraftItems([])
  }, [quoteId])

  function toast(message: string, tone: "success" | "info" = "success") {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function startEdit() {
    if (!quote) return
    setDraft({
      status: quote.status,
      expiresDate: quote.expiresDate,
      notes: quote.notes,
      internalNotes: quote.internalNotes ?? "",
    })
    setDraftItems(quote.lineItems.map((li) => ({ ...li })))
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
    setDraftItems([])
  }

  async function saveEdit() {
    if (!quote) return
    const newTotal = draftItems.reduce((s, i) => s + i.qty * i.unit, 0)
    const internal = (draft.internalNotes ?? "").trim()
    const lineItems = draftItems.map((li) => ({
      description: li.description,
      qty: li.qty,
      unit: li.unit,
    }))
    const nextStatus = (draft.status ?? quote.status) as QuoteStatus
    const patch: Parameters<typeof updateOrgQuote>[3] = {
      status: nextStatus,
      expiresAt: draft.expiresDate ?? quote.expiresDate,
      notes: (draft.notes ?? quote.notes) || "",
      internalNotes: internal || undefined,
      lineItems,
      amountCents: Math.round(newTotal * 100),
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

  async function handleSendQuoteToCustomer() {
    if (!quote) return
    if (sendingQuote) return
    setSendingQuote(true)

    // Simulate external email delivery success before persisting send metadata.
    await new Promise((resolve) => setTimeout(resolve, 450))

    const sentAt = new Date().toISOString()
    const alreadySent = quote.status === "Sent" || Boolean(quote.sentDate)
    const patch: Parameters<typeof updateOrgQuote>[3] = alreadySent
      ? { sentAt }
      : { status: "Sent", sentAt }

    const { error } = await updateQuote(quote.id, patch)
    setSendingQuote(false)
    if (error) {
      toast(`Could not send quote: ${error}`, "info")
      return
    }

    toast(
      alreadySent
        ? "Quote marked resent (email integration not configured yet)."
        : "Quote marked sent (email integration not configured yet).",
    )
  }

  async function handleConvertToInvoice() {
    if (!quote) return
    setConvertingToInvoice(true)
    const issuedAt = new Date().toISOString().split("T")[0]
    const due = new Date()
    due.setDate(due.getDate() + 30)
    const dueDate = due.toISOString().split("T")[0]
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
      title: quote.description.trim() || "Invoice from quote",
      amountCents: Math.round(quote.amount * 100),
      status: "Draft",
      issuedAt,
      dueDate,
      paidAt: null,
      lineItems: fallbackLine,
      notes: quote.notes?.trim() ? quote.notes.trim() : null,
      internalNotes: quote.internalNotes?.trim() ? quote.internalNotes.trim() : null,
    })
    setConvertingToInvoice(false)
    if (error) {
      toast(`Could not create invoice: ${error}`, "info")
      return
    }
    toast("Invoice created from quote")
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

  if (!quote) return null

  const canCreateWorkOrder =
    !quote.workOrderId &&
    Boolean(quote.customerId) &&
    Boolean(quote.equipmentId) &&
    quote.status !== "Declined" &&
    quote.status !== "Expired"

  const currentStatus = (draft.status ?? quote.status) as QuoteStatus
  const alreadySent = quote.status === "Sent" || Boolean(quote.sentDate)

  const timelineItems = [
    { date: fmtDate(quote.createdDate), label: "Quote created", description: `Created by ${quote.createdBy}`, accent: "muted" as const },
    ...(quote.sentDate ? [{ date: fmtDate(quote.sentDate), label: "Quote sent to customer", accent: "muted" as const }] : []),
    ...(currentStatus === "Approved" ? [{ date: "—", label: "Customer approved quote", accent: "success" as const }] : []),
    ...(currentStatus === "Declined" ? [{ date: "—", label: "Customer declined quote", accent: "danger" as const }] : []),
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
          <Badge variant="outline" className={cn("text-[10px] font-semibold", STATUS_CONFIG[currentStatus].className)}>
            {currentStatus}
          </Badge>
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
          ) : (
            <>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
              {(quote.status === "Draft" || quote.status === "Sent") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs cursor-pointer"
                  disabled={sendingQuote}
                  onClick={() => void handleSendQuoteToCustomer()}
                >
                  {sendingQuote ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> {alreadySent ? "Resend Quote" : "Email to Customer"}
                    </>
                  )}
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
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-not-allowed opacity-60" disabled title="Coming soon">
                <Download className="w-3.5 h-3.5" /> Download PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs cursor-pointer text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => setArchiveOpen(true)}
              >
                <Archive className="w-3.5 h-3.5" /> Archive
              </Button>
            </>
          )
        }
      >
        <div className="-mx-5 -my-5 min-h-full bg-muted/40 px-5 py-5 space-y-5">
          {/* AI Tools */}
          {!editing && (
            <QuoteAIToolsPanel
              quote={quote}
              onApplyDraft={handleApplyDraft}
              onApplyPricing={handleApplyPricing}
            />
          )}

          <DrawerSection title="Quote Details">
            <div className="rounded-xl border border-border bg-white shadow-sm p-4 space-y-1">
              <DrawerRow label="Customer" value={
                <Link href={`/customers?open=${quote.customerId}`} className="text-primary hover:underline cursor-pointer font-medium">
                  {quote.customerName}
                </Link>
              } />
              <div className="py-1">
                <ContactActions
                  email={{ customerName: quote.customerName }}
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

          <DrawerSection title="Description">
            <div className="rounded-xl border border-border bg-white shadow-sm p-4">
              <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-white rounded-lg border border-border">
                {quote.description}
              </p>
            </div>
          </DrawerSection>

          <DrawerSection title="Line Items">
            <div className="rounded-xl border border-border bg-white shadow-sm p-4">
              {editing ? (
                <EditableLineItems items={draftItems} onChange={setDraftItems} />
              ) : (
                <ReadOnlyLineItems items={quote.lineItems} total={quote.amount} />
              )}
            </div>
          </DrawerSection>

          <DrawerSection title="Notes">
            <div className="rounded-xl border border-border bg-white shadow-sm p-4">
              {editing ? (
                <EditTextarea value={draft.notes ?? ""} onChange={(v) => setField("notes", v)} placeholder="Add notes..." />
              ) : quote.notes ? (
                <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-white rounded-lg border border-border">{quote.notes}</p>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3">No notes.</p>
              )}
            </div>
          </DrawerSection>

          <DrawerSection title="Internal Notes">
            <div className="rounded-xl border border-border bg-white shadow-sm p-4">
              {editing ? (
                <EditTextarea
                  value={draft.internalNotes ?? ""}
                  onChange={(v) => setField("internalNotes", v)}
                  placeholder="Internal team notes…"
                />
              ) : quote.internalNotes ? (
                <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-white rounded-lg border border-border">
                  {quote.internalNotes}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3">No internal notes.</p>
              )}
            </div>
          </DrawerSection>

          <DrawerSection title="Timeline">
            <div className="rounded-xl border border-border bg-white shadow-sm p-4">
              <DrawerTimeline items={timelineItems} />
            </div>
          </DrawerSection>
        </div>
      </DetailDrawer>

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

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
