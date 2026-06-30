"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Copy, ExternalLink, Headphones, Loader2, Mic, Phone, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useGrowthCallWorkflowOptional } from "@/components/growth/growth-call-workflow-context"
import { buildGrowthCallDialOptions } from "@/lib/growth/communication/call-dial"
import type { ResolvedGrowthDialPreferences } from "@/lib/growth/communication/types"
import { GROWTH_CALL_AUDIO_CAPTURE_ENABLED, GROWTH_CALL_DIALER_SAFETY_COPY } from "@/lib/growth/call-workflow-copy"
import { formatGrowthCallDialerNextStep } from "@/lib/growth/call-workflow"
import { nativeCallWorkspaceHref } from "@/lib/growth/native-dialer/native-dialer-navigation"
import { resolveCallSheetMicCaptureHint } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-capability"
import { GROWTH_BROWSER_AUDIO_CAPTURE_SAFETY_COPY } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-invariants"
import { GROWTH_LEAD_CALL_DISPOSITIONS, type GrowthLeadCallDisposition } from "@/lib/growth/call-types"
import type { GrowthLead } from "@/lib/growth/types"
import { cn } from "@/lib/utils"

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
  const [micCaptureHint, setMicCaptureHint] = useState<"start_mic_capture" | "manual_transcript_mode">(
    "manual_transcript_mode",
  )

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
      setMicCaptureHint("manual_transcript_mode")
      return
    }
    void loadPreferences()
  }, [open, loadPreferences])

  const loadMicCaptureHint = useCallback(async () => {
    if (!GROWTH_CALL_AUDIO_CAPTURE_ENABLED) {
      setMicCaptureHint("manual_transcript_mode")
      return
    }
    try {
      const res = await fetch("/api/platform/growth/live-coaching/settings", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        settings?: {
          activeProviderConnectionId?: string | null
          fallbackProvider?: string | null
        }
      }
      if (!res.ok || !data.ok || !data.settings) {
        setMicCaptureHint("manual_transcript_mode")
        return
      }
      setMicCaptureHint(
        resolveCallSheetMicCaptureHint({
          activeProviderConnectionId: data.settings.activeProviderConnectionId ?? null,
          fallbackProvider: data.settings.fallbackProvider,
        }),
      )
    } catch {
      setMicCaptureHint("manual_transcript_mode")
    }
  }, [])

  useEffect(() => {
    if (!open || !sessionId) return
    void loadMicCaptureHint()
  }, [open, sessionId, loadMicCaptureHint])

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
      setError("Open the lead drawer to start call assistance from Ava.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await workflow.runStartCallCopilot()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start call assistance from Ava.")
    } finally {
      setBusy(false)
    }
  }

  const nextStepCopy = dialLabel ? formatGrowthCallDialerNextStep(dialLabel) : null
  const otherOutcomes = GROWTH_LEAD_CALL_DISPOSITIONS.filter((d) => !QUICK_DISPOSITIONS.includes(d)).map(
    (d) => DISPOSITION_LABELS[d],
  )

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        className={cn(
          "flex max-h-[min(90vh,880px)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-[760px] 2xl:max-w-[820px]",
        )}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 text-left">
          <DialogTitle>Call {contactLabel ?? "contact"}</DialogTitle>
          <DialogDescription>
            Dial via your configured channel, then use embedded coaching and call assistance from the lead drawer or Calls workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-5">
            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
              {/* Left column — dial + coaching workflow */}
              <div className="flex min-w-0 flex-col gap-5">
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-base font-medium tabular-nums">
                  {phone}
                </div>

                <p className="rounded-lg border border-sky-200 bg-sky-50/60 px-4 py-3 text-xs leading-relaxed text-sky-950">
                  {GROWTH_CALL_DIALER_SAFETY_COPY}
                </p>

                <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dial</p>

                  {loadingPrefs ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading dial preferences…
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2">
                      {dialOptions.map((option) => (
                        <Button
                          key={`${option.mode}-${option.href}`}
                          className="min-h-11 w-full justify-start gap-2"
                          disabled={busy}
                          onClick={() => void startDial(option.mode, option.href, option.label)}
                        >
                          <Phone className="size-4 shrink-0" />
                          <span className="truncate">{option.label}</span>
                          <ExternalLink className="ml-auto size-3.5 shrink-0 opacity-60" />
                        </Button>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 w-full justify-start"
                        disabled={busy}
                        onClick={() => void copyNumber()}
                      >
                        <Copy className="mr-2 size-4 shrink-0" />
                        {copied ? "Copied" : "Copy number"}
                      </Button>

                      <Button asChild className="min-h-11 w-full justify-start" variant="secondary">
                        <Link href={nativeCallWorkspaceHref({ leadId, phone })}>
                          <Headphones className="mr-2 size-4 shrink-0" />
                          Open in Calls
                        </Link>
                      </Button>
                    </div>
                  )}
                </section>

                {sessionId ? (
                  <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-emerald-900">Call session started</p>
                    {nextStepCopy ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-emerald-950/90">{nextStepCopy}</p>
                    ) : null}

                    <div className="mt-4 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
                      <Button
                        type="button"
                        className="min-h-11 w-full min-w-0 justify-center gap-2 whitespace-nowrap px-5 font-medium sm:min-w-[220px] sm:flex-[1.2]"
                        disabled={busy}
                        onClick={() => void startRealtimeCoaching()}
                      >
                        {busy ? (
                          <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                        ) : (
                          <Mic className="mr-2 h-4 w-4 shrink-0" />
                        )}
                        Start Realtime Coaching
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-11 w-full min-w-0 justify-center gap-2 whitespace-nowrap px-5 font-medium"
                        disabled={busy}
                        onClick={() => void startCallCopilot()}
                      >
                        {busy ? (
                          <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4 shrink-0" />
                        )}
                        Start call assistance
                      </Button>
                    </div>

                    {GROWTH_CALL_AUDIO_CAPTURE_ENABLED ? (
                      <div className="mt-4 space-y-2 rounded-lg border border-border/80 bg-background/80 px-3 py-3">
                        {micCaptureHint === "start_mic_capture" ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11 w-full justify-center gap-2 whitespace-nowrap px-5 font-medium"
                              disabled={busy}
                              onClick={() => void startRealtimeCoaching()}
                            >
                              <Mic className="mr-2 h-4 w-4 shrink-0" />
                              Start Mic Capture
                            </Button>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {GROWTH_BROWSER_AUDIO_CAPTURE_SAFETY_COPY} Enable mic capture in Realtime Call
                              Intelligence after coaching goes live.
                            </p>
                          </>
                        ) : (
                          <p className="text-sm font-medium text-muted-foreground">Manual transcript mode active</p>
                        )}
                      </div>
                    ) : null}
                  </section>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 text-sm leading-relaxed text-muted-foreground">
                    Choose a dial option to log a call session, then start Realtime Coaching from here or the drawer
                    cards below.
                  </div>
                )}
              </div>

              {/* Right column — outcome logging */}
              <section className="rounded-xl border border-border bg-card p-4 shadow-sm lg:min-h-[280px]">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outcome logging</p>

                {!sessionId ? (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Start a dial session to unlock outcome logging for this call.
                  </p>
                ) : (
                  <div className="mt-4 flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 w-full px-3"
                        disabled={busy}
                        onClick={() => void recordDisposition("no_answer", false)}
                      >
                        Log No Answer
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 w-full px-3"
                        disabled={busy}
                        onClick={() => void recordDisposition("call_attempted")}
                      >
                        Complete Call
                      </Button>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Quick dispositions
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {QUICK_DISPOSITIONS.map((disposition) => (
                          <Button
                            key={disposition}
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-8 shrink-0"
                            disabled={busy}
                            onClick={() => void recordDisposition(disposition)}
                          >
                            {DISPOSITION_LABELS[disposition]}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Other outcomes: {otherOutcomes.join(", ")} — use the call queue menu.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 shrink-0 border-t bg-background px-6 py-4">
          <div className="flex justify-end">
            <Button type="button" variant="outline" className="min-w-[7.5rem]" disabled={busy} onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
