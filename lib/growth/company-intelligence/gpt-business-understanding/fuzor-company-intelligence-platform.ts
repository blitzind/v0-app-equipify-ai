/**
 * FUZOR OS — Company Intelligence platform API (PLATFORM-LIFT-1A).
 *
 * ensureCompanyIntelligence() → persist org-owned versioned understanding
 * loadCompanyIntelligence() → reload authoritative understanding (tenant-scoped)
 * consumeCompanyIntelligenceForAiEmployee() → Layer 3 intake
 *
 * Growth / Equipify callers should use growth-lead-adapter for compatibility defaults.
 * AI employees must never reinterpret websites independently.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import {
  buildCanonicalCompanyInsertPayload,
  insertCanonicalCompany,
  upsertCanonicalCompanyDomain,
} from "@/lib/growth/canonical-companies/canonical-company-repository-core"
import { resolveCanonicalCompanyIdForLead } from "@/lib/growth/canonical-persons/canonical-person-repository-core"
import {
  FUZOR_COMPANY_INTELLIGENCE_2A_GENERATION_MODE,
  FUZOR_COMPANY_INTELLIGENCE_2A_QA_MARKER,
  FUZOR_COMPANY_INTELLIGENCE_PLATFORM_VERSION,
  type CompanyIntelligenceForAiEmployee,
  type EnsureCompanyIntelligenceResult,
  type FuzorCompanyIntelligenceVersionRecord,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-2a-types"
import {
  buildFuzorCompanyIntelligenceEvidenceRefs,
  computeFuzorCompanyIntelligenceEvidenceFingerprint,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-evidence-fingerprint"
import { gatherFuzorCompanyIntelligenceEvidence } from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-evidence-gatherer"
import {
  insertFuzorCompanyIntelligenceVersion,
  loadFuzorCompanyIntelligenceById,
  loadLatestFuzorCompanyIntelligence,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-repository"
import { runFuzorCompanyIntelligence } from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-service"
import {
  FUZOR_COMPANY_INTELLIGENCE_MODEL,
  FUZOR_COMPANY_INTELLIGENCE_PROMPT_VERSION,
  type FuzorCompanyIntelligenceEvidencePacket,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"

function requireOwnerOrganizationId(
  ownerOrganizationId: string | null | undefined,
): { ok: true; ownerOrganizationId: string } | { ok: false; result: EnsureCompanyIntelligenceResult } {
  const trimmed = ownerOrganizationId?.trim()
  if (!trimmed) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "owner_organization_required",
        message:
          "ownerOrganizationId is required. Company Intelligence is owned by the organization operating the AI deployment.",
      },
    }
  }
  return { ok: true, ownerOrganizationId: trimmed }
}

/**
 * Pre-lift bridge rows without owner_organization_id are readable only by the
 * Equipify Growth Engine org (compatibility shim — not a platform default).
 */
function legacyBridgeOwnerOrganizationId(): string | null {
  return getGrowthEngineAiOrgId()
}

/**
 * Resolve canonical company_id for persistence identity.
 * If unresolved but a website domain exists, provision a minimal active company
 * and link it on the lead — required for append-only CI versions / bridge storage.
 */
