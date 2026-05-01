"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { NotificationRule, NotificationChannel, WeekdayTrigger } from "@/lib/mock-data"
import {
  Bell, Plus, Trash2, Mail, MessageSquare, AlertCircle,
  Calendar, Check, ChevronDown, ToggleLeft, ToggleRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"

// ─── Channel config ───────────────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<NotificationChannel, { icon: React.ReactNode; label: string; color: string }> = {
  "Email":          { icon: <Mail className="w-3.5 h-3.5" />,          label: "Email",          color: "text-blue-600 bg-blue-50 border-blue-200" },
  "SMS":            { icon: <MessageSquare className="w-3.5 h-3.5" />, label: "SMS",            color: "text-green-700 bg-green-50 border-green-200" },
  "Internal Alert": { icon: <AlertCircle className="w-3.5 h-3.5" />,   label: "Internal Alert", color: "text-[color:var(--status-info)] bg-[color:var(--status-info)]/10 border-[color:var(--status-info)]/30" },
}

const CHANNELS: NotificationChannel[] = ["Email", "SMS", "Internal Alert"]

// Standard lead-time presets
const LEAD_TIME_PRESETS: { label: string; days: number }[] = [
  { label: "1 day",  days: 1  },
  { label: "3 days", days: 3  },
  { label: "7 days", days: 7  },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
  { label: "Custom", days: 0  },
]

const WEEKDAY_OPTIONS: { value: WeekdayTrigger; label: string }[] = [
  { value: null,       label: "No weekday rule" },
  { value: "monday",   label: "Every Monday" },
  { value: "thursday", label: "Every Thursday" },
  { value: "friday",   label: "Every Friday" },
]

// ─── Rule row ─────────────────────────────────────────────────────────────────

