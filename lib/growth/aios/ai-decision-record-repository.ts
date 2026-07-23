/** GE-AIOS-2D — Decision Record persistence (server-only). Delegates to @fuzor/decision-records. */

import "server-only"

export {
  fetchPlatformDecisionRecordById as fetchAiDecisionRecordById,
  fetchPlatformDecisionRecordsByIds as fetchAiDecisionRecordsByIds,
  insertPlatformDecisionRecord as insertAiDecisionRecord,
  insertPlatformDecisionRecordAuditEvent as insertAiDecisionRecordAuditEvent,
  listPlatformDecisionRecordAuditEvents as listAiDecisionRecordAuditEvents,
  listPlatformDecisionRecords as listAiDecisionRecords,
  platformDecisionRecordSchemaCatalog as aiDecisionRecordSchemaCatalog,
} from "@fuzor/decision-records"

export type {
  PlatformDecisionRecord as AiDecisionRecord,
  PlatformDecisionRecordAuditEvent as AiDecisionRecordAuditEvent,
  PlatformDecisionRecordCreateInput as AiDecisionRecordCreateInput,
  PlatformDecisionRecordListFilter as AiDecisionRecordListFilter,
} from "@fuzor/decision-records"
