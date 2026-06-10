/** Apollo-Scale-5 execution stage errors — client-safe structured failure payloads. */

export const APOLLO_SCALE_5_EXECUTION_ERRORS_QA_MARKER =
  "apollo-scale-5-execution-errors-v1" as const

export type ApolloScale5ExecutionStage =
  | "readiness_gates"
  | "target_company_resolution"
  | "apollo_search"
  | "candidate_mapping"
  | "email_enrichment_selection"
  | "apollo_bulk_match_enrichment"
  | "candidate_persistence"
  | "canonical_person_creation"
  | "company_contacts_promotion"
  | "readiness_evaluation"
  | "evidence_build"
  | "response_serialization"
  | "completed"

export type ApolloScale5ExecutionCompany = {
  company_name: string
  domain: string | null
  company_candidate_id: string | null
}

export type ApolloScale5ExecutionErrorCode =
  | "gates_failed"
  | "target_company_failed"
  | "certification_failed"
  | "execution_failed"
  | "response_serialization_failed"

export class ApolloScale5StageError extends Error {
  readonly stage: ApolloScale5ExecutionStage

  constructor(stage: ApolloScale5ExecutionStage, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "ApolloScale5StageError"
    this.stage = stage
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function resolveApolloScale5ExecutionStage(error: unknown): ApolloScale5ExecutionStage {
  if (error instanceof ApolloScale5StageError) return error.stage
  return "evidence_build"
}

export function formatApolloScale5ExecutionMessage(error: unknown): string {
  if (error instanceof ApolloScale5StageError) return error.message
  if (error instanceof Error) return error.message
  return asString(error) || "Apollo-Scale-5 execution failed"
}

export function buildApolloScale5ExecutionErrorMetadata(error: unknown): {
  name: string
  cause: string | null
} {
  const name = error instanceof Error ? error.name : "Error"
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : error instanceof Error && typeof error.cause === "string"
        ? error.cause
        : null
  return { name, cause }
}

export function shouldIncludeApolloScale5ExecutionStack(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" && env.VERCEL_ENV !== "production"
}

export function formatApolloScale5ExecutionFailure(input: {
  execution_id: string
  stage: ApolloScale5ExecutionStage
  error: ApolloScale5ExecutionErrorCode
  message: string
  company: ApolloScale5ExecutionCompany | null
  blockers?: string[]
  cause?: unknown
  env?: NodeJS.ProcessEnv
}): {
  ok: false
  execution_id: string
  stage: ApolloScale5ExecutionStage
  error: ApolloScale5ExecutionErrorCode
  message: string
  company: ApolloScale5ExecutionCompany | null
  blockers: string[]
  error_metadata: { name: string; cause: string | null }
  stack?: string
  verdict: null
  certification: null
} {
  const env = input.env ?? process.env
  const includeStack = shouldIncludeApolloScale5ExecutionStack(env)
  const cause = input.cause ?? null

  return {
    ok: false,
    execution_id: input.execution_id,
    stage: input.stage,
    error: input.error,
    message: input.message,
    company: input.company,
    blockers: input.blockers ?? [input.message],
    error_metadata: buildApolloScale5ExecutionErrorMetadata(cause ?? { name: input.error, message: input.message }),
    ...(includeStack && cause instanceof Error && cause.stack ? { stack: cause.stack } : {}),
    verdict: null,
    certification: null,
  }
}

export async function runApolloScale5ExecutionStage<T>(input: {
  stage: ApolloScale5ExecutionStage
  run: () => Promise<T>
}): Promise<
  | { ok: true; stage: ApolloScale5ExecutionStage; value: T }
  | { ok: false; stage: ApolloScale5ExecutionStage; message: string; cause: unknown }
> {
  try {
    const value = await input.run()
    return { ok: true, stage: input.stage, value }
  } catch (error) {
    return {
      ok: false,
      stage: input.stage,
      message: formatApolloScale5ExecutionMessage(error),
      cause: error,
    }
  }
}
