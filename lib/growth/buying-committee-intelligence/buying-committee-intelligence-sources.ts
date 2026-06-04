import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  baseConfidenceForBuyingCommitteeSource,
  confidenceTierForBuyingCommitteeIntelligence,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-confidence"
import {
  buildNormalizedAssignmentKey,
  classifyCommitteeRoleFromJobTitle,
  mapCanonicalEmploymentRoleToCommitteeRole,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-role-classification"
import type {
  GrowthBuyingCommitteeIntelligenceDraftAssignment,
  GrowthBuyingCommitteeIntelligenceRole,
  GrowthBuyingCommitteeIntelligenceSource,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

export type BuyingCommitteeIntelligenceContext = {
  company_id: string
  company_name: string
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function draftAssignment(input: {
  company_id: string
  person_id: string
  full_name: string
  job_title: string | null
  committee_role: GrowthBuyingCommitteeIntelligenceRole
  source: GrowthBuyingCommitteeIntelligenceSource
  provider_name: string
  discovery_source: string
  confidence?: number
  staging_trusted?: boolean
  evidence: GrowthBuyingCommitteeIntelligenceDraftAssignment["evidence"]
}): GrowthBuyingCommitteeIntelligenceDraftAssignment {
  const confidence = input.confidence ?? baseConfidenceForBuyingCommitteeSource(input.source)
  return {
    assignment_ref: randomUUID(),
    person_id: input.person_id,
    full_name: input.full_name,
    job_title: input.job_title,
    committee_role: input.committee_role,
    normalized_assignment_key: buildNormalizedAssignmentKey({
      company_id: input.company_id,
      person_id: input.person_id,
      committee_role: input.committee_role,
    }),
    source: input.source,
    confidence,
    confidence_tier: confidenceTierForBuyingCommitteeIntelligence({
      source: input.source,
      verification_status: "unverified",
      base_confidence: confidence,
    }),
    provider_name: input.provider_name,
    discovery_source: input.discovery_source,
    staging_trusted: input.staging_trusted,
    evidence: input.evidence,
  }
}

export async function loadBuyingCommitteeIntelligenceContext(
  admin: SupabaseClient,
  input: { company_id: string },
): Promise<BuyingCommitteeIntelligenceContext | null> {
  const { data: company, error } = await admin
    .schema("growth")
    .from("companies")
    .select("id, display_name, status")
    .eq("id", input.company_id)
    .maybeSingle()
  if (error || !company || company.status !== "active") return null
  return {
    company_id: company.id as string,
    company_name: asString(company.display_name) || "Company",
  }
}

export async function collectCanonicalPersonCompanyRoleAssignments(
  admin: SupabaseClient,
  ctx: BuyingCommitteeIntelligenceContext,
): Promise<{ drafts: GrowthBuyingCommitteeIntelligenceDraftAssignment[]; messages: string[] }> {
  const messages: string[] = []
  const { data: rows, error } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("id, person_id, role_type, title, confidence, provider_name, discovery_source")
    .eq("company_id", ctx.company_id)
    .neq("role_type", "unknown")
    .limit(200)

  if (error) {
    messages.push(`Canonical roles source skipped: ${error.message}`)
    return { drafts: [], messages }
  }

  const personIds = [...new Set((rows ?? []).map((r) => asString(r.person_id)).filter(Boolean))]
  const personById = new Map<string, { full_name: string; status: string }>()
  if (personIds.length > 0) {
    const { data: persons } = await admin
      .schema("growth")
      .from("persons")
      .select("id, full_name, status")
      .in("id", personIds)
    for (const p of persons ?? []) {
      personById.set(asString(p.id), {
        full_name: asString(p.full_name),
        status: asString(p.status),
      })
    }
  }

  const drafts: GrowthBuyingCommitteeIntelligenceDraftAssignment[] = []
  for (const row of rows ?? []) {
    const person_id = asString(row.person_id)
    const person = personById.get(person_id)
    if (!person_id || !person || person.status !== "active") continue
    const committee_role = mapCanonicalEmploymentRoleToCommitteeRole(asString(row.role_type))
    if (!committee_role) continue

    drafts.push(
      draftAssignment({
        company_id: ctx.company_id,
        person_id,
        full_name: person.full_name || "Unknown",
        job_title: asString(row.title) || null,
        committee_role,
        source: "canonical_role",
        provider_name: asString(row.provider_name) || "canonical_person_company_roles",
        discovery_source: asString(row.discovery_source) || "person_company_roles",
        confidence: Math.max(
          Number(row.confidence ?? 0),
          baseConfidenceForBuyingCommitteeSource("canonical_role"),
        ),
        evidence: [
          {
            evidence_type: "canonical_role",
            source_record_id: asString(row.id),
            extraction_method: "person_company_roles.role_type",
            evidence_text: `Canonical employment role_type=${asString(row.role_type)} maps to committee role ${committee_role}.`,
            confidence: Number(row.confidence ?? 0.9),
          },
        ],
      }),
    )
  }

  messages.push(`Canonical person_company_roles: ${drafts.length} explicit role assignment(s).`)
  return { drafts, messages }
}

export async function collectStagingContactCommitteeAssignments(
  admin: SupabaseClient,
  ctx: BuyingCommitteeIntelligenceContext,
): Promise<{ drafts: GrowthBuyingCommitteeIntelligenceDraftAssignment[]; messages: string[] }> {
  const messages: string[] = []
  const { data: contacts, error } = await admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "id, canonical_person_id, full_name, title, confidence_score, contact_status, metadata, source_evidence",
    )
    .eq("canonical_company_id", ctx.company_id)
    .not("canonical_person_id", "is", null)
    .limit(200)

  if (error) {
    messages.push(`Staging contacts source skipped: ${error.message}`)
    return { drafts: [], messages }
  }

  const drafts: GrowthBuyingCommitteeIntelligenceDraftAssignment[] = []
  for (const row of contacts ?? []) {
    const person_id = asString(row.canonical_person_id)
    if (!person_id) continue

    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {}
    const declared = asString(metadata.committee_role).toLowerCase()
    const title = asString(row.title) || null
    const full_name = asString(row.full_name) || "Unknown"

    if (declared && declared !== "unknown") {
      const committee_role = mapCanonicalEmploymentRoleToCommitteeRole(declared)
      if (committee_role) {
        drafts.push(
          draftAssignment({
            company_id: ctx.company_id,
            person_id,
            full_name,
            job_title: title,
            committee_role,
            source: "metadata_declared",
            provider_name: "company_contacts",
            discovery_source: "metadata.committee_role",
            staging_trusted: asString(row.contact_status) === "verified",
            evidence: [
              {
                evidence_type: "metadata_declared",
                source_record_id: asString(row.id),
                extraction_method: "company_contacts.metadata.committee_role",
                evidence_text: `Staging metadata declares committee_role=${declared}.`,
              },
            ],
          }),
        )
        continue
      }
    }

    const pattern = classifyCommitteeRoleFromJobTitle({ job_title: title })
    if (!pattern) continue

    const trusted =
      asString(row.contact_status) === "verified" ||
      (Array.isArray(row.source_evidence) && row.source_evidence.length > 0)

    drafts.push(
      draftAssignment({
        company_id: ctx.company_id,
        person_id,
        full_name,
        job_title: title,
        committee_role: pattern.committee_role,
        source: "title_pattern",
        provider_name: "company_contacts",
        discovery_source: "title_pattern_match",
        staging_trusted: trusted,
        confidence: Math.min(
          0.92,
          Math.max(
            baseConfidenceForBuyingCommitteeSource("title_pattern"),
            Number(row.confidence_score ?? 0) / 100,
          ),
        ),
        evidence: [
          {
            evidence_type: "title_pattern",
            source_record_id: asString(row.id),
            extraction_method: pattern.pattern_id,
            evidence_text: pattern.evidence_text,
          },
        ],
      }),
    )
  }

  messages.push(`Staging company_contacts: ${drafts.length} evidence-backed assignment draft(s).`)
  return { drafts, messages }
}

export async function collectConfirmedDecisionMakerAssignments(
  admin: SupabaseClient,
  ctx: BuyingCommitteeIntelligenceContext,
): Promise<{ drafts: GrowthBuyingCommitteeIntelligenceDraftAssignment[]; messages: string[] }> {
  const messages: string[] = []

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("growth_lead_id, lead_decision_maker_id, canonical_person_id")
    .eq("canonical_company_id", ctx.company_id)
    .not("lead_decision_maker_id", "is", null)
    .limit(300)

  const dmIds = [
    ...new Set(
      (contacts ?? [])
        .map((c) => asString(c.lead_decision_maker_id))
        .filter(Boolean),
    ),
  ]
  if (dmIds.length === 0) {
    messages.push("Confirmed decision makers: none linked via company_contacts.")
    return { drafts: [], messages }
  }

  const { data: dms, error } = await admin
    .schema("growth")
    .from("lead_decision_makers")
    .select(
      "id, canonical_person_id, full_name, title, status, evidence_excerpt, confidence, source_detail",
    )
    .in("id", dmIds)
    .eq("status", "confirmed")
    .limit(200)

  if (error) {
    messages.push(`Decision makers source skipped: ${error.message}`)
    return { drafts: [], messages }
  }

  const drafts: GrowthBuyingCommitteeIntelligenceDraftAssignment[] = []
  for (const dm of dms ?? []) {
    const person_id = asString(dm.canonical_person_id)
    if (!person_id) continue
    const title = asString(dm.title) || null
    const pattern = classifyCommitteeRoleFromJobTitle({ job_title: title })
    if (!pattern) continue

    drafts.push(
      draftAssignment({
        company_id: ctx.company_id,
        person_id,
        full_name: asString(dm.full_name) || "Unknown",
        job_title: title,
        committee_role: pattern.committee_role,
        source: "confirmed_decision_maker",
        provider_name: "lead_decision_makers",
        discovery_source: asString(dm.source_detail) || "confirmed",
        confidence: Math.max(
          baseConfidenceForBuyingCommitteeSource("confirmed_decision_maker"),
          Number(dm.confidence ?? 0) / 100,
        ),
        evidence: [
          {
            evidence_type: "confirmed_decision_maker",
            source_record_id: asString(dm.id),
            extraction_method: pattern.pattern_id,
            evidence_text: `${pattern.evidence_text}${
              dm.evidence_excerpt ? ` Operator evidence: ${asString(dm.evidence_excerpt)}` : ""
            }`,
          },
        ],
      }),
    )
  }

  messages.push(`Confirmed lead decision makers: ${drafts.length} assignment draft(s).`)
  return { drafts, messages }
}

export async function collectPriorCommitteeIntelligenceAssignments(
  admin: SupabaseClient,
  ctx: BuyingCommitteeIntelligenceContext,
): Promise<{ drafts: GrowthBuyingCommitteeIntelligenceDraftAssignment[]; messages: string[] }> {
  const messages: string[] = []
  const { data: rows, error } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_members")
    .select(
      "id, person_id, committee_role, full_name, job_title, confidence, verification_status, provider_name, discovery_source",
    )
    .eq("company_id", ctx.company_id)
    .eq("verification_status", "verified")
    .limit(100)

  if (error) {
    messages.push(`Prior committee intelligence skipped: ${error.message}`)
    return { drafts: [], messages }
  }

  const drafts: GrowthBuyingCommitteeIntelligenceDraftAssignment[] = []
  for (const row of rows ?? []) {
    drafts.push(
      draftAssignment({
        company_id: ctx.company_id,
        person_id: asString(row.person_id),
        full_name: asString(row.full_name) || "Unknown",
        job_title: asString(row.job_title) || null,
        committee_role: row.committee_role as GrowthBuyingCommitteeIntelligenceRole,
        source: "canonical_role",
        provider_name: asString(row.provider_name) || "prior_intelligence_member",
        discovery_source: "buying_committee_intelligence_members",
        confidence: Math.max(Number(row.confidence ?? 0), 0.8),
        evidence: [
          {
            evidence_type: "canonical_role",
            source_record_id: asString(row.id),
            extraction_method: "prior_verified_member",
            evidence_text: `Prior verified committee assignment (${asString(row.committee_role)}).`,
            confidence: Number(row.confidence ?? 0.85),
          },
        ],
      }),
    )
  }

  messages.push(`Prior verified committee members: ${drafts.length} carried forward.`)
  return { drafts, messages }
}

function dedupeDrafts(
  drafts: GrowthBuyingCommitteeIntelligenceDraftAssignment[],
): GrowthBuyingCommitteeIntelligenceDraftAssignment[] {
  const byKey = new Map<string, GrowthBuyingCommitteeIntelligenceDraftAssignment>()
  for (const draft of drafts) {
    const existing = byKey.get(draft.normalized_assignment_key)
    if (!existing || draft.confidence > existing.confidence) {
      byKey.set(draft.normalized_assignment_key, draft)
    }
  }
  return [...byKey.values()]
}

export async function collectAllBuyingCommitteeIntelligenceAssignments(
  admin: SupabaseClient,
  ctx: BuyingCommitteeIntelligenceContext,
): Promise<{
  drafts: GrowthBuyingCommitteeIntelligenceDraftAssignment[]
  messages: string[]
}> {
  const results = await Promise.all([
    collectCanonicalPersonCompanyRoleAssignments(admin, ctx),
    collectStagingContactCommitteeAssignments(admin, ctx),
    collectConfirmedDecisionMakerAssignments(admin, ctx),
    collectPriorCommitteeIntelligenceAssignments(admin, ctx),
  ])

  const messages: string[] = []
  const drafts: GrowthBuyingCommitteeIntelligenceDraftAssignment[] = []
  for (const result of results) {
    messages.push(...result.messages)
    drafts.push(...result.drafts)
  }

  return { drafts: dedupeDrafts(drafts), messages }
}
