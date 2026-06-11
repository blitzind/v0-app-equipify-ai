/** Launch checklist for 25-company pilot. */

import { isApolloPilotCohortProcessingAllowed } from "@/lib/growth/apollo/apollo-pilot-cohort-state"
import type { ApolloPilotCohortStatus } from "@/lib/growth/apollo/apollo-pilot-types"
import type {
  Apollo25CompanyPilotLaunchChecklist,
  Apollo25CompanyPilotLaunchReport,
  Apollo25CompanyPilotPreflightReport,
  Apollo25CompanyPilotSelectionReport,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"

export function buildApollo25CompanyPilotLaunchChecklist(input: {
  migration_present: boolean
  cohort_status: ApolloPilotCohortStatus | null
  selection: Apollo25CompanyPilotSelectionReport
  preflight: Apollo25CompanyPilotPreflightReport
  suppressions_checked: boolean
  operator_assigned: boolean
  env_gates_ok: boolean
}): Apollo25CompanyPilotLaunchChecklist {
  const items: Apollo25CompanyPilotLaunchChecklist["items"] = [
    {
      key: "env_gates",
      label: "Production env gates reviewed (no live-send flags enabled)",
      status: input.env_gates_ok ? "pass" : "fail",
      detail: input.env_gates_ok ? "Manual ACK gates required before any execute route." : "Resolve env blockers first.",
    },
    {
      key: "migration",
      label: "Apollo pilot cohort migration applied",
      status: input.migration_present ? "pass" : "fail",
      detail: input.migration_present ? "apollo_pilot_cohorts tables available." : "Run pilot operations migration.",
    },
    {
      key: "cohort_state",
      label: "Cohort created in draft (no auto-outreach)",
      status: input.cohort_status === "draft" ? "pass" : input.cohort_status ? "warn" : "fail",
      detail: input.cohort_status
        ? `Current cohort status: ${input.cohort_status}`
        : "Create draft cohort before activate.",
    },
    {
      key: "selection",
      label: "25 companies selected under production rules",
      status:
        input.selection.selected_count >= 25
          ? "pass"
          : input.selection.selected_count > 0
            ? "warn"
            : "fail",
      detail: `${input.selection.selected_count}/${input.selection.target_count} selected (threshold ${input.selection.production_qualification_threshold}).`,
    },
    {
      key: "preflight",
      label: "Preflight certification",
      status: input.preflight.pilot_readiness_pct >= 90 ? "pass" : input.preflight.pilot_readiness_pct >= 70 ? "warn" : "fail",
      detail: `${input.preflight.pilot_readiness_pct}% companies pass dry-run materialization gates.`,
    },
    {
      key: "suppressions",
      label: "Suppressions checked for selected contacts",
      status: input.suppressions_checked ? "pass" : "fail",
      detail: input.suppressions_checked
        ? "No suppression/unsubscribe conflicts in selected cohort."
        : "Re-run selection with suppression filters.",
    },
    {
      key: "operator",
      label: "Operator assigned for daily review cadence",
      status: input.operator_assigned ? "pass" : "manual",
      detail: "Assign primary operator + backup before activate.",
    },
    {
      key: "monitoring",
      label: "Daily monitoring cadence configured",
      status: "manual",
      detail: "Review Pilot Operations + Operator Scale dashboards daily.",
    },
    {
      key: "rollback",
      label: "Pause/cancel rollback procedure documented",
      status: "pass",
      detail: "Pause blocks processing_allowed; cancel preserves history; no deletes.",
    },
  ]

  const all_automated_pass = items
    .filter((item) => item.status !== "manual")
    .every((item) => item.status === "pass")

  return { items, all_automated_pass }
}

export function validateApollo25CompanyPilotLifecycleControls(): {
  valid: boolean
  notes: string[]
} {
  const notes: string[] = []
  const activeAllows = isApolloPilotCohortProcessingAllowed("active")
  const pausedBlocks = !isApolloPilotCohortProcessingAllowed("paused")
  const cancelledBlocks = !isApolloPilotCohortProcessingAllowed("cancelled")
  const draftBlocks = !isApolloPilotCohortProcessingAllowed("draft")

  if (!activeAllows) notes.push("active should allow processing")
  if (!pausedBlocks) notes.push("paused should block processing")
  if (!cancelledBlocks) notes.push("cancelled should block processing")
  if (!draftBlocks) notes.push("draft should block processing until activate")

  return { valid: notes.length === 0, notes }
}

export function resolveApollo25CompanyPilotVerdict(
  report: Pick<
    Apollo25CompanyPilotLaunchReport,
    "selection" | "preflight" | "checklist" | "lifecycle_controls_validated"
  >,
): "READY TO LAUNCH 25-COMPANY PILOT" | "NOT READY" {
  if (!report.lifecycle_controls_validated) return "NOT READY"
  if (report.selection.selected_count < 25) return "NOT READY"
  if (report.preflight.pilot_readiness_pct < 90) return "NOT READY"
  if (!report.checklist.all_automated_pass) return "NOT READY"
  return "READY TO LAUNCH 25-COMPANY PILOT"
}
