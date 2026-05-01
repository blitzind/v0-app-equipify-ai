"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useInvoices } from "@/lib/quote-invoice-store"
import type { AdminInvoice, InvoiceStatus } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import {
  CheckCircle2, Download, DollarSign, AlertTriangle, Pencil, X, Check,
  Plus, Trash2, Sparkles, RefreshCw, ChevronDown, ThumbsUp, ThumbsDown,
  Mail, ShieldAlert, ShieldCheck,
} from "lucide-react"
import { CertificatePanel } from "@/components/certificates/certificate-panel"

let toastCounter = 0

// ─── Design tokens ────────────────────────────────────────────────────────────

const AI_BG     = "bg-[color:var(--ds-info-bg)]"
const AI_BORDER = "border-[color:var(--ds-info-border)]"
const AI_TEXT   = "text-[color:var(--ds-info-text)]"
const AI_SUBTLE = "text-[color:var(--ds-info-subtle)]"

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InvoiceStatus, { className: string }> = {
  "Draft":   { className: "bg-muted text-muted-foreground border-border" },
  "Sent":    { className: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30" },
  "Unpaid":  { className: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30" },
  "Paid":    { className: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30" },
  "Overdue": { className: "bg-destructive/10 text-destructive border-destructive/30" },
  "Void":    { className: "bg-muted text-muted-foreground/60 border-border" },
}

const ALL_STATUSES: InvoiceStatus[] = ["Draft", "Sent", "Unpaid", "Paid", "Overdue", "Void"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function daysOverdue(dueDate: string): number {
  if (!dueDate) return 0
  const diff = Date.now() - new Date(dueDate).getTime()
  return Math.max(0, Math.floor(diff / 86_400_000))
}

type LineItem = { description: string; qty: number; unit: number }

// ─── AI mock generators ───────────────────────────────────────────────────────

function generatePaymentReminder(invoice: AdminInvoice): string {
  const overdue = daysOverdue(invoice.dueDate)
  const tone = overdue > 30 ? "firm" : overdue > 14 ? "direct" : "friendly"

  if (tone === "friendly") {
    return `Subject: Friendly Payment Reminder — Invoice ${invoice.id}\n\nDear ${invoice.customerName},\n\nThis is a friendly reminder that Invoice ${invoice.id} for ${fmtCurrency(invoice.amount)} is due on ${fmtDate(invoice.dueDate)}.\n\nIf you have already arranged payment, please disregard this message. Otherwise, you can pay securely via the link in your original invoice email or contact us to arrange an alternative method.\n\nThank you for your continued business. Please don't hesitate to reach out if you have any questions.\n\nBest regards,\nEquipify Service Team`
  }

  if (tone === "direct") {
    return `Subject: Payment Overdue — Invoice ${invoice.id} (${overdue} days)\n\nDear ${invoice.customerName},\n\nWe notice that Invoice ${invoice.id} for ${fmtCurrency(invoice.amount)}, which was due on ${fmtDate(invoice.dueDate)}, remains outstanding after ${overdue} days.\n\nWe kindly ask that you arrange payment at your earliest convenience to avoid any service interruptions or late fees.\n\nIf you are experiencing any issues, please contact our billing team directly and we will work with you to find a solution.\n\nThank you,\nEquipify Service Team`
  }

  return `Subject: Final Notice — Invoice ${invoice.id} Now ${overdue} Days Overdue\n\nDear ${invoice.customerName},\n\nDespite previous reminders, Invoice ${invoice.id} for ${fmtCurrency(invoice.amount)} remains unpaid at ${overdue} days past its due date of ${fmtDate(invoice.dueDate)}.\n\nThis is a final notice requesting immediate payment. Continued non-payment may result in suspension of service and referral to collections.\n\nPlease contact us immediately to resolve this matter.\n\nEquipify Service Team`
}

interface RiskResult {
  level: "low" | "medium" | "high"
  score: number
  text: string
  rows: { label: string; value: string }[]
}

function generateLatePayerRisk(invoice: AdminInvoice): RiskResult {
  const overdue = daysOverdue(invoice.dueDate)

  // Deterministic score based on invoice ID hash + overdue days
  const idHash = invoice.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  const pastLateFactor = (idHash % 3) // 0, 1, or 2 prior late incidents
  const baseScore = Math.min(95, 20 + (overdue * 1.2) + (pastLateFactor * 18))
  const score = Math.round(baseScore)

  const level: "low" | "medium" | "high" = score >= 65 ? "high" : score >= 35 ? "medium" : "low"

  const levelText = {
    low: "This customer has a strong payment history with no significant risk indicators. Recommend a standard follow-up reminder.",
    medium: "This customer shows moderate late-payment signals. Consider proactive outreach and offer a payment plan if needed to avoid escalation.",
    high: "This customer has a high churn and non-payment risk score. Immediate personal outreach is recommended. Consider requiring pre-payment for future work orders.",
  }[level]

  return {
    level,
    score,
    text: levelText,
    rows: [
      { label: "Risk score",             value: `${score} / 100` },
      { label: "Days overdue",           value: overdue > 0 ? `${overdue} days` : "Not yet overdue" },
      { label: "Prior late payments",    value: pastLateFactor === 0 ? "None on record" : `${pastLateFactor} previous` },
      { label: "Recommended action",     value: level === "high" ? "Immediate call" : level === "medium" ? "Send reminder" : "Monitor" },
    ],
  }
}

// ─── AI Tools Panel ───────────────────────────────────────────────────────────

type AITool = "reminder" | "risk" | null

function InvoiceAIToolsPanel({
  invoice,
  onApplyReminder,
}: {
  invoice: AdminInvoice
  onApplyReminder: (text: string) => void
}) {
  const [activeTool, setActiveTool] = useState<AITool>(null)
  const [loading, setLoading]       = useState(false)
  const [reminder, setReminder]     = useState<string | null>(null)
  const [risk, setRisk]             = useState<RiskResult | null>(null)
  const [feedback, setFeedback]     = useState<"up" | "down" | null>(null)
  const [applied, setApplied]       = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function runTool(tool: AITool) {
    if (loading) return
    setActiveTool(tool)
    setLoading(true)
    setReminder(null)
    setRisk(null)
    setFeedback(null)
    setApplied(false)

    timerRef.current = setTimeout(() => {
      if (tool === "reminder") setReminder(generatePaymentReminder(invoice))
      if (tool === "risk")     setRisk(generateLatePayerRisk(invoice))
      setLoading(false)
    }, 1700)
  }

  function regenerate() { if (activeTool) runTool(activeTool) }

  const RISK_COLORS: Record<RiskResult["level"], string> = {
    low:    "text-[color:var(--status-success)] bg-[color:var(--status-success)]/10 border-[color:var(--status-success)]/30",
    medium: "text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10 border-[color:var(--status-warning)]/30",
    high:   "text-destructive bg-destructive/10 border-destructive/30",
  }

  const tools: { id: AITool; icon: React.ReactNode; label: string; sub: string }[] = [
    {
      id: "reminder",
      icon: <Mail className="w-3.5 h-3.5" />,
      label: "Draft Payment Reminder",
      sub: "Generate a tone-matched reminder email",
    },
    {
      id: "risk",
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
      label: "Late Payer Risk Alert",
      sub: "Analyse churn and non-payment risk signals",
    },
  ]

  const hasResult = !loading && (reminder !== null || risk !== null)

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
              activeTool === t.id && hasResult ? "bg-[color:var(--ds-info-border)]/20" : "",
            )}
          >
            <span className={cn("shrink-0 mt-0.5", AI_SUBTLE)}>{t.icon}</span>
            <span className="flex-1 min-w-0">
              <span className={cn("block text-xs font-semibold", AI_TEXT)}>{t.label}</span>
              <span className="block text-[10px] text-muted-foreground mt-0.5">{t.sub}</span>
            </span>
            {loading && activeTool === t.id ? (
              <RefreshCw className={cn("w-3.5 h-3.5 shrink-0 animate-spin", AI_SUBTLE)} />
            ) : (
              <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 -rotate-90", AI_SUBTLE)} />
            )}
          </button>
        ))}
      </div>

      {/* Result panel */}
      {(loading || hasResult) && (
        <div className={cn("border-t px-4 py-3 space-y-3", AI_BORDER)}>
          {loading ? (
            <div className="space-y-2" aria-label="Generating...">
              <div className="h-2.5 rounded bg-[color:var(--ds-info-border)] animate-pulse w-full" />
              <div className="h-2.5 rounded bg-[color:var(--ds-info-border)] animate-pulse w-5/6" />
              <div className="h-2.5 rounded bg-[color:var(--ds-info-border)] animate-pulse w-3/4" />
            </div>
          ) : (
            <>
              {/* Payment reminder output */}
              {reminder !== null && (
                <>
                  <div className={cn("rounded-lg border p-3 space-y-1.5 bg-[color:var(--ds-info-border)]/10", AI_BORDER)}>
                    {reminder.split("\n").filter(Boolean).map((line, i) => (
                      <p key={i} className={cn("text-xs leading-relaxed", i === 0 ? "font-semibold" : "", AI_TEXT)}>
                        {line}
                      </p>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "w-full text-xs gap-1.5 cursor-pointer border bg-transparent",
                      AI_BORDER, AI_TEXT,
                      "hover:bg-[color:var(--ds-info-border)]/30",
                      applied && "opacity-60",
                    )}
                    onClick={() => { onApplyReminder(reminder); setApplied(true) }}
                    disabled={applied}
                  >
                    {applied ? (
                      <><Check className="w-3.5 h-3.5" /> Applied to Notes</>
                    ) : (
                      <><Mail className="w-3.5 h-3.5" /> Apply to Notes</>
                    )}
                  </Button>
                </>
              )}

              {/* Risk alert output */}
              {risk !== null && (
                <>
                  {/* Risk level badge */}
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                      RISK_COLORS[risk.level],
                    )}>
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {risk.level.charAt(0).toUpperCase() + risk.level.slice(1)} Risk — {risk.score}/100
                    </span>
                  </div>

                  {/* Risk description */}
                  <div className={cn("rounded-lg border p-3 bg-[color:var(--ds-info-border)]/10", AI_BORDER)}>
                    <p className={cn("text-xs leading-relaxed", AI_TEXT)}>{risk.text}</p>
                  </div>

                  {/* Risk data rows */}
                  <div className={cn("rounded-lg border divide-y overflow-hidden", AI_BORDER)}>
                    {risk.rows.map((row, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className={cn("text-[10px] font-medium opacity-70", AI_TEXT)}>{row.label}</span>
                        <span className={cn("text-[10px] font-semibold text-right", AI_TEXT)}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Feedback + regenerate */}
              <div className={cn("flex items-center justify-between gap-2 pt-1 border-t", AI_BORDER)}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFeedback("up")}
                    className={cn(
                      "p-1 rounded transition-colors cursor-pointer",
                      feedback === "up" ? "text-[color:var(--ds-info-subtle)]" : "text-muted-foreground hover:text-[color:var(--ds-info-subtle)]",
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
                      feedback === "down" ? "text-destructive" : "text-muted-foreground hover:text-destructive",
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
          )}
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
        "w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none",
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
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
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
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
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
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
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
              <tr key={i} className="bg-card">
                <td className="px-2 py-1.5"><EditInput value={item.description} onChange={(v) => updateItem(i, "description", v)} placeholder="Item description" /></td>
                <td className="px-2 py-1.5"><EditInput type="number" value={item.qty} onChange={(v) => updateItem(i, "qty", v)} className="text-right" /></td>
                <td className="px-2 py-1.5"><EditInput type="number" value={item.unit} onChange={(v) => updateItem(i, "unit", v)} className="text-right" /></td>
                <td className="px-2 py-1.5 text-right font-medium text-foreground">{fmtCurrency(item.qty * item.unit)}</td>
                <td className="px-2 py-1.5 text-center">
                  <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer" aria-label="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/40 border-t border-border">
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
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/40">
          <tr>
            <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-10">Qty</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Unit</th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item, i) => (
            <tr key={i} className="bg-card">
              <td className="px-3 py-2 text-foreground">{item.description}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{item.qty}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{fmtCurrency(item.unit)}</td>
              <td className="px-3 py-2 text-right font-medium text-foreground">{fmtCurrency(item.qty * item.unit)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/40 border-t border-border">
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

interface InvoiceDrawerProps {
  invoiceId: string | null
  onClose: () => void
}

export function InvoiceDrawer({ invoiceId, onClose }: InvoiceDrawerProps) {
  const { invoices, updateInvoice } = useInvoices()
  const [toasts, setToasts]     = useState<ToastItem[]>([])
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState<Partial<AdminInvoice>>({})
  const [draftItems, setDraftItems] = useState<LineItem[]>([])

  const invoice = invoiceId ? invoices.find((i) => i.id === invoiceId) ?? null : null

  useEffect(() => {
    setEditing(false)
    setDraft({})
    setDraftItems([])
  }, [invoiceId])

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function startEdit() {
    if (!invoice) return
    setDraft({ status: invoice.status, dueDate: invoice.dueDate, notes: invoice.notes })
    setDraftItems(invoice.lineItems.map((li) => ({ ...li })))
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
    setDraftItems([])
  }

  function saveEdit() {
    if (!invoice) return
    const newTotal = draftItems.reduce((s, i) => s + i.qty * i.unit, 0)
    updateInvoice(invoice.id, {
      ...draft,
      lineItems: draftItems,
      amount: newTotal,
      ...(draft.status === "Paid" && !invoice.paidDate ? { paidDate: new Date().toISOString().slice(0, 10) } : {}),
    })
    setEditing(false)
    setDraft({})
    setDraftItems([])
    toast("Invoice updated successfully")
  }

  function setField<K extends keyof AdminInvoice>(field: K, value: AdminInvoice[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  function handleApplyReminder(text: string) {
    setDraft((prev) => ({ ...prev, notes: text }))
    if (!editing) startEdit()
    toast("Reminder draft applied to notes — review and save")
  }

  if (!invoice) return null

  const currentStatus = (draft.status ?? invoice.status) as InvoiceStatus
  const displayTotal  = editing ? draftItems.reduce((s, i) => s + i.qty * i.unit, 0) : invoice.amount

  const timelineItems = [
    { date: fmtDate(invoice.issueDate), label: "Invoice issued", accent: "muted" as const },
    { date: fmtDate(invoice.dueDate),   label: "Payment due",    accent: (invoice.status === "Overdue" ? "danger" : "muted") as "danger" | "muted" },
    ...(invoice.paidDate ? [{ date: fmtDate(invoice.paidDate), label: "Payment received", description: fmtCurrency(invoice.amount), accent: "success" as const }] : []),
  ]

  return (
    <>
      <DetailDrawer
        open={!!invoiceId}
        onClose={onClose}
        title={invoice.id}
        subtitle={`${invoice.customerName} · ${invoice.equipmentName}`}
        width="lg"
        badge={
          <Badge variant="outline" className={cn("text-[10px] font-semibold", STATUS_CONFIG[currentStatus].className)}>
            {currentStatus}
          </Badge>
        }
        actions={
          editing ? (
            <>
              <Button size="sm" variant="default" className="gap-1.5 text-xs cursor-pointer" onClick={saveEdit}>
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
              {(invoice.status === "Unpaid" || invoice.status === "Overdue" || invoice.status === "Sent") && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Payment recorded successfully")}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Record Payment
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Invoice PDF downloaded")}>
                <Download className="w-3.5 h-3.5" /> Download PDF
              </Button>
            </>
          )
        }
      >
        {/* Overdue banner */}
        {currentStatus === "Overdue" && !editing && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Payment overdue since {fmtDate(invoice.dueDate)}
          </div>
        )}

        {/* AI Tools */}
        {!editing && (
          <InvoiceAIToolsPanel
            invoice={invoice}
            onApplyReminder={handleApplyReminder}
          />
        )}

        <DrawerSection title="Invoice Details">
          <DrawerRow label="Customer" value={invoice.customerName} />
          <DrawerRow label="Equipment" value={invoice.equipmentName} />
          {invoice.workOrderId && <DrawerRow label="Work Order" value={<span className="text-primary font-mono">{invoice.workOrderId}</span>} />}
          <DrawerRow label="Issued" value={fmtDate(invoice.issueDate)} />
          <EditRow label="Due Date" view={
            <span className={invoice.status === "Overdue" ? "text-destructive font-semibold" : ""}>{fmtDate(invoice.dueDate)}</span>
          } editing={editing}>
            <EditInput type="date" value={draft.dueDate ?? ""} onChange={(v) => setField("dueDate", v)} />
          </EditRow>
          <EditRow label="Status" view={
            <Badge variant="outline" className={cn("text-[10px] font-semibold", STATUS_CONFIG[invoice.status].className)}>{invoice.status}</Badge>
          } editing={editing}>
            <EditSelect value={draft.status ?? invoice.status} onChange={(v) => setField("status", v as InvoiceStatus)} options={ALL_STATUSES} />
          </EditRow>
          {invoice.paidDate && <DrawerRow label="Paid On" value={<span className="text-[color:var(--status-success)] font-semibold">{fmtDate(invoice.paidDate)}</span>} />}
        </DrawerSection>

        {/* Total card */}
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Invoice Total</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{fmtCurrency(displayTotal)}</p>
          </div>
          <DollarSign className="w-8 h-8 text-primary/30" />
        </div>

        <DrawerSection title="Line Items">
          {editing ? (
            <EditableLineItems items={draftItems} onChange={setDraftItems} />
          ) : (
            <ReadOnlyLineItems items={invoice.lineItems} total={invoice.amount} />
          )}
        </DrawerSection>

        <DrawerSection title="Notes">
          {editing ? (
            <EditTextarea value={draft.notes ?? ""} onChange={(v) => setField("notes", v)} placeholder="Add notes..." />
          ) : invoice.notes ? (
            <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">{invoice.notes}</p>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">No notes.</p>
          )}
        </DrawerSection>

        {/* Calibration Certificates */}
        {!editing && invoice.equipmentId && (
          <DrawerSection title="Calibration Certificates">
            <CertificatePanel
              equipmentId={invoice.equipmentId}
              equipmentName={invoice.equipmentName ?? ""}
              customerId={invoice.customerId}
              customerName={invoice.customerName}
              invoiceId={invoice.id}
            />
          </DrawerSection>
        )}

        <DrawerSection title="Payment History">
          <DrawerTimeline items={timelineItems} />
        </DrawerSection>
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
