/** Assemble full 25-company pilot launch certification report — client-safe. */

import { buildApollo25CompanyPilotEligibilityDiagnostic } from "@/lib/growth/apollo/apollo-25-company-pilot-eligibility-diagnostic"
import {
  buildApollo25CompanyPilotLaunchChecklist,
  resolveApollo25CompanyPilotVerdict,
  validateApollo25CompanyPilotLifecycleControls,
} from "@/lib/growth/apollo/apollo-25-company-pilot-launch-checklist"
import { runApollo25CompanyPilotPreflight } from "@/lib/growth/apollo/apollo-25-company-pilot-preflight"
import { selectApollo25CompanyPilotCandidates } from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import type { Apollo25CompanyPilotSelectionMode } from "@/lib/growth/apollo/apollo-25-company-pilot-skip-reasons"
import {
  APOLLO_25_COMPANY_PILOT_QA_MARKER,
  type Apollo25CompanyPilotEligibilityDiagnostic,
  type Apollo25CompanyPilotLaunchReport,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"
import { estimateApollo25CompanyPilotWorkload } from "@/lib/growth/apollo/apollo-25-company-pilot-workload"
import type { ApolloPilotCohortStatus } from "@/lib/growth/apollo/apollo-pilot-types"
import type { ApolloPrimaryContactOperatorReviewRow } from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"
import type { Apollo25CompanyPilotSelectionInput } from "@/lib/growth/apollo/apollo-25-company-pilot-selection"

export function resolveApollo25CompanyPilotEnvGatesOk(env: NodeJS.ProcessEnv = process.env): boolean {
  const livePilotEnabled =
    env.GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED === "true" ||
    env.GROWTH_APOLLO_AI_2_LIVE_PILOT_ENABLED === "true" ||
    env.GROWTH_APOLLO_AI_4_LIVE_PILOT_ENABLED === "true"
  if (!livePilotEnabled) return true
  return env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK === "1"
}

export function buildApollo25CompanyPilotRootCauseSummary(
  diagnostic: Apollo25CompanyPilotEligibilityDiagnostic,
): string {
  const { funnel_counts, skipped_reason_counts, pilot_selection_mode } = diagnostic

  if (funnel_counts.companies_eligible_greenfield >= diagnostic.target_count && pilot_selection_mode === "greenfield") {
    return "Eligible greenfield pool meets target under production rules."
  }

  if (
    pilot_selection_mode === "existing_pipeline_revalidation" &&
    funnel_counts.companies_eligible_revalidation >= diagnostic.target_count
  ) {
    return "Eligible revalidation pool meets target for existing pipeline companies."
  }

  const topReason = Object.entries(skipped_reason_counts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])[0]

  const parts: string[] = [
    `Apollo discovered ${funnel_counts.total_apollo_discovered_companies} companies; greenfield eligible ${funnel_counts.companies_eligible_greenfield}, revalidation eligible ${funnel_counts.companies_eligible_revalidation}.`,
  ]

  if (topReason) {
    parts.push(`Primary blocker: ${topReason[0]} (${topReason[1]} companies).`)
  }

  if (funnel_counts.total_apollo_discovered_companies < diagnostic.target_count) {
    parts.push("Insufficient Apollo discovery footprint for a 25-company pilot.")
  }

  return parts.join(" ")
}

export function buildApollo25CompanyPilotLaunchReport(input: {
  selection_inputs: Apollo25CompanyPilotSelectionInput[]
  contacts_by_company?: Record<string, ApolloPrimaryContactOperatorReviewRow>
  production_threshold?: number
  pilot_selection_mode?: Apollo25CompanyPilotSelectionMode
  migration_present: boolean
  cohort_status: ApolloPilotCohortStatus | null
  cohort_creation?: Apollo25CompanyPilotLaunchReport["cohort_creation"]
  suppressions_checked?: boolean
  operator_assigned?: boolean
  env_gates_ok?: boolean
  computed_at?: string
}): Apollo25CompanyPilotLaunchReport {
  const production_threshold = input.production_threshold ?? 70
  const pilot_selection_mode = input.pilot_selection_mode ?? "greenfield"

  const selection = selectApollo25CompanyPilotCandidates(input.selection_inputs, {
    production_threshold: input.production_threshold,
    pilot_selection_mode,
  })

  const eligibility_diagnostic = buildApollo25CompanyPilotEligibilityDiagnostic(input.selection_inputs, {
    production_threshold,
    pilot_selection_mode,
    target_count: selection.target_count,
  })

  const root_cause_summary = buildApollo25CompanyPilotRootCauseSummary(eligibility_diagnostic)

  const contacts_by_company = input.contacts_by_company ?? {}
  for (const row of selection.selected) {
    if (!contacts_by_company[row.company_candidate_id]) {
      const picked = input.selection_inputs.find((c) => c.company_candidate_id === row.company_candidate_id)
      const contact =
        picked?.contacts.find(
          (c) =>
            c.company_contact_id === row.selected_contact.company_contact_id ||
            c.contact_candidate_id === row.selected_contact.contact_candidate_id,
        ) ?? picked?.contacts[0]
      if (contact) contacts_by_company[row.company_candidate_id] = contact
    }
  }

  const preflight = runApollo25CompanyPilotPreflight({
    selected: selection.selected,
    contacts_by_company,
  })

  const suppressions_checked =
    input.suppressions_checked ??
    selection.selected.every((row) => row.suppression_status === "clear")

  const checklist = buildApollo25CompanyPilotLaunchChecklist({
    migration_present: input.migration_present,
    cohort_status: input.cohort_status,
    selection,
    preflight,
    suppressions_checked,
    operator_assigned: input.operator_assigned ?? false,
    env_gates_ok: input.env_gates_ok ?? resolveApollo25CompanyPilotEnvGatesOk(),
  })

  const lifecycle = validateApollo25CompanyPilotLifecycleControls()
  const workload = estimateApollo25CompanyPilotWorkload(selection)

  const partial: Omit<Apollo25CompanyPilotLaunchReport, "verdict" | "recommendations"> = {
    qa_marker: APOLLO_25_COMPANY_PILOT_QA_MARKER,
    computed_at: input.computed_at ?? new Date().toISOString(),
    root_cause_summary,
    eligibility_diagnostic,
    selection,
    preflight,
    cohort_creation: input.cohort_creation ?? {
      cohort_id: null,
      cohort_name: null,
      status: null,
      company_count: 0,
      created: false,
    },
    workload,
    checklist,
    lifecycle_controls_validated: lifecycle.valid,
    no_outreach_side_effects: true,
  }

  const verdict = resolveApollo25CompanyPilotVerdict(partial)
  const recommendations: string[] = [...eligibility_diagnostic.remediation]

  if (selection.selected_count < selection.target_count) {
    recommendations.push(
      `Expand eligible pool: only ${selection.selected_count}/${selection.target_count} companies pass production rules in ${pilot_selection_mode} mode.`,
    )
  }
  if (preflight.pilot_readiness_pct < 100) {
    recommendations.push("Resolve per-company preflight blockers before activate.")
  }
  if (!input.operator_assigned) {
    recommendations.push("Assign primary operator before cohort activation.")
  }
  if (!lifecycle.valid) {
    recommendations.push(...lifecycle.notes)
  }
  if (verdict === "READY TO LAUNCH 25-COMPANY PILOT") {
    recommendations.push("Activate cohort only after operator sign-off; monitor Pilot Operations daily.")
  }

  return { ...partial, verdict, recommendations }
}
