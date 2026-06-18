"use client"

import { notFound } from "next/navigation"
import { WorkspaceSettingsCanonicalRoutePanel } from "@/components/settings/workspace-settings-canonical-route-panel"
import { getWorkspaceSettingsGrowthEngineLiftedPanel } from "@/components/settings/workspace-settings-growth-engine-lifted-panels"
import { WorkspaceSettingsPhasePlaceholder } from "@/components/settings/workspace-settings-phase-placeholder"
import { getWorkspaceSettingsGrowthEngineSection } from "@/lib/settings/workspace-settings-navigation"
import {
  getGrowthEngineSectionClassification,
  getWorkspaceSettingsGrowthEngineCanonicalHref,
  rendersGrowthEnginePhasePlaceholder,
  resolveGrowthEngineSectionLiftKind,
  WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFT_QA_MARKER,
} from "@/lib/settings/workspace-settings-growth-engine-lift"

export function WorkspaceSettingsGrowthEngineSectionPage({ sectionId }: { sectionId: string }) {
  const section = getWorkspaceSettingsGrowthEngineSection(sectionId)
  if (!section) notFound()

  const liftKind = resolveGrowthEngineSectionLiftKind(sectionId)
  const classification = getGrowthEngineSectionClassification(sectionId)

  if (liftKind === "lifted") {
    const Panel = getWorkspaceSettingsGrowthEngineLiftedPanel(sectionId)
    if (!Panel) notFound()
    return (
      <div className="flex flex-col gap-6" data-qa-marker={WORKSPACE_SETTINGS_GROWTH_ENGINE_LIFT_QA_MARKER}>
        <Panel />
      </div>
    )
  }

  if (liftKind === "canonical") {
    const canonicalHref = getWorkspaceSettingsGrowthEngineCanonicalHref(sectionId)
    if (!canonicalHref) notFound()
    return (
      <WorkspaceSettingsCanonicalRoutePanel
        section={section}
        canonicalHref={canonicalHref}
        canonicalLabel="Open notification preferences"
        icon={section.icon}
      />
    )
  }

  if (rendersGrowthEnginePhasePlaceholder(liftKind)) {
    return (
      <WorkspaceSettingsPhasePlaceholder
        section={section}
        icon={section.icon}
        phaseLabel="Phase 3"
        phaseDescription={
          classification?.reason ??
          "Remaining Growth Engine settings migrate in Phase 3 — no new implementations in GE-SET-5."
        }
      />
    )
  }

  notFound()
}
