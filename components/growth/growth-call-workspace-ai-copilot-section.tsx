"use client"

import { useCallback, useState } from "react"
import { Bot, Check, Copy, Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type {
  VoiceAiCopilotSuggestionPublicView,
  VoiceAiCopilotWorkspaceSnapshot,
} from "@/lib/voice/ai-copilot/types"
import { VOICE_AI_COPILOT_QA_MARKER } from "@/lib/voice/ai-copilot/types"
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
  aiCopilot,
  onRefresh,
}: {
  voiceCallId: string | null
  aiCopilot: VoiceAiCopilotWorkspaceSnapshot | null
  onRefresh?: () => Promise<void>
}) {
  const [acting, setActing] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patchSuggestion = useCallback(
    async (suggestionId: string, action: "acknowledge" | "dismiss" | "copied") => {
      if (!voiceCallId) return
      setActing(`${action}:${suggestionId}`)
      setError(null)
      try {
        const res = await fetch(
          `/api/platform/growth/voice/calls/${voiceCallId}/ai-copilot/suggestions/${suggestionId}`,
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
    [onRefresh, voiceCallId],
  )

  const generateSuggestions = useCallback(async () => {
    if (!voiceCallId) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/voice/calls/${voiceCallId}/ai-copilot/generate`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not generate suggestions.")
      await onRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.")
    } finally {
      setGenerating(false)
    }
  }, [onRefresh, voiceCallId])

  if (!voiceCallId) return null

  const suggestions = aiCopilot?.activeSuggestions ?? []
  const draftSuggestions = aiCopilot?.draftSuggestions ?? []
  const canGenerate = aiCopilot?.canGenerate ?? false
  const cooldownMs = aiCopilot?.generationCooldownRemainingMs ?? 0

  return (
    <section
      className="rounded-xl border border-violet-200/60 bg-violet-50/20 p-3 dark:border-violet-900/30 dark:bg-violet-950/10"
      data-voice-ai-copilot-qa-marker={VOICE_AI_COPILOT_QA_MARKER}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-violet-700 dark:text-violet-300" />
          <p className="text-sm font-semibold">AI Copilot</p>
          <GrowthBadge label="Suggestion-only" tone="neutral" />
          <GrowthBadge label="AI does not act automatically" tone="attention" />
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

      {draftSuggestions.length > 0 ? (
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Drafts (copy/review only)</p>
          <div className="space-y-2">
            {draftSuggestions.map((suggestion) => (
              <CopilotSuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                voiceCallId={voiceCallId}
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
          <p className="text-sm font-medium">No AI copilot suggestions yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generate evidence-backed drafts from operator assist, intelligence, and transcript context.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions
            .filter((item) => !draftSuggestions.some((draft) => draft.id === item.id))
            .map((suggestion) => (
              <CopilotSuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                voiceCallId={voiceCallId}
                acting={acting}
                onLifecycle={patchSuggestion}
              />
            ))}
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {aiCopilot?.message ??
          "AI copilot drafts are operator-reviewed only. Nothing is sent, booked, transferred, or saved automatically."}
      </p>
    </section>
  )
}
