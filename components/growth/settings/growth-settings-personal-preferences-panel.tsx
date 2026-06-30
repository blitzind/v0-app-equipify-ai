"use client"

import { useCallback } from "react"
import { SlidersHorizontal } from "lucide-react"
import {
  GrowthSettingsCard,
  GrowthSettingsToggleRow,
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"
import {
  GrowthSettingsField,
  GrowthSettingsSaveStatus,
  GrowthSettingsSectionErrorState,
  GrowthSettingsSectionForm,
  GrowthSettingsSectionLoadingState,
} from "@/components/growth/settings/growth-settings-section-form-state"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { useGrowthWorkspaceSettingsResource } from "@/hooks/growth/use-growth-workspace-settings-resource"
import { GROWTH_WORKSPACE_SETTINGS_LANDING_PAGE_OPTIONS } from "@/lib/growth/settings/growth-workspace-settings-options"
import type { GrowthWorkspaceSettingsPersonalPreferences } from "@/lib/growth/settings/growth-workspace-settings-types"
import { DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES } from "@/lib/growth/settings/growth-workspace-settings-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ENDPOINT = "/api/growth/workspace/settings/personal-preferences"

const INITIAL: GrowthWorkspaceSettingsPersonalPreferences = {
  defaultLandingPage: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.defaultLandingPage,
  compactMode: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.compactMode,
  reducedMotion: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.reducedMotion,
}

export function GrowthSettingsPersonalPreferencesPanel() {
  const selectValue = useCallback(
    (data: { preferences?: GrowthWorkspaceSettingsPersonalPreferences }) => data.preferences ?? null,
    [],
  )
  const { value, loading, saving, error, refresh, patch } = useGrowthWorkspaceSettingsResource({
    endpoint: ENDPOINT,
    initialValue: INITIAL,
    selectValue,
  })

  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Personal Preferences"
        description="Defaults that follow you across Growth."
        icon={SlidersHorizontal}
      />

      {loading ? <GrowthSettingsSectionLoadingState /> : null}
      {!loading && error ? <GrowthSettingsSectionErrorState message={error} onRetry={() => void refresh()} /> : null}

      {!loading && !error ? (
        <GrowthSettingsSectionForm footer={<GrowthSettingsSaveStatus saving={saving} />}>
          <GrowthSettingsCard title="Appearance">
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <GrowthSettingsToggleRow
                label="Compact mode"
                description="Use denser spacing in lists and panels."
                checked={value.compactMode}
                disabled={saving}
                onCheckedChange={(checked) => void patch({ compactMode: checked })}
              />
              <GrowthSettingsToggleRow
                label="Reduced motion"
                description="Minimize non-essential animations."
                checked={value.reducedMotion}
                disabled={saving}
                onCheckedChange={(checked) => void patch({ reducedMotion: checked })}
              />
            </div>
          </GrowthSettingsCard>

          <GrowthSettingsCard title="Startup">
            <GrowthSettingsField
              label="Default landing page"
              description="Where Growth opens when you sign in."
            >
              <Select
                value={value.defaultLandingPage}
                onValueChange={(next) => void patch({ defaultLandingPage: next })}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROWTH_WORKSPACE_SETTINGS_LANDING_PAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </GrowthSettingsField>
          </GrowthSettingsCard>
        </GrowthSettingsSectionForm>
      ) : null}
    </div>
  )
}
