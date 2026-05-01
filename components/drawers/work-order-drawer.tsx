"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import type {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderType,
  RepairLog,
} from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import {
  CheckCircle2, FileText, Printer, Pencil, X, Check,
  AlertTriangle, Sparkles, Mic, Upload, RefreshCw,
  Wrench, ClipboardList, Clock, DollarSign,   ChevronDown, ChevronUp, ExternalLink, AlertOctagon,
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
const ALL_TYPES: WorkOrderType[] = ["Repair", "PM", "Inspection", "Install", "Emergency"]

function uiStatusToDb(s: WorkOrderStatus): string {
  const m: Record<WorkOrderStatus, string> = {
    Open: "open",
    Scheduled: "scheduled",
    "In Progress": "in_progress",
    Completed: "completed",
    Invoiced: "invoiced",
  }
  return m[s]
}

function uiPriorityToDb(p: WorkOrderPriority): string {
  const m: Record<WorkOrderPriority, string> = {
    Low: "low",
    Normal: "normal",
    High: "high",
    Critical: "critical",
  }
  return m[p]
}

function uiTypeToDb(t: WorkOrderType): string {
  const m: Record<WorkOrderType, string> = {
    Repair: "repair",
    PM: "pm",
    Inspection: "inspection",
    Install: "install",
    Emergency: "emergency",
  }
  return m[t]
}

function mapDbStatus(status: string): WorkOrderStatus {
  switch (status) {
    case "open":
      return "Open"
    case "scheduled":
      return "Scheduled"
    case "in_progress":
      return "In Progress"
    case "completed":
      return "Completed"
    case "invoiced":
      return "Invoiced"
    default:
      return "Open"
  }
}

function mapDbPriority(priority: string): WorkOrderPriority {
  switch (priority) {
    case "low":
      return "Low"
    case "normal":
      return "Normal"
    case "high":
      return "High"
    case "critical":
      return "Critical"
    default:
      return "Normal"
  }
}

function mapDbType(type: string): WorkOrderType {
  switch (type) {
    case "repair":
      return "Repair"
    case "pm":
      return "PM"
    case "inspection":
      return "Inspection"
    case "install":
      return "Install"
    case "emergency":
      return "Emergency"
    default:
      return "Repair"
  }
}

function normalizeTimeForDb(time: string): string | null {
  if (!time || !time.trim()) return null
  const t = time.trim()
  if (t.length === 5 && t.includes(":")) return `${t}:00`
  return t
}

function formatScheduledTime(isoOrTime: string | null): string {
  if (!isoOrTime) return ""
  const t = isoOrTime.includes("T") ? isoOrTime.slice(11, 16) : isoOrTime.slice(0, 5)
  return t || ""
}

function parseRepairLog(raw: unknown): RepairLog {
  const empty: RepairLog = {
    problemReported: "",
    diagnosis: "",
    partsUsed: [],
    laborHours: 0,
    technicianNotes: "",
    photos: [],
    signatureDataUrl: "",
    signedBy: "",
    signedAt: "",
  }
  if (!raw || typeof raw !== "object") return empty
  const o = raw as Record<string, unknown>
  return {
    problemReported: typeof o.problemReported === "string" ? o.problemReported : "",
    diagnosis: typeof o.diagnosis === "string" ? o.diagnosis : "",
    partsUsed: Array.isArray(o.partsUsed) ? (o.partsUsed as RepairLog["partsUsed"]) : [],
    laborHours: typeof o.laborHours === "number" ? o.laborHours : 0,
    technicianNotes: typeof o.technicianNotes === "string" ? o.technicianNotes : "",
    photos: Array.isArray(o.photos) ? (o.photos as string[]) : [],
    signatureDataUrl: typeof o.signatureDataUrl === "string" ? o.signatureDataUrl : "",
    signedBy: typeof o.signedBy === "string" ? o.signedBy : "",
    signedAt: typeof o.signedAt === "string" ? o.signedAt : "",
  }
}

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
  onUpdated?: () => void
}

type DbWorkOrderRow = {
  id: string
  organization_id: string
  customer_id: string
  equipment_id: string
  title: string
  status: string
  priority: string
  type: string
  scheduled_on: string | null
  scheduled_time: string | null
  completed_at: string | null
  assigned_user_id: string | null
  created_at: string
  invoice_number: string | null
  total_labor_cents: number
  total_parts_cents: number
  notes: string | null
  repair_log: unknown
}

