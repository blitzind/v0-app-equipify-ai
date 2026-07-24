/**
 * FUZOR Company Intelligence — append-only persistence (2A + PLATFORM-LIFT-1A).
 * Primary: growth.fuzor_company_intelligence_versions (owner-scoped)
 * Bridge (pre-migration): company_intelligence_runs.metadata (insert-only finalize)
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  FUZOR_CI_BRIDGE_PROVIDER_SUMMARY,
  FUZOR_COMPANY_INTELLIGENCE_OWNER_ORG_MIGRATION,
  type FuzorCompanyIntelligenceEvidenceRefs,
  type FuzorCompanyIntelligenceVersionRecord,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-2a-types"
import {
  fuzorCompanyBusinessUnderstandingSchema,
  normalizeFuzorCompanyBusinessUnderstanding,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-schema"
import type { FuzorCompanyBusinessUnderstanding } from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"

export function fuzorCompanyIntelligenceSchemaNotReadyMessage(): string {
  return `Apply migration ${FUZOR_COMPANY_INTELLIGENCE_OWNER_ORG_MIGRATION} for org-owned Company Intelligence versions.`
}

/**
 * Ready when dedicated table exists AND owner_organization_id is present.
 * Pre-lift 2A tables without ownership fall through to bridge until lift migration applies.
 */
export async function isFuzorCompanyIntelligenceVersionsSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("fuzor_company_intelligence_versions")
    .select("id, owner_organization_id")
    .limit(1)
  return !error
}

function parseUnderstanding(raw: unknown): FuzorCompanyBusinessUnderstanding | null {
  const parsed = fuzorCompanyBusinessUnderstandingSchema.safeParse(raw)
  if (!parsed.success) return null
  return normalizeFuzorCompanyBusinessUnderstanding(parsed.data)
}

function mapPrimaryRow(row: Record<string, unknown>): FuzorCompanyIntelligenceVersionRecord | null {
  const understanding = parseUnderstanding(row.understanding)
  if (!understanding) return null
  const refs = row.evidence_refs
  if (!refs || typeof refs !== "object") return null
  const ownerOrganizationId = row.owner_organization_id
    ? String(row.owner_organization_id)
    : null
  if (!ownerOrganizationId) return null

  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    ownerOrganizationId,
    aiDeploymentId: row.ai_deployment_id ? String(row.ai_deployment_id) : null,
    companyId: row.company_id ? String(row.company_id) : null,
    leadId: row.lead_id ? String(row.lead_id) : null,
    companyName: String(row.company_name),
    website: row.website ? String(row.website) : null,
    model: String(row.model),
    modelVersion: row.model_version ? String(row.model_version) : null,
    promptVersion: String(row.prompt_version),
    companyIntelligenceVersion: String(row.company_intelligence_version),
    evidenceVersion: String(row.evidence_version),
    evidenceFingerprint: String(row.evidence_fingerprint),
    understanding,
    evidenceRefs: refs as FuzorCompanyIntelligenceEvidenceRefs,
    generationMetadata:
      row.generation_metadata && typeof row.generation_metadata === "object"
        ? (row.generation_metadata as Record<string, unknown>)
        : {},
    generationDurationMs:
      typeof row.generation_duration_ms === "number" ? row.generation_duration_ms : null,
    promptTokens: typeof row.prompt_tokens === "number" ? row.prompt_tokens : null,
    completionTokens: typeof row.completion_tokens === "number" ? row.completion_tokens : null,
    qaMarker: String(row.qa_marker),
    generationMode: String(row.generation_mode),
    storageBackend: "fuzor_versions_table",
  }
}

function mapBridgeDocument(input: {
  runId: string
  createdAt: string
  companyId: string
  doc: InsertFuzorCompanyIntelligenceVersionInput
  metaLeadId?: string | null
}): FuzorCompanyIntelligenceVersionRecord | null {
  const understanding = parseUnderstanding(input.doc.understanding)
  if (!understanding) return null
  return {
    id: input.runId,
    createdAt: input.createdAt,
    ownerOrganizationId: input.doc.ownerOrganizationId,
    aiDeploymentId: input.doc.aiDeploymentId ?? null,
    companyId: input.companyId,
    leadId: input.doc.leadId ?? input.metaLeadId ?? null,
    companyName: input.doc.companyName,
    website: input.doc.website ?? null,
    model: input.doc.model,
    modelVersion: input.doc.modelVersion ?? null,
    promptVersion: input.doc.promptVersion,
    companyIntelligenceVersion: input.doc.companyIntelligenceVersion,
    evidenceVersion: input.doc.evidenceVersion,
    evidenceFingerprint: input.doc.evidenceFingerprint,
    understanding,
    evidenceRefs: input.doc.evidenceRefs,
    generationMetadata: input.doc.generationMetadata ?? {},
    generationDurationMs: input.doc.generationDurationMs ?? null,
    promptTokens: input.doc.promptTokens ?? null,
    completionTokens: input.doc.completionTokens ?? null,
    qaMarker: input.doc.qaMarker,
    generationMode: input.doc.generationMode,
    storageBackend: "company_intelligence_runs_bridge",
  }
}

