/** GS-AI-PLAYBOOK-4D.2 — Personalization workspace UI preferences (client-safe). */

import { GROWTH_PERSONALIZATION_DIAGNOSTICS_PREFERENCES_STORAGE_KEY } from "@/lib/growth/personalization/personalization-generation-ux"

export type GrowthPersonalizationDiagnosticsSectionKey =
  | "intelligence"
  | "quality"
  | "reasoning"
  | "sequence"

export type GrowthPersonalizationDiagnosticsPreferences = Record<
  GrowthPersonalizationDiagnosticsSectionKey,
  boolean
>

export const GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS: GrowthPersonalizationDiagnosticsPreferences =
  {
    intelligence: true,
    quality: true,
    reasoning: false,
    sequence: false,
  }

export function readPersonalizationDiagnosticsPreferences(): GrowthPersonalizationDiagnosticsPreferences {
  if (typeof window === "undefined") return { ...GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS }
  try {
    const raw = window.localStorage.getItem(GROWTH_PERSONALIZATION_DIAGNOSTICS_PREFERENCES_STORAGE_KEY)
    if (!raw) return { ...GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<GrowthPersonalizationDiagnosticsPreferences>
    return {
      intelligence: parsed.intelligence ?? GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS.intelligence,
      quality: parsed.quality ?? GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS.quality,
      reasoning: parsed.reasoning ?? GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS.reasoning,
      sequence: parsed.sequence ?? GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS.sequence,
    }
  } catch {
    return { ...GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS }
  }
}

export function persistPersonalizationDiagnosticsPreferences(
  preferences: GrowthPersonalizationDiagnosticsPreferences,
): GrowthPersonalizationDiagnosticsPreferences {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      GROWTH_PERSONALIZATION_DIAGNOSTICS_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    )
  }
  return preferences
}

export function togglePersonalizationDiagnosticsSection(
  section: GrowthPersonalizationDiagnosticsSectionKey,
): GrowthPersonalizationDiagnosticsPreferences {
  const current = readPersonalizationDiagnosticsPreferences()
  const next = { ...current, [section]: !current[section] }
  return persistPersonalizationDiagnosticsPreferences(next)
}
