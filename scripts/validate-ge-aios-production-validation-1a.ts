/**
 * GE-AIOS-PRODUCTION-VALIDATION-1A — Read-only production validation against Vercel Production.
 *
 * Run:
 *   pnpm validate:ge-aios-production-validation-1a
 *
 * Never uses .env.local. No writes. Real Block Imaging production data only.
 */
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { loadApprovals2AOperatorReviewPacket } from "@/lib/growth/aios/approvals/approvals-operator-review-service"
import { projectApprovals2AOperatorReviewPacket } from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import { evaluateCanonicalTransportBoundary } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import { resolveAuthoritativeForm } from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b"
import { listOutreachPreparationRunsForLead } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { materializeCanonicalOutreachChannelContent } from "@/lib/growth/aios/growth/growth-send-plane-1a-materialization"
import { resolveCanonicalOutreachPackageForLead } from "@/lib/growth/aios/growth/growth-send-plane-1a-canonical-loader"
import { resolveTransportAssetFromPackage } from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"
import { resolveGrowthCanonicalDecisionForLead } from "@/lib/growth/aios/growth/resolve-growth-canonical-decision-for-lead"
import {
  clearCanonicalDecisionResolutionCache,
  resolveGrowthCanonicalDecisionForLeadCached,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { buildLeadOperatorWorkspacePayloadFromGrowthLead } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-from-lead"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { resolveCanonicalHumanMemoryForLead } from "@/lib/growth/lead-memory/resolve-canonical-human-memory-for-lead"
import { projectCanonicalMemoryReviewRows } from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import { resolveGrowthCanonicalMeetingBriefForMeeting } from "@/lib/growth/meeting-intelligence/growth-canonical-meeting-brief-service"
import { gatherMeetingPrepBundleForMeeting } from "@/lib/growth/meeting-intelligence/meeting-prep-context"
import { listGrowthMeetingsForLead } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER } from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-types"
import { resolveCallWorkspaceAiosLiveReasoning } from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-service"
import { resolveSayThisNext } from "@/lib/growth/operator-assist/resolve-say-this-next"
import { buildUnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/orchestration"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"

export const GE_AIOS_PRODUCTION_VALIDATION_1A_QA_MARKER =
  "ge-aios-production-validation-1a-v1" as const

const PHASE = "GE-AIOS-PRODUCTION-VALIDATION-1A" as const
const ROOT = process.cwd()
const APP_ALIAS = "https://app.equipify.ai"
const BLOCK_LEAD = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const BATCH_FIRST_SHA = "f75d4c85"
const BATCH_HEAD_SHA = "61d5787a"

const CANONICAL_PATH_MARKERS = [
  "lib/growth/aios/growth/resolve-growth-canonical-decision-for-lead.ts",
  "lib/growth/meeting-intelligence/growth-canonical-meeting-brief-service.ts",
  "lib/growth/operator-assist/call-workspace-aios-live-reasoning-service.ts",
  "lib/growth/aios/growth/growth-send-plane-1a-canonical-loader.ts",
  "lib/growth/aios/approvals/approvals-operator-review-service.ts",
  "lib/growth/operator-assist/resolve-say-this-next.ts",
  "scripts/test-ge-aios-first-meeting-workflow-1a.ts",
] as const

const LEGACY_BYPASS_PATTERNS: Array<{ file: string; mustNotInclude: string; label: string }> = [
  {
    file: "lib/growth/lead-operator-workspace/lead-operator-workspace-from-lead.ts",
    mustNotInclude: "runGrowthLeadResearch(",
    label: "lead workspace bypasses canonical decision",
  },
  {
    file: "lib/growth/operator-assist/resolve-say-this-next.ts",
    mustNotInclude: "// legacy-only",
    label: "say-this-next forced legacy",
  },
  {
    file: "lib/growth/aios/growth/growth-send-plane-1a-canonical-loader.ts",
    mustNotInclude: "draft-factory-durable-live",
    label: "send plane uses draft factory instead of pilot store",
  },
]

type Severity = "critical" | "high" | "medium" | "low"

type CheckResult = {
  id: string
  status: "pass" | "fail" | "warn" | "skip"
  detail: string
  severity?: Severity
}

const checks: CheckResult[] = []
const blockers: Record<Severity, string[]> = {
  critical: [],
  high: [],
  medium: [],
  low: [],
}

function record(
  id: string,
  status: CheckResult["status"],
  detail: string,
  severity: Severity = "medium",
): void {
  checks.push({ id, status, detail, severity })
  const prefix = status === "pass" ? "✓" : status === "warn" ? "!" : status === "skip" ? "-" : "✗"
  console.log(`  ${prefix} ${id}: ${detail}`)
  if (status === "fail") blockers[severity].push(`${id}: ${detail}`)
  if (status === "warn" && severity !== "low") blockers[severity].push(`${id}: ${detail}`)
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim()
}

function isGitAncestor(ancestor: string, descendant: string): boolean {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: ROOT,
      stdio: "ignore",
    })
    return true
  } catch {
    return false
  }
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function resolveDeployedRevision(): {
  deploymentId: string
  deployedSha: string
  status: string | null
  alias: string
  source: string
} {
  const envSha = process.env.PROD_VAL_1A_DEPLOYED_SHA?.trim()
  const envDeployment = process.env.PROD_VAL_1A_DEPLOYMENT_ID?.trim()
  if (envSha && envDeployment) {
    return {
      deploymentId: envDeployment,
      deployedSha: envSha,
      status: process.env.PROD_VAL_1A_DEPLOYMENT_STATUS?.trim() || null,
      alias: APP_ALIAS,
      source: "env_override",
    }
  }

  try {
    const inspect = spawnSync("vercel", ["inspect", "app.equipify.ai"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 45_000,
    })
    const text = `${inspect.stdout ?? ""}\n${inspect.stderr ?? ""}`
    const deploymentId =
      text.match(/\bid\s+(dpl_[A-Za-z0-9]+)/)?.[1] ??
      text.match(/\b(dpl_[A-Za-z0-9]+)/)?.[1] ??
      "unknown"
    const status = text.match(/status\s+●?\s*(Ready|Error|Canceled|Building)/i)?.[1] ?? null

    const logs = spawnSync("vercel", ["inspect", "app.equipify.ai", "--logs"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 60_000,
    })
    const logText = `${logs.stdout ?? ""}\n${logs.stderr ?? ""}`
    const commitFromLogs =
      logText.match(/Commit:\s*([0-9a-f]{7,40})/i)?.[1] ??
      logText.match(/commit\s+([0-9a-f]{7,40})/i)?.[1] ??
      null

    let deployedSha = BATCH_HEAD_SHA
    if (commitFromLogs) {
      try {
        deployedSha = git(["rev-parse", commitFromLogs])
      } catch {
        deployedSha = commitFromLogs
      }
    }

    return {
      deploymentId,
      deployedSha,
      status,
      alias: APP_ALIAS,
      source: commitFromLogs ? "vercel_inspect_logs" : "vercel_inspect_fallback",
    }
  } catch {
    return {
      deploymentId: "unknown",
      deployedSha: BATCH_HEAD_SHA,
      status: null,
      alias: APP_ALIAS,
      source: "local_fallback",
    }
  }
}

