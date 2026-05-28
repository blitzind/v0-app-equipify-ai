"use client"

import { useCallback, useEffect, useState } from "react"
import { Brain, Loader2 } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import type { VoiceRelationshipMemoryReadinessSnapshot } from "@/lib/voice/relationship-memory/types"
import { VOICE_RELATIONSHIP_MEMORY_QA_MARKER } from "@/lib/voice/relationship-memory/types"

export function GrowthRelationshipMemoryReadinessSection() {
  const [readiness, setReadiness] = useState<VoiceRelationshipMemoryReadinessSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/relationship-memory/readiness", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { readiness?: VoiceRelationshipMemoryReadinessSnapshot }
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
      data-voice-relationship-memory-qa-marker={VOICE_RELATIONSHIP_MEMORY_QA_MARKER}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Brain className="size-4" />
        Relationship Memory Readiness
      </p>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge
            label={readiness.memoryExtractionStatus}
            tone={readiness.memoryExtractionStatus === "ready" ? "healthy" : "attention"}
          />
          <GrowthBadge label="Passive mode" tone="neutral" />
          <GrowthBadge label="No autonomous actions" tone="neutral" />
        </div>
        <p className="text-xs text-muted-foreground">{readiness.message}</p>
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <li>Draft backlog: {readiness.draftReviewBacklog}</li>
          <li>Accepted drafts: {readiness.acceptedDraftCount}</li>
          <li>Rejected drafts: {readiness.rejectedDraftCount}</li>
          <li>Unresolved objections: {readiness.unresolvedObjectionCount}</li>
          <li>Confidence threshold: {Math.round(readiness.confidenceThreshold * 100)}%</li>
          <li>Schema: {readiness.schemaReady ? "ready" : "pending migration"}</li>
        </ul>
      </div>
    </section>
  )
}
