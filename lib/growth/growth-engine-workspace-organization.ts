/**
 * GE-AIOS-PRODUCTION-VALIDATION-1B — Growth Engine internal workspace organization resolution.
 * Tenant-safe: uses Vercel Production env only; fails closed when ambiguous.
 */

import "server-only"

import { z } from "zod"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

export const GROWTH_ENGINE_WORKSPACE_ORGANIZATION_QA_MARKER =
  "ge-aios-growth-engine-workspace-organization-v1" as const

/** Documented production Equipify AI OS workspace — not a runtime hardcode fallback. */
export const DOCUMENTED_EQUIPIFY_AI_OS_PRODUCTION_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID

export type GrowthEngineWorkspaceOrganizationResolution = {
  organizationId: string
  source: "growth_engine_ai_org_id_env" | "explicit_override"
  qaMarker: typeof GROWTH_ENGINE_WORKSPACE_ORGANIZATION_QA_MARKER
}

/**
 * Resolve the internal Growth Engine AI OS workspace organization.
 * Requires GROWTH_ENGINE_AI_ORG_ID on Vercel Production or an explicit authenticated override.
 */
export function resolveGrowthEngineWorkspaceOrganizationId(
  explicitOrganizationId?: string | null,
): GrowthEngineWorkspaceOrganizationResolution | null {
  const override = explicitOrganizationId?.trim()
  if (override) {
    const parsed = z.string().uuid().safeParse(override)
    if (!parsed.success) return null
    return {
      organizationId: parsed.data,
      source: "explicit_override",
      qaMarker: GROWTH_ENGINE_WORKSPACE_ORGANIZATION_QA_MARKER,
    }
  }

  const fromEnv = getGrowthEngineAiOrgId()
  if (!fromEnv) return null

  return {
    organizationId: fromEnv,
    source: "growth_engine_ai_org_id_env",
    qaMarker: GROWTH_ENGINE_WORKSPACE_ORGANIZATION_QA_MARKER,
  }
}