export type InsertFuzorCompanyIntelligenceVersionInput = {
  ownerOrganizationId: string
  aiDeploymentId?: string | null
  companyId: string | null
  leadId: string | null
  companyName: string
  website: string | null
  model: string
  modelVersion: string | null
  promptVersion: string
  companyIntelligenceVersion: string
  evidenceVersion: string
  evidenceFingerprint: string
  understanding: FuzorCompanyBusinessUnderstanding
  evidenceRefs: FuzorCompanyIntelligenceEvidenceRefs
  generationMetadata?: Record<string, unknown>
  generationDurationMs: number | null
  promptTokens: number | null
  completionTokens: number | null
  qaMarker: string
  generationMode: string
}

export async function insertFuzorCompanyIntelligenceVersion(
  admin: SupabaseClient,
  input: InsertFuzorCompanyIntelligenceVersionInput,
): Promise<FuzorCompanyIntelligenceVersionRecord> {
  if (!input.ownerOrganizationId?.trim()) {
    throw new Error("insertFuzorCompanyIntelligenceVersion: ownerOrganizationId is required")
  }

  const primaryReady = await isFuzorCompanyIntelligenceVersionsSchemaReady(admin)
  if (primaryReady) {
    const { data, error } = await admin
      .schema("growth")
      .from("fuzor_company_intelligence_versions")
      .insert({
        owner_organization_id: input.ownerOrganizationId,
        ai_deployment_id: input.aiDeploymentId ?? null,
        company_id: input.companyId,
        lead_id: input.leadId,
        company_name: input.companyName,
        website: input.website,
        model: input.model,
        model_version: input.modelVersion,
        prompt_version: input.promptVersion,
        company_intelligence_version: input.companyIntelligenceVersion,
        evidence_version: input.evidenceVersion,
        evidence_fingerprint: input.evidenceFingerprint,
        understanding: input.understanding,
        evidence_refs: input.evidenceRefs,
        generation_metadata: input.generationMetadata ?? {},
        generation_duration_ms: input.generationDurationMs,
        prompt_tokens: input.promptTokens,
        completion_tokens: input.completionTokens,
        qa_marker: input.qaMarker,
        generation_mode: input.generationMode,
      })
      .select("*")
      .single()

    if (error) throw new Error(`insertFuzorCompanyIntelligenceVersion: ${error.message}`)
    const mapped = mapPrimaryRow(data as Record<string, unknown>)
    if (!mapped) throw new Error("insertFuzorCompanyIntelligenceVersion: invalid row mapping")
    return mapped
  }

  // Bridge: append-only run row with document in metadata (requires company_id).
  if (!input.companyId) {
    throw new Error(
      `${fuzorCompanyIntelligenceSchemaNotReadyMessage()} Bridge storage also requires a resolved company_id.`,
    )
  }

  const document = {
    ...input,
    storageBackend: "company_intelligence_runs_bridge" as const,
  }

  const started = new Date().toISOString()
  const { data: run, error: insertError } = await admin
    .schema("growth")
    .from("company_intelligence_runs")
    .insert({
      company_id: input.companyId,
      status: "completed",
      provider_summary: FUZOR_CI_BRIDGE_PROVIDER_SUMMARY,
      started_at: started,
      completed_at: started,
      finding_count: 0,
      verified_count: 0,
      promoted_count: 0,
      metadata: {
        fuzor_company_intelligence_2a: document,
        qa_marker: input.qaMarker,
        evidence_fingerprint: input.evidenceFingerprint,
        lead_id: input.leadId,
        owner_organization_id: input.ownerOrganizationId,
        ai_deployment_id: input.aiDeploymentId ?? null,
      },
    })
    .select("id, created_at, company_id, metadata")
    .single()

  if (insertError) {
    throw new Error(`insertFuzorCompanyIntelligenceVersion bridge: ${insertError.message}`)
  }

  const mapped = mapBridgeDocument({
    runId: String(run.id),
    createdAt: String(run.created_at),
    companyId: input.companyId,
    doc: input,
  })
  if (!mapped) throw new Error("insertFuzorCompanyIntelligenceVersion bridge: invalid mapping")
  return mapped
}

function bridgeOwnerMatches(
  doc: InsertFuzorCompanyIntelligenceVersionInput,
  meta: Record<string, unknown>,
  ownerOrganizationId: string,
  /** Equipify pre-lift rows omit owner; treat as Growth Engine org when provided. */
  legacyOwnerOrganizationId: string | null,
): boolean {
  const documented =
    doc.ownerOrganizationId?.trim() ||
    (typeof meta.owner_organization_id === "string" ? meta.owner_organization_id.trim() : "")
  if (documented) return documented === ownerOrganizationId
  // Pre-LIFT bridge rows: only readable by the Equipify Growth Engine org (compat shim).
  return Boolean(legacyOwnerOrganizationId && legacyOwnerOrganizationId === ownerOrganizationId)
}

