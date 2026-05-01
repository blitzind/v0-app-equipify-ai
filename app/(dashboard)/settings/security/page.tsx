"use client"

import { useState } from "react"
import { Shield, Smartphone, Monitor, Clock, LogOut, Check, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function SettingCard({ title, description, children }: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

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

const SESSIONS = [
  {
    id: "s1",
    device: "Chrome on macOS",
    icon: Monitor,
    location: "San Francisco, CA",
    lastActive: "Active now",
    current: true,
  },
  {
    id: "s2",
    device: "Safari on iPhone 15",
    icon: Smartphone,
    location: "San Francisco, CA",
    lastActive: "2 hours ago",
    current: false,
  },
  {
    id: "s3",
    device: "Chrome on Windows",
    icon: Monitor,
    location: "New York, NY",
    lastActive: "3 days ago",
    current: false,
  },
]

export default function SecurityPage() {
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaSetupOpen, setMfaSetupOpen] = useState(false)
  const [sessions, setSessions] = useState(SESSIONS)
  const [sessionTimeout, setSessionTimeout] = useState("8h")

  function revokeSession(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Two-factor auth */}
      <SettingCard
        title="Two-factor authentication"
        description="Add an extra layer of security to your account with an authenticator app."
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Shield size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Authenticator app</p>
              <p className="text-xs text-muted-foreground">
                {mfaEnabled ? "2FA is active on your account." : "Not configured. Use any TOTP app (Google Authenticator, Authy)."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {mfaEnabled && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ds-badge-success border">
                Enabled
              </span>
            )}
            <Toggle
              checked={mfaEnabled}
              onChange={(v) => { setMfaEnabled(v); if (v) setMfaSetupOpen(true) }}
            />
          </div>
        </div>

        {mfaSetupOpen && mfaEnabled && (
          <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-foreground">Set up authenticator app</p>
            <p className="text-xs text-muted-foreground">Scan this QR code with your authenticator app, then enter the 6-digit code to verify.</p>
            {/* Mock QR placeholder */}
            <div className="w-28 h-28 rounded-lg border-2 border-dashed border-border bg-background flex items-center justify-center">
              <p className="text-[10px] text-muted-foreground text-center px-2">QR code appears here</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="text" maxLength={6} placeholder="000000" className="input-base w-28 text-center font-mono tracking-widest text-base" />
              <Button size="sm" onClick={() => setMfaSetupOpen(false)}>
                <Check size={13} /> Verify
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setMfaEnabled(false); setMfaSetupOpen(false) }}>Cancel</Button>
            </div>
          </div>
        )}
      </SettingCard>

      {/* Session timeout */}
      <SettingCard
        title="Session timeout"
        description="Automatically sign out after a period of inactivity."
      >
        <div className="flex items-center gap-3 flex-wrap">
          {(["1h", "4h", "8h", "24h", "Never"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSessionTimeout(t)}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                sessionTimeout === t
                  ? "border-primary bg-primary/8 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Current setting: sign out after <strong>{sessionTimeout === "Never" ? "never (stay signed in)" : `${sessionTimeout} of inactivity`}</strong>.
        </p>
      </SettingCard>

      {/* Active sessions */}
      <SettingCard
        title="Active sessions"
        description="Devices currently signed into your account. Revoke any sessions you don't recognize."
      >
        <div className="flex flex-col gap-3">
          {sessions.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="w-9 h-9 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{s.device}</p>
                    {s.current && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ds-badge-success border">
                        This device
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock size={10} className="text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{s.lastActive} &middot; {s.location}</p>
                  </div>
                </div>
                {!s.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 gap-1 text-muted-foreground hover:text-destructive"
                    onClick={() => revokeSession(s.id)}
                  >
                    <LogOut size={12} /> Revoke
                  </Button>
                )}
              </div>
            )
          })}
        </div>
        {sessions.filter((s) => !s.current).length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-destructive/30 text-destructive hover:bg-destructive/5"
              onClick={() => setSessions((prev) => prev.filter((s) => s.current))}
            >
              Revoke all other sessions
            </Button>
          </div>
        )}
      </SettingCard>

      {/* Security log */}
      <SettingCard title="Recent security events">
        <div className="flex flex-col gap-0 divide-y divide-border">
          {[
            { event: "Password changed",         time: "Apr 18, 2026 at 2:14 PM",   icon: "check" },
            { event: "Signed in from new device", time: "Apr 15, 2026 at 9:02 AM",   icon: "warn" },
            { event: "2FA setup attempted",       time: "Apr 10, 2026 at 11:30 AM",  icon: "warn" },
            { event: "Signed in",                 time: "Apr 9, 2026 at 8:45 AM",    icon: "check" },
          ].map((ev) => (
            <div key={ev.time} className="flex items-center gap-3 py-2.5">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                ev.icon === "check" ? "bg-[color:var(--ds-success-bg)]" : "bg-[color:var(--ds-warning-bg)]"
              )}>
                {ev.icon === "check"
                  ? <Check size={12} className="ds-icon-success" />
                  : <AlertTriangle size={12} className="ds-icon-warning" />
                }
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">{ev.event}</p>
                <p className="text-[11px] text-muted-foreground">{ev.time}</p>
              </div>
            </div>
          ))}
        </div>
      </SettingCard>
    </div>
  )
}
