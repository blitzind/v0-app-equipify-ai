import type { GrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-types"
import type { GrowthContactDiscoverySnapshot } from "@/lib/growth/contact-discovery/contact-discovery-types"

/** Maps contact discovery snapshot into Lead Engine contact research output shape (read-only). */
export function contactDiscoveryToLeadEngineContactResearch(
  snapshot: GrowthContactDiscoverySnapshot,
): GrowthLeadEngineContactResearchOutput {
  const contacts = snapshot.contacts
  const committee = snapshot.buying_committee
  const primary_roles_found: string[] = []
  if (committee?.committee.economic_buyer_found) primary_roles_found.push("economic_buyer")
  if (committee?.committee.decision_maker_found) primary_roles_found.push("decision_maker")
  if (committee?.committee.technical_buyer_found) primary_roles_found.push("technical_buyer")
  if (committee?.committee.champion_found) primary_roles_found.push("champion")

  return {
    contact_candidates: contacts.map((c) => ({
      full_name: c.full_name,
      job_title: c.job_title ?? "",
      department: c.department ?? "",
      role_match_type: committee?.members.find((m) => m.contact_candidate_id === c.id)
        ?.committee_role ?? "operator",
      email: c.email ?? "",
      email_confidence: c.email ? c.confidence : 0,
      phone: c.phone ?? "",
      phone_confidence: c.phone ? c.confidence : 0,
      linkedin_url: c.linkedin_url ?? "",
      source_evidence: c.evidence.map((e) => ({
        claim: e.claim,
        evidence: e.evidence,
        source: e.source,
      })),
      confidence: c.confidence,
    })),
    coverage: {
      primary_roles_found,
      missing_roles: committee?.missing_roles.map((r) => r.replace(/_/g, " ")) ?? [],
      committee_completion: committee?.committee_completeness ?? 0,
    },
    research_quality: {
      score: committee?.committee_confidence ?? 0,
      reasoning: [
        snapshot.privacy_note,
        committee?.single_thread_risk
          ? "Single-thread risk — only one contact candidate."
          : "Multiple contact candidates available.",
      ],
    },
  }
}
