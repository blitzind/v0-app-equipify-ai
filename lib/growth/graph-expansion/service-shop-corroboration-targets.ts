/** Phase 7.PS-IH — Select high-score service-shop named person targets. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateServiceShopPersonCandidate } from "@/lib/growth/graph-expansion/service-shop-person-fragment-rejection"
import { loadServiceShopCohort } from "@/lib/growth/graph-expansion/service-shop-cohort"
import {
  SERVICE_SHOP_CORROBORATION_MAX_EXTENDED_TARGETS,
  SERVICE_SHOP_CORROBORATION_MIN_SCORE,
  type ServiceShopCorroborationRejectedRow,
  type ServiceShopCorroborationTargetRow,
} from "@/lib/growth/graph-expansion/service-shop-corroboration-types"
import { GROWTH_PS_HE_ANCHOR_COMPANIES } from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"
import { GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER } from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-types"
import { isGenericIdentityName } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

const anchorIds = new Set(GROWTH_PS_HE_ANCHOR_COMPANIES.map((a) => a.canonical_company_id))

function hasExternalEvidence(metadata: Record<string, unknown>, source_type: string): boolean {
  return (
    source_type === "public_record" ||
    source_type === "team_page" ||
    source_type === "leadership_page" ||
    Boolean(asString(metadata.external_evidence_source)) ||
    Boolean(asString(metadata.external_evidence_url))
  )
}

function hasCorroborationEvidence(metadata: Record<string, unknown>): boolean {
  const signals = metadata.professional_identity_corroboration
  return (
    Array.isArray(signals) &&
    signals.some(
      (row) =>
        row &&
        typeof row === "object" &&
        (row as Record<string, unknown>).qa_marker ===
          GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER,
    )
  )
}

export async function loadServiceShopCorroborationTargets(
  admin: SupabaseClient,
  input: { scan_limit?: number } = {},
): Promise<{
  selected: ServiceShopCorroborationTargetRow[]
  rejected: ServiceShopCorroborationRejectedRow[]
}> {
  const { diagnostics } = await loadServiceShopCohort(admin, {
    limit: 50,
    scan_limit: input.scan_limit ?? 500,
    include_anchors: true,
    min_score: SERVICE_SHOP_CORROBORATION_MIN_SCORE,
  })

  const companyScoreById = new Map(
    [...diagnostics.selected, ...diagnostics.down_ranked_sample].map((row) => [
      row.canonical_company_id,
      row,
    ]),
  )

  const eligibleCompanyIds = diagnostics.selected
    .filter(
      (row) =>
        anchorIds.has(row.canonical_company_id) ||
        row.service_shop_score >= SERVICE_SHOP_CORROBORATION_MIN_SCORE,
    )
    .map((row) => row.canonical_company_id)

  if (eligibleCompanyIds.length === 0) {
    return { selected: [], rejected: [] }
  }

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "id, company_id, canonical_person_id, full_name, title, source_type, metadata, contact_status",
    )
    .in("company_id", eligibleCompanyIds)
    .not("canonical_person_id", "is", null)
    .neq("contact_status", "archived")

  const candidateByPerson = new Map<string, ServiceShopCorroborationTargetRow>()
  const rejected: ServiceShopCorroborationRejectedRow[] = []

  for (const row of contacts ?? []) {
    const record = row as Record<string, unknown>
    const canonical_company_id = asString(record.company_id)
    const person_id = asString(record.canonical_person_id)
    const full_name = asString(record.full_name)
    const companyMeta = companyScoreById.get(canonical_company_id)
    if (!companyMeta || !person_id) continue

    const metadata =
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>)
        : {}
    const source_type = asString(record.source_type)
    const title = asString(record.title) || null
    const externalEvidence = hasExternalEvidence(metadata, source_type)
    const corroborationEvidence = hasCorroborationEvidence(metadata)

    const identity = classifyContactIdentity({
      full_name,
      title,
      source_type,
    })
    if (identity.classification !== "named_person" && isGenericIdentityName(full_name)) continue

    const evaluation = evaluateServiceShopPersonCandidate({
      full_name,
      company_name: companyMeta.company_name,
      title,
      has_external_evidence: externalEvidence,
      has_corroboration_evidence: corroborationEvidence,
    })

    if (!evaluation.accepted) {
      rejected.push({
        full_name,
        company_name: companyMeta.company_name,
        canonical_company_id,
        service_shop_score: companyMeta.service_shop_score,
        rejection_reason: evaluation.rejection_reason ?? "rejected",
      })
      continue
    }

    if (!title && !externalEvidence && !corroborationEvidence) {
      rejected.push({
        full_name,
        company_name: companyMeta.company_name,
        canonical_company_id,
        service_shop_score: companyMeta.service_shop_score,
        rejection_reason: "missing_title_or_external_evidence",
      })
      continue
    }

    const is_ps_he_anchor = anchorIds.has(canonical_company_id)
    const target: ServiceShopCorroborationTargetRow = {
      person_id,
      company_contact_id: asString(record.id),
      canonical_company_id,
      company_candidate_id: companyMeta.company_candidate_id,
      company_name: companyMeta.company_name,
      full_name,
      title,
      service_shop_score: companyMeta.service_shop_score,
      score_tier: companyMeta.score_tier,
      is_ps_he_anchor,
      has_external_evidence: externalEvidence,
      has_corroboration_evidence: corroborationEvidence,
      extended_timeout: false,
    }

    const prior = candidateByPerson.get(person_id)
    if (!prior || target.service_shop_score > prior.service_shop_score) {
      candidateByPerson.set(person_id, target)
    }
  }

  const selected = [...candidateByPerson.values()].sort(
    (a, b) => b.service_shop_score - a.service_shop_score,
  )

  const extendedCompanies = new Set<string>()
  for (const target of selected) {
    if (extendedCompanies.size >= SERVICE_SHOP_CORROBORATION_MAX_EXTENDED_TARGETS) break
    if (target.is_ps_he_anchor || target.service_shop_score >= SERVICE_SHOP_CORROBORATION_MIN_SCORE) {
      extendedCompanies.add(target.canonical_company_id)
      target.extended_timeout = true
    }
  }
  for (const target of selected) {
    target.extended_timeout = extendedCompanies.has(target.canonical_company_id)
  }

  return { selected, rejected }
}
