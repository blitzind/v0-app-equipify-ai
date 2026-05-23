import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { detectPlaybookApprovedConflicts } from "@/lib/growth/ai-copilot-playbook-conflicts"
import {
  approveGrowthAiCopilotPlaybookDraftRule,
  fetchGrowthAiCopilotPlaybookDraftRuleById,
  insertGrowthAiCopilotPlaybookEffectiveness,
  listActiveGrowthAiCopilotPlaybookApprovedRules,
  updateGrowthAiCopilotPlaybookDraftRuleStatus,
} from "@/lib/growth/ai-copilot-playbook-repository"
import type { GrowthAiCopilotPlaybookApprovedRule } from "@/lib/growth/ai-copilot-playbook-types"

export async function approveGrowthAiCopilotPlaybookDraft(
  admin: SupabaseClient,
  input: { draftId: string; actingUserId: string },
): Promise<
  | { ok: true; approvedRule: GrowthAiCopilotPlaybookApprovedRule; conflicts: ReturnType<typeof detectPlaybookApprovedConflicts> }
  | { ok: false; code: string; message: string }
> {
  const draft = await fetchGrowthAiCopilotPlaybookDraftRuleById(admin, input.draftId)
  if (!draft) return { ok: false, code: "draft_not_found", message: "Draft rule not found." }
  if (draft.status !== "draft") {
    return { ok: false, code: "draft_not_reviewable", message: "Draft rule is no longer pending review." }
  }

  const approvedRule = await approveGrowthAiCopilotPlaybookDraftRule(admin, {
    draft,
    approvedBy: input.actingUserId,
  })

  await updateGrowthAiCopilotPlaybookDraftRuleStatus(admin, draft.id, {
    status: "approved",
    reviewedBy: input.actingUserId,
  })

  const activeRules = await listActiveGrowthAiCopilotPlaybookApprovedRules(admin)
  const conflicts = detectPlaybookApprovedConflicts(activeRules)

  await insertGrowthAiCopilotPlaybookEffectiveness(admin, {
    approvedRuleId: approvedRule.id,
    sourceId: approvedRule.sourceId,
    outcome: "approved",
    category: approvedRule.category,
    effectivenessScore: 75,
    metadata: { draftRuleId: draft.id },
  })

  if (conflicts.length > 0) {
    await insertGrowthAiCopilotPlaybookEffectiveness(admin, {
      approvedRuleId: approvedRule.id,
      sourceId: approvedRule.sourceId,
      outcome: "conflict_detected",
      category: approvedRule.category,
      metadata: { conflicts },
    })
  }

  return { ok: true, approvedRule, conflicts }
}

export async function rejectGrowthAiCopilotPlaybookDraft(
  admin: SupabaseClient,
  input: { draftId: string; actingUserId: string },
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const draft = await fetchGrowthAiCopilotPlaybookDraftRuleById(admin, input.draftId)
  if (!draft) return { ok: false, code: "draft_not_found", message: "Draft rule not found." }
  if (draft.status !== "draft") {
    return { ok: false, code: "draft_not_reviewable", message: "Draft rule is no longer pending review." }
  }

  await updateGrowthAiCopilotPlaybookDraftRuleStatus(admin, draft.id, {
    status: "rejected",
    reviewedBy: input.actingUserId,
  })

  await insertGrowthAiCopilotPlaybookEffectiveness(admin, {
    sourceId: draft.sourceId,
    outcome: "rejected",
    category: draft.category,
    effectivenessScore: 0,
    metadata: { draftRuleId: draft.id },
  })

  return { ok: true }
}
