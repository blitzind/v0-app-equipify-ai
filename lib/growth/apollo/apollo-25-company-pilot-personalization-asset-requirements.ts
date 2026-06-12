/** Apollo 25-company pilot — channel-aware personalization asset requirements (client-safe). */

import {
  CERTIFICATION_MINIMAL_CALL_TEMPLATE,
  CERTIFICATION_MINIMAL_EMAIL_TEMPLATE,
  CERTIFICATION_MINIMAL_EMAIL_VOICE_DROP_TEMPLATE,
} from "@/lib/growth/apollo/apollo-certification-multichannel-template-override"
import { listApolloMultichannelSequenceTemplates } from "@/lib/growth/apollo/apollo-multichannel-sequence-templates"
import type { ApolloSequenceExecutionStepPlan } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import type { ApolloOrchestrationChannelId } from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import type { Apollo25CompanyPilotCohortPersonalizationAssetKey } from "@/lib/growth/apollo/apollo-25-company-pilot-types"

export type ApolloPersonalizationChannelRequirement = "required" | "optional" | "not_applicable"

const BASE_REQUIRED_ASSETS: Apollo25CompanyPilotCohortPersonalizationAssetKey[] = [
  "account_playbook",
  "personalization",
  "content_quality_optimization",
]

const ALL_CHANNEL_ASSET_KEYS: Apollo25CompanyPilotCohortPersonalizationAssetKey[] = [
  "email_assets",
  "sms_assets",
  "voice_drop_assets",
]

const ORCHESTRATION_CHANNEL_TO_ASSET: Partial<
  Record<ApolloOrchestrationChannelId, Apollo25CompanyPilotCohortPersonalizationAssetKey>
> = {
  email: "email_assets",
  sms: "sms_assets",
  voice_drop: "voice_drop_assets",
}

const CERTIFICATION_TEMPLATES = [
  CERTIFICATION_MINIMAL_EMAIL_TEMPLATE,
  CERTIFICATION_MINIMAL_EMAIL_VOICE_DROP_TEMPLATE,
  CERTIFICATION_MINIMAL_CALL_TEMPLATE,
]

function uniqueChannels(channels: string[]): string[] {
  return [...new Set(channels.filter((channel) => channel.trim().length > 0))]
}

function channelsFromSequenceKey(sequence_key: string): string[] {
  const certification = CERTIFICATION_TEMPLATES.find((template) => template.sequence_key === sequence_key)
  if (certification) return [...certification.channel_order]

  const multichannel = listApolloMultichannelSequenceTemplates().find(
    (template) => template.sequence_key === sequence_key,
  )
  if (multichannel) return [...multichannel.channel_order]

  return []
}

function channelsFromMaterializationSteps(
  steps: ApolloSequenceExecutionStepPlan[] | undefined,
): string[] {
  if (!steps?.length) return []
  return uniqueChannels(steps.map((step) => step.orchestration_channel))
}

function channelsFromDraftTypes(
  draftTypes: Array<"email" | "sms" | "voice_drop" | "call"> | undefined,
): string[] {
  if (!draftTypes?.length) return []
  return uniqueChannels(
    draftTypes.map((draftType) => (draftType === "call" ? "calling" : draftType)),
  )
}

export function resolveSelectedApolloPersonalizationChannels(input: {
  sequence_key?: string | null
  selected_channels?: string[] | null
  materialization_steps?: ApolloSequenceExecutionStepPlan[]
  expected_draft_types?: Array<"email" | "sms" | "voice_drop" | "call">
}): string[] {
  if (input.selected_channels?.length) {
    return uniqueChannels(input.selected_channels)
  }

  const fromSteps = channelsFromMaterializationSteps(input.materialization_steps)
  if (fromSteps.length > 0) return fromSteps

  if (input.sequence_key?.trim()) {
    const fromSequenceKey = channelsFromSequenceKey(input.sequence_key.trim())
    if (fromSequenceKey.length > 0) return fromSequenceKey
  }

  const fromDraftTypes = channelsFromDraftTypes(input.expected_draft_types)
  if (fromDraftTypes.length > 0) return fromDraftTypes

  return ["email"]
}

export function resolveRequiredApolloPersonalizationAssets(input: {
  sequence_key?: string | null
  selected_channels?: string[] | null
  materialization_steps?: ApolloSequenceExecutionStepPlan[]
  expected_draft_types?: Array<"email" | "sms" | "voice_drop" | "call">
  sms_capable?: boolean
}): {
  required_assets: Apollo25CompanyPilotCohortPersonalizationAssetKey[]
  optional_assets: Apollo25CompanyPilotCohortPersonalizationAssetKey[]
  selected_template: string | null
  selected_channels: string[]
  channel_availability: {
    email: ApolloPersonalizationChannelRequirement
    sms: ApolloPersonalizationChannelRequirement
    voice_drop: ApolloPersonalizationChannelRequirement
  }
} {
  const selected_channels = resolveSelectedApolloPersonalizationChannels(input)
  const selected_template = input.sequence_key?.trim() || null

  const requiredChannelAssets = new Set<Apollo25CompanyPilotCohortPersonalizationAssetKey>()
  for (const channel of selected_channels) {
    const assetKey = ORCHESTRATION_CHANNEL_TO_ASSET[channel as ApolloOrchestrationChannelId]
    if (assetKey) requiredChannelAssets.add(assetKey)
  }

  const required_assets = [...BASE_REQUIRED_ASSETS, ...requiredChannelAssets]
  const optional_assets = ALL_CHANNEL_ASSET_KEYS.filter((assetKey) => !requiredChannelAssets.has(assetKey))

  const channelRequirement = (
    channel: ApolloOrchestrationChannelId,
    assetKey: Apollo25CompanyPilotCohortPersonalizationAssetKey,
  ): ApolloPersonalizationChannelRequirement => {
    if (requiredChannelAssets.has(assetKey)) return "required"
    if (channel === "voice_drop") return "optional"
    return "not_applicable"
  }

  return {
    required_assets,
    optional_assets,
    selected_template,
    selected_channels,
    channel_availability: {
      email: channelRequirement("email", "email_assets"),
      sms: channelRequirement("sms", "sms_assets"),
      voice_drop: channelRequirement("voice_drop", "voice_drop_assets"),
    },
  }
}

export function isApolloSmsPersonalizationRequired(input: {
  sequence_key?: string | null
  selected_channels?: string[] | null
  materialization_steps?: ApolloSequenceExecutionStepPlan[]
  expected_draft_types?: Array<"email" | "sms" | "voice_drop" | "call">
}): boolean {
  return resolveRequiredApolloPersonalizationAssets(input).channel_availability.sms === "required"
}
