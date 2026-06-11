/** Apollo Voice Drop pipeline builder — client-safe intelligence + script assembly. */

import { buildApolloVoiceDropAttributionRecord } from "@/lib/growth/apollo/apollo-voice-drop-automation-evidence"
import type { ApolloVoiceDropEnrollmentHandoffInput } from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import {
  buildApolloChannelRecommendation,
  computeApolloVoiceDropScore,
  evaluateApolloVoiceDropChannelAvailability,
} from "@/lib/growth/apollo/apollo-voice-drop-channel-evaluation"
import { buildApolloVoiceDropIntelligence } from "@/lib/growth/apollo/apollo-voice-drop-intelligence-engine"
import { generateApolloVoiceDropScript } from "@/lib/growth/apollo/apollo-voice-drop-script-generation"
import { recommendApolloMultichannelStrategy } from "@/lib/growth/apollo/apollo-multichannel-recommendation-engine"

export const APOLLO_VOICE_DROP_PIPELINE_BUILDER_QA_MARKER =
  "apollo-voice-drop-pipeline-builder-v1" as const

function resolveComplianceFlags(env: NodeJS.ProcessEnv = process.env): {
  compliance_orchestration_enabled: boolean
  voice_drop_vd4_certified: boolean
} {
  const compliance =
    env.VOICE_COMPLIANCE_ORCHESTRATION_ENABLED?.trim().toLowerCase() === "true" ||
    env.VOICE_COMPLIANCE_ORCHESTRATION_ENABLED === "1"
  const vd4 =
    env.GROWTH_VOICE_DROP_VD4_LIVE_CERTIFIED?.trim() === "1" ||
    env.GROWTH_VOICE_DROP_VD4_LIVE_CERTIFIED?.trim().toLowerCase() === "true"
  return {
    compliance_orchestration_enabled: compliance,
    voice_drop_vd4_certified: vd4,
  }
}

export function buildVoiceDropPipelineFromEnrollmentHandoff(
  input: ApolloVoiceDropEnrollmentHandoffInput,
  env?: NodeJS.ProcessEnv,
) {
  const flags = resolveComplianceFlags(env)
  const operatorIntel =
    input.operator_intelligence && typeof input.operator_intelligence === "object"
      ? input.operator_intelligence
      : {}

  const availability = evaluateApolloVoiceDropChannelAvailability({
    email: input.email,
    email_verified: Boolean(input.email),
    phone: input.phone,
    phone_status: input.phone ? "verified" : null,
    linkedin_present: false,
    ...flags,
  })

  const channelRecommendations = buildApolloChannelRecommendation({
    availability,
    qualification_score: input.qualification_score,
    fit_score: input.fit_score,
    title: input.title,
    has_buying_committee: Boolean(
      typeof operatorIntel.buying_committee_summary === "string" &&
        operatorIntel.buying_committee_summary.includes("committee"),
    ),
  })

  const multichannelStrategy = recommendApolloMultichannelStrategy({
    availability,
    channel_recommendation: channelRecommendations,
    qualification_score: input.qualification_score,
  })

  const voiceDropScore = computeApolloVoiceDropScore({
    availability,
    qualification_score: input.qualification_score,
    fit_score: input.fit_score,
    channel_recommendation: channelRecommendations,
  })

  const voiceDropIntelligence = buildApolloVoiceDropIntelligence({
    company_name: input.company_name,
    full_name: input.full_name,
    title: input.title,
    fit_score: input.fit_score,
    research_summary:
      typeof operatorIntel.research_summary === "string" ? operatorIntel.research_summary : null,
    company_summary:
      typeof operatorIntel.company_summary === "string" ? operatorIntel.company_summary : null,
    buying_committee_summary:
      typeof operatorIntel.buying_committee_summary === "string"
        ? operatorIntel.buying_committee_summary
        : null,
    apollo_evidence_summary:
      typeof operatorIntel.apollo_evidence_summary === "string"
        ? operatorIntel.apollo_evidence_summary
        : null,
  })

  const voiceDropScript = generateApolloVoiceDropScript({
    script_type: voiceDropIntelligence.recommended_script_type,
    full_name: input.full_name,
    company_name: input.company_name,
    title: input.title,
    research_line:
      typeof operatorIntel.research_summary === "string"
        ? operatorIntel.research_summary.slice(0, 120)
        : null,
  })

  const sourceAttribution = buildApolloVoiceDropAttributionRecord(input.source_attribution)

  return {
    availability,
    channelRecommendations,
    multichannelStrategy,
    voiceDropScore,
    voiceDropIntelligence,
    voiceDropScript,
    sourceAttribution,
  }
}
