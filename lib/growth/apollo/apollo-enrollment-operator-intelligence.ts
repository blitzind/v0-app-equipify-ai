/** Apollo Enrollment operator intelligence — client-safe recommendations. */

import type {
  ApolloEnrollmentOperatorIntelligence,
  ApolloEnrollmentQualificationInput,
  ApolloEnrollmentQualificationResult,
} from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import type { ApolloPrimaryContactOperatorReviewRow } from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"

export const APOLLO_ENROLLMENT_OPERATOR_INTELLIGENCE_QA_MARKER =
  "apollo-enrollment-operator-intelligence-v1" as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function inferDecisionMakerRole(title: string | null): string | null {
  const normalized = asString(title).toLowerCase()
  if (!normalized) return null
  if (/(chief|ceo|president|owner|founder)/.test(normalized)) return "Executive decision maker"
  if (/(vp|vice president|director|head of)/.test(normalized)) return "Senior operational decision maker"
  if (/(manager|lead|supervisor)/.test(normalized)) return "Operational influencer"
  return "Potential stakeholder"
}

function resolveRecommendedFirstChannel(
  contact: Pick<ApolloPrimaryContactOperatorReviewRow, "channel_availability" | "email_status">,
): ApolloEnrollmentOperatorIntelligence["recommended_first_channel"] {
  if (contact.channel_availability.email && contact.email_status !== "blocked") return "email"
  if (contact.channel_availability.phone) return "phone"
  if (contact.channel_availability.linkedin) return "linkedin"
  return "email"
}

function resolveRecommendedSequence(input: {
  qualification: ApolloEnrollmentQualificationResult
  fit_score: number | null
}): string | null {
  if (!input.qualification.qualified_for_enrollment) return null
  const fit = input.fit_score ?? 0
  if (fit >= 80) return "High-fit Apollo primary contact — standard multichannel sequence"
  if (fit >= 60) return "Qualified Apollo contact — email-first nurture sequence"
  return "Apollo discovery contact — research-led intro sequence"
}

export function buildApolloEnrollmentOperatorIntelligence(input: {
  contact: ApolloPrimaryContactOperatorReviewRow
  qualification: ApolloEnrollmentQualificationResult
  qualification_input: ApolloEnrollmentQualificationInput
  company_summary?: string | null
  research_summary?: string | null
  buying_committee_summary?: string | null
  apollo_evidence_summary?: string | null
}): ApolloEnrollmentOperatorIntelligence {
  const whyParts: string[] = [
    input.qualification.qualification_reason,
    `${input.contact.full_name} is ${input.contact.sequence_ready ? "sequence-ready" : "not sequence-ready"} via Apollo.`,
  ]

  if (input.qualification_input.buying_committee_present) {
    whyParts.push("Buying committee intelligence supports outreach prioritization.")
  }

  if (input.qualification_input.company_intelligence_present) {
    whyParts.push("Company intelligence is available for operator review.")
  }

  return {
    why_selected: whyParts.join(" "),
    likely_decision_maker_role: inferDecisionMakerRole(input.contact.title),
    company_summary: input.company_summary ?? `${input.contact.company_name} — Apollo-discovered account.`,
    research_summary:
      input.research_summary ??
      (input.qualification_input.research_score != null
        ? `Research score ${input.qualification_input.research_score}/100.`
        : "Research score not yet available."),
    buying_committee_summary:
      input.buying_committee_summary ??
      (input.qualification_input.buying_committee_present
        ? "Buying committee intelligence present."
        : "Buying committee intelligence pending."),
    recommended_first_channel: resolveRecommendedFirstChannel(input.contact),
    recommended_sequence: resolveRecommendedSequence({
      qualification: input.qualification,
      fit_score: input.qualification_input.fit_score,
    }),
    apollo_evidence_summary: (() => {
      if (input.apollo_evidence_summary) return input.apollo_evidence_summary
      const parts = [
        input.qualification_input.apollo_search_tier
          ? `Apollo search tier ${input.qualification_input.apollo_search_tier}.`
          : null,
        input.qualification_input.verified_email_source
          ? `Verified email via ${input.qualification_input.verified_email_source}.`
          : null,
        input.qualification_input.enrichment_source
          ? `Enrichment via ${input.qualification_input.enrichment_source}.`
          : null,
      ].filter(Boolean)
      return parts.length > 0 ? parts.join(" ") : "Apollo acquisition evidence attached."
    })(),
  }
}
