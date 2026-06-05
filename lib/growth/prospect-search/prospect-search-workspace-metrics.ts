/** Prospect Search workspace worklist metrics (7.PS-FB). Derived only. */

import {
  countProspectSearchWorkspacePreviewBlocked,
  countProspectSearchWorkspacePreviewExecutable,
} from "@/lib/growth/prospect-search/prospect-search-workspace-execution-preview"
import type {
  ProspectSearchWorkspaceExecutionPreview,
  ProspectSearchWorkspaceWorklistMetrics,
} from "@/lib/growth/prospect-search/prospect-search-workspace-types"

export function buildProspectSearchWorkspaceWorklistMetrics(input: {
  visible_company_keys: string[]
  selected_company_keys: string[]
  preview: ProspectSearchWorkspaceExecutionPreview | null
}): ProspectSearchWorkspaceWorklistMetrics {
  const visible_accounts = input.visible_company_keys.length
  const selected_accounts = input.selected_company_keys.length

  if (!input.preview || selected_accounts === 0) {
    return {
      visible_accounts,
      selected_accounts,
      executable_accounts: 0,
      blocked_accounts: 0,
    }
  }

  return {
    visible_accounts,
    selected_accounts,
    executable_accounts: countProspectSearchWorkspacePreviewExecutable(input.preview),
    blocked_accounts: countProspectSearchWorkspacePreviewBlocked(input.preview),
  }
}
