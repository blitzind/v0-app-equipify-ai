"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Copy, Loader2, Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthInboxWidgetErrorBoundary } from "@/components/growth/growth-inbox-widget-error-boundary"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  GROWTH_SMS_OPERATOR_SEND_MAX_CHARS,
  GROWTH_SMS_OPERATOR_SEND_QA_MARKER,
  GROWTH_SMS_OPERATOR_SEND_WARN_CHARS,
  mapGrowthSmsSendApiError,
  resolveInboxSmsRecipientE164,
  type GrowthSmsSendApiFailure,
  type GrowthSmsSendApiSuccess,
} from "@/lib/growth/inbox/inbox-sms-operator-send"
import {
  GROWTH_SMS_PERSONALIZATION_QA_MARKER,
  type GrowthSmsInboxDraftSuggestion,
} from "@/lib/growth/sms/personalization/sms-personalization-types"
import { cn } from "@/lib/utils"

type DraftPayload = {
  ok?: boolean
  suggestion?: GrowthSmsInboxDraftSuggestion
  message?: string
}

type ReadinessPayload = {
  fromE164?: string
  liveSendEnabled?: boolean
  message?: string
}

type SendResult = GrowthSmsSendApiSuccess & {
  sentAt: string
}

export function GrowthInboxActionCenterSmsDraftEmbed() {
  const { selectedThread, selectedMessages, actionLoading, loadThreadDetail, refreshThreads } =
    useGrowthInboxWorkspace()
  const { lead, refresh: refreshLeadContext } = useGrowthInboxLeadContext()

  const [loading, setLoading] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<GrowthSmsInboxDraftSuggestion | null>(null)
  const [draftBody, setDraftBody] = useState("")
  const [copied, setCopied] = useState(false)

  const [fromE164, setFromE164] = useState<string | null>(null)
  const [liveSendEnabled, setLiveSendEnabled] = useState<boolean | null>(null)
  const [readinessError, setReadinessError] = useState<string | null>(null)

  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)

  const recipientE164 = useMemo(() => {
    if (!selectedThread) return null
    return resolveInboxSmsRecipientE164({
      subject: selectedThread.subject,
      leadContactPhone: lead?.contactPhone,
      messages: selectedMessages,
    })
  }, [selectedThread, lead?.contactPhone, selectedMessages])

  const charCount = draftBody.length
  const bodyTooLong = charCount > GROWTH_SMS_OPERATOR_SEND_MAX_CHARS
  const bodyWarnLong = charCount > GROWTH_SMS_OPERATOR_SEND_WARN_CHARS
  const canSend =
    Boolean(selectedThread?.lead_id) &&
    Boolean(recipientE164) &&
    draftBody.trim().length > 0 &&
    !bodyTooLong &&
    !sending &&
    !Boolean(actionLoading) &&
    liveSendEnabled !== false

  const loadSuggestion = useCallback(async (leadId: string, draftType: "outbound" | "reply") => {
    setLoading(true)
    setDraftError(null)
    try {
      const response = await fetch(
        `/api/platform/growth/sms/personalization/draft?leadId=${leadId}&draftType=${draftType}`,
      )
      const payload = (await response.json()) as DraftPayload
      if (!response.ok) throw new Error(payload.message ?? "Could not load SMS draft suggestion.")

      const next = payload.suggestion ?? null
      setSuggestion(next)
      setDraftBody(next?.suggestedBody ?? "")
    } catch (loadError) {
      setDraftError(loadError instanceof Error ? loadError.message : "Could not load SMS draft.")
      setSuggestion(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadReadiness = useCallback(async () => {
    setReadinessError(null)
    try {
      const response = await fetch("/api/platform/growth/sms/readiness", { cache: "no-store" })
      const payload = (await response.json()) as ReadinessPayload & { error?: string; message?: string }
      if (!response.ok) {
        throw new Error(payload.message ?? "Could not load SMS readiness.")
      }
      setFromE164(typeof payload.fromE164 === "string" ? payload.fromE164 : null)
      setLiveSendEnabled(payload.liveSendEnabled !== false)
    } catch (readinessLoadError) {
      setFromE164(null)
      setLiveSendEnabled(null)
      setReadinessError(
        readinessLoadError instanceof Error ? readinessLoadError.message : "Could not load SMS readiness.",
      )
    }
  }, [])

  useEffect(() => {
    if (!selectedThread || selectedThread.channel !== "sms") {
      setSuggestion(null)
      setDraftBody("")
      setDraftError(null)
      setSendError(null)
      setSendResult(null)
      return
    }

    setSendError(null)
    setSendResult(null)
    void loadSuggestion(selectedThread.lead_id, "reply")
    void loadReadiness()
  }, [selectedThread, loadSuggestion, loadReadiness])

  const copyDraft = async () => {
    if (!draftBody.trim()) return
    await navigator.clipboard.writeText(draftBody)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  async function sendSms() {
    if (!selectedThread) return

    const body = draftBody.trim()
    if (!body) {
      setSendError("Enter a message before sending.")
      return
    }
    if (body.length > GROWTH_SMS_OPERATOR_SEND_MAX_CHARS) {
      setSendError("Message exceeds the 1600 character SMS limit.")
      return
    }
    if (!recipientE164) {
      setSendError("This thread does not have a valid recipient phone number.")
      return
    }

    setSending(true)
    setSendError(null)
    try {
      const response = await fetch("/api/platform/growth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedThread.lead_id,
          toE164: recipientE164,
          body,
        }),
      })
      const payload = (await response.json()) as GrowthSmsSendApiSuccess & GrowthSmsSendApiFailure

      if (!response.ok || !payload.ok) {
        throw new Error(mapGrowthSmsSendApiError(response.status, payload))
      }

      const sentAt = new Date().toISOString()
      setSendResult({ ...payload, sentAt })

      await loadThreadDetail(selectedThread.id)
      await refreshThreads()
      await refreshLeadContext()
    } catch (sendFailure) {
      setSendResult(null)
      setSendError(sendFailure instanceof Error ? sendFailure.message : "Could not send SMS.")
    } finally {
      setSending(false)
    }
  }

  if (!selectedThread || selectedThread.channel !== "sms") return null

  return (
    <div
      id="inbox-sms-draft"
      data-equipify-qa-marker={`${GROWTH_SMS_PERSONALIZATION_QA_MARKER}:${GROWTH_SMS_OPERATOR_SEND_QA_MARKER}`}
    >
      <GrowthInboxWidgetErrorBoundary label="SMS drafting">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Suggested SMS</p>
            <GrowthBadge label="Human approval required" tone="attention" />
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            SMS-specific personalization — not a shortened email. Edit the draft, review recipient details, then send.
          </p>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 space-y-1">
            <p className="font-medium">Review before sending</p>
            <p>SMS will be sent from {fromE164 ?? "…"}</p>
            <p>Recipient: {recipientE164 ?? "Phone not available on this thread"}</p>
            {liveSendEnabled === false ? (
              <p className="text-rose-800">Live SMS send is disabled in this environment.</p>
            ) : null}
            {readinessError ? <p className="text-rose-800">{readinessError}</p> : null}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generating SMS suggestion…
            </div>
          ) : null}

          {draftError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">{draftError}</p>
          ) : null}

          {suggestion ? (
            <div className="flex flex-wrap gap-1.5">
              <GrowthBadge label={`Hook: ${suggestion.audit.openingHook.strategy.replace(/_/g, " ")}`} tone="neutral" />
              <GrowthBadge label={`CTA: ${suggestion.audit.cta.category.replace(/_/g, " ")}`} tone="neutral" />
              <GrowthBadge label={`Quality ${suggestion.audit.qualityScore.overall}`} tone="healthy" />
              <GrowthBadge
                label={`${suggestion.charCount} chars · ${suggestion.segmentCount} seg`}
                tone="neutral"
              />
            </div>
          ) : null}

          <Textarea
            value={draftBody}
            onChange={(event) => {
              setDraftBody(event.target.value)
              setSendError(null)
            }}
            rows={4}
            disabled={Boolean(actionLoading) || sending}
            className="text-sm"
            placeholder="Edit SMS draft or type your message…"
          />

          <p
            className={cn(
              "text-[10px] text-muted-foreground",
              bodyWarnLong && !bodyTooLong && "text-amber-800",
              bodyTooLong && "text-rose-800",
            )}
          >
            {charCount} / {GROWTH_SMS_OPERATOR_SEND_MAX_CHARS} characters
            {bodyWarnLong && !bodyTooLong ? " — long message (may use multiple segments)" : ""}
            {bodyTooLong ? " — exceeds SMS send limit" : ""}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void copyDraft()} disabled={!draftBody.trim()}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={loading || sending || Boolean(actionLoading)}
              onClick={() => void loadSuggestion(selectedThread.lead_id, "reply")}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Regenerate
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={loading || sending || Boolean(actionLoading)}
              onClick={() => void loadSuggestion(selectedThread.lead_id, "outbound")}
            >
              Outbound variant
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canSend}
              data-sms-action="send"
              onClick={() => void sendSms()}
            >
              {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
              Send SMS
            </Button>
          </div>

          {sendError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sendError}</p>
          ) : null}

          {sendResult ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950 space-y-1">
              <p className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                SMS sent — {sendResult.status ?? "queued"}
              </p>
              {sendResult.deliveryAttemptId ? <p>Delivery attempt: {sendResult.deliveryAttemptId}</p> : null}
              {sendResult.providerMessageId ? <p>Provider SID: {sendResult.providerMessageId}</p> : null}
              <p>Sent at: {new Date(sendResult.sentAt).toLocaleString()}</p>
            </div>
          ) : null}

          {suggestion?.contextUsed.length ? (
            <p className="text-[10px] text-muted-foreground">Context: {suggestion.contextUsed.join(", ")}</p>
          ) : null}
          {suggestion?.memoryUsed.length ? (
            <p className="text-[10px] text-muted-foreground">Memory: {suggestion.memoryUsed.join(" · ")}</p>
          ) : null}
        </div>
      </GrowthInboxWidgetErrorBoundary>
    </div>
  )
}
