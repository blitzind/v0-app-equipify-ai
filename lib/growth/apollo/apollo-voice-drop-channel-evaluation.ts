/** Apollo Voice Drop channel evaluation — client-safe. */

import type {
  ApolloChannelAvailability,
  ApolloChannelRecommendation,
  ApolloOutreachChannelId,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"

export const APOLLO_VOICE_DROP_CHANNEL_EVALUATION_QA_MARKER =
  "apollo-voice-drop-channel-evaluation-v1" as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function looksMobilePhone(phone: string | null): boolean {
  const digits = asString(phone).replace(/\D/g, "")
  return digits.length >= 10
}

export function evaluateApolloVoiceDropChannelAvailability(input: {
  email: string | null
  email_verified?: boolean
  phone: string | null
  phone_status?: string | null
  linkedin_present?: boolean
  compliance_orchestration_enabled?: boolean
  voice_drop_vd4_certified?: boolean
}): ApolloChannelAvailability {
  const hasEmail = Boolean(asString(input.email))
  const verifiedEmail = input.email_verified === true || asString(input.phone_status) === "verified"
  const hasPhone = Boolean(asString(input.phone)) && asString(input.phone_status) !== "blocked"
  const mobilePhone = hasPhone && looksMobilePhone(input.phone)
  const compliance = input.compliance_orchestration_enabled ?? false
  const vd4 = input.voice_drop_vd4_certified ?? false

  return {
    verified_email: hasEmail && verifiedEmail,
    phone: hasPhone,
    mobile_phone: mobilePhone,
    sms_capable: mobilePhone && compliance,
    voice_drop_capable: mobilePhone && compliance && vd4,
    linkedin: input.linkedin_present === true,
  }
}

function scoreChannel(
  channel: ApolloOutreachChannelId,
  availability: ApolloChannelAvailability,
  input: { fit_score: number | null; qualification_score: number },
): number {
  const fitBoost = (input.fit_score ?? input.qualification_score) / 100
  switch (channel) {
    case "email":
      return availability.verified_email ? 80 + fitBoost * 15 : 0
    case "voice_drop":
      return availability.voice_drop_capable ? 75 + fitBoost * 20 : 0
    case "sms":
      return availability.sms_capable ? 65 + fitBoost * 10 : 0
    case "mobile_phone":
      return availability.mobile_phone ? 60 + fitBoost * 10 : 0
    case "phone":
      return availability.phone ? 55 + fitBoost * 10 : 0
    case "linkedin":
      return availability.linkedin ? 40 + fitBoost * 5 : 0
    default:
      return 0
  }
}

export function buildApolloChannelRecommendation(input: {
  availability: ApolloChannelAvailability
  qualification_score: number
  fit_score: number | null
  title: string | null
  has_buying_committee?: boolean
}): ApolloChannelRecommendation {
  const channels: ApolloOutreachChannelId[] = [
    "email",
    "voice_drop",
    "sms",
    "mobile_phone",
    "phone",
    "linkedin",
  ]

  const scored = channels
    .map((channel) => ({
      channel,
      score: scoreChannel(channel, input.availability, {
        fit_score: input.fit_score,
        qualification_score: input.qualification_score,
      }),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)

  const first = scored[0]?.channel ?? "email"
  const second = scored[1]?.channel ?? null

  const reasons: string[] = []
  if (input.availability.verified_email) reasons.push("Verified email available for low-friction first touch.")
  if (input.availability.voice_drop_capable) {
    reasons.push("Mobile phone + compliance + VD-4 readiness support voice drop.")
  } else if (input.availability.mobile_phone) {
    reasons.push("Mobile phone present but voice drop requires compliance + VD-4 certification.")
  }
  if (input.has_buying_committee) reasons.push("Buying committee intelligence supports multichannel sequencing.")
  if (/director|vp|chief|owner|president/i.test(asString(input.title))) {
    reasons.push("Senior title suggests voice follow-up after email intro.")
  }

  const confidence = Math.min(
    100,
    Math.round(
      (scored[0]?.score ?? 30) * 0.6 + input.qualification_score * 0.4,
    ),
  )

  let strategy = "Email-first nurture with optional phone follow-up."
  if (first === "voice_drop" && second === "email") {
    strategy = "Voice Drop → Email follow-up for high-intent mobile reach."
  } else if (first === "email" && second === "voice_drop") {
    strategy = "Email → Voice Drop for verified inbox then mobile reinforcement."
  } else if (first === "email" && second === "sms") {
    strategy = "Email → SMS for multichannel persistence."
  } else if (first === "email" && second === "voice_drop" && input.availability.sms_capable) {
    strategy = "Email → Voice Drop → SMS cadence."
  }

  return {
    recommended_first_channel: first,
    recommended_second_channel: second,
    recommended_sequence_strategy: strategy,
    recommendation_reasons: reasons.length ? reasons : ["Default email-first strategy applied."],
    confidence_score: confidence,
  }
}

export function computeApolloVoiceDropScore(input: {
  availability: ApolloChannelAvailability
  qualification_score: number
  fit_score: number | null
  channel_recommendation: ApolloChannelRecommendation
}): number {
  let score = 0
  if (input.availability.voice_drop_capable) score += 40
  else if (input.availability.mobile_phone) score += 20
  if (input.availability.verified_email) score += 15
  score += Math.min(25, input.qualification_score * 0.25)
  if (input.fit_score != null) score += Math.min(10, input.fit_score * 0.1)
  score += Math.min(10, input.channel_recommendation.confidence_score * 0.1)
  return Math.round(Math.min(100, score) * 10) / 10
}
