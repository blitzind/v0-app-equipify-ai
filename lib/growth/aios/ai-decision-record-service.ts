/** GE-AIOS-2D — Decision Record service (server-only). Delegates to @fuzor/decision-records. */

import "server-only"

export {
  createPlatformDecisionRecord as createAiDecisionRecord,
  getPlatformDecisionRecord as getAiDecisionRecord,
  getPlatformDecisionRecordAuditTrail as getAiDecisionRecordAuditTrail,
  linkPlatformDecisionRecordToWorkOrder as linkAiDecisionRecordToWorkOrder,
  queryPlatformDecisionRecords as queryAiDecisionRecords,
  supersedePlatformDecisionRecord as supersedeAiDecisionRecord,
} from "@fuzor/decision-records"

export type {
  PlatformDecisionRecord as AiDecisionRecord,
  PlatformDecisionRecordAuditEvent as AiDecisionRecordAuditEvent,
  PlatformDecisionRecordCreateInput as AiDecisionRecordCreateInput,
  PlatformDecisionRecordLinkInput as AiDecisionRecordLinkInput,
  PlatformDecisionRecordListFilter as AiDecisionRecordListFilter,
  PlatformDecisionRecordSupersedeInput as AiDecisionRecordSupersedeInput,
} from "@fuzor/decision-records"
