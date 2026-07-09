/**
 * GE-AIOS-15C — Bind canonical relationship graph at lead intake (server-only).
 * Non-blocking: warnings only; never throws to callers.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  canonicalNameCityKey,
  canonicalNameStateKey,
  canonicalNormalizedCompanyName,
  canonicalNormalizedDomain,
} from "@/lib/growth/canonical-companies/canonical-company-normalize"
import {
  buildCanonicalCompanyInsertPayload,
  insertCanonicalCompany,
  upsertCanonicalCompanyDomain,
  upsertCanonicalCompanyLineage,
} from "@/lib/growth/canonical-companies/canonical-company-repository-core"
import {
  createEmptyCanonicalCompanyResolverIndexes,
  registerCanonicalCompanyInIndexes,
  resolveCanonicalCompany,
} from "@/lib/growth/canonical-companies/canonical-company-resolver"
import { resolveStagingCanonicalCompanyId } from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
import {
  canonicalNormalizedPersonEmail,
  canonicalNormalizedPersonLinkedIn,
} from "@/lib/growth/canonical-persons/canonical-person-normalize"
import {
  buildIntakeRelationshipBindingIntent,
  mergeIntakeRelationshipBindingMetadata,
  type IntakeRelationshipBindingSource,
  type IntakeRelationshipBindingStatus,
} from "@/lib/growth/relationship/intake-relationship-graph-binding"
import { buildRelationshipGraphContext } from "@/lib/growth/relationship/relationship-graph-types"
import { readCanonicalCompanyIdFromMetadata } from "@/lib/growth/relationship/parse-relationship-graph-refs"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type BindIntakeRelationshipGraphInput = {
  source: IntakeRelationshipBindingSource
  lead_id?: string | null
  organization_id?: string | null
  company_name: string
  website?: string | null
  domain?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  linkedin_url?: string | null
  contact_title?: string | null
  staging_company_candidate_id?: string | null
  existing_metadata?: Record<string, unknown> | null
  source_lineage?: Record<string, unknown>
}

export type BindIntakeRelationshipGraphResult = {
  metadata: Record<string, unknown>
  status: IntakeRelationshipBindingStatus
  warnings: string[]
  canonical_company_id: string | null
  primary_person_id: string | null
  person_company_role_id: string | null
  committee_role: string | null
  company_domain: string | null
  company_source: string | null
}

async function resolveCompanyIdFromDomain(
  admin: SupabaseClient,
  domain: string | null,
): Promise<{ company_id: string; method: string } | null> {
  if (!domain) return null

  const { data: primary } = await admin
    .schema("growth")
    .from("companies")
    .select("id")
    .eq("primary_domain", domain)
    .eq("status", "active")
    .maybeSingle()
  const primaryId = asString(primary?.id)
  if (primaryId) return { company_id: primaryId, method: "companies_primary_domain" }

  const { data: alias } = await admin
    .schema("growth")
    .from("company_domains")
    .select("company_id")
    .eq("normalized_domain", domain)
    .limit(1)
    .maybeSingle()
  const aliasId = asString(alias?.company_id)
  if (aliasId) return { company_id: aliasId, method: "company_domains_alias" }
  return null
}

async function resolveCompanyIdFromNameLocation(
  admin: SupabaseClient,
  input: { company_name: string; city?: string | null; state?: string | null },
): Promise<{ company_id: string; method: string } | null> {
  const normalizedName = canonicalNormalizedCompanyName(input.company_name)
  if (!normalizedName) return null

  const city = asString(input.city)
  if (city) {
    const { data } = await admin
      .schema("growth")
      .from("companies")
      .select("id")
      .eq("normalized_name", normalizedName)
      .eq("city", city)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
    const id = asString(data?.id)
    if (id) return { company_id: id, method: "name_city" }
  }

  const state = asString(input.state)
  if (state) {
    const { data } = await admin
      .schema("growth")
      .from("companies")
      .select("id")
      .eq("normalized_name", normalizedName)
      .eq("state", state)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
    const id = asString(data?.id)
    if (id) return { company_id: id, method: "name_state" }
  }

  return null
}

function readStagingCompanyCandidateId(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null
  const acquisition = metadata.acquisition
  if (acquisition && typeof acquisition === "object") {
    const fromAcquisition = asString((acquisition as Record<string, unknown>).company_candidate_id)
    if (fromAcquisition) return fromAcquisition
  }
  return (
    asString(metadata.company_candidate_id) ||
    asString(metadata.staging_company_candidate_id) ||
    null
  )
}

function buildSourceLineage(
  input: BindIntakeRelationshipGraphInput,
  extras: Record<string, unknown>,
): Record<string, unknown> {
  return {
    intake_source: input.source,
    company_name: input.company_name,
    website: input.website ?? null,
    domain: input.domain ?? null,
    external_ref: asString(input.existing_metadata?.external_ref) || null,
    ...(input.source_lineage ?? {}),
    ...extras,
  }
}

async function resolveIntakeCanonicalCompanyId(
  admin: SupabaseClient,
  input: BindIntakeRelationshipGraphInput,
  warnings: string[],
): Promise<{ company_id: string | null; company_source: string | null; company_domain: string | null }> {
  const existingMetadata = input.existing_metadata ?? {}
  const preset = readCanonicalCompanyIdFromMetadata(existingMetadata)
  if (preset) {
    return {
      company_id: preset,
      company_source: "lead_metadata",
      company_domain: canonicalNormalizedDomain(input.domain, input.website),
    }
  }

  const stagingId =
    input.staging_company_candidate_id ?? readStagingCompanyCandidateId(existingMetadata)
  if (stagingId) {
    try {
      const staging = await resolveStagingCanonicalCompanyId(admin, stagingId)
      if (staging.canonical_company_id) {
        return {
          company_id: staging.canonical_company_id,
          company_source: `staging:${staging.method}`,
          company_domain: canonicalNormalizedDomain(input.domain, input.website),
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "staging_resolution_failed"
      warnings.push(`staging_company_resolution_failed:${message}`)
    }
  }

  const companyDomain = canonicalNormalizedDomain(input.domain, input.website)
  if (companyDomain) {
    const fromDomain = await resolveCompanyIdFromDomain(admin, companyDomain)
    if (fromDomain) {
      return {
        company_id: fromDomain.company_id,
        company_source: fromDomain.method,
        company_domain: companyDomain,
      }
    }
  }

  const fromNameLocation = await resolveCompanyIdFromNameLocation(admin, input)
  if (fromNameLocation) {
    warnings.push(`canonical_company_matched_via_${fromNameLocation.method}`)
    return {
      company_id: fromNameLocation.company_id,
      company_source: fromNameLocation.method,
      company_domain: companyDomain,
    }
  }

  if (!companyDomain) {
    warnings.push("canonical_company_binding_skipped:insufficient_company_identity")
    return { company_id: null, company_source: null, company_domain: null }
  }

  if (!input.lead_id) {
    warnings.push("canonical_company_create_deferred:lead_id_pending")
    return { company_id: null, company_source: "pending_create", company_domain: companyDomain }
  }

  try {
    const indexes = createEmptyCanonicalCompanyResolverIndexes()
    const resolution = resolveCanonicalCompany(
      {
        source_table: "discovery_candidates",
        source_id: input.lead_id,
        run_id: null,
        provider_name: input.source,
        provider_type: "lead_intake",
        company_name: input.company_name,
        website: input.website ?? null,
        domain: input.domain ?? companyDomain,
        city: input.city ?? null,
        state: input.state ?? null,
        country: input.country ?? null,
        observed_at: new Date().toISOString(),
        confidence: 0.7,
      },
      indexes,
    )

    if (!resolution.would_create_new && resolution.company_id) {
      return {
        company_id: resolution.company_id,
        company_source: resolution.resolution_method,
        company_domain: companyDomain,
      }
    }

    const payload = buildCanonicalCompanyInsertPayload(
      {
        source_table: "discovery_candidates",
        source_id: input.lead_id,
        run_id: null,
        provider_name: input.source,
        provider_type: "lead_intake",
        company_name: input.company_name,
        website: input.website ?? null,
        domain: companyDomain,
        city: input.city ?? null,
        state: input.state ?? null,
        country: input.country ?? null,
        observed_at: new Date().toISOString(),
        confidence: 0.7,
      },
      "new",
    )

    const companyId = await insertCanonicalCompany(admin, payload)
    await upsertCanonicalCompanyDomain(admin, {
      company_id: companyId,
      domain: companyDomain,
      normalized_domain: companyDomain,
      is_primary: true,
      source_table: "growth.leads",
      source_id: input.lead_id,
      observed_at: new Date().toISOString(),
    })
    await upsertCanonicalCompanyLineage(admin, {
      company_id: companyId,
      source_table: "growth.leads",
      source_id: input.lead_id,
      provider_name: input.source,
      provider_type: "lead_intake",
      run_id: null,
      confidence: payload.identity_confidence,
      observed_at: new Date().toISOString(),
      source_metadata: {
        qa_marker: "ge-aios-15c-intake-graph-binding-v1",
        intake_source: input.source,
      },
    })

    registerCanonicalCompanyInIndexes(indexes, companyId, {
      primary_domain: companyDomain,
      normalized_domain: companyDomain,
      city: input.city ?? null,
      state: input.state ?? null,
      normalized_name: canonicalNormalizedCompanyName(input.company_name),
    })

    return {
      company_id: companyId,
      company_source: "intake_create",
      company_domain: companyDomain,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "canonical_company_create_failed"
    warnings.push(`canonical_company_create_failed:${message}`)
    return { company_id: null, company_source: null, company_domain: companyDomain }
  }
}

async function resolveIntakePersonId(
  admin: SupabaseClient,
  input: BindIntakeRelationshipGraphInput,
  canonicalCompanyId: string | null,
): Promise<string | null> {
  const normalizedEmail = canonicalNormalizedPersonEmail(input.contact_email)
  if (normalizedEmail) {
    const { data } = await admin
      .schema("growth")
      .from("person_emails")
      .select("person_id")
      .eq("normalized_email", normalizedEmail)
      .limit(1)
      .maybeSingle()
    const personId = asString(data?.person_id)
    if (personId) return personId
  }

  const normalizedLinkedIn = canonicalNormalizedPersonLinkedIn(input.linkedin_url)
  if (normalizedLinkedIn) {
    const { data } = await admin
      .schema("growth")
      .from("person_profiles")
      .select("person_id")
      .eq("normalized_profile_key", normalizedLinkedIn)
      .limit(1)
      .maybeSingle()
    const personId = asString(data?.person_id)
    if (personId) return personId
  }

  if (canonicalCompanyId && input.contact_email) {
    const { data: roles } = await admin
      .schema("growth")
      .from("person_company_roles")
      .select("person_id")
      .eq("company_id", canonicalCompanyId)
      .limit(50)
    const personIds = [...new Set((roles ?? []).map((row) => asString(row.person_id)).filter(Boolean))]
    if (personIds.length > 0 && normalizedEmail) {
      const { data: emails } = await admin
        .schema("growth")
        .from("person_emails")
        .select("person_id")
        .in("person_id", personIds)
        .eq("normalized_email", normalizedEmail)
        .limit(1)
        .maybeSingle()
      const personId = asString(emails?.person_id)
      if (personId) return personId
    }
  }

  return null
}

async function lookupPersonCompanyRoleId(
  admin: SupabaseClient,
  personId: string,
  companyId: string,
): Promise<string | null> {
  const { data } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("id")
    .eq("person_id", personId)
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle()
  return asString(data?.id) || null
}

async function lookupCommitteeRole(
  admin: SupabaseClient,
  personId: string,
  companyId: string,
): Promise<string | null> {
  const { data } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_members")
    .select("committee_role")
    .eq("person_id", personId)
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle()
  return asString(data?.committee_role) || null
}

function bindingStatus(input: {
  canonical_company_id: string | null
  primary_person_id: string | null
  warnings: string[]
  bind_person: boolean
}): IntakeRelationshipBindingStatus {
  if (input.warnings.some((w) => w.includes("_failed"))) return "failed"
  if (input.canonical_company_id && (!input.bind_person || input.primary_person_id)) return "bound"
  if (input.canonical_company_id || input.primary_person_id) return "partial"
  if (input.warnings.some((w) => w.includes("skipped"))) return "skipped"
  return "partial"
}

/** Attempt canonical graph binding for a lead intake path. Never throws. */
export async function bindIntakeRelationshipGraph(
  admin: SupabaseClient,
  input: BindIntakeRelationshipGraphInput,
): Promise<BindIntakeRelationshipGraphResult> {
  const warnings: string[] = []
  const intent = buildIntakeRelationshipBindingIntent(input.source)
  const attemptedAt = new Date().toISOString()

  try {
    const companyResolution = await resolveIntakeCanonicalCompanyId(admin, input, warnings)
    let canonicalCompanyId = companyResolution.company_id
    let companySource = companyResolution.company_source
    let companyDomain = companyResolution.company_domain

    if (
      !canonicalCompanyId &&
      companySource === "pending_create" &&
      input.lead_id &&
      companyDomain
    ) {
      const retry = await resolveIntakeCanonicalCompanyId(
        admin,
        { ...input, lead_id: input.lead_id },
        warnings,
      )
      canonicalCompanyId = retry.company_id
      companySource = retry.company_source
      companyDomain = retry.company_domain
    }

    let primaryPersonId: string | null = null
    let personCompanyRoleId: string | null = null
    let committeeRole: string | null = null

    if (intent.bind_person && canonicalCompanyId) {
      try {
        primaryPersonId = await resolveIntakePersonId(admin, input, canonicalCompanyId)
        if (!primaryPersonId && input.contact_name) {
          warnings.push("person_binding_skipped:no_canonical_person_match")
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "person_resolution_failed"
        warnings.push(`person_resolution_failed:${message}`)
      }

      if (primaryPersonId) {
        try {
          personCompanyRoleId = await lookupPersonCompanyRoleId(admin, primaryPersonId, canonicalCompanyId)
          committeeRole = await lookupCommitteeRole(admin, primaryPersonId, canonicalCompanyId)
        } catch (error) {
          const message = error instanceof Error ? error.message : "person_role_lookup_failed"
          warnings.push(`person_role_lookup_failed:${message}`)
        }
      }
    } else if (intent.bind_person && !canonicalCompanyId) {
      warnings.push("person_binding_skipped:canonical_company_unresolved")
    }

    const sourceLineage = buildSourceLineage(input, {
      canonical_company_id: canonicalCompanyId,
      primary_person_id: primaryPersonId,
      company_resolution_method: companySource,
      name_city_key: canonicalNameCityKey(input.company_name, input.city),
      name_state_key: canonicalNameStateKey(input.company_name, input.state),
    })

    const graph = buildRelationshipGraphContext({
      organization_id: input.organization_id ?? null,
      lead_id: input.lead_id ?? null,
      canonical_company_id: canonicalCompanyId,
      person_id: primaryPersonId,
      committee_role: committeeRole,
      memory_context_available: Boolean(input.existing_metadata && Object.keys(input.existing_metadata).length > 0),
      business_intelligence_context_available: Boolean(canonicalCompanyId),
    })

    const status = bindingStatus({
      canonical_company_id: canonicalCompanyId,
      primary_person_id: primaryPersonId,
      warnings,
      bind_person: intent.bind_person,
    })

    const metadata = mergeIntakeRelationshipBindingMetadata(input.existing_metadata, graph, {
      canonical_company_id: canonicalCompanyId,
      company_domain: companyDomain,
      company_source: companySource,
      relationship_binding_status: status,
      relationship_binding_attempted_at: attemptedAt,
      relationship_binding_warnings: warnings,
      source_lineage: sourceLineage,
      primary_person_id: primaryPersonId,
      person_company_role_id: personCompanyRoleId,
      committee_role: committeeRole,
      intent,
    })

    logGrowthEngine("intake_relationship_graph_bound", {
      leadId: input.lead_id ?? null,
      source: input.source,
      status,
      canonicalCompanyId,
      primaryPersonId,
      warningCount: warnings.length,
    })

    return {
      metadata,
      status,
      warnings,
      canonical_company_id: canonicalCompanyId,
      primary_person_id: primaryPersonId,
      person_company_role_id: personCompanyRoleId,
      committee_role: committeeRole,
      company_domain: companyDomain,
      company_source: companySource,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "intake_graph_binding_failed"
    warnings.push(`intake_graph_binding_failed:${message}`)
    logGrowthEngine("intake_relationship_graph_binding_failed", {
      leadId: input.lead_id ?? null,
      source: input.source,
      message,
    })

    const graph = buildRelationshipGraphContext({
      organization_id: input.organization_id ?? null,
      lead_id: input.lead_id ?? null,
      canonical_company_id: readCanonicalCompanyIdFromMetadata(input.existing_metadata),
    })

    const metadata = mergeIntakeRelationshipBindingMetadata(input.existing_metadata, graph, {
      relationship_binding_status: "failed",
      relationship_binding_attempted_at: attemptedAt,
      relationship_binding_warnings: warnings,
      source_lineage: buildSourceLineage(input, { binding_error: message }),
      intent,
    })

    return {
      metadata,
      status: "failed",
      warnings,
      canonical_company_id: null,
      primary_person_id: null,
      person_company_role_id: null,
      committee_role: null,
      company_domain: canonicalNormalizedDomain(input.domain, input.website),
      company_source: null,
    }
  }
}
