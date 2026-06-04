import "server-only"

export type { InsertCanonicalPersonPayload } from "@/lib/growth/canonical-persons/canonical-person-repository-core"
export {
  buildCanonicalPersonInsertPayload,
  countCanonicalPersons,
  fetchLineagePersonId,
  fetchStagingCanonicalCompanyId,
  insertCanonicalPerson,
  loadCanonicalPersonIndexesFromDb,
  persistCanonicalPersonChannels,
  resolveCanonicalCompanyIdForCompanyContact,
  resolveCanonicalCompanyIdForLead,
  touchCanonicalPersonSeen,
  updateStagingCanonicalPersonId,
  upsertCanonicalPersonLineage,
} from "@/lib/growth/canonical-persons/canonical-person-repository-core"
