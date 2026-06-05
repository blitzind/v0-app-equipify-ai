/** Prospect Search workspace controlled bulk enqueue (7.PS-FC). PS-C execute path only. */

import { resolveProspectSearchCanonicalResearchContext } from "@/lib/growth/prospect-search/prospect-search-actionable-research"
import { executeProspectSearchActionableResearch } from "@/lib/growth/prospect-search/prospect-search-actionable-research-execute"
import { executeProspectSearchHumanAcquisition } from "@/lib/growth/prospect-search/prospect-search-human-acquisition-execute"
import { prospectSearchSelectionKey } from "@/lib/growth/prospect-search/prospect-search-selection"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  planProspectSearchWorkspaceBulkAction,
  PROSPECT_SEARCH_WORKSPACE_BULK_ACTION_TO_PS_C_KIND,
} from "@/lib/growth/prospect-search/prospect-search-workspace"
import {
  prospectSearchWorkspaceBulkActionKindForQueue,
} from "@/lib/growth/prospect-search/prospect-search-workspace-execution-preview"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_QA_MARKER,
  PROSPECT_SEARCH_WORKSPACE_BULK_EXECUTION_MAX_ACCOUNTS,
  type ProspectSearchWorkspaceBulkAccountResult,
  type ProspectSearchWorkspaceBulkExecutionResult,
  type ProspectSearchWorkspaceExecutionPreview,
  type ProspectSearchWorkspaceQueueId,
} from "@/lib/growth/prospect-search/prospect-search-workspace-types"

const ALREADY_SATISFIED_REASONS = new Set([
  "verified_email_exists",
  "verified_phone_exists",
  "verified_profile_exists",
  "has_verified_intelligence",
  "skip_verified_intelligence",
  "active_job_exists",
])

export type ProspectSearchWorkspaceBulkExecutionValidation = {
  allowed: boolean
  reason: string | null
  executable_count: number
}

export function validateProspectSearchWorkspaceBulkExecution(input: {
  selected_company_keys: string[]
  preview: ProspectSearchWorkspaceExecutionPreview | null
  queue_id: ProspectSearchWorkspaceQueueId | null
  companies: GrowthProspectSearchCompanyResult[]
}): ProspectSearchWorkspaceBulkExecutionValidation {
  if (input.selected_company_keys.length === 0) {
    return { allowed: false, reason: "Select at least one account to queue research.", executable_count: 0 }
  }
  if (!input.preview) {
    return { allowed: false, reason: "Execution preview is required before bulk enqueue.", executable_count: 0 }
  }
  if (!input.queue_id) {
    return {
      allowed: false,
      reason: "Select a research or coverage queue to determine the Growth Engine job lane.",
      executable_count: 0,
    }
  }
  const bulkKind = prospectSearchWorkspaceBulkActionKindForQueue(input.queue_id)
  if (!bulkKind) {
    return {
      allowed: false,
      reason: "This queue does not map to a supported Growth Engine bulk job — choose another queue.",
      executable_count: 0,
    }
  }
  if (input.selected_company_keys.length > PROSPECT_SEARCH_WORKSPACE_BULK_EXECUTION_MAX_ACCOUNTS) {
    return {
      allowed: false,
      reason: `Bulk enqueue is limited to ${PROSPECT_SEARCH_WORKSPACE_BULK_EXECUTION_MAX_ACCOUNTS} accounts per action.`,
      executable_count: 0,
    }
  }

  const bulkPlan = planProspectSearchWorkspaceBulkAction({
    companies: input.companies,
    action_kind: bulkKind,
    company_keys: input.selected_company_keys,
  })

  if (bulkPlan.executable_count === 0) {
    return {
      allowed: false,
      reason: "No selected accounts are eligible to enqueue — resolve blocked reasons in the preview.",
      executable_count: 0,
    }
  }

  return { allowed: true, reason: null, executable_count: bulkPlan.executable_count }
}

export function logProspectSearchWorkspaceBulkExecutionSummary(
  result: ProspectSearchWorkspaceBulkExecutionResult,
): void {
  console.info(
    JSON.stringify({
      source: "prospect-search",
      event: "workspace_bulk_execution_completed",
      ts: new Date().toISOString(),
      queue_id: result.queue_id,
      action_kind: result.action_kind,
      requested_count: result.requested_count,
      enqueued_count: result.enqueued_count,
      already_satisfied_count: result.already_satisfied_count,
      skipped_count: result.skipped_count,
      failed_count: result.failed_count,
    }),
  )
}

function classifyExecuteOutcome(input: {
  ok: boolean
  enqueued: boolean
  reason?: string | null
  message: string
}): ProspectSearchWorkspaceBulkAccountResult["status"] {
  if (input.enqueued) return "enqueued"
  if (
    input.ok &&
    !input.enqueued &&
    (input.reason ? ALREADY_SATISFIED_REASONS.has(input.reason) : false)
  ) {
    return "already_satisfied"
  }
  if (
    input.ok &&
    !input.enqueued &&
    /already|verified|present|not queued/i.test(input.message)
  ) {
    return "already_satisfied"
  }
  if (!input.ok) return "failed"
  return "already_satisfied"
}

