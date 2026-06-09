/** Apollo-Scale-2 production certification evidence bundle — client-safe shape. */

import type {
  ApolloScale2CertResult,
  ApolloScale2CompanyEvidenceRow,
  ApolloScale2FailureAnalysis,
  ApolloScale2LiveAcquisitionCertification,
} from "@/lib/growth/apollo/apollo-scale-2-live-acquisition-certification"
import { APOLLO_SCALE_2_BROWSER_CONSOLE_EXECUTE_SNIPPET } from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"

export const APOLLO_SCALE_2_EVIDENCE_BUNDLE_QA_MARKER =
  "apollo-scale-2-evidence-bundle-v1" as const

export type ApolloScale2ProductionSafetyEvidence = {
  auto_enrollment: false
  outreach_sent: false
  scheduler_run: false
  execution_created: false
}

export type ApolloScale2EvidenceBundle = {
  qa_marker: typeof APOLLO_SCALE_2_EVIDENCE_BUNDLE_QA_MARKER
  verdict: ApolloScale2CertResult
  certified_at: string
  safety: ApolloScale2ProductionSafetyEvidence
  companies: ApolloScale2CompanyEvidenceRow[]
  failure_analysis: ApolloScale2FailureAnalysis
  blockers: string[]
  certification: ApolloScale2LiveAcquisitionCertification
  browser_console_execute_snippet: typeof APOLLO_SCALE_2_BROWSER_CONSOLE_EXECUTE_SNIPPET
  errors: string[]
}

export function buildApolloScale2EvidenceBundle(input: {
  certification: ApolloScale2LiveAcquisitionCertification
  errors?: string[]
}): ApolloScale2EvidenceBundle {
  const blockers = input.certification.failures_ranked.map(
    (row) => `${row.category} (${row.count})`,
  )

  return {
    qa_marker: APOLLO_SCALE_2_EVIDENCE_BUNDLE_QA_MARKER,
    verdict: input.certification.result,
    certified_at: input.certification.certified_at,
    safety: {
      auto_enrollment: false,
      outreach_sent: false,
      scheduler_run: false,
      execution_created: false,
    },
    companies: input.certification.companies,
    failure_analysis: input.certification.failure_analysis,
    blockers,
    certification: input.certification,
    browser_console_execute_snippet: APOLLO_SCALE_2_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    errors: input.errors ?? input.certification.runtime.errors,
  }
}
