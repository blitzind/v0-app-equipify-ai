/** Apollo Full Pipeline Certification — materializable multichannel template override (client-safe). */

import { mapOrchestrationChannelToSequenceChannel } from "@/lib/growth/apollo/apollo-sequence-step-generation"
import type { ApolloChannelAvailability } from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import type {
  ApolloMultichannelSchedulingPlan,
  ApolloMultichannelSequenceTemplate,
  ApolloOrchestrationChannelId,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import { listApolloMultichannelSequenceTemplates } from "@/lib/growth/apollo/apollo-multichannel-sequence-templates"

export const APOLLO_CERTIFICATION_MULTICHANNEL_TEMPLATE_OVERRIDE_QA_MARKER =
  "apollo-certification-multichannel-template-override-v1" as const

export const APOLLO_CERTIFICATION_PREFERRED_MATERIALIZABLE_SEQUENCE_KEYS = [
  "email_voice_drop",
  "email_voice_sms",
  "voice_drop_email",
  "email_sms",
  "call_email",
  "call_sms",
  "voice_sms_email",
] as const

/** Pilot cohort materialization — prefer full async email + voice + SMS when channels allow. */
export const APOLLO_PILOT_COHORT_MATERIALIZATION_PREFERRED_SEQUENCE_KEYS = [
  "email_voice_sms",
  "voice_sms_email",
  "email_voice_drop",
  "email_sms",
  "voice_drop_email",
  "call_email",
  "call_sms",
] as const

export const APOLLO_CERTIFICATION_FALLBACK_TEMPLATE_KEYS = [
  "certification_minimal_email",
  "certification_minimal_email_voice_drop",
  "certification_minimal_call",
] as const

export const CERTIFICATION_MINIMAL_EMAIL_TEMPLATE: ApolloMultichannelSequenceTemplate = {
  sequence_key: "certification_minimal_email",
  sequence_version: "v1",
  sequence_label: "Certification Minimal Email",
  channel_order: ["email"],
  recommendation_reason:
    "Certification fallback — single email draft placeholder, pending approval only.",
}

export const CERTIFICATION_MINIMAL_EMAIL_VOICE_DROP_TEMPLATE: ApolloMultichannelSequenceTemplate = {
  sequence_key: "certification_minimal_email_voice_drop",
  sequence_version: "v1",
  sequence_label: "Certification Minimal Email → Voice Drop",
  channel_order: ["email", "voice_drop"],
  recommendation_reason:
    "Certification fallback — email plus voice drop draft placeholders, pending approval only.",
}

export const CERTIFICATION_MINIMAL_CALL_TEMPLATE: ApolloMultichannelSequenceTemplate = {
  sequence_key: "certification_minimal_call",
  sequence_version: "v1",
  sequence_label: "Certification Minimal Call",
  channel_order: ["calling"],
  recommendation_reason:
    "Certification fallback — call step placeholder only, pending approval, no dial/send.",
}

export type ApolloCertificationInferredChannelAvailability = ApolloChannelAvailability & {
  contact_email_present: boolean
  contact_phone_present: boolean
}

export type ApolloCertificationTemplateSelectionResult = {
  template: ApolloMultichannelSequenceTemplate | null
  templates_considered: string[]
  template_rejection_reasons: string[]
  fallback_template_used: boolean
  contact_email_present: boolean
  contact_phone_present: boolean
  voice_drop_capable: boolean
  sms_capable: boolean
  available_channels: string[]
}

export type ApolloCertificationMultichannelTemplateOverrideEvidence = {
  certification_sequence_template_override_used: boolean
  original_sequence_key: string | null
  materialized_sequence_key: string | null
  original_sequence_label: string | null
  materialized_sequence_label: string | null
  materializable_steps_before: number
  materializable_steps_after: number
  template_override_blockers: string[]
  contact_email_present: boolean
  contact_phone_present: boolean
  voice_drop_capable: boolean
  sms_capable: boolean
  available_channels: string[]
  templates_considered: string[]
  template_rejection_reasons: string[]
  fallback_template_used: boolean
}

const TEMPLATE_DEFS = listApolloMultichannelSequenceTemplates()

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function isApolloSequenceMaterializableSequenceKey(
  sequenceKey: string | null | undefined,
): boolean {
  const normalized = asString(sequenceKey)
  return Boolean(normalized) && normalized !== "custom_future" && normalized !== "pending"
}

export function countMaterializableSequenceStepsFromSchedulingPlan(
  plan: ApolloMultichannelSchedulingPlan,
): number {
  return plan.touches.filter(
    (touch) => mapOrchestrationChannelToSequenceChannel(touch.channel) !== null,
  ).length
}

export function countMaterializableSequenceStepsFromChannelOrder(
  channelOrder: ApolloOrchestrationChannelId[],
): number {
  return channelOrder.filter((channel) => mapOrchestrationChannelToSequenceChannel(channel) !== null)
    .length
}

export function listAvailableCertificationChannels(
  availability: ApolloChannelAvailability,
): string[] {
  const channels: string[] = []
  if (availability.verified_email) channels.push("email")
  if (availability.voice_drop_capable) channels.push("voice_drop")
  if (availability.sms_capable) channels.push("sms")
  if (availability.phone) channels.push("calling")
  if (availability.linkedin) channels.push("linkedin")
  return channels
}

export function inferApolloCertificationChannelAvailability(input: {
  stored: ApolloChannelAvailability
  email?: string | null
  phone?: string | null
  sequence_ready_contact?: boolean
  verified_email_contact?: boolean
}): ApolloCertificationInferredChannelAvailability {
  const email = asString(input.email)
  const phone = asString(input.phone)
  const contact_email_present =
    Boolean(email) ||
    input.stored.verified_email ||
    input.verified_email_contact === true ||
    input.sequence_ready_contact === true
  const contact_phone_present =
    Boolean(phone) || input.stored.phone || input.stored.mobile_phone

  return {
    ...input.stored,
    verified_email: input.stored.verified_email || contact_email_present,
    phone: input.stored.phone || contact_phone_present,
    mobile_phone: input.stored.mobile_phone || contact_phone_present,
    voice_drop_capable: input.stored.voice_drop_capable || contact_phone_present,
    sms_capable: input.stored.sms_capable || contact_phone_present,
    contact_email_present,
    contact_phone_present,
  }
}

function templateFromDef(def: {
  sequence_key: string
  sequence_version: string
  sequence_label: string
  channel_order: ApolloOrchestrationChannelId[]
  recommendation_reason: string
}): ApolloMultichannelSequenceTemplate {
  return {
    sequence_key: def.sequence_key,
    sequence_version: def.sequence_version,
    sequence_label: def.sequence_label,
    channel_order: def.channel_order,
    recommendation_reason: def.recommendation_reason,
  }
}

function findTemplateDef(sequenceKey: string) {
  return TEMPLATE_DEFS.find((template) => template.sequence_key === sequenceKey) ?? null
}

function getTemplateRequires(
  sequenceKey: string,
): ((availability: ApolloChannelAvailability) => boolean) | null {
  switch (sequenceKey) {
    case "email_voice_drop":
      return (availability) => availability.verified_email && availability.voice_drop_capable
    case "email_sms":
      return (availability) => availability.verified_email && availability.sms_capable
    case "voice_drop_email":
      return (availability) => availability.voice_drop_capable && availability.verified_email
    case "email_voice_sms":
      return (availability) =>
        availability.verified_email && availability.voice_drop_capable && availability.sms_capable
    case "voice_sms_email":
      return (availability) =>
        availability.voice_drop_capable && availability.sms_capable && availability.verified_email
    case "call_email":
      return (availability) => Boolean(availability.phone) && availability.verified_email
    case "call_sms":
      return (availability) => Boolean(availability.phone) && availability.sms_capable
    default:
      return null
  }
}

function describeTemplateRejection(
  sequenceKey: string,
  availability: ApolloChannelAvailability,
): string {
  const requires = getTemplateRequires(sequenceKey)
  if (!requires) return `${sequenceKey}:not_catalog_template`
  if (requires(availability)) return `${sequenceKey}:accepted`
  if (sequenceKey.includes("voice") && !availability.voice_drop_capable) {
    return `${sequenceKey}:voice_drop_not_required_but_unavailable`
  }
  if (sequenceKey.includes("email") && !availability.verified_email) {
    return `${sequenceKey}:verified_email_missing`
  }
  if (sequenceKey.includes("sms") && !availability.sms_capable) {
    return `${sequenceKey}:sms_unavailable`
  }
  if (sequenceKey.startsWith("call") && !availability.phone) {
    return `${sequenceKey}:phone_unavailable`
  }
  return `${sequenceKey}:requirements_not_met`
}

function selectCertificationFallbackTemplate(
  availability: ApolloChannelAvailability,
): ApolloMultichannelSequenceTemplate | null {
  if (availability.verified_email && availability.voice_drop_capable) {
    return CERTIFICATION_MINIMAL_EMAIL_VOICE_DROP_TEMPLATE
  }
  if (availability.verified_email) {
    return CERTIFICATION_MINIMAL_EMAIL_TEMPLATE
  }
  if (availability.phone) {
    return CERTIFICATION_MINIMAL_CALL_TEMPLATE
  }
  return null
}

export function evaluateApolloCertificationTemplateSelection(input: {
  availability: ApolloCertificationInferredChannelAvailability
  preferred_keys?: readonly string[]
}): ApolloCertificationTemplateSelectionResult {
  const preferred =
    input.preferred_keys ?? APOLLO_CERTIFICATION_PREFERRED_MATERIALIZABLE_SEQUENCE_KEYS
  const templates_considered: string[] = []
  const template_rejection_reasons: string[] = []
  const available_channels = listAvailableCertificationChannels(input.availability)

  for (const sequenceKey of preferred) {
    templates_considered.push(sequenceKey)
    const def = findTemplateDef(sequenceKey)
    if (!def) {
      template_rejection_reasons.push(`${sequenceKey}:template_not_found`)
      continue
    }
    const rejection = describeTemplateRejection(sequenceKey, input.availability)
    template_rejection_reasons.push(rejection)
    const requires = getTemplateRequires(sequenceKey)
    if (requires?.(input.availability)) {
      return {
        template: templateFromDef(def),
        templates_considered,
        template_rejection_reasons,
        fallback_template_used: false,
        contact_email_present: input.availability.contact_email_present,
        contact_phone_present: input.availability.contact_phone_present,
        voice_drop_capable: input.availability.voice_drop_capable,
        sms_capable: input.availability.sms_capable,
        available_channels,
      }
    }
  }

  for (const def of TEMPLATE_DEFS) {
    if (def.sequence_key === "custom_future") continue
    if (templates_considered.includes(def.sequence_key)) continue
    templates_considered.push(def.sequence_key)
    const rejection = describeTemplateRejection(def.sequence_key, input.availability)
    template_rejection_reasons.push(rejection)
    const requires = getTemplateRequires(def.sequence_key)
    if (requires?.(input.availability)) {
      return {
        template: templateFromDef(def),
        templates_considered,
        template_rejection_reasons,
        fallback_template_used: false,
        contact_email_present: input.availability.contact_email_present,
        contact_phone_present: input.availability.contact_phone_present,
        voice_drop_capable: input.availability.voice_drop_capable,
        sms_capable: input.availability.sms_capable,
        available_channels,
      }
    }
  }

  for (const fallbackKey of APOLLO_CERTIFICATION_FALLBACK_TEMPLATE_KEYS) {
    templates_considered.push(fallbackKey)
  }

  let fallback = selectCertificationFallbackTemplate(input.availability)
  if (!fallback && input.availability.verified_email) {
    fallback = CERTIFICATION_MINIMAL_EMAIL_TEMPLATE
    template_rejection_reasons.push("certification_minimal_email:forced_verified_email_fallback")
  }

  if (fallback) {
    template_rejection_reasons.push(`${fallback.sequence_key}:selected_fallback`)
    return {
      template: fallback,
      templates_considered,
      template_rejection_reasons,
      fallback_template_used: true,
      contact_email_present: input.availability.contact_email_present,
      contact_phone_present: input.availability.contact_phone_present,
      voice_drop_capable: input.availability.voice_drop_capable,
      sms_capable: input.availability.sms_capable,
      available_channels,
    }
  }

  template_rejection_reasons.push("no_materializable_sequence_template")
  return {
    template: null,
    templates_considered,
    template_rejection_reasons,
    fallback_template_used: false,
    contact_email_present: input.availability.contact_email_present,
    contact_phone_present: input.availability.contact_phone_present,
    voice_drop_capable: input.availability.voice_drop_capable,
    sms_capable: input.availability.sms_capable,
    available_channels,
  }
}

export function selectApolloCertificationMaterializableSequenceTemplate(input: {
  availability: ApolloCertificationInferredChannelAvailability
  preferred_keys?: readonly string[]
}): ApolloMultichannelSequenceTemplate | null {
  return evaluateApolloCertificationTemplateSelection(input).template
}

export function needsApolloCertificationMultichannelTemplateOverride(input: {
  sequence_key: string | null | undefined
  scheduling_plan: ApolloMultichannelSchedulingPlan
}): boolean {
  if (!isApolloSequenceMaterializableSequenceKey(input.sequence_key)) return true
  return countMaterializableSequenceStepsFromSchedulingPlan(input.scheduling_plan) === 0
}

export function buildApolloCertificationMultichannelTemplateOverrideEvidence(input: {
  override_used: boolean
  original_sequence_key: string | null
  materialized_sequence_key: string | null
  original_sequence_label?: string | null
  materialized_sequence_label?: string | null
  materializable_steps_before: number
  materializable_steps_after: number
  blockers?: string[]
  selection?: ApolloCertificationTemplateSelectionResult | null
}): ApolloCertificationMultichannelTemplateOverrideEvidence {
  return {
    certification_sequence_template_override_used: input.override_used,
    original_sequence_key: input.original_sequence_key,
    materialized_sequence_key: input.materialized_sequence_key,
    original_sequence_label: input.original_sequence_label ?? null,
    materialized_sequence_label: input.materialized_sequence_label ?? null,
    materializable_steps_before: input.materializable_steps_before,
    materializable_steps_after: input.materializable_steps_after,
    template_override_blockers: input.blockers ?? [],
    contact_email_present: input.selection?.contact_email_present ?? false,
    contact_phone_present: input.selection?.contact_phone_present ?? false,
    voice_drop_capable: input.selection?.voice_drop_capable ?? false,
    sms_capable: input.selection?.sms_capable ?? false,
    available_channels: input.selection?.available_channels ?? [],
    templates_considered: input.selection?.templates_considered ?? [],
    template_rejection_reasons: input.selection?.template_rejection_reasons ?? [],
    fallback_template_used: input.selection?.fallback_template_used ?? false,
  }
}