async function resolveOrProvisionCanonicalCompanyIdForLead(
  admin: SupabaseClient,
  leadId: string,
  packet: FuzorCompanyIntelligenceEvidencePacket,
): Promise<string | null> {
  const existing = await resolveCanonicalCompanyIdForLead(admin, leadId)
  if (existing) return existing

  const domain = canonicalNormalizedDomain(null, packet.website)
  if (!domain) return null

  const { data: byDomain } = await admin
    .schema("growth")
    .from("companies")
    .select("id")
    .eq("primary_domain", domain)
    .limit(1)
    .maybeSingle()

  let companyId = byDomain?.id ? String(byDomain.id) : null

  if (!companyId) {
    const now = new Date().toISOString()
    const payload = buildCanonicalCompanyInsertPayload(
      {
        source_table: "discovery_candidates",
        source_id: leadId,
        run_id: null,
        provider_name: "fuzor_company_intelligence_platform",
        provider_type: "platform",
        company_name: packet.companyName,
        website: packet.website,
        domain,
        confidence: 0.55,
        observed_at: now,
      },
      "new",
    )
    payload.metadata = {
      ...payload.metadata,
      provisioned_by: "fuzor_company_intelligence_platform",
    }
    companyId = await insertCanonicalCompany(admin, payload)
    await upsertCanonicalCompanyDomain(admin, {
      company_id: companyId,
      domain,
      normalized_domain: domain,
      is_primary: true,
      source_table: "leads",
      source_id: leadId,
      observed_at: now,
    }).catch(() => {
      // Domain upsert is best-effort; company row is enough for CI FK/bridge.
    })
  }

  const { data: lead } = await admin
    .schema("growth")
    .from("leads")
    .select("metadata")
    .eq("id", leadId)
    .maybeSingle()
  const metadata =
    lead?.metadata && typeof lead.metadata === "object"
      ? ({ ...(lead.metadata as Record<string, unknown>) } as Record<string, unknown>)
      : {}
  if (metadata.canonical_company_id !== companyId) {
    metadata.canonical_company_id = companyId
    await admin.schema("growth").from("leads").update({ metadata }).eq("id", leadId)
  }

  return companyId
}

function toAiEmployeeView(
  record: FuzorCompanyIntelligenceVersionRecord,
): CompanyIntelligenceForAiEmployee {
  return {
    ownerOrganizationId: record.ownerOrganizationId,
    aiDeploymentId: record.aiDeploymentId,
    companyId: record.companyId,
    externalCompanyId: record.companyId,
    leadId: record.leadId,
    companyName: record.companyName,
    website: record.website,
    companyIntelligenceVersionId: record.id,
    companyIntelligenceVersion: record.companyIntelligenceVersion,
    evidenceFingerprint: record.evidenceFingerprint,
    createdAt: record.createdAt,
    understanding: record.understanding,
    evidenceRefs: record.evidenceRefs,
  }
}

export async function loadCompanyIntelligence(input: {
  admin: SupabaseClient
  /** Organization A — required for tenant authorization. */
  ownerOrganizationId: string
  /** External company id (Organization B). Alias of companyId. */
  externalCompanyId?: string | null
  companyId?: string | null
  /** Growth Lead evidence adapter — not a platform identity. */
  leadId?: string | null
  versionId?: string | null
}): Promise<FuzorCompanyIntelligenceVersionRecord | null> {
  const owner = requireOwnerOrganizationId(input.ownerOrganizationId)
  if (!owner.ok) return null

  const legacyOwner = legacyBridgeOwnerOrganizationId()

  if (input.versionId?.trim()) {
    return loadFuzorCompanyIntelligenceById({
      admin: input.admin,
      versionId: input.versionId.trim(),
      ownerOrganizationId: owner.ownerOrganizationId,
      legacyOwnerOrganizationId: legacyOwner,
    })
  }

  let companyId =
    input.externalCompanyId?.trim() || input.companyId?.trim() || null
  if (!companyId && input.leadId?.trim()) {
    companyId = await resolveCanonicalCompanyIdForLead(input.admin, input.leadId.trim())
  }

  return loadLatestFuzorCompanyIntelligence({
    admin: input.admin,
    ownerOrganizationId: owner.ownerOrganizationId,
    companyId,
    leadId: input.leadId?.trim() || null,
    legacyOwnerOrganizationId: legacyOwner,
  })
}

/**
 * Canonical ensure path (platform):
 * gather evidence → fingerprint → reuse if unchanged → else GPT understand → append-only persist.
 *
 * Ownership: (ownerOrganizationId, externalCompanyId).
 * Lead is an evidence adapter only.
 */
