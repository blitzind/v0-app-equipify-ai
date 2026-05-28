"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, Loader2 } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import type { VoiceAiCopilotReadinessSnapshot } from "@/lib/voice/ai-copilot/types"
import { VOICE_AI_COPILOT_QA_MARKER } from "@/lib/voice/ai-copilot/types"

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
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Bot className="size-4" />
        AI Copilot Readiness
      </p>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge label={`Provider: ${readiness.providerMode.replace(/_/g, " ")}`} tone="neutral" />
          <GrowthBadge
            label={readiness.openAiEnabled ? "OpenAI enabled" : "OpenAI disabled"}
            tone={readiness.openAiEnabled ? "healthy" : "neutral"}
          />
          <GrowthBadge
            label={readiness.deterministicFallbackReady ? "Deterministic fallback ready" : "Fallback pending"}
            tone={readiness.deterministicFallbackReady ? "healthy" : "attention"}
          />
          <GrowthBadge label="Evidence required" tone="neutral" />
          <GrowthBadge label="Autonomous actions disabled" tone="neutral" />
          <GrowthBadge label="Guardrails enabled" tone="neutral" />
        </div>
        <p className="text-xs text-muted-foreground">{readiness.message}</p>
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <li>Max suggestions per call: {readiness.maxSuggestionsPerCall}</li>
          <li>Active suggestions: {readiness.activeSuggestionCount}</li>
          <li>Schema: {readiness.schemaReady ? "ready" : "pending migration"}</li>
        </ul>
      </div>
    </section>
  )
}