export async function loadLatestFuzorCompanyIntelligence(input: {
  admin: SupabaseClient
  ownerOrganizationId: string
  companyId?: string | null
  leadId?: string | null
  /** When set, pre-lift bridge rows without owner are readable by this org only. */
  legacyOwnerOrganizationId?: string | null
}): Promise<FuzorCompanyIntelligenceVersionRecord | null> {
  const ownerOrganizationId = input.ownerOrganizationId?.trim()
  if (!ownerOrganizationId) return null

  const companyId = input.companyId?.trim() || null
  const leadId = input.leadId?.trim() || null
  if (!companyId && !leadId) return null

  const primaryReady = await isFuzorCompanyIntelligenceVersionsSchemaReady(input.admin)
  if (primaryReady) {
    let query = input.admin
      .schema("growth")
      .from("fuzor_company_intelligence_versions")
      .select("*")
      .eq("owner_organization_id", ownerOrganizationId)
      .order("created_at", { ascending: false })
      .limit(1)

    if (companyId) query = query.eq("company_id", companyId)
    else if (leadId) query = query.eq("lead_id", leadId)

    const { data, error } = await query.maybeSingle()
    if (error || !data) return null
    return mapPrimaryRow(data as Record<string, unknown>)
  }

  if (!companyId) return null

  const { data: runs, error } = await input.admin
    .schema("growth")
    .from("company_intelligence_runs")
    .select("id, created_at, company_id, metadata")
    .eq("company_id", companyId)
    .eq("provider_summary", FUZOR_CI_BRIDGE_PROVIDER_SUMMARY)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(25)

  if (error || !runs?.length) return null

  for (const run of runs as Array<Record<string, unknown>>) {
    const meta =
      run.metadata && typeof run.metadata === "object"
        ? (run.metadata as Record<string, unknown>)
        : {}
    const docRaw = meta.fuzor_company_intelligence_2a
    if (!docRaw || typeof docRaw !== "object") continue
    const doc = docRaw as InsertFuzorCompanyIntelligenceVersionInput
    if (
      !bridgeOwnerMatches(
        doc,
        meta,
        ownerOrganizationId,
        input.legacyOwnerOrganizationId ?? null,
      )
    ) {
      continue
    }
    // Normalize owner onto doc for mapping.
    const normalized: InsertFuzorCompanyIntelligenceVersionInput = {
      ...doc,
      ownerOrganizationId:
        doc.ownerOrganizationId?.trim() ||
        (typeof meta.owner_organization_id === "string"
          ? meta.owner_organization_id
          : ownerOrganizationId),
    }
    const mapped = mapBridgeDocument({
      runId: String(run.id),
      createdAt: String(run.created_at),
      companyId: String(run.company_id),
      doc: normalized,
      metaLeadId: typeof meta.lead_id === "string" ? meta.lead_id : null,
    })
    if (mapped) return mapped
  }

  return null
}

export async function loadFuzorCompanyIntelligenceById(input: {
  admin: SupabaseClient
  versionId: string
  ownerOrganizationId: string
  legacyOwnerOrganizationId?: string | null
}): Promise<FuzorCompanyIntelligenceVersionRecord | null> {
  const ownerOrganizationId = input.ownerOrganizationId?.trim()
  if (!ownerOrganizationId) return null

  const primaryReady = await isFuzorCompanyIntelligenceVersionsSchemaReady(input.admin)
  if (primaryReady) {
    const { data, error } = await input.admin
      .schema("growth")
      .from("fuzor_company_intelligence_versions")
      .select("*")
      .eq("id", input.versionId)
      .eq("owner_organization_id", ownerOrganizationId)
      .maybeSingle()
    if (error || !data) return null
    return mapPrimaryRow(data as Record<string, unknown>)
  }

  const { data: run, error } = await input.admin
    .schema("growth")
    .from("company_intelligence_runs")
    .select("id, created_at, company_id, metadata, provider_summary")
    .eq("id", input.versionId)
    .maybeSingle()
  if (error || !run) return null
  if (run.provider_summary !== FUZOR_CI_BRIDGE_PROVIDER_SUMMARY) return null

  const meta =
    run.metadata && typeof run.metadata === "object"
      ? (run.metadata as Record<string, unknown>)
      : {}
  const docRaw = meta.fuzor_company_intelligence_2a
  if (!docRaw || typeof docRaw !== "object") return null
  const doc = docRaw as InsertFuzorCompanyIntelligenceVersionInput
  if (
    !bridgeOwnerMatches(
      doc,
      meta,
      ownerOrganizationId,
      input.legacyOwnerOrganizationId ?? null,
    )
  ) {
    return null
  }

  const normalized: InsertFuzorCompanyIntelligenceVersionInput = {
    ...doc,
    ownerOrganizationId:
      doc.ownerOrganizationId?.trim() ||
      (typeof meta.owner_organization_id === "string"
        ? meta.owner_organization_id
        : ownerOrganizationId),
  }

  return mapBridgeDocument({
    runId: String(run.id),
    createdAt: String(run.created_at),
    companyId: String(run.company_id),
    doc: normalized,
    metaLeadId: typeof meta.lead_id === "string" ? meta.lead_id : null,
  })
}
