"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { GrowthMediaPicker } from "@/components/growth/media-library/growth-media-picker"
import { GrowthVideoSettingsSectionLayout } from "@/components/growth/videos/growth-video-settings-section-layout"
import { useGrowthVideoSettings } from "@/hooks/growth/use-growth-video-settings"
import type { GrowthVideoSettingsBranding } from "@/lib/growth/videos/growth-video-settings-types"

export function GrowthVideoBrandingSettingsPanel() {
  const { settings, loading, saving, error, refresh, patch } = useGrowthVideoSettings()
  const [draft, setDraft] = useState<GrowthVideoSettingsBranding | null>(null)

  useEffect(() => {
    if (settings) setDraft(settings.branding)
  }, [settings])

  async function save() {
    if (!draft) return
    await patch({ branding: draft })
  }

  return (
    <GrowthVideoSettingsSectionLayout
      title="Branding"
      description="Default branding applied to new video pages."
      section="branding"
    >
      {loading ? <GrowthSettingsSectionLoadingState /> : null}
      {!loading && error ? <GrowthSettingsSectionErrorState message={error} onRetry={() => void refresh()} /> : null}
      {!loading && !error && draft ? (
        <GrowthSettingsSectionForm
          footer={
            <div className="flex items-center gap-3">
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
                Save branding defaults
              </Button>
              {saving ? <span className="text-xs text-muted-foreground">Saving…</span> : null}
            </div>
          }
        >
          <div className={GROWTH_SETTINGS_SECTION_GAP}>
            <GrowthSettingsCard title="Visual defaults">
              <div className={GROWTH_SETTINGS_FORM_GAP}>
                <GrowthSettingsField label="Logo">
                  <GrowthMediaPicker
                    value={draft.logoUrl ?? ""}
                    acceptedTypes={["logo", "image"]}
                    allowManualUrl
                    onChange={(url) => setDraft((current) => ({ ...current!, logoUrl: url || null }))}
                  />
                </GrowthSettingsField>
                <GrowthSettingsField label="Primary color">
                  <Input
                    value={draft.primaryColor ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current!, primaryColor: event.target.value || null }))
                    }
                    placeholder="#2563eb"
                  />
                </GrowthSettingsField>
                <GrowthSettingsField label="Accent color">
                  <Input
                    value={draft.accentColor ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current!, accentColor: event.target.value || null }))
                    }
                    placeholder="#7c3aed"
                  />
                </GrowthSettingsField>
                <GrowthSettingsField label="Button color">
                  <Input
                    value={draft.buttonColor ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current!, buttonColor: event.target.value || null }))
                    }
                    placeholder="#2563eb"
                  />
                </GrowthSettingsField>
                <GrowthSettingsField label="Button text color">
                  <Input
                    value={draft.buttonTextColor ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current!, buttonTextColor: event.target.value || null }))
                    }
                    placeholder="#ffffff"
                  />
                </GrowthSettingsField>
              </div>
            </GrowthSettingsCard>

            <GrowthSettingsCard title="CTA & footer defaults">
              <div className={GROWTH_SETTINGS_FORM_GAP}>
                <GrowthSettingsField label="Default CTA label">
                  <Input
                    value={draft.defaultCtaLabel ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current!, defaultCtaLabel: event.target.value || null }))
                    }
                  />
                </GrowthSettingsField>
                <GrowthSettingsField label="Default calendar URL">
                  <Input
                    value={draft.defaultCalendarUrl ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current!, defaultCalendarUrl: event.target.value || null }))
                    }
                    placeholder="https://…"
                  />
                </GrowthSettingsField>
                <GrowthSettingsField label="Default footer text">
                  <Input
                    value={draft.footerText ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current!, footerText: event.target.value || null }))
                    }
                  />
                </GrowthSettingsField>
              </div>
            </GrowthSettingsCard>
          </div>
        </GrowthSettingsSectionForm>
      ) : null}
    </GrowthVideoSettingsSectionLayout>
  )
}
