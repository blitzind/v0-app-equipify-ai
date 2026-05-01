"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useWorkOrders } from "@/lib/work-order-store"
import type { WorkOrder, WorkOrderStatus, WorkOrderPriority } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import {
  CheckCircle2, FileText, Printer, Pencil, X, Check,
  AlertTriangle, Sparkles, Mic, Upload, RefreshCw,
  Wrench, ClipboardList, Clock, DollarSign, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react"
import { ContactActions } from "@/components/contact-actions"

let toastCounter = 0

// ─── Status / priority maps ───────────────────────────────────────────────────

const STATUS_STYLE: Record<WorkOrderStatus, string> = {
  "Open":        "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  "Scheduled":   "bg-[color:var(--status-info)]/15 text-[color:var(--status-info)] border-[color:var(--status-info)]/25",
  "In Progress": "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "Completed":   "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  "Invoiced":    "bg-muted text-muted-foreground border-border",
}

const PRIORITY_COLOR: Record<WorkOrderPriority, string> = {
  Low:      "text-muted-foreground",
  Normal:   "text-foreground",
  High:     "text-[color:var(--status-warning)]",
  Critical: "text-destructive font-semibold",
}

const ALL_STATUSES: WorkOrderStatus[] = ["Open", "Scheduled", "In Progress", "Completed", "Invoiced"]
const ALL_PRIORITIES: WorkOrderPriority[] = ["Low", "Normal", "High", "Critical"]

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

// ─── Edit controls ────────────────────────────────────────────────────────────

function EditInput({ value, onChange, type = "text", placeholder }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
    />
  )
}

function EditSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[]
}) {
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

function EditTextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      rows={rows}
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

// ─── AI mock generators ───────────────────────────────────────────────────────

function mockServiceNotes(wo: WorkOrder): string {
  return `Technician arrived on site at ${wo.scheduledTime ?? "08:00"}. Performed full diagnostic on ${wo.equipmentName}. ${wo.repairLog.problemReported ?? "Customer reported intermittent operation issues."}

Inspection revealed ${wo.repairLog.diagnosis ?? "worn contactor contacts and low refrigerant charge. Refrigerant levels were at 60% capacity, indicating a slow leak at the Schrader valve."}

All electrical connections checked and torqued to spec. Capacitor tested — reading within tolerance. System cycled three times and monitored for 15 minutes post-repair. Discharge and suction pressures confirmed within manufacturer specifications.

Customer advised to monitor system over the next 7 days and report any further issues. Recommended scheduling a follow-up PM in 90 days.`
}

function mockPartsSuggestions(wo: WorkOrder): { name: string; partNumber: string; qty: number; unitCost: number; reason: string }[] {
  const type = wo.type?.toLowerCase() ?? ""
  const base = [
    { name: "Schrader Valve Core", partNumber: "SV-4408", qty: 2, unitCost: 8, reason: "Suspected refrigerant leak source" },
    { name: "Capacitor 45/5 MFD", partNumber: "CAP-455R", qty: 1, unitCost: 42, reason: "Pre-emptive replacement — within 10% of rated tolerance" },
    { name: "Refrigerant R-410A (25 lb)", partNumber: "REF-410A-25", qty: 1, unitCost: 185, reason: "Recharge to manufacturer-specified levels" },
  ]
  if (type.includes("electrical") || type.includes("repair")) {
    base.push({ name: "Contactor 2-Pole 40A", partNumber: "CONT-2P40", qty: 1, unitCost: 38, reason: "Contacts show pitting — replace to prevent nuisance trips" })
  }
  if (type.includes("maintenance") || type.includes("pm")) {
    base.push(
      { name: "Pleated Filter 20x25x1 MERV-11", partNumber: "FLTR-2025M11", qty: 2, unitCost: 18, reason: "Scheduled replacement — media at 85% loading" },
      { name: "Condensate Pan Tablets", partNumber: "CPT-100", qty: 1, unitCost: 12, reason: "Prevent microbial buildup in condensate drain" },
    )
  }
  return base
}

function mockLaborEstimate(wo: WorkOrder): { task: string; hours: number; rate: number }[] {
  return [
    { task: "Diagnostic & system inspection", hours: 0.5, rate: 125 },
    { task: "Leak detection & Schrader valve replacement", hours: 1.0, rate: 125 },
    { task: "Refrigerant recovery, recharge & verification", hours: 1.5, rate: 125 },
    { task: "Electrical inspection & contactor check", hours: 0.5, rate: 125 },
    ...(wo.type?.toLowerCase().includes("maintenance")
      ? [{ task: "Filter replacement & condensate flush", hours: 0.5, rate: 125 }]
      : []),
    { task: "System performance test & documentation", hours: 0.5, rate: 125 },
  ]
}

function mockJobSummary(wo: WorkOrder): string {
  const total = wo.totalLaborCost + wo.totalPartsCost
  return `Work order ${wo.id} for ${wo.customerName} (${wo.equipmentName} at ${wo.location}) was completed successfully. The primary issue — ${wo.repairLog.diagnosis ?? "low refrigerant and worn contactors"} — was resolved by the assigned technician ${wo.technicianName}.

Total job duration: approximately 3.5 hours on site. Parts used: refrigerant R-410A, Schrader valve cores, and a replacement capacitor. Total job value: ${total > 0 ? fmtCurrency(total) : "$762"}.

No warranty claims required. Equipment returned to full operating capacity. Customer signed off on completion. Follow-up PM recommended in 90 days.`
}

function mockVoiceTranscription(): string {
  return `Arrived on site at 9:15. Customer said the unit had been short-cycling since yesterday morning. Checked the disconnect and breakers — all good. Pulled the panels and found the contactor was chattering. Swapped it out. Also noticed the filter was pretty dirty, went ahead and replaced it while I was in there.

Checked refrigerant pressures after the repair. Suction was at 68 PSI, discharge at 245. Slightly low on the high side so I added a half-pound of 410A. Cycled the system three times. Running clean now.

Talked to the homeowner — Sarah — she said it's been doing this every summer. I recommended they get on a maintenance plan. Left her a brochure. Job took about two and a half hours total.`
}

// ─── AI Tools Panel ───────────────────────────────────────────────────────────

type AIToolKey = "notes" | "parts" | "labor" | "summary" | null
type AILoadingKey = "notes" | "parts" | "labor" | "summary" | "voice" | null

interface SuggestedPart { name: string; partNumber: string; qty: number; unitCost: number; reason: string }
interface LaborLine    { task: string; hours: number; rate: number }

interface AIToolsPanelProps {
  wo: WorkOrder
  onApplyNotes: (notes: string) => void
  onApplySummary: (summary: string) => void
}

function AIToolsPanel({ wo, onApplyNotes, onApplySummary }: AIToolsPanelProps) {
  const [activeTool, setActiveTool]     = useState<AIToolKey>(null)
  const [loading, setLoading]           = useState<AILoadingKey>(null)
  const [serviceNotes, setServiceNotes] = useState<string | null>(null)
  const [parts, setParts]               = useState<SuggestedPart[] | null>(null)
  const [labor, setLabor]               = useState<LaborLine[] | null>(null)
  const [summary, setSummary]           = useState<string | null>(null)
  const [voiceText, setVoiceText]       = useState<string | null>(null)
  const [voiceDragging, setVoiceDragging] = useState(false)
  const [voiceFileName, setVoiceFileName] = useState<string | null>(null)
  const [notesApplied, setNotesApplied] = useState(false)
  const [summaryApplied, setSummaryApplied] = useState(false)
  const [feedbackId, setFeedbackId]     = useState<Record<string, "up"|"down"|null>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function runTool(key: "notes" | "parts" | "labor" | "summary", delay = 1600) {
    setActiveTool(key)
    setLoading(key)
    await new Promise((r) => setTimeout(r, delay))
    if (key === "notes")   setServiceNotes(mockServiceNotes(wo))
    if (key === "parts")   setParts(mockPartsSuggestions(wo))
    if (key === "labor")   setLabor(mockLaborEstimate(wo))
    if (key === "summary") setSummary(mockJobSummary(wo))
    setLoading(null)
  }

  async function handleVoiceFile(file: File) {
    setVoiceFileName(file.name)
    setLoading("voice")
    await new Promise((r) => setTimeout(r, 2200))
    setVoiceText(mockVoiceTranscription())
    setLoading(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setVoiceDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleVoiceFile(file)
  }

  const laborTotal = labor
    ? labor.reduce((s, l) => s + l.hours * l.rate, 0)
    : 0
  const partsTotal = parts
    ? parts.reduce((s, p) => s + p.qty * p.unitCost, 0)
    : 0

  // Shared style constants matching AI component library
  const AI_BG     = "bg-[color:var(--ds-info-bg)]"
  const AI_BORDER = "border-[color:var(--ds-info-border)]"
  const AI_TEXT   = "text-[color:var(--ds-info-text)]"
  const AI_SUBTLE = "text-[color:var(--ds-info-subtle)]"

  const toolBtn = (key: typeof activeTool, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => {
        if (activeTool === key) { setActiveTool(null); return }
        runTool(key as "notes" | "parts" | "labor" | "summary")
      }}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer",
        activeTool === key
          ? cn("border-[color:var(--ds-info-border)]", AI_BG, AI_TEXT)
          : "border-border bg-card text-foreground hover:border-[color:var(--ds-info-border)] hover:text-[color:var(--ds-info-text)]",
        loading === key && "opacity-70 cursor-wait",
      )}
      disabled={loading !== null && loading !== key}
      aria-pressed={activeTool === key}
    >
      {loading === key
        ? <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
        : <span className="shrink-0">{icon}</span>
      }
      {loading === key ? "Working…" : label}
    </button>
  )

  return (
    <div className={cn("rounded-xl border overflow-hidden", AI_BG, AI_BORDER)}>
      {/* Header */}
      <div className={cn("flex items-center gap-2 px-4 py-3 border-b", AI_BORDER)}>
        <div className="w-5 h-5 rounded bg-[color:var(--ds-info-subtle)] flex items-center justify-center shrink-0">
          <Sparkles className="w-3 h-3 text-white" aria-hidden="true" />
        </div>
        <span className={cn("text-xs font-semibold", AI_TEXT)}>AI Work Order Tools</span>
        <span className={cn("ml-auto text-[10px] font-medium opacity-60", AI_TEXT)}>Powered by Equipify AI</span>
      </div>

      {/* Tool buttons */}
      <div className={cn("flex flex-wrap gap-2 px-4 py-3 border-b", AI_BORDER)}>
        {toolBtn("notes",   "Draft Service Notes", <ClipboardList className="w-3.5 h-3.5" />)}
        {toolBtn("parts",   "Suggest Parts",       <Wrench className="w-3.5 h-3.5" />)}
        {toolBtn("labor",   "Estimate Labor",      <Clock className="w-3.5 h-3.5" />)}
        {toolBtn("summary", "Summarize Job",       <FileText className="w-3.5 h-3.5" />)}
      </div>

      {/* Tool output */}
      {activeTool !== null && (
        <div className={cn("px-4 py-4 border-b space-y-3", AI_BORDER)}>

          {/* Draft Service Notes */}
          {activeTool === "notes" && (
            <>
              {loading === "notes" ? (
                <div className="space-y-2">
                  <div className="h-3 rounded bg-[color:var(--ds-info-border)] animate-pulse w-full" />
                  <div className="h-3 rounded bg-[color:var(--ds-info-border)] animate-pulse w-5/6" />
                  <div className="h-3 rounded bg-[color:var(--ds-info-border)] animate-pulse w-4/6" />
                  <div className="h-3 rounded bg-[color:var(--ds-info-border)] animate-pulse w-full mt-2" />
                  <div className="h-3 rounded bg-[color:var(--ds-info-border)] animate-pulse w-3/4" />
                </div>
              ) : serviceNotes && (
                <>
                  <div className="rounded-lg border border-[color:var(--ds-info-border)] bg-white/60 p-3">
                    <p className={cn("text-xs leading-relaxed whitespace-pre-line", AI_TEXT)}>{serviceNotes}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => runTool("notes")}
                      className={cn("inline-flex items-center gap-1 text-[10px] font-medium rounded-md px-2 py-1 border border-[color:var(--ds-info-border)] bg-white/60", AI_TEXT, "hover:bg-white transition-colors")}
                    >
                      <RefreshCw className="w-3 h-3" /> Regenerate
                    </button>
                    <button
                      type="button"
                      disabled={notesApplied}
                      onClick={() => { onApplyNotes(serviceNotes); setNotesApplied(true) }}
                      className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-semibold rounded-md px-2 py-1 border transition-colors",
                        notesApplied
                          ? "border-[color:var(--status-success)]/30 bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] cursor-default"
                          : cn("bg-[color:var(--ds-info-subtle)] text-white border-transparent hover:opacity-90"),
                      )}
                    >
                      {notesApplied
                        ? <><CheckCircle2 className="w-3 h-3" /> Applied to Repair Log</>
                        : <><Check className="w-3 h-3" /> Apply to Repair Log</>
                      }
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Suggest Parts */}
          {activeTool === "parts" && (
            <>
              {loading === "parts" ? (
                <div className="space-y-2">
                  {[1,2,3].map((i) => (
                    <div key={i} className="h-10 rounded bg-[color:var(--ds-info-border)] animate-pulse w-full" />
                  ))}
                </div>
              ) : parts && (
                <>
                  <div className="rounded-lg border border-[color:var(--ds-info-border)] overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-[color:var(--ds-info-bg)]">
                        <tr>
                          <th className={cn("text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wide", AI_TEXT)}>Part</th>
                          <th className={cn("text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wide w-10", AI_TEXT)}>Qty</th>
                          <th className={cn("text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wide w-16", AI_TEXT)}>Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--ds-info-border)]">
                        {parts.map((p) => (
                          <tr key={p.partNumber} className="bg-white/50">
                            <td className="px-3 py-2">
                              <p className={cn("font-medium text-xs", AI_TEXT)}>{p.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{p.partNumber}</p>
                              <p className={cn("text-[10px] opacity-65 italic", AI_TEXT)}>{p.reason}</p>
                            </td>
                            <td className={cn("px-3 py-2 text-right text-xs", AI_TEXT)}>{p.qty}</td>
                            <td className={cn("px-3 py-2 text-right text-xs font-semibold", AI_TEXT)}>{fmtCurrency(p.qty * p.unitCost)}</td>
                          </tr>
                        ))}
                        <tr className="bg-[color:var(--ds-info-bg)]">
                          <td colSpan={2} className={cn("px-3 py-2 text-xs font-bold text-right", AI_TEXT)}>Estimated parts total</td>
                          <td className={cn("px-3 py-2 text-right text-xs font-bold", AI_TEXT)}>{fmtCurrency(partsTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={() => runTool("parts")}
                    className={cn("inline-flex items-center gap-1 text-[10px] font-medium rounded-md px-2 py-1 border border-[color:var(--ds-info-border)] bg-white/60", AI_TEXT, "hover:bg-white transition-colors")}
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                </>
              )}
            </>
          )}

          {/* Estimate Labor */}
          {activeTool === "labor" && (
            <>
              {loading === "labor" ? (
                <div className="space-y-2">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="h-8 rounded bg-[color:var(--ds-info-border)] animate-pulse w-full" />
                  ))}
                </div>
              ) : labor && (
                <>
                  <div className="rounded-lg border border-[color:var(--ds-info-border)] overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-[color:var(--ds-info-bg)]">
                        <tr>
                          <th className={cn("text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wide", AI_TEXT)}>Task</th>
                          <th className={cn("text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wide w-12", AI_TEXT)}>Hrs</th>
                          <th className={cn("text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wide w-16", AI_TEXT)}>Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--ds-info-border)]">
                        {labor.map((l, i) => (
                          <tr key={i} className="bg-white/50">
                            <td className={cn("px-3 py-2 text-xs", AI_TEXT)}>{l.task}</td>
                            <td className={cn("px-3 py-2 text-right text-xs", AI_TEXT)}>{l.hours}</td>
                            <td className={cn("px-3 py-2 text-right text-xs font-semibold", AI_TEXT)}>{fmtCurrency(l.hours * l.rate)}</td>
                          </tr>
                        ))}
                        <tr className="bg-[color:var(--ds-info-bg)]">
                          <td className={cn("px-3 py-2 text-xs font-bold", AI_TEXT)}>
                            Total — {labor.reduce((s, l) => s + l.hours, 0)} hrs @ {fmtCurrency(labor[0]?.rate ?? 125)}/hr
                          </td>
                          <td className={cn("px-3 py-2 text-right text-xs font-bold", AI_TEXT)}>{labor.reduce((s, l) => s + l.hours, 0)}</td>
                          <td className={cn("px-3 py-2 text-right text-xs font-bold", AI_TEXT)}>{fmtCurrency(laborTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className={cn("text-[10px] opacity-60", AI_TEXT)}>Estimates based on job type, equipment model, and historical work order data for this customer.</p>
                  <button
                    type="button"
                    onClick={() => runTool("labor")}
                    className={cn("inline-flex items-center gap-1 text-[10px] font-medium rounded-md px-2 py-1 border border-[color:var(--ds-info-border)] bg-white/60", AI_TEXT, "hover:bg-white transition-colors")}
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                </>
              )}
            </>
          )}

          {/* Summarize Job */}
          {activeTool === "summary" && (
            <>
              {loading === "summary" ? (
                <div className="space-y-2">
                  <div className="h-3 rounded bg-[color:var(--ds-info-border)] animate-pulse w-full" />
                  <div className="h-3 rounded bg-[color:var(--ds-info-border)] animate-pulse w-5/6" />
                  <div className="h-3 rounded bg-[color:var(--ds-info-border)] animate-pulse w-4/6" />
                  <div className="h-3 rounded bg-[color:var(--ds-info-border)] animate-pulse w-full mt-2" />
                  <div className="h-3 rounded bg-[color:var(--ds-info-border)] animate-pulse w-3/4" />
                </div>
              ) : summary && (
                <>
                  <div className="rounded-lg border border-[color:var(--ds-info-border)] bg-white/60 p-3">
                    <p className={cn("text-xs leading-relaxed whitespace-pre-line", AI_TEXT)}>{summary}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => runTool("summary")}
                      className={cn("inline-flex items-center gap-1 text-[10px] font-medium rounded-md px-2 py-1 border border-[color:var(--ds-info-border)] bg-white/60", AI_TEXT, "hover:bg-white transition-colors")}
                    >
                      <RefreshCw className="w-3 h-3" /> Regenerate
                    </button>
                    <button
                      type="button"
                      disabled={summaryApplied}
                      onClick={() => { onApplySummary(summary); setSummaryApplied(true) }}
                      className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-semibold rounded-md px-2 py-1 border transition-colors",
                        summaryApplied
                          ? "border-[color:var(--status-success)]/30 bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] cursor-default"
                          : cn("bg-[color:var(--ds-info-subtle)] text-white border-transparent hover:opacity-90"),
                      )}
                    >
                      {summaryApplied
                        ? <><CheckCircle2 className="w-3 h-3" /> Applied to Notes</>
                        : <><Check className="w-3 h-3" /> Apply to Notes</>
                      }
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Voice note uploader */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Mic className={cn("w-3.5 h-3.5", AI_SUBTLE)} aria-hidden="true" />
          <span className={cn("text-xs font-semibold", AI_TEXT)}>Voice Note to Service Notes</span>
          <span className={cn("text-[10px] opacity-60", AI_TEXT)}>Upload audio — AI transcribes to notes</span>
        </div>

        {loading === "voice" ? (
          <div className="rounded-lg border border-[color:var(--ds-info-border)] bg-white/40 p-4 text-center space-y-2">
            <RefreshCw className={cn("w-5 h-5 mx-auto animate-spin", AI_SUBTLE)} />
            <p className={cn("text-xs font-medium", AI_TEXT)}>Transcribing {voiceFileName}…</p>
            <p className={cn("text-[10px] opacity-60", AI_TEXT)}>Converting speech to service notes</p>
          </div>
        ) : voiceText ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-[color:var(--ds-info-border)] bg-white/60 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Mic className={cn("w-3 h-3", AI_SUBTLE)} aria-hidden="true" />
                <span className={cn("text-[10px] font-semibold", AI_TEXT)}>Transcribed from {voiceFileName}</span>
              </div>
              <p className={cn("text-xs leading-relaxed whitespace-pre-line", AI_TEXT)}>{voiceText}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => { setVoiceText(null); setVoiceFileName(null) }}
                className={cn("inline-flex items-center gap-1 text-[10px] font-medium rounded-md px-2 py-1 border border-[color:var(--ds-info-border)] bg-white/60", AI_TEXT, "hover:bg-white transition-colors")}
              >
                <X className="w-3 h-3" /> Clear
              </button>
              <button
                type="button"
                onClick={() => { onApplyNotes(voiceText); setVoiceText(null); setVoiceFileName(null) }}
                className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-md px-2 py-1 border bg-[color:var(--ds-info-subtle)] text-white border-transparent hover:opacity-90 transition-colors"
              >
                <Check className="w-3 h-3" /> Apply to Repair Log
              </button>
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload voice note"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setVoiceDragging(true) }}
            onDragLeave={() => setVoiceDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors",
              voiceDragging
                ? "border-[color:var(--ds-info-subtle)] bg-[color:var(--ds-info-bg)]"
                : "border-[color:var(--ds-info-border)] bg-white/40 hover:bg-white/60 hover:border-[color:var(--ds-info-subtle)]",
            )}
          >
            <Upload className={cn("w-4 h-4 mx-auto mb-1.5", AI_SUBTLE)} aria-hidden="true" />
            <p className={cn("text-xs font-medium", AI_TEXT)}>Drop audio file or click to upload</p>
            <p className={cn("text-[10px] opacity-60 mt-0.5", AI_TEXT)}>MP3, M4A, WAV, OGG supported</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVoiceFile(f) }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorkOrderDrawerProps {
  workOrderId: string | null
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkOrderDrawer({ workOrderId, onClose }: WorkOrderDrawerProps) {
  const { workOrders, updateWorkOrder, updateRepairLog } = useWorkOrders()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<WorkOrder>>({})
  const [draftNotes, setDraftNotes] = useState("")
  const [draftDiagnosis, setDraftDiagnosis] = useState("")

  const wo = workOrderId ? workOrders.find((w) => w.id === workOrderId) ?? null : null

  useEffect(() => {
    setEditing(false)
    setDraft({})
  }, [workOrderId])

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function startEdit() {
    if (!wo) return
    setDraft({
      technicianName: wo.technicianName,
      priority: wo.priority,
      status: wo.status,
      scheduledDate: wo.scheduledDate ?? "",
      scheduledTime: wo.scheduledTime ?? "",
    })
    setDraftNotes(wo.repairLog.technicianNotes ?? "")
    setDraftDiagnosis(wo.repairLog.diagnosis ?? "")
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
  }

  function saveEdit() {
    if (!wo) return
    updateWorkOrder(wo.id, draft)
    updateRepairLog(wo.id, {
      technicianNotes: draftNotes,
      diagnosis: draftDiagnosis,
    })
    setEditing(false)
    setDraft({})
    toast("Work order updated successfully")
  }

  function setField<K extends keyof WorkOrder>(field: K, value: WorkOrder[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  // Apply AI-generated notes into the repair log draft (opens edit mode automatically)
  function applyAINotes(notes: string) {
    if (!wo) return
    if (!editing) {
      setDraft({
        technicianName: wo.technicianName,
        priority: wo.priority,
        status: wo.status,
        scheduledDate: wo.scheduledDate ?? "",
        scheduledTime: wo.scheduledTime ?? "",
      })
      setDraftDiagnosis(wo.repairLog.diagnosis ?? "")
      setEditing(true)
    }
    setDraftNotes(notes)
    toast("AI notes applied — review and save when ready")
  }

  function applyAISummary(summary: string) {
    if (!wo) return
    if (!editing) {
      setDraft({
        technicianName: wo.technicianName,
        priority: wo.priority,
        status: wo.status,
        scheduledDate: wo.scheduledDate ?? "",
        scheduledTime: wo.scheduledTime ?? "",
      })
      setDraftDiagnosis(wo.repairLog.diagnosis ?? "")
      setEditing(true)
    }
    setDraftNotes((prev) => prev ? `${prev}\n\n${summary}` : summary)
    toast("AI job summary applied — review and save when ready")
  }

  if (!wo) return null

  const currentStatus = (draft.status ?? wo.status) as WorkOrderStatus
  const currentPriority = (draft.priority ?? wo.priority) as WorkOrderPriority

  const timelineItems = [
    { date: fmtDate(wo.createdAt.slice(0, 10)), label: "Work order created", description: `Created by ${wo.createdBy}`, accent: "muted" as const },
    ...(wo.scheduledDate ? [{ date: fmtDate(wo.scheduledDate), label: `Scheduled${wo.scheduledTime ? ` at ${wo.scheduledTime}` : ""}`, description: `Assigned to ${wo.technicianName}`, accent: "muted" as const }] : []),
    ...(wo.completedDate ? [{ date: fmtDate(wo.completedDate), label: "Completed", description: wo.repairLog.technicianNotes || "Service completed", accent: "success" as const }] : []),
    ...(wo.invoiceNumber ? [{ date: "—", label: `Invoiced — ${wo.invoiceNumber}`, accent: "success" as const }] : []),
  ]

  return (
    <>
      <DetailDrawer
        open={!!workOrderId}
        onClose={onClose}
        title={wo.id}
        subtitle={`${wo.type} · ${wo.customerName}`}
        width="lg"
        badge={
          <Badge variant="secondary" className={cn("text-xs border", STATUS_STYLE[currentStatus])}>
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
              {wo.status !== "Completed" && wo.status !== "Invoiced" && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Work order marked complete")}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Complete
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Invoice created")}>
                <FileText className="w-3.5 h-3.5" /> Create Invoice
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Work order PDF downloaded")}>
                <Printer className="w-3.5 h-3.5" /> Print
              </Button>
            </>
          )
        }
      >
        {/* Priority banner */}
        {currentPriority === "Critical" && !editing && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Critical priority — immediate attention required
          </div>
        )}

        {/* Details */}
        <DrawerSection title="Work Order Details">
          <DrawerRow label="Customer" value={
            <Link href={`/customers?open=${wo.customerId}`} className="text-primary hover:underline cursor-pointer font-medium">
              {wo.customerName}
            </Link>
          } />
          <DrawerRow label="Equipment" value={
            <Link href={`/equipment?open=${wo.equipmentId}`} className="text-primary hover:underline cursor-pointer font-medium">
              {wo.equipmentName}
            </Link>
          } />
          <DrawerRow label="Location" value={wo.location} />
          {wo.location && (
            <div className="py-1">
              <ContactActions
                address={wo.location}
                email={{ customerName: wo.customerName }}
              />
            </div>
          )}
          <DrawerRow label="Type" value={wo.type} />
          <EditRow label="Priority" view={<span className={PRIORITY_COLOR[wo.priority]}>{wo.priority}</span>} editing={editing}>
            <EditSelect value={draft.priority ?? wo.priority} onChange={(v) => setField("priority", v as WorkOrderPriority)} options={ALL_PRIORITIES} />
          </EditRow>
          <EditRow label="Status" view={
            <Badge variant="secondary" className={cn("text-[10px] border", STATUS_STYLE[wo.status])}>{wo.status}</Badge>
          } editing={editing}>
            <EditSelect value={draft.status ?? wo.status} onChange={(v) => setField("status", v as WorkOrderStatus)} options={ALL_STATUSES} />
          </EditRow>
          <EditRow label="Technician" view={
            <Link href={`/technicians?open=${wo.technicianId}`} className="text-primary hover:underline cursor-pointer font-medium">
              {wo.technicianName}
            </Link>
          } editing={editing}>
            <EditInput value={draft.technicianName ?? ""} onChange={(v) => setField("technicianName", v)} placeholder="Technician name" />
          </EditRow>
          <EditRow
            label="Scheduled"
            view={wo.scheduledDate ? `${fmtDate(wo.scheduledDate)}${wo.scheduledTime ? ` at ${wo.scheduledTime}` : ""}` : "—"}
            editing={editing}
          >
            <div className="flex gap-2">
              <EditInput type="date" value={draft.scheduledDate ?? ""} onChange={(v) => setField("scheduledDate", v)} />
              <EditInput type="time" value={draft.scheduledTime ?? ""} onChange={(v) => setField("scheduledTime", v)} />
            </div>
          </EditRow>
          {wo.completedDate && <DrawerRow label="Completed" value={fmtDate(wo.completedDate)} />}
          {wo.invoiceNumber && (
            <DrawerRow label="Invoice" value={
              <Link href={`/invoices?open=${wo.invoiceNumber}`} className="text-primary font-mono hover:underline cursor-pointer">
                {wo.invoiceNumber}
              </Link>
            } />
          )}
        </DrawerSection>

        {/* Description */}
        <DrawerSection title="Description">
          <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
            {wo.description}
          </p>
        </DrawerSection>

        {/* AI Tools — shown when not editing */}
        {!editing && (
          <AIToolsPanel
            wo={wo}
            onApplyNotes={applyAINotes}
            onApplySummary={applyAISummary}
          />
        )}

        {/* Repair log / notes */}
        <DrawerSection title="Repair Log">
          {wo.repairLog.problemReported && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Problem Reported</p>
              <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
                {wo.repairLog.problemReported}
              </p>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Diagnosis</p>
            {editing ? (
              <EditTextarea value={draftDiagnosis} onChange={setDraftDiagnosis} placeholder="Enter diagnosis..." />
            ) : wo.repairLog.diagnosis ? (
              <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">{wo.repairLog.diagnosis}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic">No diagnosis recorded.</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Technician Notes</p>
            {editing ? (
              <EditTextarea value={draftNotes} onChange={setDraftNotes} placeholder="Add technician notes..." rows={5} />
            ) : (draftNotes || wo.repairLog.technicianNotes) ? (
              <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
                {draftNotes || wo.repairLog.technicianNotes}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">No notes recorded.</p>
            )}
          </div>
        </DrawerSection>

        {/* Parts */}
        {wo.repairLog.partsUsed.length > 0 && (
          <DrawerSection title="Parts Used">
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Part</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-12">Qty</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {wo.repairLog.partsUsed.map((p) => (
                    <tr key={p.id} className="bg-card">
                      <td className="px-3 py-2">
                        <p className="text-foreground font-medium">{p.name}</p>
                        <p className="text-muted-foreground text-[10px]">{p.partNumber}</p>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{p.quantity}</td>
                      <td className="px-3 py-2 text-right font-medium text-foreground">{fmtCurrency(p.quantity * p.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DrawerSection>
        )}

        {/* Cost summary */}
        <DrawerSection title="Cost Summary">
          <DrawerRow label="Labor Hours" value={wo.repairLog.laborHours > 0 ? `${wo.repairLog.laborHours} hrs` : "—"} />
          <DrawerRow label="Labor Cost" value={wo.totalLaborCost > 0 ? fmtCurrency(wo.totalLaborCost) : "—"} />
          <DrawerRow label="Parts Cost" value={wo.totalPartsCost > 0 ? fmtCurrency(wo.totalPartsCost) : "—"} />
          <DrawerRow label="Total" value={<span className="font-bold text-foreground">{fmtCurrency(wo.totalLaborCost + wo.totalPartsCost)}</span>} />
        </DrawerSection>

        {/* Signature */}
        {wo.repairLog.signedBy && (
          <DrawerSection title="Signature">
            <DrawerRow label="Signed By" value={wo.repairLog.signedBy} />
            {wo.repairLog.signedAt && <DrawerRow label="Signed At" value={new Date(wo.repairLog.signedAt).toLocaleString()} />}
          </DrawerSection>
        )}

        {/* Timeline */}
        <DrawerSection title="Timeline">
          <DrawerTimeline items={timelineItems} />
        </DrawerSection>
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
