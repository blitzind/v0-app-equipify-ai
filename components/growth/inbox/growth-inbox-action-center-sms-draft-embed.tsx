"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Copy, Loader2, Phone, Send, Sparkles, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthConversationalPlaybooksPanel } from "@/components/growth/growth-conversational-playbooks-panel"
import { GrowthHumanInterventionsPanel } from "@/components/growth/growth-human-interventions-panel"
import { GrowthSmartFollowUpPoliciesPanel } from "@/components/growth/growth-smart-follow-up-policies-panel"
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
  GROWTH_SMS_INBOUND_RESPONSE_SUGGESTIONS_QA_MARKER,
  type GrowthInboundSmsResponseSuggestions,
} from "@/lib/growth/sms/inbound-sms-response-suggestion-types"
import { cn } from "@/lib/utils"

type SuggestionsPayload = {
  ok?: boolean
  suggestions?: GrowthInboundSmsResponseSuggestions
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

function latestInboundBody(
  messages: { direction: string; body_preview: string; message_timestamp: string }[],
): string | null {
  const inbound = messages
    .filter((message) => message.direction === "inbound" && message.body_preview.trim())
    .sort((a, b) => b.message_timestamp.localeCompare(a.message_timestamp))
  return inbound[0]?.body_preview.trim() ?? null
}

export function GrowthInboxActionCenterSmsDraftEmbed() {
  const { selectedThread, selectedMessages, actionLoading, loadThreadDetail, refreshThreads } =
    useGrowthInboxWorkspace()
  const { lead, refresh: refreshLeadContext, refreshWorkflow } = useGrowthInboxLeadContext()

  const [loading, setLoading] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<GrowthInboundSmsResponseSuggestions | null>(null)
  const [draftBody, setDraftBody] = useState("")
  const [copied, setCopied] = useState(false)

  const [fromE164, setFromE164] = useState<string | null>(null)
  const [liveSendEnabled, setLiveSendEnabled] = useState<boolean | null>(null)
  const [readinessError, setReadinessError] = useState<string | null>(null)

  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  const [workflowLoading, setWorkflowLoading] = useState<string | null>(null)
  const [workflowError, setWorkflowError] = useState<string | null>(null)

  const inboundBody = useMemo(() => latestInboundBody(selectedMessages), [selectedMessages])

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

  const loadSuggestions = useCallback(
    async (leadId: string, threadId: string, bodyPreview: string | null) => {
      setLoading(true)
      setDraftError(null)
      try {
        const params = new URLSearchParams({ leadId, threadId })
        if (bodyPreview) params.set("inboundBody", bodyPreview)
        const response = await fetch(`/api/platform/growth/sms/inbound-suggestions?${params.toString()}`)
        const payload = (await response.json()) as SuggestionsPayload
        if (!response.ok) throw new Error(payload.message ?? "Could not load SMS response suggestions.")

        const next = payload.suggestions ?? null
        setSuggestions(next)
        setDraftBody(next?.smsReply.suggestedBody ?? "")
      } catch (loadError) {
        setDraftError(loadError instanceof Error ? loadError.message : "Could not load SMS suggestions.")
        setSuggestions(null)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

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
      setSuggestions(null)
      setDraftBody("")
      setDraftError(null)
      setSendError(null)
      setSendResult(null)
      return
    }

    setSendError(null)
    setSendResult(null)
    void loadSuggestions(selectedThread.lead_id, selectedThread.id, inboundBody)
    void loadReadiness()
  }, [selectedThread, inboundBody, loadSuggestions, loadReadiness])

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

  async function runWorkflowAction(type: "call" | "mark_interested" | "opportunity") {
    if (!selectedThread?.lead_id) return
    setWorkflowLoading(type)
    setWorkflowError(null)
    try {
      if (type === "opportunity") {
        document.dispatchEvent(new CustomEvent("growth-inbox-open-opportunity-dialog"))
        return
      }

      const endpoint =
        type === "call"
          ? "/api/platform/growth/replies/workflow-actions/create-call-task"
          : "/api/platform/growth/replies/workflow-actions/mark-interested"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selectedThread.lead_id }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!response.ok) throw new Error(payload.error ?? payload.message ?? "Workflow action failed.")
      await refreshWorkflow()
    } catch (actionError) {
      setWorkflowError(actionError instanceof Error ? actionError.message : "Workflow action failed.")
    } finally {
      setWorkflowLoading(null)
    }
  }

  if (!selectedThread || selectedThread.channel !== "sms") return null

  const replyContext = suggestions?.replyContext

  return (
    <div
      id="inbox-sms-draft"
      data-equipify-qa-marker={`${GROWTH_SMS_INBOUND_RESPONSE_SUGGESTIONS_QA_MARKER}:${GROWTH_SMS_OPERATOR_SEND_QA_MARKER}`}
    >
      <GrowthInboxWidgetErrorBoundary label="SMS response suggestions">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">SMS Response Suggestions</p>
            <GrowthBadge label="Human approval required" tone="attention" />
          </div>

          {inboundBody ? (
            <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs space-y-1.5">
              <p className="font-medium text-foreground">Lead replied</p>
              <p className="text-muted-foreground italic">&ldquo;{inboundBody}&rdquo;</p>
              {replyContext ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <GrowthBadge label={`Intent: ${replyContext.intent.replace(/_/g, " ")}`} tone="healthy" />
                  <GrowthBadge label={`Sentiment: ${replyContext.sentiment}`} tone="neutral" />
                  <GrowthBadge label={replyContext.engagementSignal} tone="attention" />
                  {suggestions?.nextBestActionLabel ? (
                    <GrowthBadge label={`NBA: ${suggestions.nextBestActionLabel}`} tone="neutral" />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No inbound SMS on this thread yet.</p>
          )}

          {suggestions?.callPrompt ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 space-y-1">
              <p className="font-medium flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                Suggested call prompt
              </p>
              <p>
                <span className="font-medium">Why now:</span> {suggestions.callPrompt.whyCallNow}
              </p>
              <p>
                <span className="font-medium">Open with:</span> {suggestions.callPrompt.openingLine}
              </p>
              <p>
                <span className="font-medium">Ask:</span> {suggestions.callPrompt.keyQuestion}
              </p>
              <p>
                <span className="font-medium">Aim for:</span> {suggestions.callPrompt.desiredOutcome}
              </p>
            </div>
          ) : null}

          {suggestions?.emailFollowUp ? (
            <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-950 space-y-1">
              <p className="font-medium">Suggested email follow-up</p>
              <p className="font-medium">{suggestions.emailFollowUp.label}</p>
              <p>{suggestions.emailFollowUp.summary}</p>
              {suggestions.emailFollowUp.suggestedSubject ? (
                <p className="text-[10px] text-violet-800">Subject idea: {suggestions.emailFollowUp.suggestedSubject}</p>
              ) : null}
              <p className="text-[10px] text-violet-800">Suggestion only — operator sends email manually.</p>
            </div>
          ) : null}

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

          {suggestions?.safetyWarnings.length ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-900 space-y-0.5">
              {suggestions.safetyWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          {suggestions?.smsReply ? (
            <div className="flex flex-wrap gap-1.5">
              <GrowthBadge
                label={`Confidence: ${Math.round(suggestions.replyContext.confidence * 100)}% (${suggestions.replyContext.confidenceTier})`}
                tone="neutral"
              />
              <GrowthBadge label={`Quality ${suggestions.smsReply.audit.qualityScore.overall}`} tone="healthy" />
              <GrowthBadge
                label={`${suggestions.smsReply.charCount} chars · ${suggestions.smsReply.segmentCount} seg`}
                tone="neutral"
              />
            </div>
          ) : null}

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-foreground">Suggested SMS reply</p>
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
          </div>

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
              disabled={loading || sending || Boolean(actionLoading) || !inboundBody}
              onClick={() =>
                void loadSuggestions(selectedThread.lead_id, selectedThread.id, inboundBody)
              }
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Regenerate
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

          <div className="border-t border-border/60 pt-3">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">Quick actions</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="justify-start"
                disabled={Boolean(workflowLoading) || sending}
                onClick={() => void runWorkflowAction("call")}
              >
                {workflowLoading === "call" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Phone className="mr-1.5 h-3.5 w-3.5" />
                )}
                Create call task
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="justify-start"
                disabled={Boolean(workflowLoading) || sending}
                onClick={() => void runWorkflowAction("mark_interested")}
              >
                {workflowLoading === "mark_interested" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                Mark interested
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="justify-start col-span-2"
                disabled={Boolean(workflowLoading) || sending}
                onClick={() => void runWorkflowAction("opportunity")}
              >
                {workflowLoading === "opportunity" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Target className="mr-1.5 h-3.5 w-3.5" />
                )}
                Create opportunity
              </Button>
            </div>
            {workflowError ? <p className="mt-2 text-xs text-rose-600">{workflowError}</p> : null}
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

          {suggestions?.contextUsed.length ? (
            <p className="text-[10px] text-muted-foreground">Context: {suggestions.contextUsed.join(", ")}</p>
          ) : null}
          {suggestions?.memoryUsed.length ? (
            <p className="text-[10px] text-muted-foreground">Memory: {suggestions.memoryUsed.join(" · ")}</p>
          ) : null}

          <GrowthConversationalPlaybooksPanel
            consumer="sms"
            title="SMS Conversational Playbook"
            leadId={selectedThread.lead_id}
            compact
          />
          <GrowthHumanInterventionsPanel
            title="Human Interventions"
            leadId={selectedThread.lead_id}
            compact
          />
          <GrowthSmartFollowUpPoliciesPanel
            title="Smart Follow-Up Policies"
            leadId={selectedThread.lead_id}
            compact
          />
        </div>
      </GrowthInboxWidgetErrorBoundary>
    </div>
  )
}
