"use client"

import { useCallback, useMemo } from "react"
import { PanelLeft } from "lucide-react"
import { Input } from "@/components/ui/input"
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

function resolveRouteLabel(route: string | null | undefined): string {
  if (!route) return "No saved route"
  const match = GROWTH_WORKSPACE_SETTINGS_LANDING_PAGE_OPTIONS.find((option) => option.value === route)
  return match?.label ?? route
}

export function GrowthSettingsSidebarPreferencesPanel({
  variant = "sidebar",
  embedded = false,
}: {
  variant?: GrowthSettingsSidebarPreferencesPanelVariant
  embedded?: boolean
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

  const lastVisitedLabel = useMemo(
    () => resolveRouteLabel(value.lastVisitedRoute),
    [value.lastVisitedRoute],
  )

  function toggleFavorite(href: string) {
    const favorites = new Set(value.favoriteDestinations)
    if (favorites.has(href)) favorites.delete(href)
    else favorites.add(href)
    void patch({ favoriteDestinations: Array.from(favorites) })
  }

  return (
    <div
      className={embedded ? undefined : GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={variant === "sidebar" && !embedded ? GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER : undefined}
    >
      {!embedded ? (
        <GrowthWorkspacePageHeader
          title={variant === "command-center" ? "Command Center Preferences" : "Sidebar Preferences"}
          description={
            variant === "command-center"
              ? "Pin destinations for Cmd+K and quick navigation in Growth."
              : "Sidebar layout and resume behavior."
          }
          icon={PanelLeft}
        />
      ) : null}

      {loading ? <GrowthSettingsSectionLoadingState /> : null}
      {!loading && error ? <GrowthSettingsSectionErrorState message={error} onRetry={() => void refresh()} /> : null}

      {!loading && !error ? (
        <GrowthSettingsSectionForm footer={<GrowthSettingsSaveStatus saving={saving} />}>
          {variant === "sidebar" ? (
            <GrowthSettingsCard title="Layout">
              <div className={GROWTH_SETTINGS_FORM_GAP}>
                <GrowthSettingsToggleRow
                  label="Start with sidebar collapsed"
                  description="Open Growth with a collapsed sidebar."
                  checked={value.sidebarCollapsed}
                  disabled={saving}
                  onCheckedChange={(checked) => void patch({ sidebarCollapsed: checked })}
                />

                <GrowthSettingsField
                  label="Resume route"
                  description="Return to your last destination when you reopen Growth."
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={lastVisitedLabel}
                      readOnly
                      disabled
                      className="bg-muted/40"
                      aria-readonly
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
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
            <>
              <GrowthSettingsCard title="Favorite destinations">
                <p className="mb-3 text-sm text-muted-foreground">
                  Pin pages you open often — they appear at the top of Cmd+K search results.
                </p>
                <div className="space-y-2">
                  {GROWTH_WORKSPACE_SETTINGS_LANDING_PAGE_OPTIONS.map((option) => (
                    <GrowthSettingsToggleRow
                      key={option.value}
                      label={option.label}
                      description={embedded ? undefined : option.value}
                      checked={value.favoriteDestinations.includes(option.value)}
                      disabled={saving}
                      onCheckedChange={() => toggleFavorite(option.value)}
                    />
                  ))}
                </div>
              </GrowthSettingsCard>

              <GrowthSettingsCard title="Startup experience">
                <GrowthSettingsField
                  label="Where you left off"
                  description="Growth opens to your last visited page when you return."
                >
                  <Input
                    value={lastVisitedLabel}
                    readOnly
                    disabled
                    className="bg-muted/40"
                    aria-readonly
                    aria-label="Last visited destination"
                  />
                </GrowthSettingsField>
              </GrowthSettingsCard>
            </>
          ) : null}
        </GrowthSettingsSectionForm>
      ) : null}
    </div>
  )
}
