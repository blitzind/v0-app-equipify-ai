import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getCallCopilotBriefing, listRecentGrowthCallCopilotSessions } from "@/lib/growth/call-copilot-repository"
import type { GrowthCallCopilotObjectionEntry, GrowthCallCopilotSession } from "@/lib/growth/call-copilot-types"

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

function normalizeObjectionKey(text: string): string {
  return text.trim().toLowerCase().slice(0, 80)
}

function countObjections(sessions: GrowthCallCopilotSession[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const session of sessions) {
    for (const entry of session.detectedObjections) {
      const key = normalizeObjectionKey(entry.input)
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
}

function buildObjectionTrendShift(recent: Map<string, number>, prior: Map<string, number>) {
  const keys = new Set([...recent.keys(), ...prior.keys()])
  const shifts: Array<{ objection: string; recentCount: number; priorCount: number; delta: number }> = []
  for (const key of keys) {
    const recentCount = recent.get(key) ?? 0
    const priorCount = prior.get(key) ?? 0
    const delta = recentCount - priorCount
    if (recentCount === 0 && priorCount === 0) continue
    shifts.push({ objection: key, recentCount, priorCount, delta })
  }
  return shifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.recentCount - a.recentCount).slice(0, 12)
}

export async function fetchGrowthCallCopilotDashboard(admin: SupabaseClient) {
  const now = Date.now()
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since14d = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()

  const sessions = await listRecentGrowthCallCopilotSessions(admin, 200)
  const activeSessions = sessions.filter((session) => session.status === "pre_call" || session.status === "in_call")

  const recentSummaries = sessions
    .filter((session) => session.status === "completed" && session.postCallSummary)
    .slice(0, 20)

  const recentWindow = sessions.filter((session) => session.updatedAt >= since7d)
  const priorWindow = sessions.filter((session) => session.updatedAt >= since14d && session.updatedAt < since7d)

  const topObjections = [...countObjections(recentWindow).entries()]
    .map(([objection, count]) => ({ objection, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const objectionTrendShift = buildObjectionTrendShift(
    countObjections(recentWindow),
    countObjections(priorWindow),
  )

  const buyingSignalCounts = new Map<string, number>()
  const commitmentSignalCounts = new Map<string, number>()
  for (const session of recentWindow) {
    for (const signal of session.detectedBuyingSignals) {
      buyingSignalCounts.set(signal.key, (buyingSignalCounts.get(signal.key) ?? 0) + 1)
    }
    for (const signal of session.detectedCommitmentSignals) {
      commitmentSignalCounts.set(signal.key, (commitmentSignalCounts.get(signal.key) ?? 0) + 1)
    }
  }

  const followUpNeeded = sessions.filter(
    (session) =>
      session.status === "completed" &&
      !session.dispositionApprovedAt &&
      session.suggestedDisposition === "follow_up_later",
  )

  const leadIds = [...new Set(activeSessions.map((session) => session.leadId))]
  const companyByLeadId = new Map<string, string>()
  if (leadIds.length > 0) {
    const { data: leads, error } = await growthLeadsTable(admin)
      .select("id, company_name")
      .in("id", leadIds)
    if (error) throw new Error(error.message)
    for (const row of leads ?? []) {
      companyByLeadId.set(row.id as string, row.company_name as string)
    }
  }

  const activeWithCompany = activeSessions.map((session) => ({
    ...session,
    companyName: companyByLeadId.get(session.leadId) ?? "Unknown",
    highRiskCall: getCallCopilotBriefing(session)?.highRiskCall ?? false,
  }))

  const summaryLeadIds = [...new Set(recentSummaries.map((session) => session.leadId))]
  if (summaryLeadIds.length > 0) {
    const missing = summaryLeadIds.filter((id) => !companyByLeadId.has(id))
    if (missing.length > 0) {
      const { data: leads, error } = await growthLeadsTable(admin).select("id, company_name").in("id", missing)
      if (error) throw new Error(error.message)
      for (const row of leads ?? []) {
        companyByLeadId.set(row.id as string, row.company_name as string)
      }
    }
  }

  const summariesWithCompany = recentSummaries.map((session) => ({
    ...session,
    companyName: companyByLeadId.get(session.leadId) ?? "Unknown",
  }))

  return {
    activeSessions: activeWithCompany,
    recentSummaries: summariesWithCompany,
    topObjections,
    objectionTrendShift,
    buyingSignalCounts: [...buyingSignalCounts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count),
    commitmentSignalCounts: [...commitmentSignalCounts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count),
    followUpNeeded: followUpNeeded.slice(0, 20),
    stats: {
      activeCount: activeSessions.length,
      completed7d: recentWindow.filter((session) => session.status === "completed").length,
      highRiskActive: activeWithCompany.filter((session) => session.highRiskCall).length,
      avgOutcomeConfidence:
        recentWindow.length > 0
          ? Math.round(
              recentWindow.reduce((sum, session) => sum + session.callOutcomeConfidence, 0) / recentWindow.length,
            )
          : 0,
    },
  }
}

export type GrowthCallCopilotDashboard = Awaited<ReturnType<typeof fetchGrowthCallCopilotDashboard>>

export function flattenObjectionEntries(entries: GrowthCallCopilotObjectionEntry[]): string[] {
  return entries.map((entry) => entry.input).filter(Boolean)
}
