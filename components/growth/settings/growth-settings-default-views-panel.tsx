"use client"

import { useCallback } from "react"
import { Eye } from "lucide-react"
import {
  GrowthSettingsCard,
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
import {
  GROWTH_WORKSPACE_SETTINGS_CALLS_VIEW_OPTIONS,
  GROWTH_WORKSPACE_SETTINGS_INBOX_FILTER_OPTIONS,
  GROWTH_WORKSPACE_SETTINGS_OPPORTUNITIES_TAB_OPTIONS,
} from "@/lib/growth/settings/growth-workspace-settings-options"
import type { GrowthWorkspaceSettingsDefaultViews } from "@/lib/growth/settings/growth-workspace-settings-types"
import { DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES } from "@/lib/growth/settings/growth-workspace-settings-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ENDPOINT = "/api/growth/workspace/settings/default-views"

const INITIAL: GrowthWorkspaceSettingsDefaultViews = {
  inboxDefaultFilter: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.inboxDefaultFilter,
  callsDefaultView: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.callsDefaultView,
  opportunitiesDefaultTab: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.opportunitiesDefaultTab,
}

export function GrowthSettingsDefaultViewsPanel() {
  const selectValue = useCallback(
    (data: { preferences?: GrowthWorkspaceSettingsDefaultViews }) => data.preferences ?? null,
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
        title="Default Views"
        description="Starting filters and tabs when you open Growth modules."
        icon={Eye}
      />

      {loading ? <GrowthSettingsSectionLoadingState /> : null}
      {!loading && error ? <GrowthSettingsSectionErrorState message={error} onRetry={() => void refresh()} /> : null}

      {!loading && !error ? (
        <GrowthSettingsSectionForm footer={<GrowthSettingsSaveStatus saving={saving} />}>
          <GrowthSettingsCard title="Inbox">
            <p className="mb-3 text-xs text-muted-foreground">Default queue when opening Inbox.</p>
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <GrowthSettingsField label="Default filter">
                <Select
                  value={value.inboxDefaultFilter}
                  onValueChange={(next) =>
                    void patch({
                      inboxDefaultFilter: next as GrowthWorkspaceSettingsDefaultViews["inboxDefaultFilter"],
                    })
                  }
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROWTH_WORKSPACE_SETTINGS_INBOX_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </GrowthSettingsField>
            </div>
          </GrowthSettingsCard>

          <GrowthSettingsCard title="Calls">
            <p className="mb-3 text-xs text-muted-foreground">Default view when opening Calls.</p>
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <GrowthSettingsField label="Default view">
                <Select
                  value={value.callsDefaultView}
                  onValueChange={(next) =>
                    void patch({
                      callsDefaultView: next as GrowthWorkspaceSettingsDefaultViews["callsDefaultView"],
                    })
                  }
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROWTH_WORKSPACE_SETTINGS_CALLS_VIEW_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </GrowthSettingsField>
            </div>
          </GrowthSettingsCard>

          <GrowthSettingsCard title="Opportunities">
            <p className="mb-3 text-xs text-muted-foreground">Default tab when opening Opportunities.</p>
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <GrowthSettingsField label="Default tab">
                <Select
                  value={value.opportunitiesDefaultTab}
                  onValueChange={(next) =>
                    void patch({
                      opportunitiesDefaultTab:
                        next as GrowthWorkspaceSettingsDefaultViews["opportunitiesDefaultTab"],
                    })
                  }
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROWTH_WORKSPACE_SETTINGS_OPPORTUNITIES_TAB_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </GrowthSettingsField>
            </div>
          </GrowthSettingsCard>
        </GrowthSettingsSectionForm>
      ) : null}
    </div>
  )
}
