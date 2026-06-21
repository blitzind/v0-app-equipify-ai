"use client"

import { useCallback, useEffect, useState } from "react"
import type { GrowthPersonalizationLeadSummary } from "@/lib/growth/personalization/embedded/growth-personalization-embedded-types"
import {
  fetchPersonalizationSummary,
  generatePersonalizationForLead,
  regeneratePersonalizationForGeneration,
} from "@/lib/growth/personalization/embedded/growth-personalization-embedded-runtime"
import type { GrowthPersonalizationRegenerationFeedbackCategory } from "@/lib/growth/personalization/personalization-types"

export function useGrowthLeadPersonalization(leadId: string | null | undefined) {
  const [summary, setSummary] = useState<GrowthPersonalizationLeadSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!leadId) {
      setSummary(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const next = await fetchPersonalizationSummary(leadId)
      setSummary(next)
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not load personalization.")
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const generate = useCallback(async () => {
    if (!leadId) return
    setGenerating(true)
    setError(null)
    try {
      await generatePersonalizationForLead({ leadId, priorGenerationId: summary?.generationId ?? null })
      await refresh()
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Generation failed.")
    } finally {
      setGenerating(false)
    }
  }, [leadId, refresh, summary?.generationId])

  const regenerate = useCallback(
    async (input?: {
      regenerationFeedback?: {
        category: GrowthPersonalizationRegenerationFeedbackCategory
        customNotes?: string | null
      } | null
    }) => {
      if (!leadId) return
      setGenerating(true)
      setError(null)
      try {
        if (summary?.generationId) {
          await regeneratePersonalizationForGeneration({
            leadId,
            generationId: summary.generationId,
            regenerationFeedback: input?.regenerationFeedback ?? null,
          })
        } else {
          await generatePersonalizationForLead({ leadId })
        }
        await refresh()
      } catch (regenerateError) {
        setError(regenerateError instanceof Error ? regenerateError.message : "Regeneration failed.")
      } finally {
        setGenerating(false)
      }
    },
    [leadId, refresh, summary?.generationId],
  )

  return {
    summary,
    loading,
    generating,
    error,
    refresh,
    generate,
    regenerate,
  }
}
