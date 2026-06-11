/** Apollo sequence draft readiness labels — client-safe. */

import type { ApolloSequenceExecutionDraftRecord } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import { APOLLO_SEQUENCE_DRAFT_GENERATION_QA_MARKER } from "@/lib/growth/apollo/apollo-sequence-draft-generation"
import type { ApolloUnifiedPersonalizationContext } from "@/lib/growth/apollo/apollo-unified-personalization-context"

export const APOLLO_SEQUENCE_DRAFT_READINESS_QA_MARKER =
  "apollo-sequence-draft-readiness-v1" as const

export const APOLLO_SEQUENCE_DRAFT_PLACEHOLDER_SENTINEL =
  "[Draft placeholder" as const

const APOLLO_SEQUENCE_DRAFT_PLACEHOLDER_SENTINELS = [
  APOLLO_SEQUENCE_DRAFT_PLACEHOLDER_SENTINEL,
  "[Call plan only",
  "[Reference only",
  "[no voicemail sent",
  "[no SMS sent",
] as const

export type ApolloSequenceDraftReadinessLabel =
  | "Draft Placeholder"
  | "Personalization Pending"
  | "Not Send Ready"
  | "Draft Approved"

export type ApolloSequenceDraftReadiness = {
  qa_marker: typeof APOLLO_SEQUENCE_DRAFT_READINESS_QA_MARKER
  is_placeholder: boolean
  is_send_ready: boolean
  readiness_label: ApolloSequenceDraftReadinessLabel
  readiness_detail: string
  draft_generation_marker: typeof APOLLO_SEQUENCE_DRAFT_GENERATION_QA_MARKER
}

export function isApolloSequenceDraftPlaceholderContent(body: string | null | undefined): boolean {
  const normalized = (body ?? "").trim()
  if (!normalized) return true
  return APOLLO_SEQUENCE_DRAFT_PLACEHOLDER_SENTINELS.some((sentinel) => normalized.includes(sentinel))
}

export function classifyApolloSequenceDraftReadiness(
  draft: Pick<
    ApolloSequenceExecutionDraftRecord,
    "body_placeholder" | "approval_status" | "content_summary"
  >,
): ApolloSequenceDraftReadiness {
  const isPlaceholder = isApolloSequenceDraftPlaceholderContent(draft.body_placeholder)
  const approved = draft.approval_status === "draft_approved"

  if (approved && !isPlaceholder) {
    return {
      qa_marker: APOLLO_SEQUENCE_DRAFT_READINESS_QA_MARKER,
      is_placeholder: false,
      is_send_ready: true,
      readiness_label: "Draft Approved",
      readiness_detail: "Draft approved — personalization complete.",
      draft_generation_marker: APOLLO_SEQUENCE_DRAFT_GENERATION_QA_MARKER,
    }
  }

  if (approved && isPlaceholder) {
    return {
      qa_marker: APOLLO_SEQUENCE_DRAFT_READINESS_QA_MARKER,
      is_placeholder: true,
      is_send_ready: false,
      readiness_label: "Not Send Ready",
      readiness_detail:
        "Draft approved in queue, but content is still a placeholder — upgrade personalization before send.",
      draft_generation_marker: APOLLO_SEQUENCE_DRAFT_GENERATION_QA_MARKER,
    }
  }

  if (isPlaceholder) {
    return {
      qa_marker: APOLLO_SEQUENCE_DRAFT_READINESS_QA_MARKER,
      is_placeholder: true,
      is_send_ready: false,
      readiness_label: "Draft Placeholder",
      readiness_detail:
        "Materialized placeholder only — approve drafts after review; personalization still pending.",
      draft_generation_marker: APOLLO_SEQUENCE_DRAFT_GENERATION_QA_MARKER,
    }
  }

  return {
    qa_marker: APOLLO_SEQUENCE_DRAFT_READINESS_QA_MARKER,
    is_placeholder: false,
    is_send_ready: false,
    readiness_label: "Personalization Pending",
    readiness_detail: "Draft content present — awaiting operator draft approval.",
    draft_generation_marker: APOLLO_SEQUENCE_DRAFT_GENERATION_QA_MARKER,
  }
}

export function summarizeApolloSequenceCandidateDraftReadiness(
  drafts: ApolloSequenceExecutionDraftRecord[],
): ApolloSequenceDraftReadiness {
  if (!drafts.length) {
    return {
      qa_marker: APOLLO_SEQUENCE_DRAFT_READINESS_QA_MARKER,
      is_placeholder: true,
      is_send_ready: false,
      readiness_label: "Not Send Ready",
      readiness_detail: "No drafts materialized.",
      draft_generation_marker: APOLLO_SEQUENCE_DRAFT_GENERATION_QA_MARKER,
    }
  }

  const classified = drafts.map((draft) => classifyApolloSequenceDraftReadiness(draft))
  const anyPlaceholder = classified.some((row) => row.is_placeholder)
  const allApproved = classified.every((row) => row.readiness_label === "Draft Approved")
  const allSendReady = classified.every((row) => row.is_send_ready)

  if (allSendReady) return classified[0]!
  if (anyPlaceholder) {
    return {
      qa_marker: APOLLO_SEQUENCE_DRAFT_READINESS_QA_MARKER,
      is_placeholder: true,
      is_send_ready: false,
      readiness_label: "Draft Placeholder",
      readiness_detail: `${classified.filter((row) => row.is_placeholder).length} of ${drafts.length} drafts are placeholders — not send ready.`,
      draft_generation_marker: APOLLO_SEQUENCE_DRAFT_GENERATION_QA_MARKER,
    }
  }
  if (allApproved) {
    return {
      qa_marker: APOLLO_SEQUENCE_DRAFT_READINESS_QA_MARKER,
      is_placeholder: false,
      is_send_ready: false,
      readiness_label: "Personalization Pending",
      readiness_detail: "Drafts approved in queue — execution jobs still require separate approval.",
      draft_generation_marker: APOLLO_SEQUENCE_DRAFT_GENERATION_QA_MARKER,
    }
  }

  return {
    qa_marker: APOLLO_SEQUENCE_DRAFT_READINESS_QA_MARKER,
    is_placeholder: false,
    is_send_ready: false,
    readiness_label: "Not Send Ready",
    readiness_detail: "Draft review incomplete — approve drafts before job approval.",
    draft_generation_marker: APOLLO_SEQUENCE_DRAFT_GENERATION_QA_MARKER,
  }
}

export type ApolloSequenceContentReadinessResult = {
  ready: boolean
  code: string | null
  detail: string
  placeholder_count: number
  unified_context_marker: string | null
}

export function evaluateApolloSequenceCandidateContentReadiness(input: {
  drafts: ApolloSequenceExecutionDraftRecord[]
  unified_context?: ApolloUnifiedPersonalizationContext | null
}): ApolloSequenceContentReadinessResult {
  const summary = summarizeApolloSequenceCandidateDraftReadiness(input.drafts)
  const placeholderCount = input.drafts.filter((draft) =>
    isApolloSequenceDraftPlaceholderContent(draft.body_placeholder),
  ).length

  if (summary.is_send_ready && placeholderCount === 0) {
    return {
      ready: true,
      code: null,
      detail: "All drafts personalized — send-ready content present.",
      placeholder_count: 0,
      unified_context_marker: input.unified_context?.qa_marker ?? null,
    }
  }

  return {
    ready: false,
    code: placeholderCount > 0 ? "draft_placeholders_present" : "draft_content_incomplete",
    detail: summary.readiness_detail,
    placeholder_count: placeholderCount,
    unified_context_marker: input.unified_context?.qa_marker ?? null,
  }
}
