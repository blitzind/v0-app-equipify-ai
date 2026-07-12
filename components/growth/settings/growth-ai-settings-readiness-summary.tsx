"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { StatTile } from "@/components/growth/growth-ui-utils"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import {
  GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
import type { GrowthCopilotSettings } from "@/lib/growth/ai-copilot-types"
import { GROWTH_AUTONOMY_OPERATING_MODE_OPERATOR_COPY } from "@/lib/growth/autonomy/growth-autonomy-operator-ui"
import type { GrowthAutonomySettingsViewModel } from "@/lib/growth/autonomy/growth-autonomy-settings-service"
import { resolveGrowthAutonomyOutboundStatusLabel } from "@/lib/growth/autonomy/growth-autonomy-operator-ui"
import { GROWTH_WORKSPACE_SETTINGS_LANDING_PAGE_OPTIONS } from "@/lib/growth/settings/growth-workspace-settings-options"
import type { GrowthWorkspaceSettingsSidebarPreferences } from "@/lib/growth/settings/growth-workspace-settings-types"
import { AI_TEAMMATE_DEFAULT_NAME } from "@/lib/workspace/ai-teammate-identity"
import {
  GROWTH_AVA_STATUS_ENABLED,
  GROWTH_AVA_STATUS_INACTIVE,
  GROWTH_AVA_TEAMMATE_LABEL,
  growthAvaPreferencesTitle,
  growthAvaStatusLearning,
  growthAvaStatusReady,
  growthAvaStatusUnavailable,
} from "@/lib/growth/workspace/growth-workspace-ava-identity"
import { assistFromTeammate } from "@/lib/workspace/ai-teammate-voice"

export type GrowthAiReadinessScope = "teammate" | "preferences" | "autonomy" | "command-center"

const REASONING_LABELS: Record<string, string> = {
  default: "Balanced",
  concise: "Concise",
  executive: "Executive",
}

function resolveRouteLabel(route: string | null | undefined): string {
  if (!route) return "Home"
  const match = GROWTH_WORKSPACE_SETTINGS_LANDING_PAGE_OPTIONS.find((option) => option.value === route)
  return match?.label ?? "Saved destination"
}

function resolveApprovalLabel(masterMode: string, autonomyPaused: boolean): string {
  if (autonomyPaused) return "Paused"
  if (masterMode === "manual" || masterMode === "assisted") return "Human approval"
  if (masterMode === "guardrailed" || masterMode === "channel") return "Guardrailed"
  return "Objective-driven"
}

