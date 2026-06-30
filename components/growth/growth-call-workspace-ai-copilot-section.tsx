"use client"

import { useCallback, useState } from "react"
import { Bot, Check, Copy, Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type {
  VoiceAiCopilotSuggestionPublicView,
  VoiceAiCopilotWorkspaceSnapshot,
} from "@/lib/voice/ai-copilot/types"
import { VOICE_AI_COPILOT_QA_MARKER, VOICE_DEEP_COPILOT_QA_MARKER } from "@/lib/voice/ai-copilot/types"
import { GROWTH_AVA_PANEL_TITLE } from "@/lib/growth/workspace/growth-workspace-ava-identity"
import { cn } from "@/lib/utils"

function formatSuggestionType(type: string): string {
  return type.replace(/_/g, " ")
}

function CopilotSuggestionCard({
  suggestion,
  voiceCallId,
  acting,
  onLifecycle,
}: {
  suggestion: VoiceAiCopilotSuggestionPublicView
  voiceCallId: string
  acting: string | null
  onLifecycle: (suggestionId: string, action: "acknowledge" | "dismiss" | "copied") => Promise<void>
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(suggestion.body)
      setCopied(true)
      await onLifecycle(suggestion.id, "copied")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard may be unavailable — still attempt lifecycle update
      await onLifecycle(suggestion.id, "copied")
    }
  }, [onLifecycle, suggestion.body, suggestion.id])

  return (
    <div
      className={cn(
        "rounded-xl border border-violet-200/70 bg-violet-50/30 px-3 py-3 dark:border-violet-900/40 dark:bg-violet-950/20",
        suggestion.status !== "active" && "opacity-60",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <GrowthBadge label={formatSuggestionType(suggestion.suggestionType)} tone="neutral" />
        <GrowthBadge label={`P${suggestion.priority}`} tone="healthy" />
        <GrowthBadge label={suggestion.generatedByProvider.replace(/_/g, " ")} tone="neutral" />
        {suggestion.status !== "active" ? (
          <GrowthBadge label={suggestion.status} tone="neutral" />
        ) : null}
      </div>
      <p className="text-sm font-semibold">{suggestion.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{suggestion.body}</p>
      {suggestion.body.includes("Why this suggestion:") ? (
        <p className="mt-2 rounded-md border border-violet-200/50 bg-violet-50/40 px-2 py-1.5 text-xs text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-100">
          {suggestion.body.split("Why this suggestion:")[1]?.trim() ?? ""}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">Evidence:</span> {suggestion.evidenceText}
      </p>
      {suggestion.sourceEventIds.length > 0 ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Source: {suggestion.sourceEventIds.length} linked event{suggestion.sourceEventIds.length === 1 ? "" : "s"}
        </p>
      ) : null}
      {suggestion.status === "active" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={acting != null}
            data-qa-action="ai-copilot-copy"
            onClick={() => void handleCopy()}
          >
            {copied ? (
              <>
                <Check className="mr-1.5 size-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1.5 size-3.5" />
                Copy draft
              </>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={acting != null}
            data-qa-action="ai-copilot-acknowledge"
            onClick={() => void onLifecycle(suggestion.id, "acknowledge")}
          >
            {acting === `acknowledge:${suggestion.id}` ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 size-3.5" />
            )}
            Acknowledge
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={acting != null}
            data-qa-action="ai-copilot-dismiss"
            onClick={() => void onLifecycle(suggestion.id, "dismiss")}
          >
            {acting === `dismiss:${suggestion.id}` ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <X className="mr-1.5 size-3.5" />
            )}
            Dismiss
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function GrowthCallWorkspaceAiCopilotSection({
  voiceCallId,
  nativeSessionId = null,
  aiCopilot,
  onRefresh,
}: {
  voiceCallId: string | null
  nativeSessionId?: string | null
  aiCopilot: VoiceAiCopilotWorkspaceSnapshot | null
  onRefresh?: () => Promise<void>
}) {
  const [acting, setActing] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canonicalVoiceCallId = voiceCallId ?? aiCopilot?.voiceCallId ?? null

  const patchSuggestion = useCallback(
    async (suggestionId: string, action: "acknowledge" | "dismiss" | "copied") => {
      if (!canonicalVoiceCallId) return
      setActing(`${action}:${suggestionId}`)
      setError(null)
      try {
        const res = await fetch(
          `/api/platform/growth/voice/calls/${canonicalVoiceCallId}/ai-copilot/suggestions/${suggestionId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          },
        )
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
        if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not update suggestion.")
        await onRefresh?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Suggestion action failed.")
      } finally {
        setActing(null)
      }
    },
    [onRefresh, canonicalVoiceCallId],
  )

  const generateSuggestions = useCallback(async () => {
    if (!canonicalVoiceCallId) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/voice/calls/${canonicalVoiceCallId}/ai-copilot/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSessionId: nativeSessionId ?? undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not generate suggestions.")
      await onRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.")
    } finally {
      setGenerating(false)
    }
  }, [nativeSessionId, onRefresh, canonicalVoiceCallId])

  if (!canonicalVoiceCallId) return null

  const suggestions = aiCopilot?.activeSuggestions ?? []
  const topSuggestions = aiCopilot?.topSuggestions ?? []
  const draftSuggestions = aiCopilot?.draftSuggestions ?? []
  const strategy = aiCopilot?.strategy ?? null
  const performanceInsights = aiCopilot?.performanceInsights ?? []
  const canGenerate = aiCopilot?.canGenerate ?? false
  const cooldownMs = aiCopilot?.generationCooldownRemainingMs ?? 0

  return (
    <section
      className="rounded-xl border border-violet-200/60 bg-violet-50/20 p-3 dark:border-violet-900/30 dark:bg-violet-950/10"
      data-voice-ai-copilot-qa-marker={VOICE_AI_COPILOT_QA_MARKER}
      data-voice-deep-copilot-qa-marker={VOICE_DEEP_COPILOT_QA_MARKER}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-violet-700 dark:text-violet-300" />
          <p className="text-sm font-semibold">{GROWTH_AVA_PANEL_TITLE}</p>
          <GrowthBadge label="Suggestion-only" tone="neutral" />
          <GrowthBadge label="Ava does not act automatically" tone="attention" />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canGenerate || generating}
          data-qa-action="ai-copilot-generate"
          onClick={() => void generateSuggestions()}
        >
          {generating ? (
            <>
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 size-3.5" />
              Generate suggestions
            </>
          )}
        </Button>
      </div>

      {cooldownMs > 0 ? (
        <p className="mb-2 text-xs text-muted-foreground">
          Generation cooldown: {Math.ceil(cooldownMs / 1000)}s remaining
        </p>
      ) : null}

      {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}

      {strategy ? (
        <div className="mb-3 space-y-2 rounded-lg border border-violet-200/50 bg-violet-50/30 px-3 py-2 dark:border-violet-900/40 dark:bg-violet-950/20">
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge
              label={`Phase: ${strategy.conversationPhase.phase.replace(/_/g, " ")}`}
              tone="healthy"
            />
            <GrowthBadge
              label={`${Math.round(strategy.conversationPhase.confidenceScore * 100)}% confidence`}
              tone="neutral"
            />
            {strategy.escalationSafeModeEnabled ? (
              <GrowthBadge label="Escalation-safe mode" tone="attention" />
            ) : null}
            {strategy.overloadPreventionActive ? (
              <GrowthBadge label="Overload prevention" tone="neutral" />
            ) : null}
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <p>
              Pacing: {strategy.pacing.operatorTalkPercent}% op / {strategy.pacing.customerTalkPercent}% customer (
              {strategy.pacing.pacingLabel.replace(/_/g, " ")})
            </p>
            <p>
              Escalation risk: {strategy.escalationLikelihood.level} · Discovery: {strategy.discoveryCompleteness.score}%
            </p>
          </div>
          {strategy.callQualityInsights.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Call quality coaching</p>
              {strategy.callQualityInsights.slice(0, 2).map((insight) => (
                <p key={insight.id} className="text-xs text-muted-foreground">
                  {insight.title}: {insight.coachingPrompt}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {performanceInsights.length > 0 ? (
        <div className="mb-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Operator coaching (internal, non-punitive)
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {performanceInsights.slice(0, 3).map((insight) => (
              <li key={insight.id}>
                {insight.insightType.replace(/_/g, " ")}: {insight.coachingPrompt ?? insight.evidenceText}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {topSuggestions.length > 0 ? (
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Top prioritized guidance</p>
          <div className="space-y-2">
            {topSuggestions.map((suggestion) => (
              <CopilotSuggestionCard
                key={`top:${suggestion.id}`}
                suggestion={suggestion}
                voiceCallId={canonicalVoiceCallId}
                acting={acting}
                onLifecycle={patchSuggestion}
              />
            ))}
          </div>
        </div>
      ) : null}

      {draftSuggestions.length > 0 ? (
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Drafts (copy/review only)</p>
          <div className="space-y-2">
            {draftSuggestions.map((suggestion) => (
              <CopilotSuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                voiceCallId={canonicalVoiceCallId}
                acting={acting}
                onLifecycle={patchSuggestion}
              />
            ))}
          </div>
        </div>
      ) : null}

      {suggestions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-violet-200/70 px-4 py-6 text-center dark:border-violet-900/40">
          <Bot className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm font-medium">No suggestions from Ava yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generate evidence-backed drafts from operator assist, intelligence, and transcript context.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions
            .filter(
              (item) =>
                !draftSuggestions.some((draft) => draft.id === item.id) &&
                !topSuggestions.some((top) => top.id === item.id),
            )
            .map((suggestion) => (
              <CopilotSuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                voiceCallId={canonicalVoiceCallId}
                acting={acting}
                onLifecycle={patchSuggestion}
              />
            ))}
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {aiCopilot?.message ??
          "Ava's drafts are operator-reviewed only. Nothing is sent, booked, transferred, or saved automatically."}
      </p>
    </section>
  )
}
