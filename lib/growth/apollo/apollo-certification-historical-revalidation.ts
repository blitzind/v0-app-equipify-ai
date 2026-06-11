/** Apollo certification historical candidate revalidation — client-safe re-exports. */

export {
  APOLLO_CERTIFICATION_HISTORICAL_REVALIDATION_QA_MARKER,
  isApolloHistoricalRevalidationCandidate,
  readApolloHistoricalRevalidationPersonIds,
  resolveApolloCurrentRunAttributionSource,
  resolveApolloScale3CertificationMode,
  type ApolloCurrentRunAttributionSource,
  type ApolloHistoricalRevalidationCandidate,
  type ApolloScale3CertificationMode,
} from "@/lib/growth/apollo/apollo-certification-historical-revalidation-evidence"
