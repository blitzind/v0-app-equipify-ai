"use client"

import {
  GROWTH_SETTINGS_INNER_GAP,
  GROWTH_SETTINGS_SECTION_GAP,
  GrowthSettingsBadge,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
import {
  GrowthSettingsSectionErrorState,
  GrowthSettingsSectionLoadingState,
} from "@/components/growth/settings/growth-settings-section-form-state"
import { GrowthVideoSettingsSectionLayout } from "@/components/growth/videos/growth-video-settings-section-layout"
import { useGrowthVideoSettings } from "@/hooks/growth/use-growth-video-settings"

function PermissionRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 dark:border-[#25324C]">
      <span className="text-sm text-foreground">{label}</span>
      <GrowthSettingsBadge label={enabled ? "Enabled" : "Disabled"} tone={enabled ? "healthy" : "neutral"} />
    </div>
  )
}

export function GrowthVideoPermissionsSettingsPanel() {
  const { settings, loading, error, refresh } = useGrowthVideoSettings()

  return (
    <GrowthVideoSettingsSectionLayout
      title="Permissions"
      description="Growth Video workspace access and safety posture."
      section="permissions"
    >
      {loading ? <GrowthSettingsSectionLoadingState /> : null}
      {!loading && error ? <GrowthSettingsSectionErrorState message={error} onRetry={() => void refresh()} /> : null}
      {!loading && !error && settings ? (
        <div className={GROWTH_SETTINGS_SECTION_GAP}>
          <GrowthSettingsCard
            title="Access controls"
            headerAside={<GrowthSettingsBadge label="Read-only" tone="neutral" />}
          >
            <div className={GROWTH_SETTINGS_INNER_GAP}>
              <p className="text-sm text-muted-foreground">
                Role-based permissions will be configurable here. No role editor is wired in this phase.
              </p>
              <PermissionRow label="Platform admin required" enabled={settings.permissions.platformAdminRequired} />
              <PermissionRow label="Human review required" enabled={settings.permissions.humanReviewRequired} />
              <PermissionRow
                label="Autonomous execution"
                enabled={settings.permissions.autonomousExecutionEnabled}
              />
              <PermissionRow
                label="Customer tenant access"
                enabled={settings.permissions.customerTenantAccessEnabled}
              />
              <PermissionRow
                label="Provider execution gated"
                enabled={settings.permissions.providerExecutionGated}
              />
            </div>
          </GrowthSettingsCard>

          <GrowthSettingsCard title="Provider gates">
            <div className={GROWTH_SETTINGS_INNER_GAP}>
              <PermissionRow label="Voice provider live" enabled={settings.permissions.voiceProviderEnabled} />
              <PermissionRow label="Avatar provider live" enabled={settings.permissions.avatarProviderEnabled} />
              <p className="text-xs text-muted-foreground">
                Provider keys are configured in Vercel Production only. Status reflects env gates without exposing
                secrets.
              </p>
            </div>
          </GrowthSettingsCard>
        </div>
      ) : null}
    </GrowthVideoSettingsSectionLayout>
  )
}
