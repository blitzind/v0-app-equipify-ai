/** Apollo Full Pipeline DB error evidence — client-safe sanitization. */

export type ApolloFullPipelineDbErrorEvidence = {
  db_error_table: string | null
  db_error_operation: string | null
  db_error_message: string | null
  insert_error: string | null
}

const UUID_SYNTAX_RE = /invalid input syntax for type uuid/i

export function sanitizeApolloFullPipelineDbErrorMessage(message: string): string {
  return message.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
}

export function inferApolloFullPipelineDbErrorContext(
  message: string,
): Pick<ApolloFullPipelineDbErrorEvidence, "db_error_table" | "db_error_operation"> {
  const normalized = message.toLowerCase()

  if (normalized.includes("growth.leads") || normalized.includes("relation \"leads\"")) {
    return { db_error_table: "growth.leads", db_error_operation: "insert" }
  }
  if (
    normalized.includes("lead_decision_makers") ||
    normalized.includes("relation \"lead_decision_makers\"")
  ) {
    return { db_error_table: "growth.lead_decision_makers", db_error_operation: "insert" }
  }
  if (
    normalized.includes("apollo_enrollment_candidates") ||
    normalized.includes("relation \"apollo_enrollment_candidates\"")
  ) {
    return { db_error_table: "growth.apollo_enrollment_candidates", db_error_operation: "insert" }
  }
  if (UUID_SYNTAX_RE.test(message)) {
    if (
      normalized.includes("created_by") ||
      normalized.includes("apollo-full-pipeline-certification")
    ) {
      return { db_error_table: "growth.leads", db_error_operation: "insert" }
    }
    return { db_error_table: "growth", db_error_operation: "write" }
  }

  return { db_error_table: null, db_error_operation: null }
}

export function buildApolloFullPipelineDbErrorEvidence(input: {
  message: string
  operation?: string | null
  table?: string | null
  company_contact_id?: string | null
  contact_candidate_id?: string | null
  candidate_id?: string | null
}): ApolloFullPipelineDbErrorEvidence & {
  company_contact_id: string | null
  contact_candidate_id: string | null
  candidate_id: string | null
} {
  const inferred = inferApolloFullPipelineDbErrorContext(input.message)
  const db_error_table = input.table ?? inferred.db_error_table
  const db_error_operation = input.operation ?? inferred.db_error_operation
  const db_error_message = sanitizeApolloFullPipelineDbErrorMessage(input.message.trim())

  const detailParts = [
    db_error_table ? `table=${db_error_table}` : null,
    db_error_operation ? `operation=${db_error_operation}` : null,
    input.candidate_id ? `candidate_id=${input.candidate_id}` : null,
    input.company_contact_id ? `company_contact_id=${input.company_contact_id}` : null,
    input.contact_candidate_id ? `contact_candidate_id=${input.contact_candidate_id}` : null,
    db_error_message,
  ].filter(Boolean)

  return {
    db_error_table,
    db_error_operation,
    db_error_message,
    insert_error: detailParts.join(" | "),
    company_contact_id: input.company_contact_id ?? null,
    contact_candidate_id: input.contact_candidate_id ?? null,
    candidate_id: input.candidate_id ?? null,
  }
}
