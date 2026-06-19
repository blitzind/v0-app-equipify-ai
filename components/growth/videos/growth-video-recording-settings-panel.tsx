"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_SECTION_GAP,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
import {
  GrowthSettingsField,
  GrowthSettingsSectionErrorState,
  GrowthSettingsSectionForm,
  GrowthSettingsSectionLoadingState,
} from "@/components/growth/settings/growth-settings-section-form-state"
import { GrowthVideoSettingsSectionLayout } from "@/components/growth/videos/growth-video-settings-section-layout"
import { useGrowthVideoSettings } from "@/hooks/growth/use-growth-video-settings"
import type { GrowthVideoSettingsRecordingDefaults } from "@/lib/growth/videos/growth-video-settings-types"
import { GROWTH_VIDEO_RECORDING_QUALITIES } from "@/lib/growth/videos/growth-video-settings-types"
import { GROWTH_VIDEO_SOURCE_TYPES } from "@/lib/growth/videos/growth-video-types"

export function GrowthVideoRecordingSettingsPanel() {
  const { settings, loading, saving, error, refresh, patch } = useGrowthVideoSettings()
  const [draft, setDraft] = useState<GrowthVideoSettingsRecordingDefaults | null>(null)

  useEffect(() => {
    if (settings) setDraft(settings.recordingDefaults)
  }, [settings])

  async function save() {
    if (!draft) return
    await patch({ recording_defaults: draft })
  }

  return (
    <GrowthVideoSettingsSectionLayout
      title="Recording Defaults"
      description="Saved defaults for future recording sessions."
      section="recording"
    >
      {loading ? <GrowthSettingsSectionLoadingState /> : null}
      {!loading && error ? <GrowthSettingsSectionErrorState message={error} onRetry={() => void refresh()} /> : null}
      {!loading && !error && draft ? (
        <GrowthSettingsSectionForm
          footer={
            <div className="flex items-center gap-3">
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
                Save recording defaults
              </Button>
              {saving ? <span className="text-xs text-muted-foreground">Saving…</span> : null}
            </div>
          }
        >
          <div className={GROWTH_SETTINGS_SECTION_GAP}>
            <GrowthSettingsCard title="Capture defaults">
              <div className={GROWTH_SETTINGS_FORM_GAP}>
                <p className="text-sm text-muted-foreground">
                  Recording UI remains foundational — these defaults are stored for future capture flows only.
                </p>
                <GrowthSettingsField label="Default recording mode">
                  <select
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={draft.recordingMode}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current!,
                        recordingMode: event.target.value as GrowthVideoSettingsRecordingDefaults["recordingMode"],
                      }))
                    }
                  >
                    {GROWTH_VIDEO_SOURCE_TYPES.filter((mode) => mode !== "ai_generated").map((mode) => (
                      <option key={mode} value={mode}>
                        {mode.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </GrowthSettingsField>
                <GrowthSettingsField label="Default quality">
                  <select
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={draft.quality}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current!,
                        quality: event.target.value as GrowthVideoSettingsRecordingDefaults["quality"],
                      }))
                    }
                  >
                    {GROWTH_VIDEO_RECORDING_QUALITIES.map((quality) => (
                      <option key={quality} value={quality}>
                        {quality.replace(/_/g, " ").toUpperCase()}
                      </option>
                    ))}
                  </select>
                </GrowthSettingsField>
                <GrowthSettingsField label="Default max duration (seconds)">
                  <Input
                    type="number"
                    min={30}
                    max={3600}
                    value={draft.maxDurationSeconds}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current!,
                        maxDurationSeconds: Number(event.target.value) || current!.maxDurationSeconds,
                      }))
                    }
                  />
                </GrowthSettingsField>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 dark:border-[#25324C]">
                  <div>
                    <Label className="text-sm">Transcript by default</Label>
                    <p className="text-xs text-muted-foreground">Metadata only until transcript pipeline ships.</p>
                  </div>
                  <Switch
                    checked={draft.transcriptEnabled}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current!, transcriptEnabled: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 dark:border-[#25324C]">
                  <div>
                    <Label className="text-sm">Captions by default</Label>
                    <p className="text-xs text-muted-foreground">Metadata only until captions pipeline ships.</p>
                  </div>
                  <Switch
                    checked={draft.captionsEnabled}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current!, captionsEnabled: checked }))
                    }
                  />
                </div>
              </div>
            </GrowthSettingsCard>
          </div>
        </GrowthSettingsSectionForm>
      ) : null}
    </GrowthVideoSettingsSectionLayout>
  )
}
