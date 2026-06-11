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

export type ApolloCertificationMultichannelTemplateOverrideEvidence = {
  certification_sequence_template_override_used: boolean
  original_sequence_key: string | null
  materialized_sequence_key: string | null
  original_sequence_label: string | null
  materialized_sequence_label: string | null
  materializable_steps_before: number
  materializable_steps_after: number
  template_override_blockers: string[]
}

const TEMPLATE_DEFS = listApolloMultichannelSequenceTemplates()

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function isApolloSequenceMaterializableSequenceKey(sequenceKey: string): boolean {
  const normalized = sequenceKey.trim()
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

export function inferApolloCertificationChannelAvailability(input: {
  stored: ApolloChannelAvailability
  email?: string | null
  phone?: string | null
}): ApolloChannelAvailability {
  const email = asString(input.email)
  const phone = asString(input.phone)

  return {
    ...input.stored,
    verified_email: input.stored.verified_email || Boolean(email),
    phone: input.stored.phone || Boolean(phone),
    mobile_phone: input.stored.mobile_phone || Boolean(phone),
    voice_drop_capable: input.stored.voice_drop_capable || Boolean(phone),
    sms_capable: input.stored.sms_capable || Boolean(phone),
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

function buildMinimalCertificationTemplate(
  availability: ApolloChannelAvailability,
): ApolloMultichannelSequenceTemplate | null {
  const channels: ApolloOrchestrationChannelId[] = []
  if (availability.verified_email) channels.push("email")
  if (availability.voice_drop_capable) channels.push("voice_drop")
  if (availability.sms_capable) channels.push("sms")
  if (availability.phone) channels.push("calling")

  const materializable = channels.filter(
    (channel) => mapOrchestrationChannelToSequenceChannel(channel) !== null,
  )
  if (materializable.length === 0) return null

  const sequenceKey = `certification_minimal_${materializable.join("_")}`
  return {
    sequence_key: sequenceKey,
    sequence_version: "v1",
    sequence_label: `Certification Minimal (${materializable.join(" → ")})`,
    channel_order: materializable,
    recommendation_reason:
      "Certification override — minimal materializable channel mix when no catalog template matched.",
  }
}

export function selectApolloCertificationMaterializableSequenceTemplate(input: {
  availability: ApolloChannelAvailability
  preferred_keys?: readonly string[]
}): ApolloMultichannelSequenceTemplate | null {
  const preferred =
    input.preferred_keys ?? APOLLO_CERTIFICATION_PREFERRED_MATERIALIZABLE_SEQUENCE_KEYS

  for (const sequenceKey of preferred) {
    const def = findTemplateDef(sequenceKey)
    if (!def) continue
    const requires = getTemplateRequires(sequenceKey)
    if (requires && requires(input.availability)) {
      return templateFromDef(def)
    }
  }

  const catalogCandidates = TEMPLATE_DEFS.filter((template) => {
    if (template.sequence_key === "custom_future") return false
    const requires = getTemplateRequires(template.sequence_key)
    return requires ? requires(input.availability) : false
  })
  const priorityOrder = [
    "email_voice_sms",
    "email_voice_drop",
    "voice_drop_email",
    "email_sms",
    "voice_sms_email",
    "call_email",
    "call_sms",
  ]
  const catalogMatch =
    priorityOrder
      .map((key) => catalogCandidates.find((template) => template.sequence_key === key))
      .find(Boolean) ?? catalogCandidates[0]

  if (catalogMatch) {
    return templateFromDef(catalogMatch)
  }

  return buildMinimalCertificationTemplate(input.availability)
}

function getTemplateRequires(sequenceKey: string): ((a: ApolloChannelAvailability) => boolean) | null {
  switch (sequenceKey) {
    case "email_voice_drop":
      return (a) => a.verified_email && a.voice_drop_capable
    case "email_sms":
      return (a) => a.verified_email && a.sms_capable
    case "voice_drop_email":
      return (a) => a.voice_drop_capable && a.verified_email
    case "email_voice_sms":
      return (a) => a.verified_email && a.voice_drop_capable && a.sms_capable
    case "voice_sms_email":
      return (a) => a.voice_drop_capable && a.sms_capable && a.verified_email
    case "call_email":
      return (a) => Boolean(a.phone) && a.verified_email
    case "call_sms":
      return (a) => Boolean(a.phone) && a.sms_capable
    default:
      return null
  }
}

export function needsApolloCertificationMultichannelTemplateOverride(input: {
  sequence_key: string
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
  }
}
