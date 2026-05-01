"use client"

import { useState } from "react"
import { Mail, Clock, Send, Eye, Edit3, Check, ChevronDown, ChevronUp, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayTiming {
  days: number
  direction: "before" | "after"
  time: string
}

interface CadenceSection {
  id: string
  title: string
  description: string
  enabled: boolean
  timings: DayTiming[]
  template: string
  sendDay?: string
  sendTime?: string
  weekly?: boolean
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const INITIAL_SECTIONS: CadenceSection[] = [
  {
    id: "appointment-confirmation",
    title: "Appointment Confirmations",
    description: "Send a confirmation email when a service appointment or work order is scheduled.",
    enabled: true,
    timings: [{ days: 0, direction: "before", time: "09:00" }],
    template: "appointment-confirmation",
  },
  {
    id: "weekly-reminders",
    title: "Weekly Upcoming Service Reminders",
    description: "A digest sent each week listing all upcoming service appointments for the following week.",
    enabled: true,
    timings: [],
    template: "weekly-service-digest",
    weekly: true,
    sendDay: "Thursday",
    sendTime: "09:00",
  },
  {
    id: "maintenance-due",
    title: "Maintenance Due Reminders",
    description: "Notify customers when scheduled maintenance is approaching based on configured lead times.",
    enabled: true,
    timings: [
      { days: 30, direction: "before", time: "09:00" },
      { days: 14, direction: "before", time: "09:00" },
      { days: 7,  direction: "before", time: "09:00" },
      { days: 1,  direction: "before", time: "09:00" },
    ],
    template: "maintenance-reminder",
  },
  {
    id: "quote-followup",
    title: "Quote Follow-Up",
    description: "Automatically follow up on open quotes that have not been accepted.",
    enabled: true,
    timings: [
      { days: 3,  direction: "after", time: "10:00" },
      { days: 7,  direction: "after", time: "10:00" },
      { days: 14, direction: "after", time: "10:00" },
    ],
    template: "quote-followup",
  },
  {
    id: "invoice-followup",
    title: "Invoice Follow-Up",
    description: "Send reminders for unpaid invoices before and after the due date.",
    enabled: true,
    timings: [
      { days: 3, direction: "before", time: "09:00" },
      { days: 3, direction: "after",  time: "09:00" },
      { days: 7, direction: "after",  time: "09:00" },
    ],
    template: "invoice-followup",
  },
]

const TEMPLATES = [
  { id: "appointment-confirmation", label: "Appointment Confirmation" },
  { id: "weekly-service-digest",    label: "Weekly Service Digest" },
  { id: "maintenance-reminder",     label: "Maintenance Reminder" },
  { id: "quote-followup",           label: "Quote Follow-Up" },
  { id: "invoice-followup",         label: "Invoice Follow-Up" },
]

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const TIMES = [
  "06:00","07:00","08:00","09:00","10:00","11:00",
  "12:00","13:00","14:00","15:00","16:00","17:00","18:00",
]

const DAY_OPTIONS_BEFORE = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60]
const DAY_OPTIONS_AFTER  = [1, 2, 3, 5, 7, 10, 14, 21, 30]

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        checked ? "bg-primary" : "bg-border"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm",
        "transform transition-transform duration-150",
        checked ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  )
}

function NativeSelect({ value, onChange, children, className }: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground",
        "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
        "transition-colors appearance-none pr-7 bg-no-repeat",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")] bg-[right_8px_center]",
        className
      )}
    >
      {children}
    </select>
  )
}

