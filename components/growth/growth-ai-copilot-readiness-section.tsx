"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, Loader2 } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import type { VoiceAiCopilotReadinessSnapshot } from "@/lib/voice/ai-copilot/types"
import { VOICE_AI_COPILOT_QA_MARKER, VOICE_DEEP_COPILOT_QA_MARKER } from "@/lib/voice/ai-copilot/types"

export function GrowthAiCopilotReadinessSection() {
  const [readiness, setReadiness] = useState<VoiceAiCopilotReadinessSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/ai-copilot/readiness", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { readiness?: VoiceAiCopilotReadinessSnapshot }
      if (res.ok && data.readiness) setReadiness(data.readiness)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <section className={GROWTH_SETTINGS_SECTION_GAP}>
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </section>
    )
  }

  if (!readiness) return null

  return (
    <section
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-voice-ai-copilot-qa-marker={VOICE_AI_COPILOT_QA_MARKER}
      data-voice-deep-copilot-qa-marker={VOICE_DEEP_COPILOT_QA_MARKER}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Bot className="size-4" />
        Ava readiness
      </p>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge
            label={readiness.deterministicModeActive ? "Deterministic mode active" : "Deterministic fallback"}
            tone="healthy"
          />
          <GrowthBadge
            label={readiness.openAiAugmentationEnabled ? "OpenAI augmentation on" : "OpenAI augmentation off"}
            tone={readiness.openAiAugmentationEnabled ? "healthy" : "neutral"}
          />
          <GrowthBadge label="Structured output enforced" tone="neutral" />
          <GrowthBadge label="Evidence validation enabled" tone="neutral" />
          <GrowthBadge label="Overload prevention enabled" tone="neutral" />
          <GrowthBadge label="Escalation-safe mode" tone="neutral" />
          <GrowthBadge label="Autonomous actions disabled" tone="neutral" />
        </div>
        <p className="text-xs text-muted-foreground">{readiness.message}</p>
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <li>Provider: {readiness.providerMode.replace(/_/g, " ")}</li>
          <li>Max active suggestions: {readiness.maxActiveSuggestions}</li>
          <li>Max per call: {readiness.maxSuggestionsPerCall}</li>
          <li>Performance insights: {readiness.performanceInsightsReady ? "ready" : "pending"}</li>
          <li>Schema: {readiness.schemaReady ? "ready" : "pending migration"}</li>
          <li>Active suggestions: {readiness.activeSuggestionCount}</li>
        </ul>
      </div>
    </section>
  )
}
