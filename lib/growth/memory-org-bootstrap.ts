/** FUZOR-ADOPTION-1H — Resolve organization scope for Memory calls (server-only). */

import "server-only"

import { getGrowthEngineAiOrgId } from "@/lib/growth/growth-engine-session"

export function resolveMemoryOrganizationId(organizationId?: string | null): string | null {
  return organizationId ?? getGrowthEngineAiOrgId()
}

export function ensureMemoryOrganizationBootstrap(organizationId?: string | null): string | null {
  return resolveMemoryOrganizationId(organizationId)
}