function companyByKey(
  companies: GrowthProspectSearchCompanyResult[],
): Map<string, GrowthProspectSearchCompanyResult> {
  return new Map(companies.map((row) => [prospectSearchSelectionKey(row), row]))
}

export async function executeProspectSearchWorkspaceBulkResearch(input: {
  companies: GrowthProspectSearchCompanyResult[]
  company_keys: string[]
  queue_id: ProspectSearchWorkspaceQueueId
  preview: ProspectSearchWorkspaceExecutionPreview
}): Promise<ProspectSearchWorkspaceBulkExecutionResult> {
  const validation = validateProspectSearchWorkspaceBulkExecution({
    selected_company_keys: input.company_keys,
    preview: input.preview,
    queue_id: input.queue_id,
    companies: input.companies,
  })
  if (!validation.allowed) {
    throw new Error(validation.reason ?? "Bulk execution is not allowed.")
  }

  const bulkKind = prospectSearchWorkspaceBulkActionKindForQueue(input.queue_id)!
  const psActionKind = PROSPECT_SEARCH_WORKSPACE_BULK_ACTION_TO_PS_C_KIND[bulkKind]
  const bulkPlan = planProspectSearchWorkspaceBulkAction({
    companies: input.companies,
    action_kind: bulkKind,
    company_keys: input.company_keys,
  })

  const companyIndex = companyByKey(input.companies)
  const executableKeys = new Set(bulkPlan.executable_accounts.map((row) => row.company_key))
  const blockedByKey = new Map(
    bulkPlan.blocked_accounts.map((row) => [row.company_key, row.reason] as const),
  )

  const per_account_results: ProspectSearchWorkspaceBulkAccountResult[] = []
  const blocked_reasons: string[] = []

  for (const company_key of input.company_keys) {
    const company = companyIndex.get(company_key)
    const company_name = company?.company_name ?? company_key

    if (!company) {
      per_account_results.push({
        company_key,
        company_name,
        status: "skipped_blocked",
        message: "Company row not found in hydrated results.",
        lane: null,
        job_id: null,
        reason: "company_not_found",
      })
      blocked_reasons.push(`${company_name}: company not found`)
      continue
    }

    if (!executableKeys.has(company_key)) {
      const reason =
        blockedByKey.get(company_key) ?? "Blocked by execution preview — canonical linkage required."
      per_account_results.push({
        company_key,
        company_name,
        status: "skipped_blocked",
        message: reason,
        lane: null,
        job_id: null,
        reason: "preview_blocked",
      })
      blocked_reasons.push(`${company_name}: ${reason}`)
      continue
    }

    const executeResult =
      bulkKind === "human_acquisition"
        ? await executeProspectSearchHumanAcquisition({
            companyCandidateId: company.id,
            canonicalCompanyId:
              resolveProspectSearchCanonicalResearchContext(company).canonical_company_id,
          })
        : await executeProspectSearchActionableResearch({
            company,
            actionKind: psActionKind,
            companyCandidateId: company.id,
            personId:
              bulkPlan.executable_accounts.find((row) => row.company_key === company_key)
                ?.canonical_person_id ?? null,
          })

    if (
      executeResult.lane === "legacy_contact_discovery" &&
      bulkKind !== "human_acquisition"
    ) {
      per_account_results.push({
        company_key,
        company_name,
        status: "skipped_blocked",
        message: "Legacy contact discovery is not used for workspace bulk enqueue.",
        lane: null,
        job_id: null,
        reason: "legacy_lane_blocked",
      })
      blocked_reasons.push(`${company_name}: legacy lane blocked`)
      continue
    }

    const status = classifyExecuteOutcome(executeResult)
    per_account_results.push({
      company_key,
      company_name,
      status,
      message: executeResult.message,
      lane: executeResult.lane,
      job_id: executeResult.job_id ?? null,
      reason: executeResult.reason ?? null,
    })
  }

  const result: ProspectSearchWorkspaceBulkExecutionResult = {
    qa_marker: GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_QA_MARKER,
    queue_id: input.queue_id,
    action_kind: bulkKind,
    requested_count: input.company_keys.length,
    executable_count: bulkPlan.executable_count,
    skipped_count: per_account_results.filter((row) => row.status === "skipped_blocked").length,
    enqueued_count: per_account_results.filter((row) => row.status === "enqueued").length,
    already_satisfied_count: per_account_results.filter(
      (row) => row.status === "already_satisfied",
    ).length,
    failed_count: per_account_results.filter((row) => row.status === "failed").length,
    blocked_reasons: [...new Set(blocked_reasons)],
    per_account_results,
  }

  logProspectSearchWorkspaceBulkExecutionSummary(result)
  return result
}
