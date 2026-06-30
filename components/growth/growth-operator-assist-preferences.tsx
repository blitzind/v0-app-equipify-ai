"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import {
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_INNER_GAP,
  GrowthSettingsCard,
  GrowthSettingsToggleRow,
} from "@/components/growth/growth-settings-ui"
import { GROWTH_AVA_CALL_ASSISTANCE_TITLE } from "@/lib/growth/workspace/growth-workspace-ava-identity"
import {
  DEFAULT_OPERATOR_ASSIST_PREFERENCES,
  VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER,
  type OperatorAssistPreferencesPublicView,
  type UnifiedOperatorAssistCategory,
} from "@/lib/growth/operator-assist/types"

const CATEGORY_LABELS: Record<UnifiedOperatorAssistCategory, string> = {
  objection: "Objection handling",
  buying_signal: "Buying signals",
  risk: "Risk alerts",
  guidance: "Call guidance",
  coaching: "Coaching prompts",
  interruption: "Interruptions",
  conversation: "Conversation signals",
}

export function GrowthOperatorAssistPreferencesPanel() {
  const [preferences, setPreferences] = useState<OperatorAssistPreferencesPublicView>(
    DEFAULT_OPERATOR_ASSIST_PREFERENCES,
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/operator-assist/preferences", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        preferences?: OperatorAssistPreferencesPublicView
        message?: string
      }
      if (!res.ok || !data.ok || !data.preferences) {
        throw new Error(data.message ?? "Could not load call assistance settings from Ava.")
      }
      setPreferences(data.preferences)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(patch: Partial<OperatorAssistPreferencesPublicView>) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/operator-assist/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        preferences?: OperatorAssistPreferencesPublicView
        message?: string
      }
      if (!res.ok || !data.ok || !data.preferences) {
        throw new Error(data.message ?? "Could not save preferences.")
      }
      setPreferences(data.preferences)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading call assistance from Ava…
      </div>
    )
  }

  return (
    <div data-voice-unified-operator-assist-qa-marker={VOICE_UNIFIED_OPERATOR_ASSIST_QA_MARKER}>
      <GrowthSettingsCard title={GROWTH_AVA_CALL_ASSISTANCE_TITLE} icon={<Sparkles className="size-4" />}>
        <p className="mb-4 text-sm text-muted-foreground">
          Control real-time suggestions, objections, and buying signals during live calls.
        </p>
        <div className={GROWTH_SETTINGS_FORM_GAP}>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className={GROWTH_SETTINGS_INNER_GAP}>
          <GrowthSettingsToggleRow
            label="Focus mode"
            description="Hide lower-priority assist cards while you are on a call."
            checked={preferences.quietMode}
            disabled={saving}
            onCheckedChange={(checked) => void save({ quietMode: checked })}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="operator-assist-min-priority">
              Minimum alert priority
            </label>
            <select
              id="operator-assist-min-priority"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={preferences.minimumPriorityLabel}
              disabled={saving}
              onChange={(event) =>
                void save({
                  minimumPriorityLabel: event.target.value as OperatorAssistPreferencesPublicView["minimumPriorityLabel"],
                })
              }
            >
              {(["Critical", "High", "Medium", "Low"] as const).map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Suggestion categories</p>
            {(Object.keys(CATEGORY_LABELS) as UnifiedOperatorAssistCategory[]).map((category) => (
              <GrowthSettingsToggleRow
                key={category}
                label={CATEGORY_LABELS[category]}
                checked={preferences.enabledCategories[category]}
                disabled={saving}
                onCheckedChange={(checked) =>
                  void save({
                    enabledCategories: { ...preferences.enabledCategories, [category]: checked },
                  })
                }
              />
            ))}
          </div>
        </div>
        </div>
      </GrowthSettingsCard>
    </div>
  )
}
