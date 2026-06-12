/** Apollo 25-company pilot cohort — personalization asset validation (Phase 14.2F). */

import {
  evaluateApolloSequenceCandidateContentReadiness,
  isApolloSequenceDraftPlaceholderContent,
} from "@/lib/growth/apollo/apollo-sequence-draft-readiness"
import type { ApolloSequenceExecutionDraftRecord } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import type {
  Apollo25CompanyPilotCohortPersonalizationAssetKey,
  Apollo25CompanyPilotCohortPersonalizationCompany,
  Apollo25CompanyPilotCohortPersonalizationReport,
  Apollo25CompanyPilotCohortSnapshotCompany,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"

export type Apollo25CompanyPilotPersonalizationMaterializationState = {
  has_account_playbook: boolean
  has_personalization_generation: boolean
  execution_drafts: ApolloSequenceExecutionDraftRecord[]
  has_voice_drop_candidate: boolean
}

const ASSET_KEYS: Apollo25CompanyPilotCohortPersonalizationAssetKey[] = [
  "account_playbook",
  "personalization",
  "content_quality_optimization",
  "voice_drop_assets",
  "email_assets",
  "sms_assets",
]

function hasNonPlaceholderDraft(
  drafts: ApolloSequenceExecutionDraftRecord[],
  draftType: ApolloSequenceExecutionDraftRecord["draft_type"],
): boolean {
  return drafts.some(
    (draft) =>
      draft.draft_type === draftType &&
      !isApolloSequenceDraftPlaceholderContent(draft.body_placeholder),
  )
}

function evaluatePersonalizationAssets(
  state: Apollo25CompanyPilotPersonalizationMaterializationState,
): Record<Apollo25CompanyPilotCohortPersonalizationAssetKey, boolean> {
  const contentReadiness = evaluateApolloSequenceCandidateContentReadiness({
    drafts: state.execution_drafts,
  })
  const placeholderCount = state.execution_drafts.filter((draft) =>
    isApolloSequenceDraftPlaceholderContent(draft.body_placeholder),
  ).length
  const personalizedDraftsPresent =
    state.execution_drafts.length > 0 && placeholderCount === 0

  return {
    account_playbook: state.has_account_playbook,
    personalization: state.has_personalization_generation,
    content_quality_optimization: contentReadiness.ready || personalizedDraftsPresent,
    voice_drop_assets:
      hasNonPlaceholderDraft(state.execution_drafts, "voice_drop") || state.has_voice_drop_candidate,
    email_assets: hasNonPlaceholderDraft(state.execution_drafts, "email"),
    sms_assets: hasNonPlaceholderDraft(state.execution_drafts, "sms"),
  }
}

export function evaluateApollo25CompanyPilotCohortPersonalization(input: {
  snapshot_companies: Apollo25CompanyPilotCohortSnapshotCompany[]
  materialization_by_company: Record<string, Apollo25CompanyPilotPersonalizationMaterializationState>
}): Apollo25CompanyPilotCohortPersonalizationReport {
  const companies: Apollo25CompanyPilotCohortPersonalizationCompany[] = input.snapshot_companies.map(
    (snapshotCompany) => {
      const state = input.materialization_by_company[snapshotCompany.company_candidate_id] ?? {
        has_account_playbook: false,
        has_personalization_generation: false,
        execution_drafts: [],
        has_voice_drop_candidate: false,
      }

      const assets = evaluatePersonalizationAssets(state)
      const missing_assets = ASSET_KEYS.filter((key) => !assets[key])

      return {
        company_candidate_id: snapshotCompany.company_candidate_id,
        company_name: snapshotCompany.company_name,
        ready: missing_assets.length === 0,
        missing_assets,
        assets,
      }
    },
  )

  const companies_ready = companies.filter((row) => row.ready).length
  const companies_evaluated = companies.length

  return {
    companies_evaluated,
    companies_ready,
    readiness_pct:
      companies_evaluated > 0 ? Math.round((companies_ready / companies_evaluated) * 100) : 0,
    companies,
  }
}
