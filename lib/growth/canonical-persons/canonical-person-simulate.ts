import { canonicalNormalizedPersonEmail } from "@/lib/growth/canonical-persons/canonical-person-normalize"
import {
  createEmptyCanonicalPersonResolverIndexes,
  registerNewCanonicalPersonFromCandidate,
  resolveCanonicalPerson,
} from "@/lib/growth/canonical-persons/canonical-person-resolver"
import type {
  GrowthCanonicalPersonBackfillStats,
  GrowthCanonicalPersonCandidateInput,
  GrowthCanonicalPersonSourceTable,
} from "@/lib/growth/canonical-persons/canonical-person-types"

function emptySourceStats() {
  return {
    rows_processed: 0,
    already_linked: 0,
    resolved_normalized_email: 0,
    resolved_normalized_linkedin: 0,
    resolved_normalized_phone: 0,
    resolved_name_company: 0,
    would_create_new: 0,
    errors: 0,
  }
}

function bumpStats(
  stats: GrowthCanonicalPersonBackfillStats["sources"][GrowthCanonicalPersonSourceTable],
  resolution: ReturnType<typeof resolveCanonicalPerson>,
): void {
  stats.rows_processed++
  if (resolution.would_create_new) stats.would_create_new++
  switch (resolution.resolution_method) {
    case "normalized_email":
      stats.resolved_normalized_email++
      break
    case "normalized_linkedin":
      stats.resolved_normalized_linkedin++
      break
    case "normalized_phone":
      stats.resolved_normalized_phone++
      break
    case "name_company":
      stats.resolved_name_company++
      break
    default:
      break
  }
}

/** In-memory dry-run simulation without database (for unit tests). */
export function simulateCanonicalPersonBackfill(
  candidates: GrowthCanonicalPersonCandidateInput[],
): {
  stats: Pick<
    GrowthCanonicalPersonBackfillStats,
    "sources" | "unique_normalized_emails" | "merge_groups_by_email"
  >
  person_ids_by_source: Map<string, string>
} {
  const indexes = createEmptyCanonicalPersonResolverIndexes()
  const personIdsBySource = new Map<string, string>()
  const stats = {
    contact_candidates: emptySourceStats(),
    company_contacts: emptySourceStats(),
    lead_decision_makers: emptySourceStats(),
  }
  const emailGroups = new Map<string, number>()

  for (const input of candidates) {
    const email = canonicalNormalizedPersonEmail(input.email)
    if (email) emailGroups.set(email, (emailGroups.get(email) ?? 0) + 1)
    const resolution = resolveCanonicalPerson(input, indexes)
    bumpStats(stats[input.source_table], resolution)
    let personId = resolution.person_id
    if (!personId) {
      personId = `sim-${personIdsBySource.size + 1}`
      registerNewCanonicalPersonFromCandidate(indexes, personId, input, resolution)
    } else {
      registerNewCanonicalPersonFromCandidate(indexes, personId, input, resolution)
    }
    personIdsBySource.set(`${input.source_table}:${input.source_id}`, personId)
  }

  let mergeGroups = 0
  for (const c of emailGroups.values()) if (c > 1) mergeGroups++

  return {
    stats: {
      sources: stats,
      unique_normalized_emails: indexes.by_normalized_email.size,
      merge_groups_by_email: mergeGroups,
    },
    person_ids_by_source: personIdsBySource,
  }
}
