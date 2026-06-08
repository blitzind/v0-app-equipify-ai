/** Phase 7.PS-IS — PDL runtime validation certification. Client-safe. */

import {
  GROWTH_PDL_RUNTIME_VALIDATION_CERTIFICATION_QA_MARKER,
  type PdlRuntimeValidationEnvironmentRow,
} from "@/lib/growth/qa/pdl-runtime-validation-types"

export function evaluatePdlRuntimeValidationCertification(): {
  qa_marker: typeof GROWTH_PDL_RUNTIME_VALIDATION_CERTIFICATION_QA_MARKER
  audit_only: true
  no_broad_acquisition: true
  no_contact_creation: true
  no_benchmark_snapshots: true
  no_benchmark_metric_changes: true
} {
  return {
    qa_marker: GROWTH_PDL_RUNTIME_VALIDATION_CERTIFICATION_QA_MARKER,
    audit_only: true,
    no_broad_acquisition: true,
    no_contact_creation: true,
    no_benchmark_snapshots: true,
    no_benchmark_metric_changes: true,
  }
}

export function evaluatePdlRuntimeValidationOutcome(input: {
  local: PdlRuntimeValidationEnvironmentRow
  runtime: PdlRuntimeValidationEnvironmentRow | null
  runtime_probed: boolean
  ps_ir_false_negative_likely: boolean
}): {
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  remaining_blockers: string[]
  root_cause: string | null
} {
  const remaining_blockers: string[] = []
  const runtime = input.runtime

  if (!input.runtime_probed || !runtime) {
    remaining_blockers.push("deployed_runtime_not_probed")
  } else if (!runtime.pdl_configured) {
    remaining_blockers.push("runtime_pdl_not_configured")
  }

  if (runtime && runtime.pdl_configured && !runtime.search_executable) {
    remaining_blockers.push("runtime_search_not_executable")
  }

  if (runtime && runtime.search_executable && !runtime.records_returned) {
    remaining_blockers.push("runtime_search_no_records")
  }

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  if (runtime?.search_executable && runtime.records_returned) {
    certification = "PASS"
  } else if (runtime?.pdl_configured && runtime.search_executable && !runtime.records_returned) {
    certification = "PASS_PARTIAL"
  } else if (runtime?.pdl_configured && !runtime.search_executable) {
    certification = "PASS_PARTIAL"
  }

  let root_cause: string | null = null
  if (input.ps_ir_false_negative_likely) {
    root_cause =
      "PS-IR local cert false negative: local env has KEY=\"\" placeholders while deployed runtime reports configured PDL keys. Re-run PS-IR using deployed-runtime PDL execution path."
  } else if (!runtime?.pdl_configured) {
    root_cause = "PDL not configured in deployed runtime — PS-IR failure is real, not a local env artifact."
  } else if (runtime.pdl_configured && !runtime.search_executable) {
    root_cause = "PDL configured in deployed runtime but search blocked (permissions, quota, or API error)."
  } else if (runtime.search_executable && !runtime.records_returned) {
    root_cause = "PDL search executed in deployed runtime but returned zero records for probe company."
  }

  return { certification, remaining_blockers, root_cause }
}
