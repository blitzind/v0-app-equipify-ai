/**
 * Growth Lead evidence adapter + Equipify compatibility surface.
 *
 * Lead is NOT a platform identity — it is one evidence adapter.
 * Equipify / Growth Engine callers may use these helpers so existing
 * deployments keep working while the platform API requires explicit ownership.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import type {
  CompanyIntelligenceForAiEmployee,
  EnsureCompanyIntelligenceResult,
  FuzorCompanyIntelligenceVersionRecord,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-2a-types"
import {
  consumeCompanyIntelligenceForAiEmployee,
  ensureCompanyIntelligence,
  loadCompanyIntelligence,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-platform"

function resolveEquipifyOwnerOrganizationId(
  organizationId?: string | null,
):
  | { ok: true; ownerOrganizationId: string }
  | { ok: false; result: EnsureCompanyIntelligenceResult } {
  const ownerOrganizationId = organizationId?.trim() || getGrowthEngineAiOrgId()
  if (!ownerOrganizationId) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "organization_unavailable",
        message:
          "GROWTH_ENGINE_AI_ORG_ID is not configured (Equipify Growth Engine compatibility default).",
      },
    }
  }
  return { ok: true, ownerOrganizationId }
}

/**
 * Equipify / Growth Engine compatibility: ensure CI for a Growth Lead.
 * Maps organizationId → ownerOrganizationId (defaults to Growth Engine AI org).
 */
export async function ensureCompanyIntelligenceForGrowthLead(input: {
  admin: SupabaseClient
  leadId: string
  organizationId?: string | null
  actingUserEmail?: string | null
  forceRegenerate?: boolean
  aiDeploymentId?: string | null
}): Promise<EnsureCompanyIntelligenceResult> {
  const owner = resolveEquipifyOwnerOrganizationId(input.organizationId)
  if (!owner.ok) return owner.result

  return ensureCompanyIntelligence({
    admin: input.admin,
    ownerOrganizationId: owner.ownerOrganizationId,
    aiDeploymentId: input.aiDeploymentId,
    leadId: input.leadId,
    actingUserEmail: input.actingUserEmail,
    forceRegenerate: input.forceRegenerate,
  })
}

/**
 * Equipify / Growth Engine compatibility load.
 */
export async function loadCompanyIntelligenceForGrowthLead(input: {
  admin: SupabaseClient
  leadId?: string | null
  companyId?: string | null
  versionId?: string | null
  organizationId?: string | null
}): Promise<FuzorCompanyIntelligenceVersionRecord | null> {
  const owner = resolveEquipifyOwnerOrganizationId(input.organizationId)
  if (!owner.ok) return null

  return loadCompanyIntelligence({
    admin: input.admin,
    ownerOrganizationId: owner.ownerOrganizationId,
    companyId: input.companyId,
    leadId: input.leadId,
    versionId: input.versionId,
  })
}

/**
 * Equipify / Growth Engine compatibility consume.
 */
export async function consumeCompanyIntelligenceForGrowthLead(input: {
  admin: SupabaseClient
  leadId?: string | null
  companyId?: string | null
  versionId?: string | null
  organizationId?: string | null
  ensureIfMissing?: boolean
  actingUserEmail?: string | null
  aiDeploymentId?: string | null
}): Promise<
  | { ok: true; intelligence: CompanyIntelligenceForAiEmployee; ensured: boolean }
  | { ok: false; code: string; message: string }
> {
  const owner = resolveEquipifyOwnerOrganizationId(input.organizationId)
  if (!owner.ok) {
    return { ok: false, code: owner.result.code, message: owner.result.message }
  }

  return consumeCompanyIntelligenceForAiEmployee({
    admin: input.admin,
    ownerOrganizationId: owner.ownerOrganizationId,
    aiDeploymentId: input.aiDeploymentId,
    companyId: input.companyId,
    leadId: input.leadId,
    versionId: input.versionId,
    ensureIfMissing: input.ensureIfMissing,
    actingUserEmail: input.actingUserEmail,
  })
}
