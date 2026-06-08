/** Phase 7.PS-IS — PDL runtime validation audit types. Client-safe. */

export const GROWTH_PDL_RUNTIME_VALIDATION_QA_MARKER =
  "growth-pdl-runtime-validation-7-ps-is-v1" as const

export const GROWTH_PDL_RUNTIME_VALIDATION_CERTIFICATION_QA_MARKER =
  "growth-pdl-runtime-validation-certification-7-ps-is-v1" as const

export type PdlRuntimeValidationEnvironmentRow = {
  pdl_configured: boolean
  sandbox: boolean
  production_ready: boolean
  search_executable: boolean
  records_returned: boolean
  contacts_returned: number
  search_status: string | null
  search_message: string | null
  winning_key: "PEOPLE_DATA_LABS_API_KEY" | "PDL_API_KEY" | null
  pdl_discovery_disabled: boolean
}

export type PdlRuntimeValidationComparisonTable = {
  check: string
  local: string | boolean | number
  runtime: string | boolean | number
}[]
