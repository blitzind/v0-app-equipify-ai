"use client"

import { useCallback } from "react"
import { Eye, Loader2 } from "lucide-react"
import {
  GrowthSettingsCard,
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"
import {
  GrowthSettingsField,
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
    <div className={GROWTH_SETTINGS_SECTION_GAP}>
      <GrowthWorkspacePageHeader
        title="Default Views"
        description="Landing views and default filters when opening Growth destinations."
        icon={Eye}
        iconClassName="bg-emerald-50 text-emerald-700"
      />

      {loading ? <GrowthSettingsSectionLoadingState /> : null}
      {!loading && error ? <GrowthSettingsSectionErrorState message={error} onRetry={() => void refresh()} /> : null}

      {!loading && !error ? (
        <GrowthSettingsSectionForm
          footer={
            saving ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Saving…
              </p>
            ) : null
          }
        >
          <GrowthSettingsCard title="Destination defaults">
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <GrowthSettingsField label="Inbox default filter">
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

              <GrowthSettingsField label="Calls default view">
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

              <GrowthSettingsField label="Opportunities default tab">
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
