/** Apollo contact title buckets for benchmark quality reporting. Client-safe. */

export const GROWTH_APOLLO_TITLE_BUCKET_QA_MARKER = "growth-apollo-title-bucket-7-pca-3-v1" as const

export type ApolloContactTitleBucket =
  | "owner_founder_president_ceo"
  | "operations_coo_general_manager"
  | "service_field_service_manager"
  | "biomedical_equipment_facilities_maintenance"
  | "sales_marketing_admin_irrelevant"
  | "unknown_other"

const OWNER_EXEC_PATTERNS = [
  /\b(owner|founder|co-?founder|president|ceo|chief executive)\b/i,
  /\bmanaging partner\b/i,
] as const

const OPERATIONS_PATTERNS = [
  /\b(coo|chief operating officer)\b/i,
  /\b(general manager|gm)\b/i,
  /\b(vp|vice president).*operations\b/i,
  /\bdirector of operations\b/i,
  /\boperations director\b/i,
  /\bhead of operations\b/i,
] as const

const SERVICE_PATTERNS = [
  /\bservice manager\b/i,
  /\bfield service\b/i,
  /\bdispatch\b/i,
  /\bcustomer service manager\b/i,
] as const

const BIOMED_PATTERNS = [
  /\bbio\s?med/i,
  /\bclinical engineering\b/i,
  /\bequipment manager\b/i,
  /\bfacilities manager\b/i,
  /\bmaintenance manager\b/i,
  /\bplant manager\b/i,
  /\bhtm\b/i,
] as const

const IRRELEVANT_PATTERNS = [
  /\b(sales|marketing|business development|bdm|account executive|sdr|bdr)\b/i,
  /\b(human resources|hr|recruiting|talent)\b/i,
  /\b(finance|accounting|controller|cfo)\b/i,
  /\b(it director|information technology|software|developer)\b/i,
  /\b(administrative assistant|office manager|receptionist)\b/i,
  /\b(intern|student)\b/i,
] as const

/** Post-search filter — drop clearly irrelevant titles before mapping when not executive/ops. */
export function isApolloIrrelevantTitleForIcp(title: string | null | undefined): boolean {
  const normalized = (title ?? "").trim()
  if (!normalized) return false
  if (IRRELEVANT_PATTERNS.some((p) => p.test(normalized))) {
    const salvaged =
      OPERATIONS_PATTERNS.some((p) => p.test(normalized)) ||
      BIOMED_PATTERNS.some((p) => p.test(normalized)) ||
      OWNER_EXEC_PATTERNS.some((p) => p.test(normalized))
    return !salvaged
  }
  return false
}

export function classifyApolloContactTitleBucket(title: string | null | undefined): ApolloContactTitleBucket {
  const normalized = (title ?? "").trim()
  if (!normalized) return "unknown_other"

  if (OWNER_EXEC_PATTERNS.some((p) => p.test(normalized))) {
    return "owner_founder_president_ceo"
  }
  if (OPERATIONS_PATTERNS.some((p) => p.test(normalized))) {
    return "operations_coo_general_manager"
  }
  if (SERVICE_PATTERNS.some((p) => p.test(normalized))) {
    return "service_field_service_manager"
  }
  if (BIOMED_PATTERNS.some((p) => p.test(normalized))) {
    return "biomedical_equipment_facilities_maintenance"
  }
  if (IRRELEVANT_PATTERNS.some((p) => p.test(normalized))) {
    return "sales_marketing_admin_irrelevant"
  }
  return "unknown_other"
}

export function emptyApolloTitleBucketCounts(): Record<ApolloContactTitleBucket, number> {
  return {
    owner_founder_president_ceo: 0,
    operations_coo_general_manager: 0,
    service_field_service_manager: 0,
    biomedical_equipment_facilities_maintenance: 0,
    sales_marketing_admin_irrelevant: 0,
    unknown_other: 0,
  }
}

export function tallyApolloTitleBuckets(
  titles: Array<string | null | undefined>,
): Record<ApolloContactTitleBucket, number> {
  const counts = emptyApolloTitleBucketCounts()
  for (const title of titles) {
    counts[classifyApolloContactTitleBucket(title)] += 1
  }
  return counts
}
