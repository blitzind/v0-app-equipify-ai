/** GE-AIOS-MEMORY-RESOLVER-1A — Slice projection from canonical records (client-safe). */

import type {
  ActionMemorySlice,
  BusinessMemorySlice,
  CanonicalMemoryRecord,
  PersonalMemorySlice,
  RelationshipMemorySlice,
  SalesMemorySlice,
} from "@/lib/growth/lead-memory/canonical-human-memory-types"
import type { GrowthLeadMemoryProfileView } from "@/lib/growth/lead-memory/memory-types"

function uniqueStrings(values: Array<string | null | undefined>, limit = 8): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = (value ?? "").trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
    if (out.length >= limit) break
  }
  return out
}

function recordsForKind(records: CanonicalMemoryRecord[], kind: CanonicalMemoryRecord["humanMemoryKind"]): CanonicalMemoryRecord[] {
  return records.filter((record) => record.humanMemoryKind === kind)
}

export function buildBusinessMemorySlice(input: {
  records: CanonicalMemoryRecord[]
  companyName: string | null
  industry: string | null
  equipment: string[]
}): BusinessMemorySlice {
  const businessRecords = recordsForKind(input.records, "business_fact")
  const competitorRecords = input.records.filter((record) => record.memoryCategory === "competitor_signal")
  const softwareLines = businessRecords
    .filter((record) => /software|incumbent|using|servicetitan|platform|system/i.test(record.conclusion))
    .map((record) => record.conclusion)
  const expansionLines = businessRecords
    .filter((record) => /expansion|location|opening|site|depot/i.test(record.conclusion))
    .map((record) => record.conclusion)

  return {
    companyName: input.companyName,
    industry: input.industry,
    equipment: uniqueStrings(input.equipment),
    growthInitiatives: uniqueStrings(expansionLines),
    currentSoftware: uniqueStrings(softwareLines),
    competitiveLandscape: uniqueStrings([
      ...competitorRecords.map((record) => record.conclusion),
      ...businessRecords
        .filter((record) => /competitor|alternative|vendor/i.test(record.conclusion))
        .map((record) => record.conclusion),
    ]),
    operationalPriorities: uniqueStrings(
      businessRecords
        .filter((record) => /dispatch|coordination|workflow|operations|service/i.test(record.conclusion))
        .map((record) => record.conclusion),
    ),
    records: [...businessRecords, ...competitorRecords],
  }
}

export function buildPersonalMemorySlice(records: CanonicalMemoryRecord[]): PersonalMemorySlice {
  const personalRecords = recordsForKind(records, "personal_context")
  const styleRecords = recordsForKind(records, "communication_style")

  return {
    communicationStyle: uniqueStrings(styleRecords.map((record) => record.conclusion)),
    personalityNotes: uniqueStrings(
      personalRecords.filter((record) => /personality|tone|style|direct|formal/i.test(record.conclusion)).map((record) => record.conclusion),
    ),
    preferredTerminology: uniqueStrings(
      styleRecords.filter((record) => /term|call me|prefers/i.test(record.conclusion)).map((record) => record.conclusion),
    ),
    personalContext: uniqueStrings(personalRecords.map((record) => record.conclusion)),
    records: [...personalRecords, ...styleRecords],
  }
}

export function buildRelationshipMemorySlice(input: {
  records: CanonicalMemoryRecord[]
  profileView: GrowthLeadMemoryProfileView | null
  priorReplySummaries: string[]
  memoryOpenLoopSummaries: string[]
}): RelationshipMemorySlice {
  const relationship = input.profileView?.relationshipContext
  const salesRecords = input.records.filter(
    (record) =>
      record.humanMemoryKind === "sales_conclusion" ||
      (record.humanMemoryKind == null && record.memoryCategory === "buying_signal"),
  )

  return {
    stage: relationship?.relationshipStage ?? input.profileView?.profile?.relationshipStage ?? null,
    summary: input.profileView?.profile?.summary ?? relationship?.relationshipSummary ?? null,
    engagementTrend: relationship?.engagementTrend ?? null,
    trustSignals: uniqueStrings(relationship?.topSignals ?? []),
    champions: uniqueStrings(
      (input.profileView?.committeeMembers ?? [])
        .filter((member) => member.influenceLevel === "high" || member.influenceLevel === "decision_maker")
        .map((member) => member.memberLabel),
    ),
    blockers: uniqueStrings(
      input.records
        .filter((record) => record.memoryCategory === "risk_signal" || record.memoryCategory === "objection")
        .map((record) => record.conclusion),
    ),
    meetingHistory: uniqueStrings(
      input.records
        .filter((record) => record.humanMemoryKind == null && record.memoryCategory === "meeting_signal")
        .map((record) => record.conclusion),
    ),
    commitments: uniqueStrings([
      ...input.memoryOpenLoopSummaries,
      ...recordsForKind(input.records, "action_commitment").map((record) => record.conclusion),
    ]),
    records: salesRecords,
  }
}

export function buildSalesMemorySlice(records: CanonicalMemoryRecord[]): SalesMemorySlice {
  const salesRecords = records.filter(
    (record) =>
      record.humanMemoryKind === "sales_conclusion" ||
      record.memoryCategory === "buying_signal" ||
      record.memoryCategory === "objection" ||
      record.memoryCategory === "budget_signal" ||
      record.memoryCategory === "timeline_signal",
  )

  return {
    painPoints: uniqueStrings(
      salesRecords.filter((record) => /pain|pressure|challenge|scattered|handoff/i.test(record.conclusion)).map((record) => record.conclusion),
    ),
    businessPressures: uniqueStrings(
      salesRecords.filter((record) => /pressure|urgency|capacity|growth/i.test(record.conclusion)).map((record) => record.conclusion),
    ),
    objections: uniqueStrings(
      salesRecords.filter((record) => record.memoryCategory === "objection").map((record) => record.conclusion),
    ),
    buyingTriggers: uniqueStrings(
      salesRecords.filter((record) => record.memoryCategory === "buying_signal").map((record) => record.conclusion),
    ),
    questionsThatWorked: [],
    questionsThatFailed: [],
    records: salesRecords,
  }
}

export function buildActionMemorySlice(records: CanonicalMemoryRecord[]): ActionMemorySlice {
  const actionRecords = recordsForKind(records, "action_commitment")
  const open = actionRecords.filter((record) => !/fulfilled|completed|done/i.test(record.conclusion))

  return {
    openCommitments: uniqueStrings(open.map((record) => record.conclusion)),
    promisedFollowUps: uniqueStrings(
      open.filter((record) => /follow|call back|check in/i.test(record.conclusion)).map((record) => record.conclusion),
    ),
    pendingDocuments: uniqueStrings(
      open.filter((record) => /checklist|document|send|deck|proposal/i.test(record.conclusion)).map((record) => record.conclusion),
    ),
    requestedInformation: uniqueStrings(
      open.filter((record) => /information|details|pricing|quote/i.test(record.conclusion)).map((record) => record.conclusion),
    ),
    records: actionRecords,
  }
}