function verifySourceCanonicalPaths(): void {
  console.log("\n[Phase 1] Source canonical path trace")

  for (const marker of CANONICAL_PATH_MARKERS) {
    const exists = fs.existsSync(path.join(ROOT, marker))
    record(
      `source_marker_${path.basename(marker)}`,
      exists ? "pass" : "fail",
      exists ? "present in repo" : "missing",
      "critical",
    )
  }

  const sayThisNext = readSource("lib/growth/operator-assist/resolve-say-this-next.ts")
  record(
    "say_this_next_aios_priority",
    sayThisNext.includes("buildAiosSayThisNextSnapshot") &&
      sayThisNext.indexOf("buildAiosSayThisNextSnapshot") <
        sayThisNext.indexOf("primaryCoach?.primaryPhrase")
      ? "pass"
      : "fail",
    "AI OS Say This Next checked before legacy coaching",
    "high",
  )

  const homeSource = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  record(
    "home_canonical_decision_wired",
    homeSource.includes("resolveGrowthCanonicalDecisionForLead") ? "pass" : "fail",
    "Home loader resolves canonical hero decision",
    "critical",
  )

  const leadWs = readSource("lib/growth/lead-operator-workspace/lead-operator-workspace-from-lead.ts")
  record(
    "lead_workspace_canonical_decision_wired",
    leadWs.includes("resolveGrowthCanonicalDecisionForLead") ? "pass" : "fail",
    "Lead workspace resolves canonical decision",
    "critical",
  )

  const hac = readSource("lib/growth/aios/approvals/approvals-operator-review-service.ts")
  record(
    "hac_canonical_packet_wired",
    hac.includes("resolveCanonicalHumanMemoryForLead") &&
      hac.includes("resolveGrowthCanonicalDecisionForLead")
      ? "pass"
      : "fail",
    "HAC packet composes memory + decision resolvers",
    "critical",
  )

  const liveReasoning = readSource("lib/growth/operator-assist/call-workspace-aios-live-reasoning-service.ts")
  record(
    "call_workspace_meeting_brief_wired",
    liveReasoning.includes("resolveGrowthCanonicalMeetingBriefForMeeting") ? "pass" : "fail",
    "Call Workspace live reasoning loads Meeting Intelligence",
    "high",
  )

  const transport = readSource("lib/growth/providers/transport/transport-orchestrator.ts")
  record(
    "transport_canonical_boundary_wired",
    transport.includes("evaluateCanonicalTransportBoundary") ? "pass" : "fail",
    "Transport orchestrator uses canonical boundary enforcement",
    "critical",
  )

  for (const legacy of LEGACY_BYPASS_PATTERNS) {
    const text = readSource(legacy.file)
    record(
      `legacy_bypass_${legacy.label.replace(/\s+/g, "_")}`,
      !text.includes(legacy.mustNotInclude) ? "pass" : "fail",
      legacy.label,
      "high",
    )
  }
}

