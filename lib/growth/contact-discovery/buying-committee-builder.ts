import { averageContactConfidence } from "@/lib/growth/contact-discovery/contact-confidence"
import type {
  GrowthBuyingCommittee,
  GrowthBuyingCommitteeAssessment,
  GrowthBuyingCommitteeMember,
  GrowthBuyingCommitteeRole,
  GrowthBuyingCommitteeType,
  GrowthContactCandidate,
} from "@/lib/growth/contact-discovery/contact-discovery-types"

const KEY_ROLES: GrowthBuyingCommitteeRole[] = [
  "economic_buyer",
  "decision_maker",
  "technical_buyer",
  "champion",
]

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function inferCommitteeRole(contact: GrowthContactCandidate): GrowthBuyingCommitteeRole {
  const title = asString(contact.job_title)
  const seniority = asString(contact.seniority)
  const blob = `${title} ${seniority} ${contact.full_name.toLowerCase()}`

  if (blob.includes("owner") || blob.includes("founder") || blob.includes("president")) {
    return "owner"
  }
  if (blob.includes("cfo") || blob.includes("finance") || blob.includes("procurement")) {
    return "economic_buyer"
  }
  if (blob.includes("cto") || blob.includes("technical") || blob.includes("engineer")) {
    return "technical_buyer"
  }
  if (blob.includes("director") || blob.includes("vp") || blob.includes("head")) {
    return "decision_maker"
  }
  if (blob.includes("manager") || blob.includes("operations") || blob.includes("service")) {
    return "operator"
  }
  if (blob.includes("champion") || blob.includes("lead")) {
    return "champion"
  }
  return "operator"
}

export function buildBuyingCommitteeAssessment(input: {
  company_id: string
  committee_type?: GrowthBuyingCommitteeType
  contacts: GrowthContactCandidate[]
}): GrowthBuyingCommitteeAssessment {
  const committee_type = input.committee_type ?? "initial"
  const members: GrowthBuyingCommitteeMember[] = []
  const roleSet = new Set<GrowthBuyingCommitteeRole>()

  for (const contact of input.contacts) {
    const committee_role = inferCommitteeRole(contact)
    roleSet.add(committee_role)
    members.push({
      committee_id: "",
      contact_candidate_id: contact.id,
      committee_role,
      confidence: contact.confidence,
    })
  }

  const missing_roles = KEY_ROLES.filter((r) => !roleSet.has(r))
  const keyFound = KEY_ROLES.filter((r) => roleSet.has(r)).length
  const coverage_score = Number((keyFound / KEY_ROLES.length).toFixed(3))
  const committee_completeness = Number(
    (input.contacts.length > 0 ? keyFound / Math.max(KEY_ROLES.length, input.contacts.length) : 0).toFixed(
      3,
    ),
  )
  const committee_confidence = averageContactConfidence(input.contacts)
  const single_thread_risk = input.contacts.length <= 1

  const committee: GrowthBuyingCommittee = {
    id: "",
    company_id: input.company_id,
    committee_type,
    coverage_score,
    decision_maker_found: roleSet.has("decision_maker") || roleSet.has("owner"),
    economic_buyer_found: roleSet.has("economic_buyer"),
    technical_buyer_found: roleSet.has("technical_buyer"),
    champion_found: roleSet.has("champion"),
    metadata: {
      single_thread_risk,
      committee_completeness,
      committee_confidence,
      missing_roles,
      member_count: members.length,
    },
  }

  return {
    committee,
    members,
    contacts: input.contacts,
    single_thread_risk,
    committee_completeness,
    committee_confidence,
    missing_roles,
  }
}
