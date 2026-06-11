/** Apollo Voice Drop Intelligence Engine — client-safe. */

import type { ApolloUnifiedPersonalizationContext } from "@/lib/growth/apollo/apollo-unified-personalization-context"
import {
  resolveApolloUnifiedBusinessProblem,
  resolveApolloUnifiedCompanyInsight,
  resolveApolloUnifiedResearchInsight,
  resolveApolloUnifiedRoleInsight,
} from "@/lib/growth/apollo/apollo-unified-personalization-context"
import type {
  ApolloVoiceDropIntelligence,
  ApolloVoiceDropScriptType,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"

export const APOLLO_VOICE_DROP_INTELLIGENCE_QA_MARKER =
  "apollo-voice-drop-intelligence-v1" as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function inferScriptType(input: {
  title: string | null
  company_name: string
  fit_score: number | null
  is_biomedical: boolean
  is_follow_up: boolean
}): ApolloVoiceDropScriptType {
  if (input.is_follow_up) return "follow_up"
  if (input.is_biomedical) return "biomedical_specific"
  if (/service|maintenance|repair|field/i.test(asString(input.title))) {
    return "equipment_service_focused"
  }
  if ((input.fit_score ?? 0) >= 75) return "referral_style"
  return "cold_introduction"
}

export function buildApolloVoiceDropIntelligence(input: {
  company_name: string
  full_name: string
  title: string | null
  fit_score: number | null
  research_summary?: string | null
  company_summary?: string | null
  buying_committee_summary?: string | null
  apollo_evidence_summary?: string | null
  is_follow_up?: boolean
}): ApolloVoiceDropIntelligence {
  const biomedical =
    /medical|biomed|clinical|hospital|health|lab|diagnostic|pharma/i.test(
      `${input.company_name} ${input.company_summary ?? ""}`,
    )

  const scriptType = inferScriptType({
    title: input.title,
    company_name: input.company_name,
    fit_score: input.fit_score,
    is_biomedical: biomedical,
    is_follow_up: input.is_follow_up === true,
  })

  const personalization: string[] = []
  if (input.company_name) personalization.push(`Reference ${input.company_name} by name.`)
  if (input.title) personalization.push(`Acknowledge ${input.title} role without overstating authority.`)
  if (input.research_summary) personalization.push("Weave one research-backed observation.")
  if (input.buying_committee_summary) {
    personalization.push("Note committee coverage gap or single-thread risk if relevant.")
  }
  if (input.apollo_evidence_summary) {
    personalization.push("Anchor to Apollo-verified contact discovery context.")
  }

  const objectiveByType: Record<ApolloVoiceDropScriptType, string> = {
    cold_introduction: "Introduce Equipify value and invite a brief discovery conversation.",
    referral_style: "Position outreach as a peer-relevant introduction with high fit rationale.",
    equipment_service_focused: "Connect field service / equipment maintenance pain to Equipify capabilities.",
    biomedical_specific: "Speak to biomedical operations, compliance, and uptime priorities.",
    follow_up: "Re-engage after prior touch with a concise reminder and next step.",
  }

  const ctaByType: Record<ApolloVoiceDropScriptType, string> = {
    cold_introduction: "Invite a 10-minute call or reply to confirm interest.",
    referral_style: "Ask whether now is a good time to compare notes with similar operators.",
    equipment_service_focused: "Offer a short workflow review focused on service dispatch efficiency.",
    biomedical_specific: "Suggest a brief discussion on equipment lifecycle and compliance workflows.",
    follow_up: "Request a callback or email reply to continue the conversation.",
  }

  return {
    recommended_script_type: scriptType,
    voicemail_objective: objectiveByType[scriptType],
    personalization_opportunities: personalization.length
      ? personalization
      : ["Use first name and company name only — no fabricated claims."],
    call_to_action_recommendation: ctaByType[scriptType],
    intelligence_summary: [
      input.company_summary,
      input.research_summary,
      input.apollo_evidence_summary,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || `Voice drop intelligence for ${input.full_name} at ${input.company_name}.`,
  }
}

/** Upgrade voice drop intelligence using unified Apollo personalization context. */
export function buildApolloVoiceDropIntelligenceFromUnifiedContext(input: {
  unified_context: ApolloUnifiedPersonalizationContext
  fit_score?: number | null
  is_follow_up?: boolean
}): ApolloVoiceDropIntelligence {
  const ctx = input.unified_context
  const base = buildApolloVoiceDropIntelligence({
    company_name: ctx.contact_company_name,
    full_name: ctx.contact_full_name,
    title: ctx.contact_title,
    fit_score: input.fit_score ?? ctx.qualification_score,
    research_summary: resolveApolloUnifiedResearchInsight(ctx),
    company_summary: resolveApolloUnifiedCompanyInsight(ctx),
    buying_committee_summary: ctx.buying_committee_summary,
    apollo_evidence_summary: ctx.apollo_evidence_summary,
    is_follow_up: input.is_follow_up,
  })

  const enrichedOpportunities = [
    ...base.personalization_opportunities,
    resolveApolloUnifiedRoleInsight(ctx) ? `Role insight: ${resolveApolloUnifiedRoleInsight(ctx)}` : "",
    resolveApolloUnifiedBusinessProblem(ctx)
      ? `Business problem: ${resolveApolloUnifiedBusinessProblem(ctx)}`
      : "",
    ctx.account_playbook_summary ? `Playbook: ${ctx.account_playbook_summary}` : "",
  ].filter(Boolean)

  const ctaRationale = ctx.outreach_packet.researchRecommendedNextAction?.trim()
    ? `CTA rationale: ${ctx.outreach_packet.researchRecommendedNextAction}`
    : base.call_to_action_recommendation

  return {
    ...base,
    personalization_opportunities: enrichedOpportunities.length
      ? enrichedOpportunities
      : base.personalization_opportunities,
    call_to_action_recommendation: ctaRationale,
    intelligence_summary: [
      base.intelligence_summary,
      resolveApolloUnifiedResearchInsight(ctx),
      resolveApolloUnifiedBusinessProblem(ctx),
    ]
      .filter(Boolean)
      .join(" — ")
      .trim(),
  }
}