function TimingRow({ timing, onChange, onRemove, canRemove }: {
  timing: DayTiming
  onChange: (t: DayTiming) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const dayOptions = timing.direction === "before" ? DAY_OPTIONS_BEFORE : DAY_OPTIONS_AFTER
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <NativeSelect value={String(timing.days)} onChange={(v) => onChange({ ...timing, days: Number(v) })} className="w-20">
        {dayOptions.map((d) => <option key={d} value={d}>{d} {d === 1 ? "day" : "days"}</option>)}
      </NativeSelect>
      <NativeSelect value={timing.direction} onChange={(v) => onChange({ ...timing, direction: v as "before" | "after" })} className="w-24">
        <option value="before">before</option>
        <option value="after">after</option>
      </NativeSelect>
      <span className="text-xs text-muted-foreground">due date at</span>
      <NativeSelect value={timing.time} onChange={(v) => onChange({ ...timing, time: v })} className="w-24">
        {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
      </NativeSelect>
      {canRemove && (
        <button type="button" onClick={onRemove} className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors ml-1 cursor-pointer">
          Remove
        </button>
      )}
    </div>
  )
}

function TemplateActions({ onPreview, onEdit, onTest }: {
  onPreview: () => void; onEdit: () => void; onTest: () => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {[
        { label: "Preview Email", icon: Eye, fn: onPreview },
        { label: "Edit Template", icon: Edit3, fn: onEdit },
        { label: "Send Test Email", icon: Send, fn: onTest },
      ].map(({ label, icon: Icon, fn }) => (
        <button key={label} type="button" onClick={fn}
          className="flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted transition-colors cursor-pointer">
          <Icon className="w-3 h-3" /> {label}
        </button>
      ))}
    </div>
  )
}

// ─── Cadence card ─────────────────────────────────────────────────────────────

function CadenceCard({ section, onChange }: {
  section: CadenceSection
  onChange: (s: CadenceSection) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [testSent, setTestSent] = useState(false)

  function handleTest() { setTestSent(true); setTimeout(() => setTestSent(false), 2500) }

  function addTiming() {
    const last = section.timings[section.timings.length - 1]
    onChange({ ...section, timings: [...section.timings, { days: 7, direction: last?.direction ?? "before", time: "09:00" }] })
  }

  function updateTiming(i: number, t: DayTiming) {
    const timings = [...section.timings]
    timings[i] = t
    onChange({ ...section, timings })
  }

  function removeTiming(i: number) {
    onChange({ ...section, timings: section.timings.filter((_, idx) => idx !== i) })
  }

  return (
    <div className={cn(
      "bg-card border border-border rounded-xl overflow-hidden transition-shadow duration-150",
      section.enabled ? "shadow-sm" : "opacity-60"
    )}>
      <div className="flex items-center gap-4 px-5 py-4 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
          <Mail className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{section.title}</p>
          <p className="text-xs text-muted-foreground leading-snug mt-0.5">{section.description}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Toggle checked={section.enabled} onChange={(v) => onChange({ ...section, enabled: v })} />
          <button type="button" onClick={() => setExpanded((v) => !v)}
            className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted transition-colors cursor-pointer"
            aria-label={expanded ? "Collapse" : "Expand"}>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 py-5 flex flex-col gap-5">
          {section.weekly ? (
            <div>
              <p className="text-xs font-semibold text-foreground mb-3">Send schedule</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Every</span>
                <NativeSelect value={section.sendDay ?? "Thursday"} onChange={(v) => onChange({ ...section, sendDay: v })} className="w-32">
                  {DAYS_OF_WEEK.map((d) => <option key={d} value={d}>{d}</option>)}
                </NativeSelect>
                <span className="text-xs text-muted-foreground">at</span>
                <NativeSelect value={section.sendTime ?? "09:00"} onChange={(v) => onChange({ ...section, sendTime: v })} className="w-24">
                  {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </NativeSelect>
                <span className="text-xs text-muted-foreground">covering the following week</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-foreground">Timing</p>
                {section.timings.length < 5 && (
                  <button type="button" onClick={addTiming} className="text-[11px] font-medium text-primary hover:underline cursor-pointer">
                    + Add reminder
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2.5">
                {section.timings.map((t, i) => (
                  <TimingRow key={i} timing={t} onChange={(u) => updateTiming(i, u)} onRemove={() => removeTiming(i)} canRemove={section.timings.length > 1} />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Email template</p>
            <NativeSelect value={section.template} onChange={(v) => onChange({ ...section, template: v })} className="w-64">
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </NativeSelect>
          </div>

          <div>
            <TemplateActions onPreview={() => {}} onEdit={() => {}} onTest={handleTest} />
            {testSent && (
              <p className="flex items-center gap-1.5 text-[11px] text-[oklch(0.42_0.17_145)] mt-2 font-medium">
                <Check className="w-3 h-3" /> Test email sent to alex.johnson@acmecorp.com
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const [sections, setSections] = useState<CadenceSection[]>(INITIAL_SECTIONS)
  const [saved, setSaved] = useState(false)

  function updateSection(id: string, updated: CadenceSection) {
    setSections((prev) => prev.map((s) => s.id === id ? updated : s))
  }

  function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  const enabledCount = sections.filter((s) => s.enabled).length

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Email Automations</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure automated email cadences for reminders, follow-ups, and service notifications.
            {" "}<span className="font-medium text-foreground">{enabledCount} of {sections.length}</span> automations active.
          </p>
        </div>
        <Button size="sm" onClick={handleSave} className="shrink-0">
          {saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : "Save changes"}
        </Button>
      </div>

      {sections.map((section) => (
        <CadenceCard key={section.id} section={section} onChange={(u) => updateSection(section.id, u)} />
      ))}

      {/* Global send window */}
      <div className="rounded-lg border border-border bg-secondary/40 px-5 py-4">
        <div className="flex items-start gap-3">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-foreground">Global Send Window</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              All emails respect your workspace timezone (America/Los_Angeles) and are only sent between
              8:00 AM and 6:00 PM on business days. Adjust in{" "}
              <a href="/settings/workspace" className="text-primary hover:underline font-medium">Workspace Settings</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