type TechnicianOption = { id: string; label: string }

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkOrderDrawer({ workOrderId, onClose, onUpdated }: WorkOrderDrawerProps) {
  const [wo, setWo] = useState<WorkOrder | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [dbNotes, setDbNotes] = useState("")
  const [technicianOptions, setTechnicianOptions] = useState<TechnicianOption[]>([])
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<WorkOrder>>({})
  const [draftNotesDb, setDraftNotesDb] = useState("")
  const [draftDiagnosis, setDraftDiagnosis] = useState("")
  const [draftNotes, setDraftNotes] = useState("")
  const [draftLaborDollars, setDraftLaborDollars] = useState("")
  const [draftPartsDollars, setDraftPartsDollars] = useState("")

  const loadWorkOrder = useCallback(async () => {
    if (!workOrderId) {
      setWo(null)
      setOrganizationId(null)
      return
    }

    setLoading(true)
    const supabase = createBrowserSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setWo(null)
      setOrganizationId(null)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("default_organization_id")
      .eq("id", user.id)
      .single()

    const orgId = profile?.default_organization_id ?? null
    setOrganizationId(orgId)
    if (!orgId) {
      setWo(null)
      setLoading(false)
      return
    }

    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .in("role", ["owner", "admin", "manager", "tech"])

    const userIds = [...new Set((members ?? []).map((m: { user_id: string }) => m.user_id))]
    let techOpts: TechnicianOption[] = []
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
      techOpts =
        ((profs as Array<{ id: string; full_name: string | null; email: string | null }> | null) ?? []).map(
          (p) => ({
            id: p.id,
            label:
              (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || p.id.slice(0, 8),
          })
        )
      techOpts.sort((a, b) => a.label.localeCompare(b.label))
    }
    setTechnicianOptions(techOpts)

    const { data: row, error } = await supabase
      .from("work_orders")
      .select(
        "id, organization_id, customer_id, equipment_id, title, status, priority, type, scheduled_on, scheduled_time, completed_at, assigned_user_id, created_at, invoice_number, total_labor_cents, total_parts_cents, notes, repair_log"
      )
      .eq("id", workOrderId)
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .maybeSingle()

    if (error || !row) {
      setWo(null)
      setLoading(false)
      return
    }

    const w = row as DbWorkOrderRow

    const [{ data: cust }, { data: eq }, { data: assigneeProf }] = await Promise.all([
      supabase
        .from("customers")
        .select("company_name")
        .eq("id", w.customer_id)
        .eq("organization_id", orgId)
        .maybeSingle(),
      supabase
        .from("equipment")
        .select("name, location_label")
        .eq("id", w.equipment_id)
        .eq("organization_id", orgId)
        .maybeSingle(),
      w.assigned_user_id
        ? supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", w.assigned_user_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const customerName = (cust as { company_name: string } | null)?.company_name ?? "Unknown Customer"
    const eqRow = eq as { name: string; location_label: string | null } | null
    const equipmentName = eqRow?.name ?? "Equipment"
    const location = eqRow?.location_label ?? ""
    const ap = assigneeProf as { full_name: string | null; email: string | null } | null
    const techName = w.assigned_user_id
      ? (ap?.full_name && ap.full_name.trim()) || (ap?.email && ap.email.trim()) || "Unknown"
      : "Unassigned"
    const techId = w.assigned_user_id ?? "unassigned"

    const mapped: WorkOrder = {
      id: w.id,
      customerId: w.customer_id,
      customerName,
      equipmentId: w.equipment_id,
      equipmentName,
      location,
      type: mapDbType(w.type),
      status: mapDbStatus(w.status),
      priority: mapDbPriority(w.priority),
      technicianId: techId,
      technicianName: techName,
      scheduledDate: w.scheduled_on ?? "",
      scheduledTime: formatScheduledTime(w.scheduled_time),
      completedDate: w.completed_at ? w.completed_at.slice(0, 10) : "",
      createdAt: w.created_at,
      createdBy: "",
      description: w.title,
      repairLog: parseRepairLog(w.repair_log),
      totalLaborCost: w.total_labor_cents / 100,
      totalPartsCost: w.total_parts_cents / 100,
      invoiceNumber: w.invoice_number ?? "",
    }

    setDbNotes(w.notes ?? "")
    setWo(mapped)
    setLoading(false)
  }, [workOrderId])

  useEffect(() => {
    setEditing(false)
    setDraft({})
    setDraftNotesDb("")
    setDraftDiagnosis("")
    setDraftNotes("")
    setDraftLaborDollars("")
    setDraftPartsDollars("")
    void loadWorkOrder()
  }, [workOrderId, loadWorkOrder])

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  function startEdit() {
    if (!wo) return
    setDraft({
      description: wo.description,
      type: wo.type,
      technicianId: wo.technicianId,
      technicianName: wo.technicianName,
      priority: wo.priority,
      status: wo.status,
      scheduledDate: wo.scheduledDate ?? "",
      scheduledTime: wo.scheduledTime ?? "",
    })
    setDraftNotesDb(dbNotes)
    setDraftNotes(wo.repairLog.technicianNotes ?? "")
    setDraftDiagnosis(wo.repairLog.diagnosis ?? "")
    setDraftLaborDollars(String(wo.totalLaborCost ?? 0))
    setDraftPartsDollars(String(wo.totalPartsCost ?? 0))
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
    setDraftNotesDb(dbNotes)
    if (wo) {
      setDraftNotes(wo.repairLog.technicianNotes ?? "")
      setDraftDiagnosis(wo.repairLog.diagnosis ?? "")
    }
  }

  async function saveEdit() {
    if (!wo || !organizationId) return
    const supabase = createBrowserSupabaseClient()

    const laborCents = Math.max(0, Math.round(parseFloat(draftLaborDollars || "0") * 100))
    const partsCents = Math.max(0, Math.round(parseFloat(draftPartsDollars || "0") * 100))

    const tid = (draft.technicianId ?? wo.technicianId) === "unassigned" ? null : (draft.technicianId ?? wo.technicianId)

    const updatePayload = {
      title: (draft.description ?? wo.description).trim(),
      status: uiStatusToDb((draft.status ?? wo.status) as WorkOrderStatus),
      priority: uiPriorityToDb((draft.priority ?? wo.priority) as WorkOrderPriority),
      type: uiTypeToDb((draft.type ?? wo.type) as WorkOrderType),
      scheduled_on: (draft.scheduledDate ?? wo.scheduledDate) || null,
      scheduled_time: normalizeTimeForDb(draft.scheduledTime ?? wo.scheduledTime ?? ""),
      assigned_user_id: tid,
      notes: draftNotesDb.trim() || null,
      total_labor_cents: laborCents,
      total_parts_cents: partsCents,
      repair_log: {
        ...wo.repairLog,
        diagnosis: draftDiagnosis,
        technicianNotes: draftNotes,
      },
    }

    const { error } = await supabase
      .from("work_orders")
      .update(updatePayload)
      .eq("id", wo.id)
      .eq("organization_id", organizationId)

    if (error) {
      toast(`Update failed: ${error.message}`)
      return
    }

    setEditing(false)
    setDraft({})
    toast("Work order updated successfully")
    await loadWorkOrder()
    onUpdated?.()
  }

  async function markComplete() {
    if (!wo || !organizationId) return
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase
      .from("work_orders")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", wo.id)
      .eq("organization_id", organizationId)

    if (error) {
      toast(`Update failed: ${error.message}`)
      return
    }
    toast("Work order marked complete")
    await loadWorkOrder()
    onUpdated?.()
  }

  async function archiveWorkOrder() {
    if (!wo || !organizationId) return
    if (!window.confirm("Archive this work order?")) return
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase
      .from("work_orders")
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
      })
      .eq("id", wo.id)
      .eq("organization_id", organizationId)

    if (error) {
      toast(`Archive failed: ${error.message}`)
      return
    }
    toast("Work order archived")
    onUpdated?.()
    onClose()
  }

  function setField<K extends keyof WorkOrder>(field: K, value: WorkOrder[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  function applyAINotes(notes: string) {
    if (!wo) return
    if (!editing) {
      setDraft({
        description: wo.description,
        type: wo.type,
        technicianId: wo.technicianId,
        technicianName: wo.technicianName,
        priority: wo.priority,
        status: wo.status,
        scheduledDate: wo.scheduledDate ?? "",
        scheduledTime: wo.scheduledTime ?? "",
      })
      setDraftNotesDb(dbNotes ? `${dbNotes}\n\n${notes}` : notes)
      setDraftNotes(wo.repairLog.technicianNotes ?? "")
      setDraftDiagnosis(wo.repairLog.diagnosis ?? "")
      setDraftLaborDollars(String(wo.totalLaborCost ?? 0))
      setDraftPartsDollars(String(wo.totalPartsCost ?? 0))
      setEditing(true)
    } else {
      setDraftNotesDb((prev) => (prev ? `${prev}\n\n${notes}` : notes))
    }
    toast("AI notes applied — review and save when ready")
  }

  function applyAISummary(summary: string) {
    if (!wo) return
    if (!editing) {
      setDraft({
        description: wo.description,
        type: wo.type,
        technicianId: wo.technicianId,
        technicianName: wo.technicianName,
        priority: wo.priority,
        status: wo.status,
        scheduledDate: wo.scheduledDate ?? "",
        scheduledTime: wo.scheduledTime ?? "",
      })
      setDraftNotesDb(dbNotes ? `${dbNotes}\n\n${summary}` : summary)
      setDraftNotes(wo.repairLog.technicianNotes ?? "")
      setDraftDiagnosis(wo.repairLog.diagnosis ?? "")
      setDraftLaborDollars(String(wo.totalLaborCost ?? 0))
      setDraftPartsDollars(String(wo.totalPartsCost ?? 0))
      setEditing(true)
    } else {
      setDraftNotesDb((prev) => (prev ? `${prev}\n\n${summary}` : summary))
    }
    toast("AI job summary applied — review and save when ready")
  }

  if (!workOrderId) return null

  if (!wo) {
    return (
      <DetailDrawer
        open={!!workOrderId}
        onClose={onClose}
        title={loading ? "Loading work order…" : "Work order not found"}
        subtitle={loading ? "Fetching details" : "It may be archived or unavailable"}
        width="lg"
        transitionMs={400}
      >
        <div className="px-5 py-6 text-sm text-muted-foreground">
          {loading ? "Loading…" : "Unable to load this work order."}
        </div>
      </DetailDrawer>
    )
  }

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
        transitionMs={400}
        badge={
          <Badge variant="secondary" className={cn("text-xs border", STATUS_STYLE[currentStatus])}>
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
              {wo.status !== "Completed" && wo.status !== "Invoiced" && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => void markComplete()}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Complete
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Invoice created")}>
                <FileText className="w-3.5 h-3.5" /> Create Invoice
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs cursor-pointer" onClick={() => toast("Work order PDF downloaded")}>
                <Printer className="w-3.5 h-3.5" /> Print
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs cursor-pointer border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => void archiveWorkOrder()}
              >
                <AlertOctagon className="w-3.5 h-3.5" /> Archive
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
          <EditRow label="Type" view={wo.type} editing={editing}>
            <EditSelect
              value={(draft.type ?? wo.type) as string}
              onChange={(v) => setField("type", v as WorkOrderType)}
              options={ALL_TYPES}
            />
          </EditRow>
          <EditRow label="Priority" view={<span className={PRIORITY_COLOR[wo.priority]}>{wo.priority}</span>} editing={editing}>
            <EditSelect value={draft.priority ?? wo.priority} onChange={(v) => setField("priority", v as WorkOrderPriority)} options={ALL_PRIORITIES} />
          </EditRow>
          <EditRow label="Status" view={
            <Badge variant="secondary" className={cn("text-[10px] border", STATUS_STYLE[wo.status])}>{wo.status}</Badge>
          } editing={editing}>
            <EditSelect value={draft.status ?? wo.status} onChange={(v) => setField("status", v as WorkOrderStatus)} options={ALL_STATUSES} />
          </EditRow>
          <EditRow
            label="Technician"
            view={
              wo.technicianId !== "unassigned" ? (
                <Link href={`/technicians?open=${wo.technicianId}`} className="text-primary hover:underline cursor-pointer font-medium">
                  {wo.technicianName}
                </Link>
              ) : (
                <span className="text-muted-foreground">{wo.technicianName}</span>
              )
            }
            editing={editing}
          >
            <select
              value={draft.technicianId ?? wo.technicianId ?? "unassigned"}
              onChange={(e) => setField("technicianId", e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
            >
              <option value="unassigned">Unassigned</option>
              {technicianOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
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

        {/* Title & notes (DB) */}
        <DrawerSection title="Description">
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Title</p>
                <EditInput
                  value={draft.description ?? wo.description}
                  onChange={(v) => setField("description", v)}
                  placeholder="Work order title"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                <EditTextarea
                  value={draftNotesDb}
                  onChange={setDraftNotesDb}
                  placeholder="Internal notes…"
                  rows={4}
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
                {wo.description}
              </p>
              {dbNotes && (
                <div className="space-y-1 mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border whitespace-pre-wrap">
                    {dbNotes}
                  </p>
                </div>
              )}
            </>
          )}
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
          {editing ? (
            <>
              <EditRow label="Labor Cost" view={fmtCurrency(wo.totalLaborCost)} editing={editing}>
                <EditInput
                  type="number"
                  min={0}
                  step={0.01}
                  value={draftLaborDollars}
                  onChange={setDraftLaborDollars}
                  placeholder="0"
                />
              </EditRow>
              <EditRow label="Parts Cost" view={fmtCurrency(wo.totalPartsCost)} editing={editing}>
                <EditInput
                  type="number"
                  min={0}
                  step={0.01}
                  value={draftPartsDollars}
                  onChange={setDraftPartsDollars}
                  placeholder="0"
                />
              </EditRow>
            </>
          ) : (
            <>
              <DrawerRow label="Labor Cost" value={wo.totalLaborCost > 0 ? fmtCurrency(wo.totalLaborCost) : "—"} />
              <DrawerRow label="Parts Cost" value={wo.totalPartsCost > 0 ? fmtCurrency(wo.totalPartsCost) : "—"} />
            </>
          )}
          <DrawerRow
            label="Total"
            value={
              <span className="font-bold text-foreground">
                {fmtCurrency(
                  (editing
                    ? parseFloat(draftLaborDollars || "0") + parseFloat(draftPartsDollars || "0")
                    : wo.totalLaborCost + wo.totalPartsCost)
                )}
              </span>
            }
          />
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
