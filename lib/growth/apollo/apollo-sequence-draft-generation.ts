/** Apollo Sequence Execution draft generation — client-safe placeholders only. */

import { randomUUID } from "node:crypto"
import type {
  ApolloSequenceExecutionDraftRecord,
  ApolloSequenceExecutionMultichannelHandoffInput,
  ApolloSequenceExecutionStepPlan,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"

export const APOLLO_SEQUENCE_DRAFT_GENERATION_QA_MARKER =
  "apollo-sequence-draft-generation-v1" as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function draftTypeForStep(step: ApolloSequenceExecutionStepPlan) {
  if (step.channel === "email") return "email" as const
  if (step.channel === "sms") return "sms" as const
  if (step.channel === "voice_drop") return "voice_drop" as const
  return "call" as const
}

export function buildApolloSequenceExecutionDraftRecords(input: {
  handoff: ApolloSequenceExecutionMultichannelHandoffInput
  steps: ApolloSequenceExecutionStepPlan[]
}): ApolloSequenceExecutionDraftRecord[] {
  const { handoff, steps } = input
  const company = asString(handoff.company_name) || "your organization"
  const name = asString(handoff.full_name) || "there"
  const title = asString(handoff.title) || "your role"

  return steps.map((step) => {
    const draftType = draftTypeForStep(step)
    const draftId = randomUUID()

    if (draftType === "email") {
      return {
        draft_id: draftId,
        draft_type: draftType,
        step_number: step.step_number,
        channel: step.channel,
        subject_placeholder: `Quick idea for ${company}`,
        body_placeholder: `Hi ${name},\n\nFollowing up on how Equipify supports ${title} teams at organizations like ${company}. [Draft placeholder — operator approval required before send.]`,
        voice_drop_script_reference: null,
        approval_status: "pending_draft_approval" as const,
        content_summary: `Email draft placeholder for step ${step.step_number}.`,
      }
    }

    if (draftType === "sms") {
      return {
        draft_id: draftId,
        draft_type: draftType,
        step_number: step.step_number,
        channel: step.channel,
        subject_placeholder: null,
        body_placeholder: `${name}, quick follow-up from Equipify re: ${company}. Reply STOP to opt out. [Draft placeholder — no SMS sent.]`,
        voice_drop_script_reference: null,
        approval_status: "pending_draft_approval" as const,
        content_summary: `SMS draft placeholder for step ${step.step_number}.`,
      }
    }

    if (draftType === "voice_drop") {
      return {
        draft_id: draftId,
        draft_type: draftType,
        step_number: step.step_number,
        channel: step.channel,
        subject_placeholder: null,
        body_placeholder:
          handoff.voice_drop_script_reference?.trim() ||
          `Voice drop script placeholder for ${name} at ${company}. [Reference only — no voicemail sent.]`,
        voice_drop_script_reference: handoff.voice_drop_script_reference ?? null,
        approval_status: "pending_draft_approval" as const,
        content_summary: `Voice drop script reference for step ${step.step_number}.`,
      }
    }

    return {
      draft_id: draftId,
      draft_type: "call" as const,
      step_number: step.step_number,
      channel: step.channel,
      subject_placeholder: null,
      body_placeholder: `Call talking points for ${name} (${title}) at ${company}. [Call plan only — no dial attempted.]`,
      voice_drop_script_reference: null,
      approval_status: "pending_draft_approval" as const,
      content_summary: `Call draft placeholder for step ${step.step_number}.`,
    }
  })
}

export function summarizeApolloSequenceExecutionDrafts(
  drafts: ApolloSequenceExecutionDraftRecord[],
): string {
  return drafts.map((draft) => `${draft.draft_type} step ${draft.step_number}`).join(", ")
}
