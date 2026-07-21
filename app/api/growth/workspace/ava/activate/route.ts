import { NextResponse } from "next/server"
import {
  activateGrowthAvaAutonomousMode,
  loadGrowthAvaActivationState,
} from "@/lib/growth/ava-activation/growth-ava-activation-service"
import { GROWTH_AVA_ACTIVATION_1C_QA_MARKER } from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import { buildGrowthHomeSalesOutcomes } from "@/lib/growth/home/growth-home-sales-outcomes-loader"
import { buildGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import { loadGrowthHomeMissionDiscoveryObjectives } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import {
  growthWorkspaceSettingsJsonError,
  requireGrowthWorkspaceSettingsAccess,
} from "@/lib/growth/settings/growth-workspace-settings-api-access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response

  if (!access.organizationId) {
    return growthWorkspaceSettingsJsonError(
      "organization_missing",
      "Growth organization is not configured for Ava activation.",
      503,
    )
  }

  const generatedAt = new Date().toISOString()

  try {
    const missionObjectives = await loadGrowthHomeMissionDiscoveryObjectives(access.admin, access.organizationId)
    const missionDiscovery = buildGrowthHomeMissionDiscoverySnapshot({ objectives: missionObjectives })
    const salesOutcomes = await buildGrowthHomeSalesOutcomes({
      admin: access.admin,
      organizationId: access.organizationId,
      generatedAt,
      researchLoopSummary: null,
      pendingApprovals: 0,
    })

    const activation = await loadGrowthAvaActivationState({
      admin: access.admin,
      organizationId: access.organizationId,
      actorUserId: access.userId,
      generatedAt,
      salesOutcomes,
      missionDiscovery,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
      activation,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Ava activation state."
    return growthWorkspaceSettingsJsonError("ava_activation_load_failed", message, 500)
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthWorkspaceSettingsAccess(request)
  if (!access.ok) return access.response

  if (!access.organizationId) {
    return growthWorkspaceSettingsJsonError(
      "organization_missing",
      "Growth organization is not configured for Ava activation.",
      503,
    )
  }

  const generatedAt = new Date().toISOString()

  try {
    const missionObjectives = await loadGrowthHomeMissionDiscoveryObjectives(access.admin, access.organizationId)
    const missionDiscovery = buildGrowthHomeMissionDiscoverySnapshot({ objectives: missionObjectives })
    const salesOutcomes = await buildGrowthHomeSalesOutcomes({
      admin: access.admin,
      organizationId: access.organizationId,
      generatedAt,
      researchLoopSummary: null,
      pendingApprovals: 0,
    })

    const { activation, immediateTick } = await activateGrowthAvaAutonomousMode({
      admin: access.admin,
      organizationId: access.organizationId,
      actorUserId: access.userId,
      generatedAt,
      salesOutcomes,
      missionDiscovery,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
      activation,
      immediateTick,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not activate Ava."
    return growthWorkspaceSettingsJsonError("ava_activation_failed", message, 400)
  }
}
