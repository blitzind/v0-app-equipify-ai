/** GE-AIOS-END-TO-END-1A — Supervised sales loop certification types (client-safe). */

export const GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER =
  "ge-aios-end-to-end-supervised-sales-loop-1a-v1" as const

export const GE_AIOS_END_TO_END_1A_LIVE_SEND_CONFIRM_ENV =
  "CONFIRM_GE_AIOS_END_TO_END_1A_LIVE_SEND" as const

export const GE_AIOS_END_TO_END_1A_BLOCK_IMAGING_LEAD_ID =
  "6d9220f0-2960-468c-b4be-5d7595d292c3" as const

export type EndToEndStepStatus = "pass" | "fail" | "warn" | "skip" | "blocked"

export type EndToEndEvidenceRow = {
  step: string
  record: string
  result: EndToEndStepStatus
  detail?: string
}

export type EndToEndSupervisedSalesLoopReport = {
  qaMarker: typeof GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER
  generatedAt: string
  organizationId: string
  selectedLeadId: string | null
  selectedPackageId: string | null
  selectedEnrollmentId: string | null
  selectedJobId: string | null
  phases: {
    productionAudit: Record<string, unknown>
    prospectSelection: Record<string, unknown>
    evidenceAudit: Record<string, unknown>
    handoffAudit: Record<string, unknown>
    preSendSafety: Record<string, unknown>
    liveDelivery: Record<string, unknown> | null
    replyValidation: Record<string, unknown> | null
  }
  chronology: EndToEndEvidenceRow[]
  blockers: Array<{ severity: "critical" | "high" | "medium"; message: string }>
  overallVerdict: "pass" | "fail" | "blocked"
  liveSendAuthorized: boolean
}