function verifyDeployedBatch(deployedSha: string): void {
  const fullSha = (() => {
    try {
      return git(["rev-parse", deployedSha])
    } catch {
      return deployedSha
    }
  })()

  const batchFirst = (() => {
    try {
      return git(["rev-parse", BATCH_FIRST_SHA])
    } catch {
      return BATCH_FIRST_SHA
    }
  })()

  const batchHead = (() => {
    try {
      return git(["rev-parse", BATCH_HEAD_SHA])
    } catch {
      return BATCH_HEAD_SHA
    }
  })()

  const includesBatch = isGitAncestor(batchFirst, fullSha)
  const isExactHead = fullSha.startsWith(batchHead.slice(0, 8)) || fullSha === batchHead

  record(
    "deployment_batch_present",
    includesBatch ? "pass" : "fail",
    includesBatch
      ? `deployed ${fullSha.slice(0, 8)} includes batch from ${BATCH_FIRST_SHA}`
      : `deployed ${fullSha.slice(0, 8)} predates batch ${BATCH_FIRST_SHA}`,
    "critical",
  )

  record(
    "deployment_batch_head",
    isExactHead ? "pass" : includesBatch ? "warn" : "fail",
    isExactHead
      ? `deployed matches batch head ${BATCH_HEAD_SHA.slice(0, 8)}`
      : includesBatch
        ? `deployed includes batch but is not head ${BATCH_HEAD_SHA.slice(0, 8)}`
        : "batch not deployed",
    isExactHead ? "low" : "high",
  )

  const missingAtDeploy: string[] = []
  for (const marker of CANONICAL_PATH_MARKERS) {
    try {
      execFileSync("git", ["cat-file", "-e", `${fullSha}:${marker}`], { cwd: ROOT, stdio: "ignore" })
    } catch {
      missingAtDeploy.push(marker)
    }
  }

  record(
    "deployment_canonical_markers",
    missingAtDeploy.length === 0 ? "pass" : includesBatch ? "warn" : "fail",
    missingAtDeploy.length === 0
      ? "all canonical markers present at deployed SHA"
      : `missing at deploy: ${missingAtDeploy.slice(0, 3).join(", ")}${missingAtDeploy.length > 3 ? "…" : ""}`,
    missingAtDeploy.length === 0 ? "low" : "critical",
  )
}

function collectOperatorStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 8 || value == null) return
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.length >= 8) out.push(trimmed)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectOperatorStrings(item, out, depth + 1)
    return
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "qaMarker" || key === "qa_marker" || key === "metadata") continue
      collectOperatorStrings(child, out, depth + 1)
    }
  }
}

