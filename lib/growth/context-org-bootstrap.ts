/** FUZOR-ADOPTION-1I — Context assembly org bootstrap (server-only). */

import "server-only"

import { getGrowthEngineAiOrgId } from "@/lib/growth/growth-engine-session"

export function resolveContextOrganizationId(organizationId?: string | null): string | null {
  return organizationId ?? getGrowthEngineAiOrgId()
}

export function ensureContextOrganizationBootstrap(organizationId?: string | null): string | null {
  return resolveContextOrganizationId(organizationId)
}
