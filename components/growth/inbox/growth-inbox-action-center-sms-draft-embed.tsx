"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthInboxWidgetErrorBoundary } from "@/components/growth/growth-inbox-widget-error-boundary"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import {
  GROWTH_SMS_PERSONALIZATION_QA_MARKER,
  type GrowthSmsInboxDraftSuggestion,
} from "@/lib/growth/sms/personalization/sms-personalization-types"

type DraftPayload = {
  ok?: boolean
  suggestion?: GrowthSmsInboxDraftSuggestion
  message?: string
}

export function GrowthInboxActionCenterSmsDraftEmbed() {
  const { selectedThread, actionLoading } = useGrowthInboxWorkspace()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<GrowthSmsInboxDraftSuggestion | null>(null)
  const [draftBody, setDraftBody] = useState("")
  const [copied, setCopied] = useState(false)

  const loadSuggestion = useCallback(async (leadId: string, draftType: "outbound" | "reply") => {
    setLoading(true)
    setError(null)
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
      setError(loadError instanceof Error ? loadError.message : "Could not load SMS draft.")
      setSuggestion(null)
      setDraftBody("")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedThread || selectedThread.channel !== "sms") {
      setSuggestion(null)
      setDraftBody("")
      setError(null)
      return
    }

    void loadSuggestion(selectedThread.lead_id, "reply")
  }, [selectedThread, loadSuggestion])

  const copyDraft = async () => {
    if (!draftBody.trim()) return
    await navigator.clipboard.writeText(draftBody)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  if (!selectedThread || selectedThread.channel !== "sms") return null

  return (
    <div id="inbox-sms-draft" data-equipify-qa-marker={GROWTH_SMS_PERSONALIZATION_QA_MARKER}>
      <GrowthInboxWidgetErrorBoundary label="SMS drafting">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Suggested SMS</p>
            <GrowthBadge label="Human approval required" tone="attention" />
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            SMS-specific personalization — not a shortened email. Edit before sending via Quick Actions.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generating SMS suggestion…
            </div>
          ) : null}

          {error ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">{error}</p>
          ) : null}

          {suggestion ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                <GrowthBadge label={`Hook: ${suggestion.audit.openingHook.strategy.replace(/_/g, " ")}`} tone="neutral" />
                <GrowthBadge label={`CTA: ${suggestion.audit.cta.category.replace(/_/g, " ")}`} tone="neutral" />
                <GrowthBadge label={`Quality ${suggestion.audit.qualityScore.overall}`} tone="healthy" />
                <GrowthBadge
                  label={`${suggestion.charCount} chars · ${suggestion.segmentCount} seg`}
                  tone="neutral"
                />
              </div>

              <Textarea
                value={draftBody}
                onChange={(event) => setDraftBody(event.target.value)}
                rows={4}
                disabled={Boolean(actionLoading)}
                className="text-sm"
              />

              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void copyDraft()} disabled={!draftBody}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={loading || Boolean(actionLoading)}
                  onClick={() => void loadSuggestion(selectedThread.lead_id, "reply")}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Regenerate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={loading || Boolean(actionLoading)}
                  onClick={() => void loadSuggestion(selectedThread.lead_id, "outbound")}
                >
                  Outbound variant
                </Button>
              </div>

              {suggestion.contextUsed.length > 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  Context: {suggestion.contextUsed.join(", ")}
                </p>
              ) : null}
              {suggestion.memoryUsed.length > 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  Memory: {suggestion.memoryUsed.join(" · ")}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </GrowthInboxWidgetErrorBoundary>
    </div>
  )
}
