/** Prospect Search — canonical resolution (7.PS-A / hardened 7.PS-E). Re-exports coverage resolution. */

export type { ProspectSearchCanonicalPersonRef } from "@/lib/growth/prospect-search/prospect-search-coverage-resolution"
export { resolveProspectSearchCompanyCoverage } from "@/lib/growth/prospect-search/prospect-search-coverage-resolution-core"
export type { ProspectSearchDomainResolutionIndex } from "@/lib/growth/prospect-search/prospect-search-coverage-resolution-core"

export {
  loadProspectSearchDomainResolutionIndex,
  resolveProspectSearchCanonicalCompanyId,
  resolveProspectSearchCanonicalCompanyIdsBatch,
  resolveProspectSearchCanonicalPersonIdsBatch,
  resolveProspectSearchCompanyCoverageBatch,
  resolveProspectSearchPersonLinkageBatch,
} from "@/lib/growth/prospect-search/prospect-search-coverage-resolution"
