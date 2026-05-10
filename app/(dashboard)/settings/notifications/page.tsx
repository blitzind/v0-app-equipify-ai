"use client"

import { Bell, Mail, Smartphone, Monitor, AlertCircle, Repeat2, Shield, CalendarClock, UserCog, CheckCircle2, Info } from "lucide-react"
import { AiOpsDigestSettingsCard } from "@/components/ai-ops/digest-settings-card"
import { InternalEscalationRulesPanel } from "@/components/settings/internal-escalation-rules-panel"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => { if (!disabled) onChange(!checked) }}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent",
        "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
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
  const { organizationId, status: orgStatus } = useActiveOrganization()
  /** Design preview only — not persisted (Phase 57.2). */
  const prefs = INITIAL_PREFS
  const digestEmail = true
  const digestFrequency: "daily" | "weekly" = "daily"
  const quietStart = "22:00"
  const quietEnd = "07:00"

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
            Internal escalation rules and the AI Ops digest below are saved to your workspace. The personal alert matrix is a design preview only.
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Personal channel preferences are not saved yet</AlertTitle>
        <AlertDescription>
          The alert matrix, email digest options, and quiet hours below illustrate planned behavior. Toggles are read-only until notification preferences are backed by the API.
        </AlertDescription>
      </Alert>

      {/* Alert matrix (preview) */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Alert preferences</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Planned: control which events trigger notifications and on which channels.
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
                    onChange={() => {}}
                    disabled
                  />
                </div>
                <div className="w-14 flex justify-center">
                  <Toggle
                    checked={pref.channels.email}
                    onChange={() => {}}
                    disabled
                  />
                </div>
                <div className="w-12 flex justify-center">
                  <Toggle
                    checked={pref.channels.sms}
                    onChange={() => {}}
                    disabled
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
          <Toggle checked={digestEmail} onChange={() => {}} disabled />
        </div>
        {digestEmail && (
          <div className="px-6 py-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Digest frequency</p>
            <div className="flex items-center gap-2">
              {(["daily", "weekly"] as const).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  disabled
                  className={cn(
                    "px-4 py-2 rounded-lg border text-sm font-medium capitalize transition-all opacity-50 cursor-not-allowed",
                    digestFrequency === freq
                      ? "border-primary bg-primary/8 text-primary"
                      : "border-border text-muted-foreground"
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
            disabled
            className="h-8 rounded-md border border-border bg-muted/50 px-2.5 text-xs font-medium text-muted-foreground cursor-not-allowed"
          >
            {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-sm text-muted-foreground">to</span>
          <select
            value={quietEnd}
            disabled
            className="h-8 rounded-md border border-border bg-muted/50 px-2.5 text-xs font-medium text-muted-foreground cursor-not-allowed"
          >
            {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">(your local time)</span>
        </div>
      </div>

      {/* Phase 48 — internal escalation rules (workspace managers edit; all staff preview within scope) */}
      {orgStatus === "ready" && organizationId ?
        <InternalEscalationRulesPanel organizationId={organizationId} />
      : null}

      {/* AI Ops daily digest (Phase 3 — internal staff only) */}
      <AiOpsDigestSettingsCard />

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
