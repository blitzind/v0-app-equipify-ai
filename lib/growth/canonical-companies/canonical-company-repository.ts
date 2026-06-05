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
export {
  backfillStagingCanonicalCompanyLinkage,
  countUnlinkedStagingCompanyCandidates,
  ensureStagingCanonicalCompanyLinkage,
  GROWTH_CANONICAL_COMPANY_STAGING_LINKAGE_QA_MARKER,
  resolveStagingCanonicalCompanyId,
} from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
