"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { AdminInvoice, InvoiceStatus } from "@/lib/mock-data"
import { useInvoices } from "@/lib/quote-invoice-store"
import type { updateOrgInvoice } from "@/lib/org-quotes-invoices/repository"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CertificatePanel } from "@/components/certificates/certificate-panel"
import {
  Mail, MessageSquare, Link2, Download, Save, CreditCard, CheckCircle2,
  Ban, Copy, Repeat, Paperclip, FileSignature, StickyNote, ClipboardList,
  ChevronDown, X, Check, Pencil, Plus, Trash2, AlertTriangle, DollarSign,
  Sparkles, RefreshCw, ThumbsUp, ThumbsDown, ShieldAlert, Monitor, Tablet,
  Loader2,
  Smartphone, FileText, Settings, Eye, EyeOff, Building2, SlidersHorizontal,
  ExternalLink,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "info" | "payments" | "files" | "comments" | "work-orders" | "activity"
type PreviewDevice = "mobile" | "tablet" | "laptop" | "pdf"
type LineItem = { description: string; qty: number; unit: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n)
}

function daysOverdue(dueDate: string): number {
  if (!dueDate) return 0
  const diff = Date.now() - new Date(dueDate).getTime()
  return Math.max(0, Math.floor(diff / 86_400_000))
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<InvoiceStatus, { className: string }> = {
  Draft:   { className: "bg-muted text-muted-foreground border-border" },
  Sent:    { className: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30" },
  Unpaid:  { className: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30" },
  Paid:    { className: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30" },
  Overdue: { className: "bg-destructive/10 text-destructive border-destructive/30" },
  Void:    { className: "bg-muted text-muted-foreground/60 border-border" },
}

const ALL_STATUSES: InvoiceStatus[] = ["Draft", "Sent", "Unpaid", "Paid", "Overdue", "Void"]

// ─── Mock company profile ─────────────────────────────────────────────────────

const COMPANY = {
  name: "Equipify Service Co.",
  address: "4821 Industrial Pkwy, Suite 200",
  city: "Austin, TX 78744",
  phone: "(512) 555-0182",
  email: "billing@equipify.ai",
  website: "equipify.ai",
}

// ─── AI mock generators ───────────────────────────────────────────────────────

function generatePaymentReminder(invoice: AdminInvoice): string {
  const overdue = daysOverdue(invoice.dueDate)
  const tone = overdue > 30 ? "firm" : overdue > 14 ? "direct" : "friendly"
  if (tone === "friendly") {
    return `Subject: Friendly Payment Reminder — Invoice ${invoice.id}\n\nDear ${invoice.customerName},\n\nThis is a friendly reminder that Invoice ${invoice.id} for ${fmtCurrency(invoice.amount)} is due on ${fmtDate(invoice.dueDate)}.\n\nIf you have already arranged payment, please disregard this message. Otherwise, you can pay securely via the link in your original invoice email.\n\nThank you for your continued business.\n\nBest regards,\nEquipify Service Team`
  }
  if (tone === "direct") {
    return `Subject: Payment Overdue — Invoice ${invoice.id} (${overdue} days)\n\nDear ${invoice.customerName},\n\nInvoice ${invoice.id} for ${fmtCurrency(invoice.amount)}, due on ${fmtDate(invoice.dueDate)}, remains outstanding after ${overdue} days.\n\nPlease arrange payment at your earliest convenience.\n\nThank you,\nEquipify Service Team`
  }
  return `Subject: Final Notice — Invoice ${invoice.id} Now ${overdue} Days Overdue\n\nDear ${invoice.customerName},\n\nInvoice ${invoice.id} for ${fmtCurrency(invoice.amount)} is ${overdue} days past due. This is a final notice requesting immediate payment.\n\nEquipify Service Team`
}

interface RiskResult {
  level: "low" | "medium" | "high"
  score: number
  text: string
  rows: { label: string; value: string }[]
}

function generateLatePayerRisk(invoice: AdminInvoice): RiskResult {
  const overdue = daysOverdue(invoice.dueDate)
  const idHash = invoice.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  const pastLateFactor = idHash % 3
  const baseScore = Math.min(95, 20 + overdue * 1.2 + pastLateFactor * 18)
  const score = Math.round(baseScore)
  const level: RiskResult["level"] = score >= 65 ? "high" : score >= 35 ? "medium" : "low"
  const levelText = {
    low: "This customer has a strong payment history with no significant risk indicators. Recommend a standard follow-up reminder.",
    medium: "This customer shows moderate late-payment signals. Consider proactive outreach and offer a payment plan if needed.",
    high: "High churn and non-payment risk. Immediate personal outreach is recommended. Consider requiring pre-payment for future work.",
  }[level]
  return {
    level, score, text: levelText,
    rows: [
      { label: "Risk score",          value: `${score} / 100` },
      { label: "Days overdue",        value: overdue > 0 ? `${overdue} days` : "Not yet overdue" },
      { label: "Prior late payments", value: pastLateFactor === 0 ? "None on record" : `${pastLateFactor} previous` },
      { label: "Recommended action",  value: level === "high" ? "Immediate call" : level === "medium" ? "Send reminder" : "Monitor" },
    ],
  }
}

// ─── AI Tools ─────────────────────────────────────────────────────────────────

const AI_BG     = "bg-[color:var(--ds-info-bg)]"
const AI_BORDER = "border-[color:var(--ds-info-border)]"
const AI_TEXT   = "text-[color:var(--ds-info-text)]"
const AI_SUBTLE = "text-[color:var(--ds-info-subtle)]"

function AIToolsPanel({ invoice, onApplyReminder }: { invoice: AdminInvoice; onApplyReminder: (t: string) => void }) {
  type AITool = "reminder" | "risk" | null
  const [activeTool, setActiveTool] = useState<AITool>(null)
  const [loading, setLoading]       = useState(false)
  const [reminder, setReminder]     = useState<string | null>(null)
  const [risk, setRisk]             = useState<RiskResult | null>(null)
  const [feedback, setFeedback]     = useState<"up" | "down" | null>(null)
  const [applied, setApplied]       = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function runTool(tool: AITool) {
    if (loading) return
    setActiveTool(tool); setLoading(true); setReminder(null); setRisk(null); setFeedback(null); setApplied(false)
    timerRef.current = setTimeout(() => {
      if (tool === "reminder") setReminder(generatePaymentReminder(invoice))
      if (tool === "risk")     setRisk(generateLatePayerRisk(invoice))
      setLoading(false)
    }, 1700)
  }

  const RISK_COLORS: Record<RiskResult["level"], string> = {
    low:    "text-[color:var(--status-success)] bg-[color:var(--status-success)]/10 border-[color:var(--status-success)]/30",
    medium: "text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10 border-[color:var(--status-warning)]/30",
    high:   "text-destructive bg-destructive/10 border-destructive/30",
  }

  const tools = [
    { id: "reminder" as AITool, icon: <Mail className="w-3.5 h-3.5" />, label: "Draft Payment Reminder", sub: "Generate a tone-matched reminder email" },
    { id: "risk" as AITool, icon: <ShieldAlert className="w-3.5 h-3.5" />, label: "Late Payer Risk Alert", sub: "Analyse churn and non-payment risk signals" },
  ]

  const hasResult = !loading && (reminder !== null || risk !== null)

  return (
    <div className={cn("rounded-xl border overflow-hidden", AI_BG, AI_BORDER)}>
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="w-5 h-5 rounded bg-[color:var(--ds-info-subtle)] flex items-center justify-center shrink-0">
          <Sparkles className="w-2.5 h-2.5 text-white" />
        </div>
        <span className={cn("text-xs font-semibold", AI_TEXT)}>AI Tools</span>
        <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ml-0.5 bg-[color:var(--ds-info-subtle)] text-white border-transparent">AI</span>
      </div>
      <div className={cn("grid grid-cols-1 gap-px border-t", AI_BORDER)}>
        {tools.map((t) => (
          <button key={t.id} type="button" onClick={() => runTool(t.id)} disabled={loading}
            className={cn("flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer hover:bg-[color:var(--ds-info-border)]/30 disabled:opacity-50 disabled:cursor-not-allowed", activeTool === t.id && hasResult && "bg-[color:var(--ds-info-border)]/20")}>
            <span className={cn("shrink-0 mt-0.5", AI_SUBTLE)}>{t.icon}</span>
            <span className="flex-1 min-w-0">
              <span className={cn("block text-xs font-semibold", AI_TEXT)}>{t.label}</span>
              <span className="block text-[10px] text-muted-foreground mt-0.5">{t.sub}</span>
            </span>
            {loading && activeTool === t.id
              ? <RefreshCw className={cn("w-3.5 h-3.5 shrink-0 animate-spin", AI_SUBTLE)} />
              : <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 -rotate-90", AI_SUBTLE)} />}
          </button>
        ))}
      </div>
      {(loading || hasResult) && (
        <div className={cn("border-t px-4 py-3 space-y-3", AI_BORDER)}>
          {loading ? (
            <div className="space-y-2">
              <div className="h-2.5 rounded bg-[color:var(--ds-info-border)] animate-pulse w-full" />
              <div className="h-2.5 rounded bg-[color:var(--ds-info-border)] animate-pulse w-5/6" />
              <div className="h-2.5 rounded bg-[color:var(--ds-info-border)] animate-pulse w-3/4" />
            </div>
          ) : (
            <>
              {reminder !== null && (
                <>
                  <div className={cn("rounded-lg border p-3 space-y-1.5 bg-[color:var(--ds-info-border)]/10", AI_BORDER)}>
                    {reminder.split("\n").filter(Boolean).map((line, i) => (
                      <p key={i} className={cn("text-xs leading-relaxed", i === 0 && "font-semibold", AI_TEXT)}>{line}</p>
                    ))}
                  </div>
                  <Button size="sm" variant="outline"
                    className={cn("w-full text-xs gap-1.5 cursor-pointer border bg-transparent", AI_BORDER, AI_TEXT, "hover:bg-[color:var(--ds-info-border)]/30", applied && "opacity-60")}
                    onClick={() => { onApplyReminder(reminder); setApplied(true) }} disabled={applied}>
                    {applied ? <><Check className="w-3.5 h-3.5" /> Applied to Notes</> : <><Mail className="w-3.5 h-3.5" /> Apply to Notes</>}
                  </Button>
                </>
              )}
              {risk !== null && (
                <>
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", RISK_COLORS[risk.level])}>
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {risk.level.charAt(0).toUpperCase() + risk.level.slice(1)} Risk — {risk.score}/100
                    </span>
                  </div>
                  <div className={cn("rounded-lg border p-3 bg-[color:var(--ds-info-border)]/10", AI_BORDER)}>
                    <p className={cn("text-xs leading-relaxed", AI_TEXT)}>{risk.text}</p>
                  </div>
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
              <div className={cn("flex items-center justify-between gap-2 pt-1 border-t", AI_BORDER)}>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setFeedback("up")}
                    className={cn("p-1 rounded transition-colors cursor-pointer", feedback === "up" ? "text-[color:var(--ds-info-subtle)]" : "text-muted-foreground hover:text-[color:var(--ds-info-subtle)]")}>
                    <ThumbsUp className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => setFeedback("down")}
                    className={cn("p-1 rounded transition-colors cursor-pointer", feedback === "down" ? "text-destructive" : "text-muted-foreground hover:text-destructive")}>
                    <ThumbsDown className="w-3 h-3" />
                  </button>
                  {feedback && <span className="text-[10px] text-muted-foreground ml-1">{feedback === "up" ? "Thanks!" : "We'll improve this."}</span>}
                </div>
                <button type="button" onClick={() => runTool(activeTool)} disabled={loading}
                  className={cn("inline-flex items-center gap-1 text-[10px] font-semibold cursor-pointer", AI_TEXT, "hover:underline disabled:opacity-40 transition-all")}>
                  <RefreshCw className={cn("w-2.5 h-2.5", loading && "animate-spin")} /> Regenerate
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Invoice Preview ──────────────────────────────────────────────────────────

interface DisplaySettings {
  showLineItems: boolean
  showLineItemNames: boolean
  showLineItemDescriptions: boolean
  showSku: boolean
  showQty: boolean
  showUnitPrice: boolean
  showTax: boolean
  showTotalPrice: boolean
  showSubtotal: boolean
  showTotalTax: boolean
  showServiceAddress: boolean
  showCustomerPhone: boolean
  showCustomerEmail: boolean
  showServiceTitle: boolean
  showServiceLocation: boolean
  showTeamMembers: boolean
  showServiceDate: boolean
  showInvoiceCreator: boolean
  showNotesBelow: boolean
  showBlankFields: boolean
  customTitle: string
  paymentTerms: string
  invoiceTheme: "default" | "minimal" | "bold"
}

const DEFAULT_SETTINGS: DisplaySettings = {
  showLineItems: true,
  showLineItemNames: true,
  showLineItemDescriptions: true,
  showSku: false,
  showQty: true,
  showUnitPrice: true,
  showTax: true,
  showTotalPrice: true,
  showSubtotal: true,
  showTotalTax: true,
  showServiceAddress: true,
  showCustomerPhone: true,
  showCustomerEmail: true,
  showServiceTitle: true,
  showServiceLocation: true,
  showTeamMembers: true,
  showServiceDate: true,
  showInvoiceCreator: true,
  showNotesBelow: true,
  showBlankFields: false,
  customTitle: "",
  paymentTerms: "Net 30",
  invoiceTheme: "default",
}

function InvoicePreview({
  invoice,
  settings,
  device,
}: {
  invoice: AdminInvoice
  settings: DisplaySettings
  device: PreviewDevice
}) {
  const subtotal  = invoice.lineItems.reduce((s, i) => s + i.qty * i.unit, 0)
  const taxRate   = 0.0875
  const taxAmt    = settings.showTax ? subtotal * taxRate : 0
  const total     = subtotal + taxAmt
  const amountDue = invoice.status === "Paid" ? 0 : total

  const isBold    = settings.invoiceTheme === "bold"
  const isMinimal = settings.invoiceTheme === "minimal"

  const wrapClass = device === "mobile"  ? "max-w-[320px]"
                  : device === "tablet"  ? "max-w-[480px]"
                  : device === "pdf"     ? "max-w-[595px]"
                  : "w-full"

  return (
    <div className={cn("mx-auto transition-all duration-300", wrapClass)}>
      <div className={cn(
        "bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm font-sans text-gray-800",
        device === "pdf" && "rounded-none shadow-none",
      )}>
        {/* Header band */}
        <div className={cn(
          "px-8 py-6",
          isBold   ? "bg-[color:var(--primary)] text-white"
          : isMinimal ? "border-b border-gray-200"
          : "border-b-2 border-[color:var(--primary)]",
        )}>
          <div className="flex items-start justify-between gap-4">
            {/* Company */}
            <div>
              <div className={cn(
                "flex items-center gap-2 mb-1",
                isBold ? "text-white" : "text-gray-900",
              )}>
                <div className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold",
                  isBold ? "bg-white/20 text-white" : "bg-[color:var(--primary)] text-white",
                )}>
                  E
                </div>
                <span className="text-sm font-bold">{COMPANY.name}</span>
              </div>
              <p className={cn("text-[10px] leading-relaxed", isBold ? "text-white/70" : "text-gray-500")}>
                {COMPANY.address}<br />{COMPANY.city}<br />{COMPANY.phone}
              </p>
            </div>
            {/* Invoice ID + status */}
            <div className="text-right">
              <p className={cn("text-lg font-bold tracking-tight", isBold ? "text-white" : "text-[color:var(--primary)]")}>
                {settings.customTitle || "INVOICE"}
              </p>
              <p className={cn("text-xs font-semibold mt-0.5", isBold ? "text-white/80" : "text-gray-700")}>
                #{invoice.id}
              </p>
              <div className="mt-2 flex flex-col items-end gap-0.5">
                <span className="text-[10px] text-gray-500">Date: {fmtDate(invoice.issueDate)}</span>
                <span className="text-[10px] text-gray-500">Due: {fmtDate(invoice.dueDate)}</span>
                {settings.paymentTerms && (
                  <span className="text-[10px] text-gray-500">Terms: {settings.paymentTerms}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bill To + Service Address */}
        <div className="px-8 py-5 grid grid-cols-2 gap-6 border-b border-gray-100">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Bill To</p>
            <p className="text-xs font-semibold text-gray-900">{invoice.customerName}</p>
            {settings.showCustomerEmail && (
              <p className="text-[10px] text-gray-500 mt-0.5">{COMPANY.email.replace("billing@", "ap@")}</p>
            )}
            {settings.showCustomerPhone && (
              <p className="text-[10px] text-gray-500">(555) 010-{invoice.customerId.slice(-4)}</p>
            )}
          </div>
          {settings.showServiceAddress && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Service Address</p>
              <p className="text-xs font-semibold text-gray-900">{invoice.customerName}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                1200 Commerce Dr<br />Industrial Park, TX 78744
              </p>
            </div>
          )}
        </div>

        {/* Service info */}
        {(settings.showServiceTitle || settings.showServiceLocation || settings.showTeamMembers || settings.showServiceDate) && (
          <div className="px-8 py-4 bg-gray-50/70 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {settings.showServiceTitle && (
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 block mb-0.5">Service</span>
                  <span className="text-[10px] text-gray-700">{invoice.equipmentName}</span>
                </div>
              )}
              {settings.showServiceLocation && (
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 block mb-0.5">Location</span>
                  <span className="text-[10px] text-gray-700">Main Facility — Bay 4</span>
                </div>
              )}
              {settings.showTeamMembers && (
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 block mb-0.5">Technician</span>
                  <span className="text-[10px] text-gray-700">Marcus Webb</span>
                </div>
              )}
              {settings.showServiceDate && (
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 block mb-0.5">Service Date</span>
                  <span className="text-[10px] text-gray-700">{fmtDate(invoice.issueDate)}</span>
                </div>
              )}
              {settings.showInvoiceCreator && (
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 block mb-0.5">Created By</span>
                  <span className="text-[10px] text-gray-700">{invoice.createdBy}</span>
                </div>
              )}
              {invoice.workOrderId && (
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 block mb-0.5">Work Order</span>
                  <span className="text-[10px] font-mono text-gray-700">{getWorkOrderDisplay({ id: invoice.workOrderId })}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Line items */}
        {settings.showLineItems && (
          <div className="px-8 py-5">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  {settings.showLineItemNames && <th className="text-left pb-2 text-[9px] font-bold uppercase tracking-widest text-gray-400">Description</th>}
                  {settings.showSku         && <th className="text-left pb-2 text-[9px] font-bold uppercase tracking-widest text-gray-400 w-20">SKU</th>}
                  {settings.showQty         && <th className="text-right pb-2 text-[9px] font-bold uppercase tracking-widest text-gray-400 w-10">Qty</th>}
                  {settings.showUnitPrice   && <th className="text-right pb-2 text-[9px] font-bold uppercase tracking-widest text-gray-400 w-20">Unit</th>}
                  {settings.showTotalPrice  && <th className="text-right pb-2 text-[9px] font-bold uppercase tracking-widest text-gray-400 w-20">Amount</th>}
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {settings.showLineItemNames && (
                      <td className="py-2.5 pr-4">
                        <p className="text-xs text-gray-800 font-medium">{item.description}</p>
                        {settings.showLineItemDescriptions && (
                          <p className="text-[10px] text-gray-400 mt-0.5">Equipment maintenance service</p>
                        )}
                      </td>
                    )}
                    {settings.showSku       && <td className="py-2.5 text-[10px] font-mono text-gray-400">SKU-{(1000 + i).toString()}</td>}
                    {settings.showQty       && <td className="py-2.5 text-right text-[10px] text-gray-600">{item.qty}</td>}
                    {settings.showUnitPrice && <td className="py-2.5 text-right text-[10px] text-gray-600">{fmtCurrency(item.unit)}</td>}
                    {settings.showTotalPrice && <td className="py-2.5 text-right text-[10px] font-semibold text-gray-800">{fmtCurrency(item.qty * item.unit)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-4 flex flex-col items-end gap-1">
              {settings.showSubtotal && (
                <div className="flex items-center gap-8 text-xs">
                  <span className="text-gray-500 font-medium">Subtotal</span>
                  <span className="w-24 text-right text-gray-700">{fmtCurrency(subtotal)}</span>
                </div>
              )}
              {settings.showTax && (
                <div className="flex items-center gap-8 text-xs">
                  <span className="text-gray-500 font-medium">Tax (8.75%)</span>
                  <span className="w-24 text-right text-gray-700">{fmtCurrency(taxAmt)}</span>
                </div>
              )}
              {settings.showTotalTax && settings.showTax && (
                <div className="flex items-center gap-8 text-xs border-t border-gray-200 pt-1 mt-0.5">
                  <span className="text-gray-500 font-medium">Total Tax</span>
                  <span className="w-24 text-right text-gray-700">{fmtCurrency(taxAmt)}</span>
                </div>
              )}
              <div className="flex items-center gap-8 border-t-2 border-gray-800 pt-2 mt-1">
                <span className={cn("text-sm font-bold", isBold ? "text-[color:var(--primary)]" : "text-gray-900")}>Total</span>
                <span className={cn("w-24 text-right text-sm font-bold tabular-nums", isBold ? "text-[color:var(--primary)]" : "text-gray-900")}>
                  {fmtCurrency(total)}
                </span>
              </div>
              {invoice.status === "Paid" ? (
                <div className="flex items-center gap-8 text-xs">
                  <span className="text-green-600 font-semibold">Amount Paid</span>
                  <span className="w-24 text-right text-green-600 font-semibold">{fmtCurrency(total)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-8 text-xs">
                  <span className="text-[color:var(--status-warning)] font-semibold">Amount Due</span>
                  <span className="w-24 text-right text-[color:var(--status-warning)] font-bold tabular-nums">{fmtCurrency(amountDue)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {settings.showNotesBelow && invoice.notes && (
          <div className="px-8 py-4 border-t border-gray-100 bg-gray-50/50">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Notes</p>
            <p className="text-[10px] text-gray-600 leading-relaxed">{invoice.notes}</p>
          </div>
        )}

        {/* Payment link */}
        <div className="px-8 py-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Pay Online</p>
              <p className="text-[10px] text-[color:var(--primary)] font-medium underline cursor-pointer">
                pay.equipify.ai/inv/{invoice.id.toLowerCase()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-gray-400">{COMPANY.email}</p>
              <p className="text-[9px] text-gray-400">{COMPANY.website}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

interface ToggleRowProps {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}
function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer group">
      <span className="text-xs text-foreground group-hover:text-foreground/80 transition-colors">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span className={cn(
          "pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transform transition-transform duration-150",
          checked ? "translate-x-3" : "translate-x-0",
        )} />
      </button>
    </label>
  )
}

function SettingsPanel({
  settings,
  onChange,
}: {
  settings: DisplaySettings
  onChange: (s: DisplaySettings) => void
}) {
  function set<K extends keyof DisplaySettings>(key: K, val: DisplaySettings[K]) {
    onChange({ ...settings, [key]: val })
  }

  const THEMES = [
    { value: "default", label: "Default" },
    { value: "minimal", label: "Minimal" },
    { value: "bold",    label: "Bold" },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Editable fields */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Editable Fields</p>
        <div>
          <label className="text-[10px] text-muted-foreground font-medium block mb-1">Custom Invoice Title</label>
          <input
            type="text"
            value={settings.customTitle}
            onChange={(e) => set("customTitle", e.target.value)}
            placeholder="INVOICE"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-medium block mb-1">Payment Terms</label>
          <select
            value={settings.paymentTerms}
            onChange={(e) => set("paymentTerms", e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
          >
            {["Net 15", "Net 30", "Net 45", "Net 60", "Due on Receipt"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-medium block mb-1">Invoice Theme</label>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => set("invoiceTheme", t.value as DisplaySettings["invoiceTheme"])}
                className={cn(
                  "flex-1 py-1.5 rounded border text-xs font-medium transition-colors cursor-pointer",
                  settings.invoiceTheme === t.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:border-primary/50",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Display toggles */}
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Line Items</p>
        <ToggleRow label="Display Line Items"             checked={settings.showLineItems}             onChange={(v) => set("showLineItems", v)} />
        <ToggleRow label="Display Line Item Names"        checked={settings.showLineItemNames}         onChange={(v) => set("showLineItemNames", v)} />
        <ToggleRow label="Display Line Item Descriptions" checked={settings.showLineItemDescriptions}  onChange={(v) => set("showLineItemDescriptions", v)} />
        <ToggleRow label="Display SKU / Item Number"      checked={settings.showSku}                   onChange={(v) => set("showSku", v)} />
        <ToggleRow label="Display Quantity"               checked={settings.showQty}                   onChange={(v) => set("showQty", v)} />
        <ToggleRow label="Display Unit Price"             checked={settings.showUnitPrice}             onChange={(v) => set("showUnitPrice", v)} />
        <ToggleRow label="Display Tax"                    checked={settings.showTax}                   onChange={(v) => set("showTax", v)} />
        <ToggleRow label="Display Total Price"            checked={settings.showTotalPrice}            onChange={(v) => set("showTotalPrice", v)} />
        <ToggleRow label="Display Subtotal"               checked={settings.showSubtotal}              onChange={(v) => set("showSubtotal", v)} />
        <ToggleRow label="Display Total Tax"              checked={settings.showTotalTax}              onChange={(v) => set("showTotalTax", v)} />
      </div>

      <div className="border-t border-border" />

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Customer Info</p>
        <ToggleRow label="Display Customer Service Address" checked={settings.showServiceAddress}  onChange={(v) => set("showServiceAddress", v)} />
        <ToggleRow label="Display Customer Phone"           checked={settings.showCustomerPhone}   onChange={(v) => set("showCustomerPhone", v)} />
        <ToggleRow label="Display Customer Email"           checked={settings.showCustomerEmail}   onChange={(v) => set("showCustomerEmail", v)} />
      </div>

      <div className="border-t border-border" />

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Service Details</p>
        <ToggleRow label="Display Service Title"          checked={settings.showServiceTitle}    onChange={(v) => set("showServiceTitle", v)} />
        <ToggleRow label="Display Service Location"       checked={settings.showServiceLocation} onChange={(v) => set("showServiceLocation", v)} />
        <ToggleRow label="Display Assigned Team Members"  checked={settings.showTeamMembers}     onChange={(v) => set("showTeamMembers", v)} />
        <ToggleRow label="Display Service Start Date"     checked={settings.showServiceDate}     onChange={(v) => set("showServiceDate", v)} />
        <ToggleRow label="Display Invoice Creator"        checked={settings.showInvoiceCreator}  onChange={(v) => set("showInvoiceCreator", v)} />
        <ToggleRow label="Display Notes Below Total"      checked={settings.showNotesBelow}      onChange={(v) => set("showNotesBelow", v)} />
        <ToggleRow label="Show Blank Custom Fields"       checked={settings.showBlankFields}     onChange={(v) => set("showBlankFields", v)} />
      </div>
    </div>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function EmailModal({
  invoice,
  variant,
  onClose,
  onSent,
  onError,
}: {
  invoice: AdminInvoice
  variant: "send" | "resend"
  onClose: () => void
  onSent?: () => void
  onError?: (message: string) => void
}) {
  const { updateInvoice } = useInvoices()
  const [sending, setSending] = useState(false)
  const [to,      setTo]      = useState(`billing@${invoice.customerName.toLowerCase().replace(/\s+/g, "")}.com`)
  const [subject, setSubject] = useState(`Invoice ${invoice.id} — ${fmtCurrency(invoice.amount)} Due ${fmtDate(invoice.dueDate)}`)
  const [body,    setBody]    = useState(`Hi ${invoice.customerName},\n\nPlease find attached Invoice ${invoice.id} for ${fmtCurrency(invoice.amount)}.\n\nPayment is due by ${fmtDate(invoice.dueDate)}. You can pay securely online at:\npay.equipify.ai/inv/${invoice.id.toLowerCase()}\n\nPlease don't hesitate to reach out if you have any questions.\n\nThank you,\n${COMPANY.name}`)

  async function handleSend() {
    setSending(true)
    const sentAt = new Date().toISOString()
    const patch =
      variant === "resend"
        ? { sentAt }
        : { status: "Sent" as const, sentAt }
    const { error } = await updateInvoice(invoice.id, patch)
    setSending(false)
    if (error) {
      onError?.(error)
      return
    }
    onSent?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !sending && onClose()} />
      <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />{" "}
            {variant === "resend" ? "Resend Invoice to Customer" : "Email Invoice to Customer"}
          </h3>
          <button type="button" onClick={() => !sending && onClose()} disabled={sending} className="p-1 rounded hover:bg-muted transition-colors cursor-pointer disabled:opacity-50">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">To</label>
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">Subject</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">Message</label>
            <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none" />
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border">
            <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Invoice {invoice.id}.pdf will be attached</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <Button size="sm" variant="outline" onClick={onClose} disabled={sending} className="text-xs cursor-pointer disabled:opacity-50">
            Cancel
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => void handleSend()}
            disabled={sending}
            className="text-xs gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {sending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
              </>
            ) : variant === "resend" ? (
              <>
                <Mail className="w-3.5 h-3.5" /> Resend Invoice
              </>
            ) : (
              <>
                <Mail className="w-3.5 h-3.5" /> Send Email
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function SmsModal({ invoice, onClose }: { invoice: AdminInvoice; onClose: () => void }) {
  const [phone, setPhone] = useState("(555) 010-0001")
  const [msg,   setMsg]   = useState(`Hi, this is ${COMPANY.name}. Invoice ${invoice.id} for ${fmtCurrency(invoice.amount)} is due ${fmtDate(invoice.dueDate)}. Pay online: pay.equipify.ai/inv/${invoice.id.toLowerCase()}`)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> SMS Invoice to Customer
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors cursor-pointer">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">Phone Number</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">Message</label>
            <textarea rows={5} value={msg} onChange={(e) => setMsg(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none" />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">{msg.length} / 160 chars</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <Button size="sm" variant="outline" onClick={onClose} className="text-xs cursor-pointer">Cancel</Button>
          <Button size="sm" variant="default" onClick={onClose} className="text-xs gap-1.5 cursor-pointer">
            <MessageSquare className="w-3.5 h-3.5" /> Send SMS
          </Button>
        </div>
      </div>
    </div>
  )
}

function PaymentModal({ invoice, onClose, onRecord }: { invoice: AdminInvoice; onClose: () => void; onRecord: () => void }) {
  const total = invoice.lineItems.reduce((s, i) => s + i.qty * i.unit, 0)
  const [amount,  setAmount]  = useState(total.toString())
  const [method,  setMethod]  = useState("Check")
  const [refNum,  setRefNum]  = useState("")
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" /> Record Payment
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors cursor-pointer">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Invoice Total</span>
            <span className="text-sm font-bold text-primary tabular-nums">{fmtCurrency(total)}</span>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">Amount Received</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">Payment Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer">
              {["Check", "ACH / Bank Transfer", "Credit Card", "Cash", "Zelle", "Other"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">Reference / Check Number</label>
            <input type="text" value={refNum} onChange={(e) => setRefNum(e.target.value)} placeholder="Optional"
              className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1">Payment Date</label>
            <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <Button size="sm" variant="outline" onClick={onClose} className="text-xs cursor-pointer">Cancel</Button>
          <Button size="sm" variant="default" onClick={() => { onRecord(); onClose() }} className="text-xs gap-1.5 cursor-pointer">
            <CheckCircle2 className="w-3.5 h-3.5" /> Record Payment
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab content ──────────────────────────────────────────────────────────────

function InfoTab({
  invoice,
  editing,
  draft,
  draftItems,
  setDraftItems,
  setField,
  onApplyReminder,
}: {
  invoice: AdminInvoice
  editing: boolean
  draft: Partial<AdminInvoice>
  draftItems: LineItem[]
  setDraftItems: (items: LineItem[]) => void
  setField: <K extends keyof AdminInvoice>(k: K, v: AdminInvoice[K]) => void
  onApplyReminder: (t: string) => void
}) {
  const currentStatus = (draft.status ?? invoice.status) as InvoiceStatus
  const displayTotal  = editing
    ? draftItems.reduce((s, i) => s + i.qty * i.unit, 0)
    : invoice.amount

  return (
    <div className="space-y-5">
      {/* Overdue banner */}
      {currentStatus === "Overdue" && !editing && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Payment overdue since {fmtDate(invoice.dueDate)} — {daysOverdue(invoice.dueDate)} days
        </div>
      )}

      {/* AI Tools */}
      {!editing && (
        <AIToolsPanel invoice={invoice} onApplyReminder={onApplyReminder} />
      )}

      {/* Invoice Details */}
      <Section title="Invoice Details">
        <Row label="Customer" value={
          <Link href={`/customers?open=${invoice.customerId}`} className="text-primary hover:underline cursor-pointer font-medium">
            {invoice.customerName}
          </Link>
        } />
        <Row label="Equipment" value={invoice.equipmentName} />
        {invoice.workOrderId && (
          <Row label="Work Order" value={
            <Link href={`/work-orders?open=${invoice.workOrderId}`} className="text-primary font-mono hover:underline cursor-pointer">
              {getWorkOrderDisplay({ id: invoice.workOrderId })}
            </Link>
          } />
        )}
        <Row label="Issued" value={fmtDate(invoice.issueDate)} />
        {editing ? (
          <EditRow label="Due Date">
            <input type="date" value={draft.dueDate ?? ""} onChange={(e) => setField("dueDate", e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
          </EditRow>
        ) : (
          <Row label="Due Date" value={
            <span className={invoice.status === "Overdue" ? "text-destructive font-semibold" : ""}>{fmtDate(invoice.dueDate)}</span>
          } />
        )}
        {editing ? (
          <EditRow label="Status">
            <select value={draft.status ?? invoice.status} onChange={(e) => setField("status", e.target.value as InvoiceStatus)}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer">
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </EditRow>
        ) : (
          <Row label="Status" value={
            <Badge variant="outline" className={cn("text-[10px] font-semibold", STATUS_CONFIG[invoice.status].className)}>{invoice.status}</Badge>
          } />
        )}
        {!editing && invoice.sentAt && (
          <Row label="Sent" value={`Sent on ${fmtDate(invoice.sentAt)}`} />
        )}
        {invoice.paidDate && (
          <Row label="Paid On" value={<span className="text-[color:var(--status-success)] font-semibold">{fmtDate(invoice.paidDate)}</span>} />
        )}
        <Row label="Created By" value={invoice.createdBy} />
      </Section>

      {/* Total card */}
      <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Invoice Total</p>
          <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums">{fmtCurrency(displayTotal)}</p>
        </div>
        <DollarSign className="w-8 h-8 text-primary/30" />
      </div>

      {/* Line items */}
      <Section title="Line Items">
        {editing ? (
          <EditableLineItems items={draftItems} onChange={setDraftItems} />
        ) : (
          <ReadOnlyLineItems items={invoice.lineItems} total={invoice.amount} />
        )}
      </Section>

      {/* Notes */}
      <Section title="Notes">
        {editing ? (
          <textarea
            rows={3}
            value={draft.notes ?? ""}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder="Add notes..."
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
          />
        ) : invoice.notes ? (
          <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">{invoice.notes}</p>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-3">No notes.</p>
        )}
      </Section>
    </div>
  )
}

function PaymentsTab({ invoice }: { invoice: AdminInvoice }) {
  const total   = invoice.lineItems.reduce((s, i) => s + i.qty * i.unit, 0)
  const taxAmt  = total * 0.0875
  const grandTotal = total + taxAmt
  const isPaid  = invoice.status === "Paid"

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Due", value: fmtCurrency(grandTotal), color: "text-foreground" },
          { label: "Amount Paid", value: isPaid ? fmtCurrency(grandTotal) : "$0.00", color: isPaid ? "text-[color:var(--status-success)]" : "text-muted-foreground" },
          { label: "Balance", value: isPaid ? "$0.00" : fmtCurrency(grandTotal), color: isPaid ? "text-muted-foreground" : "text-[color:var(--status-warning)]" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{s.label}</p>
            <p className={cn("text-base font-bold tabular-nums mt-0.5", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {invoice.paidDate ? (
        <div className="rounded-lg border border-[color:var(--status-success)]/30 bg-[color:var(--status-success)]/5 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[color:var(--status-success)] shrink-0" />
          <div>
            <p className="text-xs font-semibold text-[color:var(--status-success)]">Payment received</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {fmtCurrency(grandTotal)} — {fmtDate(invoice.paidDate)}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/5 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[color:var(--status-warning)] shrink-0" />
          <div>
            <p className="text-xs font-semibold text-[color:var(--status-warning)]">Payment pending</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Due {fmtDate(invoice.dueDate)}</p>
          </div>
        </div>
      )}

      <Section title="Payment History">
        <div className="space-y-2">
          {[
            { date: fmtDate(invoice.issueDate), event: "Invoice issued", detail: fmtCurrency(grandTotal), type: "neutral" },
            { date: fmtDate(invoice.dueDate),   event: "Payment due",    detail: "",                     type: invoice.status === "Overdue" ? "danger" : "neutral" },
            ...(invoice.paidDate ? [{ date: fmtDate(invoice.paidDate), event: "Payment received", detail: fmtCurrency(grandTotal), type: "success" }] : []),
          ].map((e, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/30 border border-border">
              <div className={cn(
                "w-2 h-2 rounded-full shrink-0",
                e.type === "success" ? "bg-[color:var(--status-success)]"
                : e.type === "danger" ? "bg-destructive"
                : "bg-muted-foreground/40",
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{e.event}</p>
                <p className="text-[10px] text-muted-foreground">{e.date}</p>
              </div>
              {e.detail && <span className="text-xs font-semibold tabular-nums text-foreground">{e.detail}</span>}
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function FilesTab({ invoice }: { invoice: AdminInvoice }) {
  return (
    <div className="space-y-4">
      {invoice.equipmentId ? (
        <CertificatePanel
          equipmentId={invoice.equipmentId}
          equipmentName={invoice.equipmentName ?? ""}
          customerId={invoice.customerId}
          customerName={invoice.customerName}
          invoiceId={invoice.id}
        />
      ) : (
        <div className="rounded-lg border-2 border-dashed border-border py-10 text-center">
          <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-medium">No files attached</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Upload certificates and documents to attach to this invoice.</p>
        </div>
      )}
    </div>
  )
}

function CommentsTab() {
  const [comment, setComment] = useState("")
  const [comments, setComments] = useState([
    { id: 1, author: "Admin", text: "Invoice sent to customer via email.", time: "Apr 29, 2026 at 9:14 AM", internal: false },
    { id: 2, author: "Marcus Webb", text: "Customer confirmed receipt, said payment in 2 weeks.", time: "Apr 30, 2026 at 2:05 PM", internal: true },
  ])

  function addComment() {
    if (!comment.trim()) return
    setComments((prev) => [...prev, {
      id: Date.now(),
      author: "Admin",
      text: comment.trim(),
      time: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " at " + new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      internal: false,
    }])
    setComment("")
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[9px] font-bold text-primary">{c.author[0]}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-foreground">{c.author}</span>
                {c.internal && (
                  <span className="inline-flex items-center rounded-full bg-muted border border-border px-1.5 py-0 text-[9px] font-medium text-muted-foreground">Internal</span>
                )}
                <span className="text-[10px] text-muted-foreground">{c.time}</span>
              </div>
              <p className="text-xs text-foreground leading-relaxed bg-muted/30 border border-border rounded-lg px-3 py-2">{c.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addComment()}
          placeholder="Add a comment..."
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
        <Button size="sm" variant="outline" onClick={addComment} className="text-xs cursor-pointer px-3">Post</Button>
      </div>
    </div>
  )
}

function WorkOrdersTab({ invoice }: { invoice: AdminInvoice }) {
  if (!invoice.workOrderId) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border py-10 text-center">
        <ClipboardList className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground font-medium">No linked work orders</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Link
        href={`/work-orders?open=${invoice.workOrderId}`}
        className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/30 transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <ClipboardList className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold font-mono text-primary">{getWorkOrderDisplay({ id: invoice.workOrderId })}</p>
            <p className="text-[10px] text-muted-foreground">{invoice.equipmentName}</p>
          </div>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
      </Link>
    </div>
  )
}

function ActivityTab({ invoice }: { invoice: AdminInvoice }) {
  const events = [
    { date: fmtDate(invoice.issueDate), time: "9:00 AM", actor: "Admin", action: "Created invoice", detail: invoice.id },
    { date: fmtDate(invoice.issueDate), time: "9:14 AM", actor: "Admin", action: "Changed status to Sent", detail: "" },
    ...(invoice.status === "Paid" && invoice.paidDate ? [
      { date: fmtDate(invoice.paidDate), time: "11:32 AM", actor: "Admin", action: "Payment recorded", detail: fmtCurrency(invoice.amount) },
      { date: fmtDate(invoice.paidDate), time: "11:32 AM", actor: "System", action: "Status updated to Paid", detail: "" },
    ] : [
      { date: "Today", time: "—", actor: "System", action: "Invoice outstanding", detail: `${daysOverdue(invoice.dueDate) > 0 ? `${daysOverdue(invoice.dueDate)} days overdue` : "Pending payment"}` },
    ]),
  ]

  return (
    <div className="space-y-1">
      {events.map((e, i) => (
        <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-foreground">{e.action}</span>
              {e.detail && <span className="text-[10px] text-muted-foreground">— {e.detail}</span>}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{e.actor} · {e.date} {e.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
      <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <span className="text-xs text-muted-foreground shrink-0 w-28">{label}</span>
      <span className="text-xs text-foreground text-right flex-1">{value}</span>
    </div>
  )
}

function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-3 py-2.5">
      <span className="text-xs text-muted-foreground shrink-0 pt-1.5 w-28">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

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
    <div className="space-y-2 p-3">
      <table className="w-full text-xs">
        <thead className="bg-muted/40">
          <tr>
            <th className="text-left px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
            <th className="text-right px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-14">Qty</th>
            <th className="text-right px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-20">Unit</th>
            <th className="text-right px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Total</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item, i) => (
            <tr key={i}>
              <td className="px-1 py-1.5">
                <input type="text" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="Item description"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-colors" />
              </td>
              <td className="px-1 py-1.5">
                <input type="number" value={item.qty} onChange={(e) => updateItem(i, "qty", e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-right text-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-colors" />
              </td>
              <td className="px-1 py-1.5">
                <input type="number" value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-right text-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-colors" />
              </td>
              <td className="px-2 py-1.5 text-right font-medium text-foreground">{fmtCurrency(item.qty * item.unit)}</td>
              <td className="px-1 py-1.5 text-center">
                <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/40 border-t border-border">
          <tr>
            <td colSpan={3} className="px-2 py-2 text-right font-semibold text-foreground text-xs uppercase tracking-wide">Total</td>
            <td className="px-2 py-2 text-right font-bold text-foreground tabular-nums">{fmtCurrency(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      <button onClick={addItem} className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer font-medium">
        <Plus className="w-3.5 h-3.5" /> Add Line Item
      </button>
    </div>
  )
}

function ReadOnlyLineItems({ items, total }: { items: LineItem[]; total: number }) {
  return (
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
          <tr key={i}>
            <td className="px-3 py-2 text-foreground">{item.description}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{item.qty}</td>
            <td className="px-3 py-2 text-right text-muted-foreground">{fmtCurrency(item.unit)}</td>
            <td className="px-3 py-2 text-right font-medium text-foreground tabular-nums">{fmtCurrency(item.qty * item.unit)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="bg-muted/40 border-t border-border">
        <tr>
          <td colSpan={3} className="px-3 py-2 text-right font-semibold text-foreground text-xs uppercase tracking-wide">Total</td>
          <td className="px-3 py-2 text-right font-bold text-foreground tabular-nums">{fmtCurrency(total)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

// ─── Main exported component ──────────────────────────────────────────────────

interface InvoiceDetailViewProps {
  invoice: AdminInvoice
  onClose: () => void
}

let toastCounter = 0

export function InvoiceDetailView({ invoice, onClose }: InvoiceDetailViewProps) {
  const { updateInvoice } = useInvoices()

  // Tabs + layout state
  const [activeTab,    setActiveTab]    = useState<Tab>("info")
  const [showPreview,  setShowPreview]  = useState(false)
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("laptop")
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings]         = useState<DisplaySettings>(DEFAULT_SETTINGS)

  // Edit state
  const [editing,    setEditing]    = useState(false)
  const [draft,      setDraft]      = useState<Partial<AdminInvoice>>({})
  const [draftItems, setDraftItems] = useState<LineItem[]>([])

  // Toasts
  const [toasts, setToasts] = useState<{ id: number; message: string; kind: "success" | "error" }[]>([])

  // Modals
  const [modal, setModal] = useState<"email" | "sms" | "payment" | null>(null)
  const [emailVariant, setEmailVariant] = useState<"send" | "resend">("send")
  const [moreOpen, setMoreOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)

  function toast(message: string, kind: "success" | "error" = "success") {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, kind }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  const alreadyEmailed = invoice.status === "Sent" && Boolean(invoice.sentAt)

  function openEmailModal(variant: "send" | "resend") {
    setEmailVariant(variant)
    setModal("email")
  }

  function startEdit() {
    setDraft({ status: invoice.status, dueDate: invoice.dueDate, notes: invoice.notes })
    setDraftItems(invoice.lineItems.map((li) => ({ ...li })))
    setEditing(true)
    setActiveTab("info")
  }

  function cancelEdit() {
    setEditing(false); setDraft({}); setDraftItems([])
  }

  async function saveEdit() {
    const newTotal = draftItems.reduce((s, i) => s + i.qty * i.unit, 0)
    const nextStatus = (draft.status ?? invoice.status) as InvoiceStatus
    const patch: Parameters<typeof updateOrgInvoice>[3] = {
      status: nextStatus,
      dueDate: draft.dueDate ?? invoice.dueDate,
      notes: draft.notes ?? invoice.notes,
      lineItems: draftItems.map((li) => ({
        description: li.description,
        qty: li.qty,
        unit: li.unit,
      })),
      amountCents: Math.round(newTotal * 100),
    }
    if (nextStatus === "Paid" && !invoice.paidDate) {
      patch.paidAt = new Date().toISOString()
    }
    const { error } = await updateInvoice(invoice.id, patch)
    if (error) {
      toast(`Could not save: ${error}`, "error")
      return
    }
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

  const currentStatus = (draft.status ?? invoice.status) as InvoiceStatus
  const canRecordPayment = ["Unpaid", "Overdue", "Sent"].includes(currentStatus)

  const TABS: { id: Tab; label: string }[] = [
    { id: "info",         label: "Info" },
    { id: "payments",     label: "Payments" },
    { id: "files",        label: "Files" },
    { id: "comments",     label: "Comments" },
    { id: "work-orders",  label: "Work Orders" },
    { id: "activity",     label: "Activity" },
  ]

  const DEVICES: { id: PreviewDevice; icon: React.ReactNode; label: string }[] = [
    { id: "mobile",  icon: <Smartphone className="w-3.5 h-3.5" />,  label: "Mobile" },
    { id: "tablet",  icon: <Tablet className="w-3.5 h-3.5" />,      label: "Tablet" },
    { id: "laptop",  icon: <Monitor className="w-3.5 h-3.5" />,     label: "Laptop" },
    { id: "pdf",     icon: <FileText className="w-3.5 h-3.5" />,    label: "PDF" },
  ]

  return (
    <>
      {/* ── Top action bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/20 flex-wrap shrink-0">
        {editing ? (
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
            {/* Primary: Email / already sent + resend */}
            {alreadyEmailed ? (
              <>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-not-allowed" disabled>
                  <Mail className="w-3.5 h-3.5" /> Already Sent
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="gap-1.5 text-xs cursor-pointer"
                  onClick={() => openEmailModal("resend")}
                >
                  <Mail className="w-3.5 h-3.5" /> Resend Invoice
                </Button>
              </>
            ) : (
              <Button size="sm" variant="default" className="gap-1.5 text-xs cursor-pointer" onClick={() => openEmailModal("send")}>
                <Mail className="w-3.5 h-3.5" /> Email to Customer
              </Button>
            )}

            {/* Dropdown: send actions */}
            <div className="relative">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer px-2" onClick={() => setActionsOpen((p) => !p)}>
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
              {actionsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-20 w-52 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                    {[
                      { icon: <Mail className="w-3.5 h-3.5" />,          label: alreadyEmailed ? "Resend Invoice" : "Email Dynamic Invoice",   action: () => openEmailModal(alreadyEmailed ? "resend" : "send") },
                      { icon: <MessageSquare className="w-3.5 h-3.5" />, label: "SMS Dynamic Invoice",     action: () => setModal("sms") },
                      { icon: <Link2 className="w-3.5 h-3.5" />,         label: "Copy Invoice URL",        action: () => { navigator.clipboard?.writeText(`https://pay.equipify.ai/inv/${invoice.id.toLowerCase()}`); toast("Invoice URL copied to clipboard") } },
                      { icon: <Download className="w-3.5 h-3.5" />,      label: "Download PDF",            action: () => toast("Invoice PDF downloaded") },
                      { icon: <Save className="w-3.5 h-3.5" />,          label: "Save PDF to Record",      action: () => toast("PDF saved to invoice record") },
                      { icon: <CreditCard className="w-3.5 h-3.5" />,    label: "Record Payment",          action: () => setModal("payment") },
                      { icon: <CheckCircle2 className="w-3.5 h-3.5" />,  label: "Mark Paid",               action: async () => {
                        const { error } = await updateInvoice(invoice.id, { status: "Paid", paidAt: new Date().toISOString() })
                        if (error) { toast(`Could not mark paid: ${error}`, "error"); return }
                        toast("Invoice marked as paid")
                        setActionsOpen(false)
                      } },
                      { icon: <Ban className="w-3.5 h-3.5" />,           label: "Void Invoice",            action: async () => {
                        const { error } = await updateInvoice(invoice.id, { status: "Void" })
                        if (error) { toast(`Could not void: ${error}`, "error"); return }
                        toast("Invoice voided")
                        setActionsOpen(false)
                      } },
                    ].map((item) => (
                      <button key={item.label} type="button" onClick={() => { item.action(); setActionsOpen(false) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left text-xs text-foreground hover:bg-muted/60 transition-colors cursor-pointer">
                        <span className="text-muted-foreground shrink-0">{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Record Payment */}
            {canRecordPayment && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => setModal("payment")}>
                <CreditCard className="w-3.5 h-3.5" /> Record Payment
              </Button>
            )}

            {/* Edit */}
            <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={startEdit}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>

            {/* More Actions */}
            <div className="relative ml-auto">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => setMoreOpen((p) => !p)}>
                More <ChevronDown className="w-3 h-3" />
              </Button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                    {[
                      { icon: <Copy className="w-3.5 h-3.5" />,             label: "Duplicate Invoice",           action: () => toast("Invoice duplicated") },
                      { icon: <Repeat className="w-3.5 h-3.5" />,           label: "Convert to Recurring",        action: () => toast("Converted to recurring invoice") },
                      { icon: <Paperclip className="w-3.5 h-3.5" />,        label: "Attach Certificates",         action: () => { setActiveTab("files"); setMoreOpen(false) } },
                      { icon: <FileSignature className="w-3.5 h-3.5" />,    label: "Attach Contract",             action: () => toast("Contract attachment coming soon") },
                      { icon: <StickyNote className="w-3.5 h-3.5" />,       label: "Add Internal Note",           action: () => { setActiveTab("comments"); setMoreOpen(false) } },
                      { icon: <ClipboardList className="w-3.5 h-3.5" />,    label: "View Audit Log",              action: () => { setActiveTab("activity"); setMoreOpen(false) } },
                    ].map((item) => (
                      <button key={item.label} type="button" onClick={() => { item.action(); setMoreOpen(false) }}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left text-xs text-foreground hover:bg-muted/60 transition-colors cursor-pointer">
                        <span className="text-muted-foreground shrink-0">{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Preview + Settings toggle bar ──────────────────────────────────── */}
      {!editing && (
        <div className="flex items-center gap-2 px-5 py-2 border-b border-border bg-background shrink-0">
          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors cursor-pointer",
              showPreview ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary/50",
            )}
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? "Hide Preview" : "Preview Invoice"}
          </button>

          {showPreview && (
            <div className="flex items-center gap-1 ml-2">
              {DEVICES.map((d) => (
                <button key={d.id} type="button" onClick={() => setPreviewDevice(d.id)}
                  title={d.label}
                  className={cn(
                    "p-1.5 rounded-md border text-xs transition-colors cursor-pointer",
                    previewDevice === d.id ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
                  )}>
                  {d.icon}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowSettings((p) => !p)}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors cursor-pointer ml-auto",
              showSettings ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary/50",
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>
      )}

      {/* ── Main content area ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left: tabs + content */}
        <div className={cn("flex flex-col min-w-0 transition-all duration-300", showSettings ? "flex-1" : "flex-1")}>
          {/* Tabs */}
          <div className="flex items-center gap-0 border-b border-border px-5 shrink-0 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0",
                  activeTab === tab.id
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground border-b-2 border-transparent",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {activeTab === "info" && (
              <InfoTab
                invoice={invoice}
                editing={editing}
                draft={draft}
                draftItems={draftItems}
                setDraftItems={setDraftItems}
                setField={setField}
                onApplyReminder={handleApplyReminder}
              />
            )}
            {activeTab === "payments"    && <PaymentsTab   invoice={invoice} />}
            {activeTab === "files"       && <FilesTab      invoice={invoice} />}
            {activeTab === "comments"    && <CommentsTab />}
            {activeTab === "work-orders" && <WorkOrdersTab invoice={invoice} />}
            {activeTab === "activity"    && <ActivityTab   invoice={invoice} />}
          </div>
        </div>

        {/* Right: Settings panel */}
        {showSettings && !editing && (
          <div className="w-64 shrink-0 border-l border-border bg-muted/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Display Settings</span>
              </div>
              <button type="button" onClick={() => setShowSettings(false)} className="p-0.5 rounded hover:bg-muted transition-colors cursor-pointer">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <SettingsPanel settings={settings} onChange={setSettings} />
            </div>
          </div>
        )}
      </div>

      {/* ── Preview overlay ────────────────────────────────────────────────── */}
      {showPreview && !editing && (
        <div className="border-t border-border bg-muted/30 shrink-0 overflow-y-auto" style={{ maxHeight: "55vh" }}>
          <div className="px-5 py-5">
            <InvoicePreview invoice={invoice} settings={settings} device={previewDevice} />
          </div>
        </div>
      )}

      {/* ── Toasts ─────────────────────────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[70] flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-lg text-xs font-medium shadow-lg pointer-events-auto",
                t.kind === "error"
                  ? "bg-destructive text-destructive-foreground border border-destructive/30"
                  : "bg-foreground text-background",
              )}
            >
              {t.kind === "error" ? (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[color:var(--status-success)]" />
              )}
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {modal === "email" && (
        <EmailModal
          invoice={invoice}
          variant={emailVariant}
          onClose={() => setModal(null)}
          onSent={() =>
            toast(
              emailVariant === "resend" ? "Invoice resent — sent time updated." : "Invoice sent to customer.",
            )
          }
          onError={(msg) => toast(`Could not send email: ${msg}`, "error")}
        />
      )}
      {modal === "sms"     && <SmsModal     invoice={invoice} onClose={() => setModal(null)} />}
      {modal === "payment" && (
        <PaymentModal
          invoice={invoice}
          onClose={() => setModal(null)}
          onRecord={() => {
            void (async () => {
              const { error } = await updateInvoice(invoice.id, {
                status: "Paid",
                paidAt: new Date().toISOString(),
              })
              if (error) {
                toast(`Could not record payment: ${error}`, "error")
                return
              }
              toast("Payment recorded — invoice marked as paid")
              setModal(null)
            })()
          }}
        />
      )}
    </>
  )
}
