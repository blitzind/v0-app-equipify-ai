/** Prospect Search — merge Growth Engine intelligence into contact overlays (7.PS-A). Client-safe. */

import type {
  GrowthProspectSearchBuyingCommitteeMember,
  GrowthProspectSearchEngineIntelligence,
  GrowthProspectSearchVerifiedChannelPerson,
} from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import type {
  GrowthProspectSearchContactIntelligence,
  ProspectSearchCommitteeRoleMapping,
  ProspectSearchContactOverlay,
} from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import { mergeEngineReadinessIntoContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-readiness"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

function formatCommitteeRoleLabel(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

export function mergeBuyingCommitteeIntelligenceRoles(
  baseline: ProspectSearchCommitteeRoleMapping[],
  members: GrowthProspectSearchBuyingCommitteeMember[],
): ProspectSearchCommitteeRoleMapping[] {
  const byRole = new Map<string, ProspectSearchCommitteeRoleMapping>()
  for (const row of baseline) {
    byRole.set(row.role.toLowerCase(), row)
  }

  for (const member of members) {
    const role = formatCommitteeRoleLabel(String(member.committee_role))
    const existing = byRole.get(role.toLowerCase())
    if (existing?.has_named_contact && existing.contact_name) continue

    byRole.set(role.toLowerCase(), {
      role,
      role_type: String(member.committee_role),
      confidence: member.confidence,
      recommended_order: existing?.recommended_order ?? baseline.length + byRole.size,
      has_named_contact: true,
      contact_name: member.full_name,
    })
  }

  return [...byRole.values()].sort(
    (a, b) => a.recommended_order - b.recommended_order || b.confidence - a.confidence,
  )
}

function preferVerifiedChannel(
  current: string | null | undefined,
  verified: string | null,
  currentStatus: string | null | undefined,
): { value: string | null; status: string } {
  if (!verified?.trim()) {
    return { value: current?.trim() || null, status: currentStatus ?? "pending_verification" }
  }
  if (!current?.trim()) {
    return { value: verified, status: "verified" }
  }
  if (currentStatus === "verified" || currentStatus === "verified_channels") {
    return { value: current, status: currentStatus }
  }
  return { value: verified, status: "verified" }
}

export function applyVerifiedChannelsToContactOverlays(
  contacts: ProspectSearchContactOverlay[],
  personIdByContactId: Map<string, string | null>,
  channelsByPersonId: Record<string, GrowthProspectSearchVerifiedChannelPerson>,
): ProspectSearchContactOverlay[] {
  return contacts.map((contact) => {
    const person_id = personIdByContactId.get(contact.id) ?? null
    if (!person_id) return { ...contact, canonical_person_id: null }

    const channels = channelsByPersonId[person_id]
    if (!channels) return { ...contact, canonical_person_id: person_id }

    const emailMerge = preferVerifiedChannel(contact.email, channels.verified_email, contact.verification_status)
    const phoneMerge = preferVerifiedChannel(contact.phone, channels.verified_phone, contact.verification_status)
    const linkedinMerge = preferVerifiedChannel(
      contact.linkedin_url,
      channels.verified_profile_url,
      contact.verification_status,
    )

    const verification_status =
      channels.has_verified_email && channels.has_verified_phone
        ? "verified_channels"
        : channels.has_verified_email
          ? "email_verified"
          : channels.has_verified_phone
            ? "phone_verified"
            : channels.has_verified_profile
              ? "profile_verified"
              : contact.verification_status ?? null

    const provider_verified_email = channels.has_verified_email && Boolean(emailMerge.value)
    const provider_verified_phone = channels.has_verified_phone && Boolean(phoneMerge.value)

    return {
      ...contact,
      canonical_person_id: person_id,
      email: emailMerge.value,
      phone: phoneMerge.value,
      linkedin_url: linkedinMerge.value,
      verification_status,
      email_verification_depth: provider_verified_email
        ? "provider_verified"
        : contact.email_verification_depth,
      phone_verification_depth: provider_verified_phone
        ? "provider_verified"
        : contact.phone_verification_depth,
      outreach_ready:
        contact.outreach_ready ||
        Boolean(provider_verified_email || provider_verified_phone),
    }
  })
}

export function mergeEngineIntelligenceIntoContactIntelligence(
  intelligence: GrowthProspectSearchContactIntelligence,
  engine: GrowthProspectSearchEngineIntelligence | null | undefined,
  personIdByContactId: Map<string, string | null>,
  companyContext?: Pick<
    GrowthProspectSearchCompanyResult,
    "canonical_company_id" | "is_suppressed"
  >,
): GrowthProspectSearchContactIntelligence {
  if (!engine?.has_canonical_company) {
    const baseline = { ...intelligence, engine_intelligence: engine ?? undefined }
    return mergeEngineReadinessIntoContactIntelligence(baseline, {
      contact_intelligence: baseline,
      canonical_company_id: companyContext?.canonical_company_id ?? null,
      is_suppressed: companyContext?.is_suppressed,
    })
  }

  const source_labels = [
    ...new Set([
      ...(intelligence.source_labels ?? []),
      ...(engine.source_labels ?? []),
      "growth.engine_intelligence",
    ]),
  ]

  let committee_roles = intelligence.committee_roles
  let committee_completeness_pct = intelligence.committee_completeness_pct

  if (engine.buying_committee?.members.length) {
    committee_roles = mergeBuyingCommitteeIntelligenceRoles(
      intelligence.committee_roles,
      engine.buying_committee.members,
    )
    if (engine.buying_committee.coverage_score > 0) {
      committee_completeness_pct = Math.max(
        intelligence.committee_completeness_pct ?? 0,
        Math.round(engine.buying_committee.coverage_score * 100),
      )
    }
  }

  const contacts =
    engine.verified_channels?.by_person_id && personIdByContactId.size > 0
      ? applyVerifiedChannelsToContactOverlays(
          intelligence.contacts,
          personIdByContactId,
          engine.verified_channels.by_person_id,
        )
      : intelligence.contacts.map((contact) => ({
          ...contact,
          canonical_person_id: personIdByContactId.get(contact.id) ?? contact.canonical_person_id ?? null,
        }))

  const merged: GrowthProspectSearchContactIntelligence = {
    ...intelligence,
    contacts,
    committee_roles,
    committee_completeness_pct,
    source_labels,
    engine_intelligence: engine,
    schema_health: engine.schema_health ?? intelligence.schema_health ?? null,
    schema_ready: intelligence.schema_ready && engine.schema_ready,
  }

  return mergeEngineReadinessIntoContactIntelligence(merged, {
    contact_intelligence: merged,
    canonical_company_id: companyContext?.canonical_company_id ?? engine?.canonical_company_id ?? null,
    is_suppressed: companyContext?.is_suppressed,
  })
}
