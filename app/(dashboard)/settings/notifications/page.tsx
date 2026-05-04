"use client"

import { useState } from "react"
import { Check, Bell, Mail, Smartphone, Monitor, AlertCircle, Repeat2, Shield, CalendarClock, UserCog, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotifPreference {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  iconColor: string
  channels: {
    inApp: boolean
    email: boolean
    sms: boolean
  }
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const INITIAL_PREFS: NotifPreference[] = [
  {
    id: "overdue-wo",
    label: "Overdue work orders",
    description: "When a work order passes its due date without being closed.",
    icon: AlertCircle,
    iconColor: "text-destructive",
    channels: { inApp: true, email: true, sms: false },
  },
  {
    id: "repeat-repair",
    label: "Repeat repair alerts",
    description: "When the same equipment is flagged for repeated repairs.",
    icon: Repeat2,
    iconColor: "text-destructive",
    channels: { inApp: true, email: true, sms: false },
  },
  {
    id: "warranty-expiring",
    label: "Warranty expiring",
    description: "When equipment warranties are approaching expiration.",
    icon: Shield,
    iconColor: "text-[oklch(0.50_0.12_70)]",
    channels: { inApp: true, email: true, sms: false },
  },
  {
    id: "pm-due",
    label: "Maintenance due",
    description: "When scheduled preventive maintenance is upcoming.",
    icon: CalendarClock,
    iconColor: "text-primary",
    channels: { inApp: true, email: false, sms: false },
  },
  {
    id: "wo-completed",
    label: "Work order completed",
    description: "When a technician closes a work order.",
    icon: CheckCircle2,
    iconColor: "text-[oklch(0.42_0.17_145)]",
    channels: { inApp: true, email: false, sms: false },
  },
  {
    id: "schedule-change",
    label: "Schedule changes",
    description: "When a technician is reassigned or an appointment is rescheduled.",
    icon: UserCog,
    iconColor: "text-primary",
    channels: { inApp: true, email: false, sms: false },
  },
]

// ─── Toggle ───────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<NotifPreference[]>(INITIAL_PREFS)
  const [saved, setSaved] = useState(false)
  const [digestEmail, setDigestEmail] = useState(true)
  const [digestFrequency, setDigestFrequency] = useState<"daily" | "weekly">("daily")
  const [quietStart, setQuietStart] = useState("22:00")
  const [quietEnd, setQuietEnd]   = useState("07:00")

  function updateChannel(id: string, channel: keyof NotifPreference["channels"], value: boolean) {
    setPrefs((prev) =>
      prev.map((p) => p.id === id ? { ...p, channels: { ...p.channels, [channel]: value } } : p)
    )
  }

  function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  const TIMES = [
    "00:00","01:00","02:00","03:00","04:00","05:00","06:00","07:00",
    "08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00",
    "16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00",
  ]

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell size={16} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Notification Preferences</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Choose which alerts you receive and how they are delivered. These are personal settings — they only affect your account.
          </p>
        </div>
        <Button size="sm" onClick={handleSave} className="shrink-0">
          {saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : "Save changes"}
        </Button>
      </div>

      {/* Alert matrix */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Alert preferences</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Control which events trigger notifications and on which channels.
          </p>
        </div>

        {/* Channel header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-3 bg-secondary/40 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alert type</span>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground w-16 justify-center">
            <Monitor size={12} /> In-app
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground w-14 justify-center">
            <Mail size={12} /> Email
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground w-12 justify-center">
            <Smartphone size={12} /> SMS
          </div>
        </div>

        <div className="divide-y divide-border">
          {prefs.map((pref) => {
            const Icon = pref.icon
            return (
              <div
                key={pref.id}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-4 hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
                    <Icon size={14} className={pref.iconColor} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{pref.label}</p>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{pref.description}</p>
                  </div>
                </div>
                <div className="w-16 flex justify-center">
                  <Toggle
                    checked={pref.channels.inApp}
                    onChange={(v) => updateChannel(pref.id, "inApp", v)}
                  />
                </div>
                <div className="w-14 flex justify-center">
                  <Toggle
                    checked={pref.channels.email}
                    onChange={(v) => updateChannel(pref.id, "email", v)}
                  />
                </div>
                <div className="w-12 flex justify-center">
                  <Toggle
                    checked={pref.channels.sms}
                    onChange={(v) => updateChannel(pref.id, "sms", v)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Email digest */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Email digest</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Receive a summary of activity instead of individual emails for each event.</p>
          </div>
          <Toggle checked={digestEmail} onChange={setDigestEmail} />
        </div>
        {digestEmail && (
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Digest frequency</p>
            <div className="flex items-center gap-2">
              {(["daily", "weekly"] as const).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setDigestFrequency(freq)}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-sm font-medium capitalize transition-all",
                    digestFrequency === freq
                      ? "border-primary bg-primary/8 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quiet hours */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Quiet hours</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Suppress all notifications during these hours. Applies to email and SMS only — in-app alerts are still recorded.</p>
        </div>
        <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground">From</span>
          <select
            value={quietStart}
            onChange={(e) => setQuietStart(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-sm text-muted-foreground">to</span>
          <select
            value={quietEnd}
            onChange={(e) => setQuietEnd(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">(your local time)</span>
        </div>
      </div>

      {/* Link to automations */}
      <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-5 py-4">
        <p className="text-sm font-medium text-foreground">Looking for email automation cadences?</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure appointment confirmations, maintenance reminders, quote follow-ups, and invoice follow-up sequences in{" "}
          <a href="/settings/automations" className="text-primary hover:underline font-medium">Automations</a>.
        </p>
      </div>
    </div>
  )
}
