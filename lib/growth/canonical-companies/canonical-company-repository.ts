import "server-only"

export type { InsertCanonicalCompanyPayload } from "@/lib/growth/canonical-companies/canonical-company-repository-core"
export {
  buildCanonicalCompanyInsertPayload,
  countCanonicalCompanies,
  domainRowsForCandidate,
  fetchLineageCompanyId,
  insertCanonicalCompany,
  loadCanonicalCompanyIndexesFromDb,
  updateStagingCanonicalCompanyId,
  upsertCanonicalCompanyDomain,
  upsertCanonicalCompanyLineage,
} from "@/lib/growth/canonical-companies/canonical-company-repository-core"
