import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthRepRoster } from "@/lib/growth/assignment/rep-roster-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { getInboxThread } from "@/lib/growth/inbox/thread-repository"
import { listInboxAssignmentRules } from "@/lib/growth/inbox-team-ownership/inbox-assignment-rules-repository"
import type { GrowthInboxOwnerSuggestion } from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-types"
import { maskInboxOwnerLabel } from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-types"

async function countOpenThreadsForRep(admin: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("inbox_threads")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", userId)
    .in("thread_status", ["open", "waiting", "needs_review"])
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function suggestInboxThreadOwner(
  admin: SupabaseClient,
  threadId: string,
): Promise<GrowthInboxOwnerSuggestion | null> {
  const thread = await getInboxThread(admin, threadId, false)
  if (!thread) return null

  const [lead, rules, reps] = await Promise.all([
    fetchGrowthLeadById(admin, thread.lead_id),
    listInboxAssignmentRules(admin),
    listGrowthRepRoster(admin),
  ])

  const activeReps = reps.filter((rep) => rep.status === "active")

  for (const rule of rules.filter((entry) => entry.enabled)) {
    if (rule.classification && rule.classification !== thread.classification) continue
    if (rule.priorityTier && rule.priorityTier !== thread.priority_tier) continue

    if (rule.ruleType === "lead_owner" && lead?.assignedTo) {
      const rep = activeReps.find((entry) => entry.userId === lead.assignedTo)
      if (rep) {
        return {
          suggestedUserId: rep.userId,
          suggestedUserLabel: maskInboxOwnerLabel(rep.userId, rep.displayName, rep.email),
          ruleType: "lead_owner",
          reasons: ["lead_owner_match", `rule:${rule.id.slice(0, 8)}`],
          confidence: 85,
        }
      }
    }

    if (rule.ruleType === "specific_rep" && rule.targetUserId) {
      const rep = activeReps.find((entry) => entry.userId === rule.targetUserId)
      if (rep) {
        return {
          suggestedUserId: rep.userId,
          suggestedUserLabel: maskInboxOwnerLabel(rep.userId, rep.displayName, rep.email),
          ruleType: "specific_rep",
          reasons: ["specific_rep_rule", `rule:${rule.id.slice(0, 8)}`],
          confidence: 80,
        }
      }
    }

    if (rule.ruleType === "classification") {
      const rep = activeReps[0]
      if (rep) {
        return {
          suggestedUserId: rep.userId,
          suggestedUserLabel: maskInboxOwnerLabel(rep.userId, rep.displayName, rep.email),
          ruleType: "classification",
          reasons: ["classification_rule", `classification:${thread.classification}`],
          confidence: 65,
        }
      }
    }

    if (rule.ruleType === "round_robin" && activeReps.length > 0) {
      const counts = await Promise.all(
        activeReps.map(async (rep) => ({
          rep,
          openThreads: await countOpenThreadsForRep(admin, rep.userId),
        })),
      )
      counts.sort((a, b) => a.openThreads - b.openThreads || a.rep.roundRobinOrder - b.rep.roundRobinOrder)
      const winner = counts[0]?.rep
      if (winner) {
        return {
          suggestedUserId: winner.userId,
          suggestedUserLabel: maskInboxOwnerLabel(winner.userId, winner.displayName, winner.email),
          ruleType: "round_robin",
          reasons: ["round_robin_lowest_load", `open_threads:${counts[0]?.openThreads ?? 0}`],
          confidence: 70,
        }
      }
    }
  }

  if (lead?.assignedTo) {
    const rep = activeReps.find((entry) => entry.userId === lead.assignedTo)
    if (rep) {
      return {
        suggestedUserId: rep.userId,
        suggestedUserLabel: maskInboxOwnerLabel(rep.userId, rep.displayName, rep.email),
        ruleType: "lead_owner_fallback",
        reasons: ["lead_owner_fallback"],
        confidence: 60,
      }
    }
  }

  if (activeReps.length === 0) return null

  const counts = await Promise.all(
    activeReps.map(async (rep) => ({
      rep,
      openThreads: await countOpenThreadsForRep(admin, rep.userId),
    })),
  )
  counts.sort((a, b) => a.openThreads - b.openThreads || a.rep.roundRobinOrder - b.rep.roundRobinOrder)
  const fallback = counts[0]?.rep
  if (!fallback) return null

  return {
    suggestedUserId: fallback.userId,
    suggestedUserLabel: maskInboxOwnerLabel(fallback.userId, fallback.displayName, fallback.email),
    ruleType: "round_robin",
    reasons: ["default_round_robin"],
    confidence: 50,
  }
}