export function GrowthAiSettingsReadinessSummary({ scope }: { scope: GrowthAiReadinessScope }) {
  const { teammate } = useAiTeammateIdentity()
  const [loading, setLoading] = useState(true)
  const [copilot, setCopilot] = useState<GrowthCopilotSettings | null>(null)
  const [autonomy, setAutonomy] = useState<GrowthAutonomySettingsViewModel | null>(null)
  const [teammateName, setTeammateName] = useState(AI_TEAMMATE_DEFAULT_NAME)
  const [sidebarPrefs, setSidebarPrefs] = useState<GrowthWorkspaceSettingsSidebarPreferences | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [copilotRes, autonomyRes, teammateRes, sidebarRes] = await Promise.all([
        fetch("/api/platform/growth/copilot/settings", { cache: "no-store" }),
        fetch("/api/growth/workspace/settings/autonomy", { cache: "no-store" }),
        fetch("/api/growth/workspace/settings/ai-teammate", { cache: "no-store" }),
        fetch("/api/growth/workspace/settings/sidebar-preferences", { cache: "no-store" }),
      ])

      const copilotData = (await copilotRes.json().catch(() => ({}))) as {
        ok?: boolean
        settings?: GrowthCopilotSettings
      }
      const autonomyData = (await autonomyRes.json().catch(() => ({}))) as {
        ok?: boolean
        viewModel?: GrowthAutonomySettingsViewModel
      }
      const teammateData = (await teammateRes.json().catch(() => ({}))) as {
        ok?: boolean
        identity?: { name?: string }
      }
      const sidebarData = (await sidebarRes.json().catch(() => ({}))) as {
        ok?: boolean
        preferences?: GrowthWorkspaceSettingsSidebarPreferences
      }

      if (copilotData.settings) setCopilot(copilotData.settings)
      if (autonomyData.viewModel) setAutonomy(autonomyData.viewModel)
      if (teammateData.identity?.name) setTeammateName(teammateData.identity.name)
      if (sidebarData.preferences) setSidebarPrefs(sidebarData.preferences)
    } catch {
      // Keep partial/null state — tiles fall back to Unknown
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const reasoningLabel =
    REASONING_LABELS[String(copilot?.aiCopilotDefaultPromptVariant ?? "default")] ?? "Balanced"
  const autonomyMode = autonomy
    ? GROWTH_AUTONOMY_OPERATING_MODE_OPERATOR_COPY[autonomy.status.masterMode].title
    : "Unknown"
  const outboundLabel = autonomy ? resolveGrowthAutonomyOutboundStatusLabel(autonomy.status) : "Unknown"
  const favoriteCount = sidebarPrefs?.favoriteDestinations.length ?? 0

  function renderTiles() {
    switch (scope) {
      case "teammate":
        return (
          <>
            <StatTile label={GROWTH_AVA_TEAMMATE_LABEL} value={teammateName} />
            <StatTile
              label={assistFromTeammate(teammate)}
              value={copilot?.aiCopilotEnabled ? GROWTH_AVA_STATUS_ENABLED : GROWTH_AVA_STATUS_INACTIVE}
            />
            <StatTile label="Autonomy" value={autonomyMode} />
            <StatTile
              label="Guidance"
              value={copilot?.aiCopilotPlaybookEnabled ? "Connected" : "Not connected"}
            />
          </>
        )
      case "preferences":
        return (
          <>
            <StatTile
              label={growthAvaStatusReady(teammate)}
              value={copilot?.aiCopilotEnabled ? GROWTH_AVA_STATUS_ENABLED : growthAvaStatusUnavailable(teammate)}
            />
            <StatTile label="Response style" value={reasoningLabel} />
            <StatTile
              label="Memory"
              value={copilot?.aiCopilotStoreGenerations ? "Enabled" : "Disabled"}
            />
            <StatTile
              label="Learning"
              value={copilot?.aiCopilotPlaybookEnabled ? growthAvaStatusLearning(teammate) : GROWTH_AVA_STATUS_INACTIVE}
            />
          </>
        )
      case "autonomy":
        return (
          <>
            <StatTile label="Operating mode" value={autonomyMode} />
            <StatTile
              label="Approval"
              value={
                autonomy
                  ? resolveApprovalLabel(autonomy.status.masterMode, autonomy.status.autonomyPaused)
                  : "Unknown"
              }
            />
            <StatTile label="Outbound" value={outboundLabel} />
            <StatTile
              label="Emergency stop"
              value={autonomy?.status.autonomyPaused ? "Active" : "Off"}
            />
          </>
        )
      case "command-center":
        return (
          <>
            <StatTile label="Favorites" value={favoriteCount > 0 ? `${favoriteCount} pinned` : "None"} />
            <StatTile
              label="Startup"
              value={resolveRouteLabel(sidebarPrefs?.lastVisitedRoute)}
            />
            <StatTile
              label="Quick nav"
              value={favoriteCount > 0 ? "Configured" : "Add favorites"}
            />
            <StatTile label="Cmd+K" value="Ready" />
          </>
        )
    }
  }

  return (
    <div data-growth-settings-ai-refinement={GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER}>
      <GrowthSettingsCard
        title={
          {
            teammate: `How ${teammate.name} works for you`,
            preferences: growthAvaPreferencesTitle(teammate),
            autonomy: "Autonomy at a glance",
            "command-center": "Command Center at a glance",
          }[scope]
        }
      >
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading AI status…
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{renderTiles()}</div>
        )}
      </GrowthSettingsCard>
    </div>
  )
}