export async function ensureCompanyIntelligence(input: {
  admin: SupabaseClient
  /** Organization A — required. No silent Growth Engine default. */
  ownerOrganizationId: string
  /** Reserved for multi-deployment orgs; CI remains shared across deployments. */
  aiDeploymentId?: string | null
  externalCompanyId?: string | null
  companyId?: string | null
  /** Growth Lead evidence adapter (required until additional adapters ship). */
  leadId?: string | null
  actingUserEmail?: string | null
  forceRegenerate?: boolean
}): Promise<EnsureCompanyIntelligenceResult> {
  const owner = requireOwnerOrganizationId(input.ownerOrganizationId)
  if (!owner.ok) return owner.result

  const leadId = input.leadId?.trim() || null
  if (!leadId) {
    return {
      ok: false,
      code: "evidence_adapter_required",
      message:
        "A Growth Lead evidence adapter (leadId) is required until additional evidence adapters ship. Platform identity remains (ownerOrganizationId, externalCompanyId).",
    }
  }

  // AI billing / gather scope = owner organization (operating the deployment).
  const organizationId = owner.ownerOrganizationId

  const gathered = await gatherFuzorCompanyIntelligenceEvidence({
    admin: input.admin,
    leadId,
    organizationId,
  })
  if (!gathered.ok) {
    return { ok: false, code: gathered.code, message: gathered.message }
  }

  const packet = gathered.packet
  const { evidenceFingerprint, evidenceVersion } =
    computeFuzorCompanyIntelligenceEvidenceFingerprint(packet)
  const evidenceRefs = buildFuzorCompanyIntelligenceEvidenceRefs(packet)

  const companyId =
    input.externalCompanyId?.trim() ||
    input.companyId?.trim() ||
    (await resolveOrProvisionCanonicalCompanyIdForLead(input.admin, leadId, packet))

  const prior = await loadLatestFuzorCompanyIntelligence({
    admin: input.admin,
    ownerOrganizationId: organizationId,
    companyId,
    leadId,
    legacyOwnerOrganizationId: legacyBridgeOwnerOrganizationId(),
  })

  if (
    prior &&
    !input.forceRegenerate &&
    prior.evidenceFingerprint === evidenceFingerprint &&
    prior.companyIntelligenceVersion === FUZOR_COMPANY_INTELLIGENCE_PLATFORM_VERSION
  ) {
    logGrowthEngine("fuzor_company_intelligence_reused", {
      ownerOrganizationId: organizationId,
      leadId,
      companyId,
      versionId: prior.id,
      evidenceFingerprint,
    })
    return {
      ok: true,
      reused: true,
      regenerated: false,
      reason: "reused_matching_evidence",
      record: prior,
    }
  }

  const generated = await runFuzorCompanyIntelligence({
    admin: input.admin,
    leadId,
    organizationId,
    actingUserEmail: input.actingUserEmail,
  })
  if (!generated.ok) {
    return { ok: false, code: generated.code, message: generated.message }
  }

  try {
    const record = await insertFuzorCompanyIntelligenceVersion(input.admin, {
      ownerOrganizationId: organizationId,
      aiDeploymentId: input.aiDeploymentId ?? null,
      companyId,
      leadId,
      companyName: packet.companyName,
      website: packet.website,
      model: generated.output.model ?? FUZOR_COMPANY_INTELLIGENCE_MODEL,
      modelVersion: generated.output.model ?? FUZOR_COMPANY_INTELLIGENCE_MODEL,
      promptVersion: FUZOR_COMPANY_INTELLIGENCE_PROMPT_VERSION,
      companyIntelligenceVersion: FUZOR_COMPANY_INTELLIGENCE_PLATFORM_VERSION,
      evidenceVersion,
      evidenceFingerprint,
      understanding: generated.output.understanding,
      evidenceRefs,
      generationMetadata: {
        provider: generated.output.provider,
        modelAttempts: generated.output.modelAttempts,
        qaMarker: FUZOR_COMPANY_INTELLIGENCE_2A_QA_MARKER,
        forceRegenerate: Boolean(input.forceRegenerate),
        priorVersionId: prior?.id ?? null,
        aiDeploymentId: input.aiDeploymentId ?? null,
        evidenceAdapter: "growth_lead",
      },
      generationDurationMs: generated.output.durationMs,
      promptTokens: generated.output.promptTokens,
      completionTokens: generated.output.completionTokens,
      qaMarker: FUZOR_COMPANY_INTELLIGENCE_2A_QA_MARKER,
      generationMode: FUZOR_COMPANY_INTELLIGENCE_2A_GENERATION_MODE,
    })

    logGrowthEngine("fuzor_company_intelligence_persisted", {
      ownerOrganizationId: organizationId,
      leadId,
      companyId,
      versionId: record.id,
      storageBackend: record.storageBackend,
      evidenceFingerprint,
      reused: false,
    })

    return {
      ok: true,
      reused: false,
      regenerated: true,
      reason: input.forceRegenerate
        ? "regenerated_forced"
        : prior
          ? "regenerated_new_evidence"
          : "regenerated_no_prior",
      record,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Persist failed."
    return { ok: false, code: "persist_failed", message }
  }
}

/**
 * Layer 3 intake — AI employees consume understanding, never regenerate here.
 * Tenant-scoped: only intelligence owned by ownerOrganizationId is returned.
 */
export async function consumeCompanyIntelligenceForAiEmployee(input: {
  admin: SupabaseClient
  ownerOrganizationId: string
  aiDeploymentId?: string | null
  externalCompanyId?: string | null
  companyId?: string | null
  leadId?: string | null
  versionId?: string | null
  /**
   * When true and no version exists, run ensure once.
   * Default false — employees should not silently trigger GPT.
   */
  ensureIfMissing?: boolean
  actingUserEmail?: string | null
}): Promise<
  | { ok: true; intelligence: CompanyIntelligenceForAiEmployee; ensured: boolean }
  | { ok: false; code: string; message: string }
> {
  const owner = requireOwnerOrganizationId(input.ownerOrganizationId)
  if (!owner.ok) {
    return {
      ok: false,
      code: owner.result.code,
      message: owner.result.message,
    }
  }

  const existing = await loadCompanyIntelligence({
    admin: input.admin,
    ownerOrganizationId: owner.ownerOrganizationId,
    externalCompanyId: input.externalCompanyId,
    companyId: input.companyId,
    leadId: input.leadId,
    versionId: input.versionId,
  })

  if (existing) {
    if (existing.ownerOrganizationId !== owner.ownerOrganizationId) {
      return {
        ok: false,
        code: "forbidden_cross_tenant",
        message: "Company Intelligence is not owned by the requesting organization.",
      }
    }
    return { ok: true, intelligence: toAiEmployeeView(existing), ensured: false }
  }

  if (!input.ensureIfMissing || !input.leadId?.trim()) {
    return {
      ok: false,
      code: "company_intelligence_missing",
      message: "No Company Intelligence version found for this owner organization / company.",
    }
  }

  const ensured = await ensureCompanyIntelligence({
    admin: input.admin,
    ownerOrganizationId: owner.ownerOrganizationId,
    aiDeploymentId: input.aiDeploymentId,
    externalCompanyId: input.externalCompanyId,
    companyId: input.companyId,
    leadId: input.leadId.trim(),
    actingUserEmail: input.actingUserEmail,
  })
  if (!ensured.ok) {
    return { ok: false, code: ensured.code, message: ensured.message }
  }

  return { ok: true, intelligence: toAiEmployeeView(ensured.record), ensured: true }
}

/** Stable equality check for persist→reload validation. */
export function companyIntelligenceUnderstandingFingerprint(
  understanding: FuzorCompanyIntelligenceVersionRecord["understanding"],
): string {
  return JSON.stringify(understanding)
}
