"use client"

import { Loader2 } from "lucide-react"
import {
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_INNER_GAP,
  GROWTH_SETTINGS_SECTION_GAP,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
import {
  GrowthSettingsField,
  GrowthSettingsSectionErrorState,
  GrowthSettingsSectionLoadingState,
} from "@/components/growth/settings/growth-settings-section-form-state"
import { GrowthVideoSettingsSectionLayout } from "@/components/growth/videos/growth-video-settings-section-layout"
import { useGrowthVideoSettings } from "@/hooks/growth/use-growth-video-settings"

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 dark:border-[#25324C]">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

export function GrowthVideoStorageSettingsPanel() {
  const { settings, loading, error, refresh } = useGrowthVideoSettings()

  return (
    <GrowthVideoSettingsSectionLayout
      title="Storage"
      description="Current Growth Video storage targets and upload limits."
      section="storage"
    >
      {loading ? <GrowthSettingsSectionLoadingState /> : null}
      {!loading && error ? <GrowthSettingsSectionErrorState message={error} onRetry={() => void refresh()} /> : null}
      {!loading && !error && settings ? (
        <div className={GROWTH_SETTINGS_SECTION_GAP}>
          <GrowthSettingsCard title="Storage providers">
            <div className={GROWTH_SETTINGS_INNER_GAP}>
              <p className="text-sm text-muted-foreground">
                Read-only view of configured buckets. Provider switching is not editable in this phase.
              </p>
              <StatRow label="Video bucket" value={settings.storage.videoBucket} />
              <StatRow label="Media bucket" value={settings.storage.mediaBucket} />
              <StatRow label="Max upload size" value={settings.storage.maxUploadLabel} />
              <StatRow label="Provider status" value={settings.storage.providerStatus} />
            </div>
          </GrowthSettingsCard>

          <GrowthSettingsCard title="Allowed MIME types">
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <GrowthSettingsField label="Video MIME types">
                <p className="text-sm text-foreground">{settings.storage.allowedVideoMimeTypes.join(", ") || "—"}</p>
              </GrowthSettingsField>
              <GrowthSettingsField label="Image MIME types">
                <p className="text-sm text-foreground">{settings.storage.allowedImageMimeTypes.join(", ") || "—"}</p>
              </GrowthSettingsField>
            </div>
          </GrowthSettingsCard>
        </div>
      ) : null}
    </GrowthVideoSettingsSectionLayout>
  )
}