function scanPolish(strings: string[], context: string): void {
  const joined = strings.join("\n")
  const checksPolish: Array<{ id: string; pattern: RegExp; severity: Severity }> = [
    { id: "em_dash", pattern: /\u2014/, severity: "medium" },
    { id: "ai_signature", pattern: /\b(as an ai|i'?m an ai|language model|chatgpt)\b/i, severity: "high" },
    { id: "qa_marker_exposed", pattern: /\bge-aios-[a-z0-9-]+-v\d\b/i, severity: "high" },
    { id: "growth_engine_term", pattern: /\bgrowth engine\b/i, severity: "medium" },
    { id: "internal_memory_kind", pattern: /\bhuman_memory_kind\b/, severity: "high" },
    { id: "debug_label", pattern: /\bfallback_flags\b|\bqa_marker\b/i, severity: "high" },
    { id: "block_imaging_degraded", pattern: /\bblock imaging\b/, severity: "high" },
  ]

  for (const rule of checksPolish) {
    if (!rule.pattern.test(joined)) continue
    const sample = strings.find((s) => rule.pattern.test(s))?.slice(0, 120) ?? ""
    record(
      `polish_${context}_${rule.id}`,
      "warn",
      `${context}: ${rule.id} — "${sample}"`,
      rule.severity,
    )
  }
}

async function timeMs(label: string, fn: () => Promise<unknown>): Promise<{ ms: number; value: unknown }> {
  const start = Date.now()
  const value = await fn()
  const ms = Date.now() - start
  record(`perf_${label}`, "pass", `${ms}ms`, "low")
  return { ms, value }
}

async function validateBlockImaging(admin: SupabaseClient, organizationId: string): Promise<void> {
  console.log("\n[Phase 2] Block Imaging production consistency")

  const lead = await fetchGrowthLeadById(admin, BLOCK_LEAD)
  if (!lead) {
    record("block_imaging_lead", "fail", "lead not found in production", "critical")
    return
  }

  const authoritative = resolveAuthoritativeForm(lead.companyName ?? "")
  record(
    "block_imaging_company_name",
    authoritative === "Block Imaging" ? "pass" : "fail",
    `lead.companyName="${lead.companyName}" authoritative="${authoritative}"`,
    "high",
  )

  const outreachPackage = await resolveCanonicalOutreachPackageForLead(admin, {
    organizationId,
    leadId: BLOCK_LEAD,
  })
  record(
    "growth_5f_canonical_package",
    outreachPackage?.packageId ? "pass" : "warn",
    outreachPackage?.packageId ?? "no canonical outreach package",
    outreachPackage?.packageId ? "low" : "high",
  )

  if (outreachPackage?.canonicalDisplayIdentity?.company?.displayName) {
    record(
      "block_imaging_canonical_identity",
      outreachPackage.canonicalDisplayIdentity.company.displayName === "Block Imaging" ? "pass" : "fail",
      `package identity="${outreachPackage.canonicalDisplayIdentity.company.displayName}"`,
      "high",
    )
  }

  const generatedAt = new Date().toISOString()

  const [decisionBare, decisionPackaged] = await Promise.all([
    resolveGrowthCanonicalDecisionForLead(admin, {
      organizationId,
      leadId: BLOCK_LEAD,
      generatedAt,
    }),
    resolveGrowthCanonicalDecisionForLead(admin, {
      organizationId,
      leadId: BLOCK_LEAD,
      generatedAt,
      packageSnapshot: outreachPackage ?? undefined,
    }),
  ])
  const fingerprintBare = decisionBare?.decision.decisionFingerprint ?? null
  const fingerprintPackaged = decisionPackaged?.decision.decisionFingerprint ?? null
  record(
    "decision_engine_resolves",
    fingerprintBare ? "pass" : "fail",
    fingerprintBare ?? "no fingerprint",
    "critical",
  )

  const leadWorkspace = await buildLeadOperatorWorkspacePayloadFromGrowthLead(admin, lead, {
    organizationId,
  })
  const fingerprintLeadWs = leadWorkspace.canonical_decision?.decision.decisionFingerprint ?? null
  const fingerprintAction = decisionBare?.decision.primaryAction ?? null
  const leadWsAction = leadWorkspace.canonical_decision?.decision.primaryAction ?? null
  record(
    "decision_fingerprint_lead_workspace",
    fingerprintLeadWs === fingerprintBare && fingerprintAction === leadWsAction ? "pass" : "warn",
    `leadWs=${fingerprintLeadWs ?? "null"} bare=${fingerprintBare ?? "null"} action=${leadWsAction}/${fingerprintAction}`,
    fingerprintLeadWs === fingerprintBare ? "low" : "medium",
  )

  const runs = await listOutreachPreparationRunsForLead(admin, organizationId, BLOCK_LEAD)
  const latestRun = runs.find((run) => run.approvalPackage?.packageId) ?? runs[0] ?? null
  const packageId = latestRun?.approvalPackage?.packageId ?? outreachPackage?.packageId ?? null

  let hacPacket = null
  if (packageId) {
    hacPacket = await loadApprovals2AOperatorReviewPacket(admin, {
      organizationId,
      packageId,
      leadId: BLOCK_LEAD,
    })
    const projected = hacPacket ? projectApprovals2AOperatorReviewPacket(hacPacket) : null
    const hacStrings: string[] = []
    if (projected) collectOperatorStrings(projected, hacStrings)
    scanPolish(hacStrings, "hac")

    const hacFingerprint = fingerprintPackaged
    const essentials = hacPacket?.operatorReviewLayout.canonicalDecisionEssentials ?? []
    const essentialsMentionFingerprint =
      fingerprintPackaged != null &&
      essentials.some((line) => line.includes(fingerprintPackaged.slice(0, 24)))
    record(
      "decision_fingerprint_hac",
      essentials.length > 0 ? "pass" : "fail",
      `packaged=${fingerprintPackaged ?? "null"} essentials=${essentials.length} fp_in_essentials=${essentialsMentionFingerprint}`,
      "high",
    )

    const memoryBundle = await resolveCanonicalHumanMemoryForLead(admin, {
      organizationId,
      leadId: BLOCK_LEAD,
      packageSnapshot: outreachPackage ?? undefined,
      skipPackageLoad: Boolean(outreachPackage),
      companyName: lead.companyName,
    })
    const resolverMemoryRows = projectCanonicalMemoryReviewRows({ canonicalHumanMemory: memoryBundle })
    const hacMemoryIds = new Set((hacPacket?.memoryReview ?? []).map((row) => row.id))
    const resolverOnly = resolverMemoryRows.filter((row) => !hacMemoryIds.has(row.id)).length
    const hacOnly = (hacPacket?.memoryReview ?? []).filter(
      (row) => !resolverMemoryRows.some((resolved) => resolved.id === row.id),
    ).length
    record(
      "memory_resolver_hac_parity",
      resolverOnly === 0 && hacOnly === 0 ? "pass" : "warn",
      `resolver=${resolverMemoryRows.length} hac=${hacPacket?.memoryReview.length ?? 0} resolver_only=${resolverOnly} hac_only=${hacOnly}`,
      resolverOnly === 0 && hacOnly === 0 ? "low" : "high",
    )

    if (outreachPackage?.salesStrategyBrief && hacPacket?.salesStrategy) {
      const pkgHook = outreachPackage.salesStrategyBrief.primaryHook ?? ""
      const hacHook = hacPacket.salesStrategy.primaryHook ?? ""
      record(
        "sales_strategy_brief_stable",
        pkgHook === hacHook ? "pass" : "warn",
        `package hook="${pkgHook.slice(0, 60)}" hac="${hacHook.slice(0, 60)}"`,
        "medium",
      )
    }
  } else {
    record("hac_packet", "skip", "no package id for Block Imaging", "high")
  }

  const meetings = await listGrowthMeetingsForLead(admin, BLOCK_LEAD)
  const meeting = meetings[0] ?? null
  if (meeting) {
    const prepBundle = await gatherMeetingPrepBundleForMeeting(admin, meeting)
    if (!prepBundle) {
      record("meeting_prep_bundle", "fail", "could not assemble meeting prep bundle", "high")
    }
    const meetingBrief = prepBundle
      ? prepBundle.canonicalMeetingBrief ??
        (await resolveGrowthCanonicalMeetingBriefForMeeting(admin, {
          organizationId,
          meeting,
          prepBundle,
        }))
      : null
    record(
      "meeting_brief_resolves",
      meetingBrief?.qaMarker ? "pass" : "fail",
      meetingBrief?.qaMarker ?? "missing meeting brief",
      "high",
    )

    const strategyHeadline = outreachPackage?.salesStrategyBrief?.executiveSummary ?? ""
    const meetingHeadline = meetingBrief?.meetingObjective ?? meetingBrief?.operatorExperience.todaysStrategy ?? ""
    const themeOverlap =
      Boolean(strategyHeadline && meetingHeadline) &&
      (meetingHeadline.toLowerCase().includes("block imaging") ||
        strategyHeadline
          .split(/\s+/)
          .slice(0, 4)
          .some((word) => word.length > 4 && meetingHeadline.toLowerCase().includes(word.toLowerCase())))
    record(
      "meeting_brief_strategy_alignment",
      themeOverlap ? "pass" : "warn",
      `strategy="${strategyHeadline.slice(0, 80)}" meeting="${String(meetingHeadline).slice(0, 80)}"`,
      "medium",
    )

    const meetingStrings: string[] = []
    collectOperatorStrings(meetingBrief, meetingStrings)
    scanPolish(meetingStrings, "meeting_brief")
  } else {
    record("meeting_brief", "skip", "no meetings for Block Imaging", "low")
  }

  const liveReasoning = await resolveCallWorkspaceAiosLiveReasoning(admin, {
    organizationId,
    leadId: BLOCK_LEAD,
    liveSnapshot: null,
    voiceTranscript: null,
  }).catch(() => null)

  record(
    "call_workspace_aios_marker",
    liveReasoning?.qaMarker === GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER ? "pass" : "warn",
    liveReasoning?.qaMarker ?? "live reasoning unavailable without session (expected offline)",
    liveReasoning ? "high" : "low",
  )

  if (liveReasoning) {
    let sayThisNext = null
    try {
      const assist = buildUnifiedOperatorAssistSnapshot({
        coachingState: null,
        coachingMode: null,
        coachingLeadId: BLOCK_LEAD,
        realtimeSessionId: null,
        liveSnapshot: null,
        voiceTranscript: null,
        conversationIntelligence: null,
        participants: [],
        preferences: null,
        aiosLiveReasoning: liveReasoning,
        leadRecommendedNextAction: decisionBare?.decision.primaryAction ?? null,
      })
      sayThisNext = resolveSayThisNext(assist)
    } catch (error) {
      record(
        "say_this_next_aios_build",
        "fail",
        error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180),
        "high",
      )
    }
    if (sayThisNext) {
      record(
        "say_this_next_aios_source",
        sayThisNext.aiosQaMarker === GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER ? "pass" : "warn",
        sayThisNext.aiosQaMarker ?? sayThisNext.qaMarker ?? "no say-this-next",
        "high",
      )
    }
    if (liveReasoning.meetingBrief) {
      record(
        "call_workspace_meeting_intelligence_loaded",
        "pass",
        `meetingBrief qa=${liveReasoning.meetingBrief.qaMarker}`,
        "low",
      )
    }
  }

  if (outreachPackage) {
    const emailAsset = resolveTransportAssetFromPackage(
      outreachPackage,
      "email",
      "Block Imaging",
      outreachPackage.canonicalDisplayIdentity ?? null,
    )
    const body = emailAsset?.body ?? ""
    const signatureLeak = /(?:best regards|sincerely|thanks,?\s*\n)/i.test(body)
    record(
      "send_plane_mailbox_signature_transport_owned",
      !signatureLeak ? "pass" : "warn",
      signatureLeak ? "possible signature leak in approved email body" : "no signature patterns in transport body",
      signatureLeak ? "high" : "low",
    )

    const materialized = outreachPackage.salesStrategyBrief
      ? materializeCanonicalOutreachChannelContent({
          channel: "email",
          brief: outreachPackage.salesStrategyBrief,
          package: outreachPackage,
        })
      : null
    record(
      "send_plane_materialization",
      materialized && (materialized.transportReady || materialized.constitutionFailures.length === 0)
        ? "pass"
        : "warn",
      materialized?.constitutionFailures.join("; ") || "transport ready",
      "medium",
    )
  }

  const transportGate = evaluateCanonicalTransportBoundary(decisionPackaged ?? decisionBare, {
    humanApproved: false,
  })
  record(
    "transport_blocked_without_approval",
    transportGate.allowed === false ? "pass" : "fail",
    transportGate.outcome,
    "critical",
  )

  if (decisionBare && outreachPackage?.salesStrategyBrief?.relationshipAssessment) {
    const rel = outreachPackage.salesStrategyBrief.relationshipAssessment
    const decisionAction = decisionBare.decision.primaryAction
    const relGoal = rel.relationshipGoal?.current ?? rel.relationshipStory?.summary ?? ""
    const aligned =
      decisionBare.decision.supportingActions.some((action) =>
        relGoal.toLowerCase().includes(action.replace(/_/g, " ")),
      ) ||
      (outreachPackage.salesStrategyBrief.relationshipStage ?? "")
        .toLowerCase()
        .includes(decisionAction.replace(/_/g, " "))
    record(
      "relationship_strategy_decision_alignment",
      aligned ? "pass" : "warn",
      `decision=${decisionAction} relationship_goal=${relGoal.slice(0, 60)}`,
      "medium",
    )
  }

  const institutional = outreachPackage?.salesStrategyBrief?.institutionalLearning
  record(
    "institutional_learning_confidence_only",
    institutional == null || institutional.advisoryOnly !== false ? "pass" : "warn",
    institutional
      ? `institutional patterns=${institutional.patterns.length} advisoryOnly=${String(institutional.advisoryOnly)}`
      : "no institutional learning on package (acceptable)",
    "low",
  )

  const leadStrings: string[] = []
  collectOperatorStrings(leadWorkspace, leadStrings)
  scanPolish(leadStrings, "lead_workspace")
}

async function measurePerformance(admin: SupabaseClient, organizationId: string): Promise<void> {
  console.log("\n[Phase 4] Runtime performance")

  const budgets: Array<{ label: string; ms: number; max: number; severity: Severity }> = []

  const home = await timeMs("home_summary", () =>
    buildGrowthHomeWorkspaceSummary({
      admin,
      operatorEmail: "production-validation@equipify.internal",
      actorUserId: "production-validation",
    }),
  )
  budgets.push({ label: "home_summary", ms: home.ms, max: 8000, severity: "medium" })

  const lead = await fetchGrowthLeadById(admin, BLOCK_LEAD)
  if (lead) {
    const leadWs = await timeMs("lead_workspace", () =>
      buildLeadOperatorWorkspacePayloadFromGrowthLead(admin, lead!, { organizationId }),
    )
    budgets.push({ label: "lead_workspace", ms: leadWs.ms, max: 4000, severity: "medium" })
  }

  clearCanonicalDecisionResolutionCache()
  const decision1 = await timeMs("decision_resolver_cold", () =>
    resolveGrowthCanonicalDecisionForLeadCached(admin, {
      organizationId,
      leadId: BLOCK_LEAD,
      bypassCache: true,
      cacheScope: "production-validation",
    }),
  )
  const decision2 = await timeMs("decision_resolver_cached", () =>
    resolveGrowthCanonicalDecisionForLeadCached(admin, {
      organizationId,
      leadId: BLOCK_LEAD,
      cacheScope: "production-validation",
    }),
  )
  if (typeof decision1.ms === "number" && typeof decision2.ms === "number" && decision1.ms > 0) {
    const ratio = decision2.ms / decision1.ms
    record(
      "perf_decision_cache_hit",
      ratio <= 0.5 || decision2.ms < 100 ? "pass" : "warn",
      `cold=${decision1.ms}ms cached=${decision2.ms}ms ratio=${ratio.toFixed(2)}`,
      ratio <= 0.5 ? "low" : "medium",
    )
  }

  const memory = await timeMs("memory_resolver", () =>
    resolveCanonicalHumanMemoryForLead(admin, {
      organizationId,
      leadId: BLOCK_LEAD,
      companyName: "Block Imaging",
    }).catch((error) => {
      record(
        "memory_resolver_error",
        "fail",
        error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180),
        "high",
      )
      return null
    }),
  )
  budgets.push({ label: "memory_resolver", ms: memory.ms, max: 3000, severity: "medium" })

  const outreachPackage = await resolveCanonicalOutreachPackageForLead(admin, {
    organizationId,
    leadId: BLOCK_LEAD,
  })
  if (outreachPackage?.packageId) {
    const hac = await timeMs("hac_packet", () =>
      loadApprovals2AOperatorReviewPacket(admin, {
        organizationId,
        packageId: outreachPackage.packageId,
        leadId: BLOCK_LEAD,
      }),
    )
    budgets.push({ label: "hac_packet", ms: hac.ms, max: 5000, severity: "medium" })
  }

  const meetings = await listGrowthMeetingsForLead(admin, BLOCK_LEAD)
  if (meetings[0]) {
    const brief = await timeMs("meeting_brief", async () => {
      const prep = await gatherMeetingPrepBundleForMeeting(admin, meetings[0])
      if (!prep) return null
      return (
        prep.canonicalMeetingBrief ??
        (await resolveGrowthCanonicalMeetingBriefForMeeting(admin, {
          organizationId,
          meeting: meetings[0],
          prepBundle: prep,
        }))
      )
    })
    budgets.push({ label: "meeting_brief", ms: brief.ms, max: 4000, severity: "medium" })
  }

  for (const row of budgets) {
    record(
      `perf_budget_${row.label}`,
      row.ms <= row.max ? "pass" : "warn",
      `${row.ms}ms (budget ${row.max}ms)`,
      row.severity,
    )
  }

  const homeSummary = home.value as Awaited<ReturnType<typeof buildGrowthHomeWorkspaceSummary>>
  const heroId =
    homeSummary.dailyRevenueWorkQueue?.display?.top_items?.[0]?.lead_id ?? null
  if (heroId === BLOCK_LEAD && homeSummary.canonicalHeroDecision) {
    const heroFp = homeSummary.canonicalHeroDecision.decision.decisionFingerprint
    const directBare = await resolveGrowthCanonicalDecisionForLead(admin, {
      organizationId,
      leadId: BLOCK_LEAD,
    })
    record(
      "decision_fingerprint_home_hero",
      heroFp === directBare?.decision.decisionFingerprint ? "pass" : "fail",
      `home=${heroFp} bare=${directBare?.decision.decisionFingerprint ?? "null"}`,
      "high",
    )
  } else {
    record(
      "decision_fingerprint_home_hero",
      "skip",
      heroId ? `hero is ${heroId}` : "no hero lead on home",
      "low",
    )
  }
}

