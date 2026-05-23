"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, ExternalLink, Loader2, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { buildGrowthCallDialOptions } from "@/lib/growth/communication/call-dial"
import type { ResolvedGrowthDialPreferences } from "@/lib/growth/communication/types"
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
  const [loadingPrefs, setLoadingPrefs] = useState(false)
  const [resolved, setResolved] = useState<ResolvedGrowthDialPreferences | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
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

  async function startDial(mode: ResolvedGrowthDialPreferences["callDialMode"], href: string) {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start call session.")
    } finally {
      setBusy(false)
    }
  }

  async function recordDisposition(disposition: GrowthLeadCallDisposition) {
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
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record disposition.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Call {contactLabel ?? "contact"}</DialogTitle>
          <DialogDescription>
            Dial via your configured channel. Disposition is recorded separately — this logs dial initiated, not a connected call.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium tabular-nums">{phone}</div>

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

          <div className="grid gap-2">
            {dialOptions.map((option) => (
              <Button
                key={`${option.mode}-${option.href}`}
                className="justify-start gap-2"
                disabled={busy}
                onClick={() => void startDial(option.mode, option.href)}
              >
                <Phone className="size-4" />
                {option.label}
                <ExternalLink className="ml-auto size-3.5 opacity-60" />
              </Button>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void copyNumber()}>
            <Copy className="mr-2 size-4" />
            {copied ? "Copied" : "Copy number"}
          </Button>

          {sessionId ? (
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-sm font-medium text-emerald-900">Dial logged — record outcome</p>
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
          ) : null}
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
