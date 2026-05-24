"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, ExternalLink, Loader2, Mic, Phone, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useGrowthCallWorkflowOptional } from "@/components/growth/growth-call-workflow-context"
import { buildGrowthCallDialOptions } from "@/lib/growth/communication/call-dial"
import type { ResolvedGrowthDialPreferences } from "@/lib/growth/communication/types"
import { GROWTH_CALL_DIALER_SAFETY_COPY } from "@/lib/growth/call-workflow-copy"
import { formatGrowthCallDialerNextStep } from "@/lib/growth/call-workflow"
import { GROWTH_LEAD_CALL_DISPOSITIONS, type GrowthLeadCallDisposition } from "@/lib/growth/call-types"
import type { GrowthLead } from "@/lib/growth/types"

const QUICK_DISPOSITIONS: GrowthLeadCallDisposition[] = [
  "no_answer",
  "left_voicemail",
  "call_attempted",
  "interested",
]

const DISPOSITION_LABELS: Record<GrowthLeadCallDisposition, string> = {
  call_attempted: "Call attempted",
  left_voicemail: "Left voicemail",
  interested: "Interested",
  not_a_fit: "Not a fit",
  follow_up_later: "Follow up later",
  no_answer: "No answer",
}

type GrowthCallActionSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId: string
  phone: string
  contactLabel?: string | null
  onLeadUpdated?: (lead: GrowthLead) => void
}

export function GrowthCallActionSheet({
  open,
  onOpenChange,
  leadId,
  phone,
  contactLabel,
  onLeadUpdated,
}: GrowthCallActionSheetProps) {
  const workflow = useGrowthCallWorkflowOptional()
  const [loadingPrefs, setLoadingPrefs] = useState(false)
  const [resolved, setResolved] = useState<ResolvedGrowthDialPreferences | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [dialLabel, setDialLabel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const dialOptions = useMemo(() => {
    if (!resolved) return []
    return buildGrowthCallDialOptions(phone, resolved)
  }, [phone, resolved])

  const loadPreferences = useCallback(async () => {
    setLoadingPrefs(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/communication-preferences", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        resolved?: ResolvedGrowthDialPreferences
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.resolved) {
        throw new Error(data.message ?? data.error ?? "Could not load call preferences.")
      }
      setResolved(data.resolved)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load call preferences.")
    } finally {
      setLoadingPrefs(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setSessionId(null)
      setDialLabel(null)
      setCopied(false)
      setError(null)
      return
    }
    void loadPreferences()
  }, [open, loadPreferences])

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(phone)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setError("Could not copy phone number.")
    }
  }

  async function startDial(mode: ResolvedGrowthDialPreferences["callDialMode"], href: string, label: string) {
    setBusy(true)
    setError(null)
    try {
      window.open(href, "_blank", "noopener,noreferrer")
      const res = await fetch(`/api/platform/growth/leads/${leadId}/call-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneDialed: phone, dialMode: mode }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        session?: { id: string }
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.session?.id) {
        throw new Error(data.message ?? data.error ?? "Could not log call started.")
      }
      setSessionId(data.session.id)
      setDialLabel(label)
      workflow?.notifyDialStarted({ sessionId: data.session.id, dialLabel: label })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start call session.")
    } finally {
      setBusy(false)
    }
  }

  async function recordDisposition(disposition: GrowthLeadCallDisposition, closeSheet = true) {
    setBusy(true)
    setError(null)
    try {
      if (sessionId) {
        const res = await fetch(`/api/platform/growth/leads/${leadId}/call-sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ disposition }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          lead?: GrowthLead
          message?: string
          error?: string
        }
        if (!res.ok || !data.ok) {
          throw new Error(data.message ?? data.error ?? "Could not record disposition.")
        }
        if (data.lead) onLeadUpdated?.(data.lead)
      } else {
        const res = await fetch(`/api/platform/growth/leads/${leadId}/call-events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ disposition }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          lead?: GrowthLead
          message?: string
          error?: string
        }
        if (!res.ok || !data.ok) {
          throw new Error(data.message ?? data.error ?? "Could not record disposition.")
        }
        if (data.lead) onLeadUpdated?.(data.lead)
      }
      workflow?.clearCallWorkflow()
      if (closeSheet) onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record disposition.")
    } finally {
      setBusy(false)
    }
  }

  async function startRealtimeCoaching() {
    if (!workflow) {
      setError("Open the lead drawer to start Realtime Coaching.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await workflow.runStartRealtimeCoaching()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Realtime Coaching.")
    } finally {
      setBusy(false)
    }
  }

  async function startCallCopilot() {
    if (!workflow) {
      setError("Open the lead drawer to start Call Copilot.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await workflow.runStartCallCopilot()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Call Copilot.")
    } finally {
      setBusy(false)
    }
  }

  const nextStepCopy = dialLabel ? formatGrowthCallDialerNextStep(dialLabel) : null

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Call {contactLabel ?? "contact"}</DialogTitle>
          <DialogDescription>
            Dial via your configured channel, then start Realtime Coaching or Call Copilot in the lead drawer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium tabular-nums">{phone}</div>

          <p className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-xs text-sky-950">{GROWTH_CALL_DIALER_SAFETY_COPY}</p>

          {loadingPrefs ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading dial preferences…
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dial</p>
            <div className="grid gap-2">
              {dialOptions.map((option) => (
                <Button
                  key={`${option.mode}-${option.href}`}
                  className="justify-start gap-2"
                  disabled={busy}
                  onClick={() => void startDial(option.mode, option.href, option.label)}
                >
                  <Phone className="size-4" />
                  {option.label}
                  <ExternalLink className="ml-auto size-3.5 opacity-60" />
                </Button>
              ))}
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void copyNumber()}>
            <Copy className="mr-2 size-4" />
            {copied ? "Copied" : "Copy number"}
          </Button>

          {sessionId ? (
            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <div>
                <p className="text-sm font-medium text-emerald-900">Call session started</p>
                {nextStepCopy ? <p className="mt-1 text-sm text-emerald-950/90">{nextStepCopy}</p> : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" size="sm" disabled={busy} onClick={() => void startRealtimeCoaching()}>
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mic className="mr-2 size-4" />}
                  Start Realtime Coaching
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void startCallCopilot()}>
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                  Start Call Copilot
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void recordDisposition("no_answer", false)}
                >
                  Log No Answer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void recordDisposition("call_attempted")}
                >
                  Complete Call
                </Button>
              </div>

              <div className="space-y-2 border-t border-emerald-200/80 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80">Log outcome</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_DISPOSITIONS.map((disposition) => (
                    <Button
                      key={disposition}
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void recordDisposition(disposition)}
                    >
                      {DISPOSITION_LABELS[disposition]}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Other outcomes: {GROWTH_LEAD_CALL_DISPOSITIONS.filter((d) => !QUICK_DISPOSITIONS.includes(d)).map((d) => DISPOSITION_LABELS[d]).join(", ")} — use the call queue menu.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
              Choose a dial option to log a call session, then start Realtime Coaching from here or the drawer cards below.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
