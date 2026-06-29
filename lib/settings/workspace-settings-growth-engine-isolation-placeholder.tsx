"use client"

/**
 * PROD-HOTFIX — temporary binary isolation for Growth Engine settings routes.
 * Remove after crash layer is proven (lifted panels vs parent shell).
 */
export const GROWTH_ENGINE_SETTINGS_ISOLATION_PLACEHOLDER_QA_MARKER =
  "growth-engine-settings-isolation-placeholder-v1" as const

/** When true, lifted panel host/registry is bypassed entirely in section-page. */
export const GROWTH_ENGINE_SETTINGS_ISOLATION_PLACEHOLDER_ACTIVE = true

export function WorkspaceSettingsGrowthEngineIsolationPlaceholder({
  sectionId,
  sectionLabel,
}: {
  sectionId: string
  sectionLabel?: string | null
}) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-8 text-sm text-foreground"
      data-growth-engine-settings-safe-placeholder
      data-qa-marker={GROWTH_ENGINE_SETTINGS_ISOLATION_PLACEHOLDER_QA_MARKER}
      data-workspace-settings-growth-engine-section={sectionId}
    >
      <p className="font-medium">Growth Engine settings placeholder for {sectionId}</p>
      {sectionLabel ? <p className="mt-1 text-muted-foreground">{sectionLabel}</p> : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Isolation build — lifted panel registry bypassed. Marker:{" "}
        {GROWTH_ENGINE_SETTINGS_ISOLATION_PLACEHOLDER_QA_MARKER}
      </p>
    </div>
  )
}