function RuleRow({
  rule,
  onUpdate,
  onDelete,
}: {
  rule: NotificationRule
  onUpdate: (r: NotificationRule) => void
  onDelete: () => void
}) {
  const [customDays, setCustomDays] = useState(
    LEAD_TIME_PRESETS.some((p) => p.days === rule.triggerDays && p.days !== 0)
      ? ""
      : String(rule.triggerDays)
  )
  const [showCustom, setShowCustom] = useState(
    !LEAD_TIME_PRESETS.some((p) => p.days === rule.triggerDays)
  )
  const [editRecipient, setEditRecipient] = useState(rule.recipients.join(", "))

  const ch = CHANNEL_CONFIG[rule.channel]

  function handlePreset(days: number) {
    if (days === 0) {
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    onUpdate({ ...rule, triggerDays: days })
  }

  function handleCustomDays(v: string) {
    setCustomDays(v)
    const n = parseInt(v, 10)
    if (!isNaN(n) && n > 0) onUpdate({ ...rule, triggerDays: n })
  }

  function handleWeekday(v: string) {
    const val = v === "null" ? null : v as WeekdayTrigger
    onUpdate({ ...rule, weekdayTrigger: val ?? undefined })
  }

  function handleRecipients() {
    const recs = editRecipient
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    onUpdate({ ...rule, recipients: recs })
  }

  return (
    <div className={cn(
      "rounded-xl border border-border bg-card p-4 flex flex-col gap-3 transition-opacity",
      !rule.enabled && "opacity-60"
    )}>
      {/* Top row: channel badge + enable toggle + delete */}
      <div className="flex items-center justify-between gap-3">
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold", ch.color)}>
          {ch.icon} {ch.label}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => onUpdate({ ...rule, enabled: !rule.enabled })}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md border transition-colors cursor-pointer",
              rule.enabled
                ? "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30 hover:bg-[color:var(--status-success)]/20"
                : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
            )}
          >
            {rule.enabled
              ? <><ToggleRight className="w-3.5 h-3.5" /> Enabled</>
              : <><ToggleLeft className="w-3.5 h-3.5" /> Disabled</>
            }
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-destructive/10 transition-colors cursor-pointer"
            aria-label="Delete rule"
          >
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>

      {/* Lead time row */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Lead Time</label>
        <div className="flex flex-wrap gap-1.5">
          {LEAD_TIME_PRESETS.map((p) => {
            const isActive = p.days === 0
              ? showCustom
              : !showCustom && rule.triggerDays === p.days
            return (
              <button
                key={p.days}
                type="button"
                onClick={() => handlePreset(p.days)}
                className={cn(
                  "px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-foreground hover:bg-muted"
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        {showCustom && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={365}
              value={customDays}
              onChange={(e) => handleCustomDays(e.target.value)}
              placeholder="e.g. 21"
              className="w-24 rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
            />
            <span className="text-xs text-muted-foreground">days before due date</span>
          </div>
        )}
      </div>

      {/* Weekday trigger row */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Calendar className="w-3 h-3" /> Weekday Rule
        </label>
        <select
          value={rule.weekdayTrigger ?? "null"}
          onChange={(e) => handleWeekday(e.target.value)}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40 transition-colors cursor-pointer"
        >
          {WEEKDAY_OPTIONS.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
          ))}
        </select>
        {rule.weekdayTrigger === "thursday" && (
          <p className="text-[10px] text-muted-foreground italic">
            Reminder will fire every Thursday within the lead-time window — standard for most service teams.
          </p>
        )}
      </div>

      {/* Recipients row */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Recipients</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={editRecipient}
            onChange={(e) => setEditRecipient(e.target.value)}
            onBlur={handleRecipients}
            placeholder="email@example.com, +1 555 ..."
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">Comma-separated emails or phone numbers</p>
      </div>
    </div>
  )
}

// ─── Add rule button ──────────────────────────────────────────────────────────

function AddRuleButton({
  onAdd,
}: {
  onAdd: (channel: NotificationChannel) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs cursor-pointer w-full"
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="w-3.5 h-3.5" />
        Add Reminder Rule
        <ChevronDown className={cn("w-3.5 h-3.5 ml-auto transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          {CHANNELS.map((ch) => {
            const cfg = CHANNEL_CONFIG[ch]
            return (
              <button
                key={ch}
                type="button"
                onClick={() => { onAdd(ch); setOpen(false) }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer border-b last:border-0 border-border"
              >
                <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded", cfg.color)}>
                  {cfg.icon}
                </span>
                {cfg.label} reminder
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface ReminderRulesPanelProps {
  planId: string
  rules: NotificationRule[]
  onSave: (rules: NotificationRule[]) => void
}

export function ReminderRulesPanel({ planId, rules, onSave }: ReminderRulesPanelProps) {
  const [localRules, setLocalRules] = useState<NotificationRule[]>(rules)
  const [saved, setSaved] = useState(false)

  function handleUpdate(idx: number, updated: NotificationRule) {
    setLocalRules((prev) => prev.map((r, i) => (i === idx ? updated : r)))
    setSaved(false)
  }

  function handleDelete(idx: number) {
    setLocalRules((prev) => prev.filter((_, i) => i !== idx))
    setSaved(false)
  }

  function handleAdd(channel: NotificationChannel) {
    const newRule: NotificationRule = {
      id: `r-${channel.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
      channel,
      triggerDays: 7,
      weekdayTrigger: channel === "Email" ? "thursday" : undefined,
      enabled: true,
      recipients: channel === "Internal Alert" ? ["admin@equipify.ai"] : [],
    }
    setLocalRules((prev) => [...prev, newRule])
    setSaved(false)
  }

  function handleSave() {
    onSave(localRules)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex flex-col gap-3">
      {localRules.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">No reminder rules configured.</p>
      ) : (
        localRules.map((rule, idx) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            onUpdate={(updated) => handleUpdate(idx, updated)}
            onDelete={() => handleDelete(idx)}
          />
        ))
      )}

      <AddRuleButton onAdd={handleAdd} />

      <Button
        size="sm"
        className={cn("gap-1.5 text-xs cursor-pointer", saved && "bg-[color:var(--status-success)] hover:bg-[color:var(--status-success)]/90")}
        onClick={handleSave}
        disabled={saved}
      >
        {saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : "Save Reminder Rules"}
      </Button>
    </div>
  )
}
