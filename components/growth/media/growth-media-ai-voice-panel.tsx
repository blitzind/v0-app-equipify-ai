"use client"

import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  extractContentMergeFields,
  isBlockedContentVariable,
  validateContentMergeFields,
} from "@/lib/growth/content/merge-field-validator"
import {
  GROWTH_MEDIA_ELEVENLABS_VOICE_CATALOG,
  listEnabledMediaVoices,
  type GrowthMediaVoiceDefinition,
} from "@/lib/growth/media/media-voice-types"
import { GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS } from "@/lib/growth/media/media-voice-generation-types"
import { buildPersonalizedVoiceScriptPreview } from "@/lib/growth/media/media-voice-generation-utils"
import type { GrowthSharePageTemplateVideoVoiceCloneSettings } from "@/lib/growth/share-pages/share-page-template-block-types"

function defaultVoiceCloneSettings(): GrowthSharePageTemplateVideoVoiceCloneSettings {
  return {
    enabled: false,
    voiceId: GROWTH_MEDIA_ELEVENLABS_VOICE_CATALOG[0]?.voiceId ?? null,
    scriptTemplate: "Hi {{prospect.name}}, this is {{sender.name}} from {{sender.company}}.",
    mergeFieldsUsed: ["prospect.name", "sender.name", "sender.company"],
  }
}

export function GrowthMediaAiVoicePanel({
  voiceClone,
  mergeValues,
  disabled,
  onChange,
}: {
  voiceClone: GrowthSharePageTemplateVideoVoiceCloneSettings | null | undefined
  mergeValues: Record<string, string>
  disabled?: boolean
  onChange: (next: GrowthSharePageTemplateVideoVoiceCloneSettings) => void
}) {
  const settings = voiceClone ?? defaultVoiceCloneSettings()
  const voices = listEnabledMediaVoices("elevenlabs")
  const selectedVoice: GrowthMediaVoiceDefinition | null =
    voices.find((voice) => voice.voiceId === settings.voiceId) ?? voices[0] ?? null

  const allowedKeys = useMemo(() => new Set(Object.keys(mergeValues)), [mergeValues])
  const scriptPreview = useMemo(
    () =>
      buildPersonalizedVoiceScriptPreview({
        scriptTemplate: settings.scriptTemplate ?? "",
        personalizationContext: {
          prospectName: mergeValues["prospect.name"] ?? mergeValues["lead.contact_name"],
          companyName: mergeValues["company.name"] ?? mergeValues["lead.company_name"],
          senderName: mergeValues["sender.name"],
          senderCompany: mergeValues["sender.company"],
          customMergeValues: mergeValues,
        },
      }),
    [mergeValues, settings.scriptTemplate],
  )

  const mergeValidation = validateContentMergeFields({
    text: settings.scriptTemplate ?? "",
    allowedKeys,
  })
  const detectedFields = extractContentMergeFields(settings.scriptTemplate ?? "")
  const blockedFields = detectedFields.filter(isBlockedContentVariable)

  const updateSettings = (patch: Partial<GrowthSharePageTemplateVideoVoiceCloneSettings>) => {
    const nextScript = patch.scriptTemplate ?? settings.scriptTemplate ?? ""
    onChange({
      ...settings,
      ...patch,
      mergeFieldsUsed: extractContentMergeFields(nextScript),
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-sky-300/80 p-3 dark:border-sky-800">
      <div>
        <p className="text-sm font-medium">AI voice clone (S2-G foundation)</p>
        <p className="text-xs text-muted-foreground">
          Voice profile + script template preview only — no Generate button, provider execution, playback, or audio creation.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={disabled}
          onChange={(e) => updateSettings({ enabled: e.target.checked })}
        />
        Enable voice cloning spec for this placeholder
      </label>

      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <div className="flex size-24 items-center justify-center rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground">
          {selectedVoice?.displayName?.slice(0, 1) ?? "V"}
        </div>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Voice profile</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={settings.voiceId ?? ""}
              disabled={disabled || !settings.enabled}
              onChange={(e) => updateSettings({ voiceId: e.target.value || null })}
            >
              {voices.map((voice) => (
                <option key={voice.voiceId} value={voice.voiceId}>
                  {voice.displayName} ({voice.language})
                </option>
              ))}
            </select>
          </div>
          {selectedVoice ? (
            <p className="text-[11px] text-muted-foreground">
              {selectedVoice.category} · {selectedVoice.accent ?? "neutral accent"} · Models:{" "}
              {selectedVoice.supportedModels.join(", ")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Script template</Label>
        <Textarea
          value={settings.scriptTemplate ?? ""}
          disabled={disabled || !settings.enabled}
          rows={4}
          onChange={(e) => updateSettings({ scriptTemplate: e.target.value })}
        />
      </div>

      {detectedFields.length > 0 ? (
        <div className="rounded-md border border-border bg-muted/40 p-2 text-[11px]">
          <p className="font-medium">Merge fields detected</p>
          <p className="mt-1 text-muted-foreground">{detectedFields.join(", ")}</p>
          {blockedFields.length > 0 ? (
            <p className="mt-1 text-rose-600">Blocked: {blockedFields.join(", ")}</p>
          ) : null}
          {mergeValidation.unknownVariables.length > 0 ? (
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              Unknown: {mergeValidation.unknownVariables.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-background p-3 text-xs">
        <p className="font-medium">Resolved script preview</p>
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{scriptPreview.resolvedScript}</p>
        {scriptPreview.usedFallback ? (
          <p className="mt-2 text-amber-700 dark:text-amber-300">Fallback preview text used.</p>
        ) : null}
      </div>

      <div className="rounded-md border border-emerald-300/70 bg-emerald-50/70 p-2 text-[11px] text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-medium">Safety state</p>
        <p>provider_execution_enabled: {String(GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.provider_execution_enabled)}</p>
        <p>autonomous_execution_enabled: {String(GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.autonomous_execution_enabled)}</p>
        <p>no_voice_generation_executed: {String(GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.no_voice_generation_executed)}</p>
        <p>no_generated_audio_assets: {String(GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.no_generated_audio_assets)}</p>
        <p>no_playback: {String(GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS.no_playback)}</p>
      </div>
    </div>
  )
}
