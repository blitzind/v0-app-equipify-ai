"use client"

import { useCallback } from "react"
import { Loader2, PanelLeft } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  GrowthSettingsCard,
  GrowthSettingsToggleRow,
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
import { GROWTH_WORKSPACE_SETTINGS_LANDING_PAGE_OPTIONS } from "@/lib/growth/settings/growth-workspace-settings-options"
import type { GrowthWorkspaceSettingsSidebarPreferences } from "@/lib/growth/settings/growth-workspace-settings-types"
import { DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES } from "@/lib/growth/settings/growth-workspace-settings-types"
import { Button } from "@/components/ui/button"

const ENDPOINT = "/api/growth/workspace/settings/sidebar-preferences"

const INITIAL: GrowthWorkspaceSettingsSidebarPreferences = {
  sidebarCollapsed: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.sidebarCollapsed,
  favoriteDestinations: [],
  lastVisitedRoute: DEFAULT_GROWTH_OPERATOR_WORKSPACE_PREFERENCES.lastVisitedRoute,
}

export type GrowthSettingsSidebarPreferencesPanelVariant = "sidebar" | "command-center"

export function GrowthSettingsSidebarPreferencesPanel({
  variant = "sidebar",
}: {
  variant?: GrowthSettingsSidebarPreferencesPanelVariant
}) {
  const selectValue = useCallback(
    (data: { preferences?: GrowthWorkspaceSettingsSidebarPreferences }) => data.preferences ?? null,
    [],
  )
  const { value, loading, saving, error, refresh, patch } = useGrowthWorkspaceSettingsResource({
    endpoint: ENDPOINT,
    initialValue: INITIAL,
    selectValue,
  })

  function toggleFavorite(href: string) {
    const favorites = new Set(value.favoriteDestinations)
    if (favorites.has(href)) favorites.delete(href)
    else favorites.add(href)
    void patch({ favoriteDestinations: Array.from(favorites) })
  }

  return (
    <div className={GROWTH_SETTINGS_SECTION_GAP}>
      <GrowthWorkspacePageHeader
        title={variant === "command-center" ? "Command Center Preferences" : "Sidebar Preferences"}
        description={
          variant === "command-center"
            ? "Pin destinations for Cmd+K and quick navigation in Growth."
            : "Sidebar collapse behavior and resume routing."
        }
        icon={PanelLeft}
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
          {variant === "sidebar" ? (
            <GrowthSettingsCard title="Sidebar behavior">
              <div className={GROWTH_SETTINGS_FORM_GAP}>
                <GrowthSettingsToggleRow
                  label="Collapse sidebar by default"
                  description="Start with the workspace sidebar collapsed."
                  checked={value.sidebarCollapsed}
                  disabled={saving}
                  onCheckedChange={(checked) => void patch({ sidebarCollapsed: checked })}
                />

                <GrowthSettingsField
                  label="Last visited route"
                  description="Resume where you left off in Growth."
                >
                  <div className="flex gap-2">
                    <Input value={value.lastVisitedRoute ?? ""} readOnly disabled placeholder="Not set yet" />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving || !value.lastVisitedRoute}
                      onClick={() => void patch({ lastVisitedRoute: null })}
                    >
                      Clear
                    </Button>
                  </div>
                </GrowthSettingsField>
              </div>
            </GrowthSettingsCard>
          ) : null}

          {variant === "command-center" ? (
            <GrowthSettingsCard title="Favorite destinations">
              <div className="space-y-2">
                {GROWTH_WORKSPACE_SETTINGS_LANDING_PAGE_OPTIONS.map((option) => (
                  <GrowthSettingsToggleRow
                    key={option.value}
                    label={option.label}
                    description={option.value}
                    checked={value.favoriteDestinations.includes(option.value)}
                    disabled={saving}
                    onCheckedChange={() => toggleFavorite(option.value)}
                  />
                ))}
              </div>
            </GrowthSettingsCard>
          ) : null}
        </GrowthSettingsSectionForm>
      ) : null}
    </div>
  )
}