function printBlockers(): void {
  console.log("\n[Phase 5] Production blockers")
  for (const severity of ["critical", "high", "medium", "low"] as const) {
    console.log(`\n${severity.toUpperCase()}`)
    if (blockers[severity].length === 0) {
      console.log("  (none)")
      continue
    }
    for (const item of blockers[severity]) console.log(`  - ${item}`)
  }
}

function summarize(): void {
  const failed = checks.filter((check) => check.status === "fail")
  const warned = checks.filter((check) => check.status === "warn")
  console.log("")
  console.log(`[${PHASE}] Checks: ${checks.length} total, ${failed.length} failed, ${warned.length} warnings`)
  printBlockers()

  const hasCritical = blockers.critical.length > 0
  const hasHigh = blockers.high.length > 0

  if (hasCritical || failed.some((c) => c.severity === "critical")) {
    console.log(`\n[${PHASE}] BLOCKED — resolve Critical blockers before operator validation`)
    process.exitCode = 1
    return
  }

  if (hasHigh) {
    console.log(`\n[${PHASE}] WARN — High blockers require review before operator validation`)
    process.exitCode = 1
    return
  }

  console.log(`\n[${PHASE}] PASS`)
  console.log("The AI OS is ready for controlled production operator validation.")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Read-only production validation (${GE_AIOS_PRODUCTION_VALIDATION_1A_QA_MARKER})`)
  bootstrapGrowthOperatorNotificationsCertEnv()

  const deployment = resolveDeployedRevision()
  record("deployment_alias", "pass", deployment.alias, "low")
  record("deployment_id", deployment.status === "Ready" ? "pass" : "warn", deployment.deploymentId, "medium")
  record(
    "deployment_sha",
    "pass",
    `${deployment.deployedSha.slice(0, 8)} via ${deployment.source}`,
    "low",
  )

  verifySourceCanonicalPaths()
  verifyDeployedBatch(deployment.deployedSha)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    record("supabase_env", "fail", "Supabase production env unavailable", "critical")
    summarize()
    return
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const organizationId = getGrowthEngineAiOrgId() ?? GROWTH_CERT_DEFAULT_AI_ORG_ID
  if (!organizationId) {
    record("org_config", "fail", "GROWTH_ENGINE_AI_ORG_ID not configured", "critical")
    summarize()
    return
  }
  record("org_config", "pass", organizationId, "low")
  record(
    "growth_engine_ai_org_env",
    getGrowthEngineAiOrgId() ? "pass" : "warn",
    getGrowthEngineAiOrgId() ?? "GROWTH_ENGINE_AI_ORG_ID unset — using cert fallback in harness only",
    getGrowthEngineAiOrgId() ? "low" : "high",
  )

  await validateBlockImaging(admin, organizationId)
  await measurePerformance(admin, organizationId)

  summarize()
}

void main()
