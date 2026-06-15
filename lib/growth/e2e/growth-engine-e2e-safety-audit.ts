/** Phase GE-HARDEN-1 — Growth Engine E2E safety gate audit (client-safe). */

import fs from "node:fs"
import path from "node:path"
import type { GrowthEngineE2ESafetyAuditResult } from "@/lib/growth/e2e/growth-engine-e2e-types"

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bSend Outreach\b/i, label: "Send Outreach" },
  { pattern: /\bExecute Outreach\b/i, label: "Execute Outreach" },
  { pattern: /\bAuto Reply\b/i, label: "Auto Reply" },
  { pattern: /\bBook Meeting\b/i, label: "Book Meeting" },
  { pattern: /\benrollLeadInSequence\b/, label: "enrollLeadInSequence" },
  { pattern: /\blaunchCampaign\b/, label: "launchCampaign" },
  { pattern: /\bexecuteOutreach\b/, label: "executeOutreach" },
]

const GS_ACTION_ROUTES = [
  "app/api/platform/growth/signal-feed/actions/route.ts",
  "app/api/platform/growth/operator-inbox/actions/route.ts",
  "app/api/platform/growth/campaign-readiness/actions/route.ts",
  "app/api/platform/growth/conversational-playbooks/actions/route.ts",
  "app/api/platform/growth/human-interventions/actions/route.ts",
  "app/api/platform/growth/follow-up-policies/actions/route.ts",
  "app/api/platform/growth/sequence-preview/actions/route.ts",
  "app/api/platform/growth/campaign-builder/actions/route.ts",
  "app/api/platform/growth/realtime-events/actions/route.ts",
  "app/api/platform/growth/agent-orchestration/actions/route.ts",
  "app/api/platform/growth/command-center-unification/actions/route.ts",
] as const

const GS_PANELS = [
  "components/growth/growth-signal-feed-panel.tsx",
  "components/growth/growth-operator-inbox-panel.tsx",
  "components/growth/growth-campaign-readiness-panel.tsx",
  "components/growth/growth-conversational-playbooks-panel.tsx",
  "components/growth/growth-human-interventions-panel.tsx",
  "components/growth/growth-smart-follow-up-policies-panel.tsx",
  "components/growth/growth-sequence-preview-studio-panel.tsx",
  "components/growth/growth-campaign-builder-wizard-panel.tsx",
  "components/growth/growth-realtime-event-bus-panel.tsx",
  "components/growth/growth-agent-orchestration-panel.tsx",
  "components/growth/growth-command-center-unified-workspace.tsx",
  "components/growth/prospect-search/natural-language-discovery-panel.tsx",
] as const

export function assertReadinessSafetyInvariants(payload: Record<string, unknown>): {
  ok: boolean
  failures: string[]
} {
  const failures: string[] = []

  const humanReview =
    payload.requires_human_review === true ||
    payload.no_outreach_execution === true ||
    payload.search_execution_enabled === false

  if (!humanReview) {
    failures.push("missing_human_review_or_outreach_disabled_flag")
  }

  if (payload.autonomous_execution_enabled !== undefined && payload.autonomous_execution_enabled !== false) {
    failures.push("autonomous_execution_enabled_not_false")
  }

  const outreachDisabled =
    payload.outreach_execution === false ||
    payload.no_outreach_execution === true ||
    payload.outreach_enabled === false ||
    payload.search_execution_enabled === false ||
    payload.no_message_send === true ||
    payload.no_auto_reply === true

  if (!outreachDisabled) {
    failures.push("outreach_not_explicitly_disabled")
  }

  const enrollmentDisabled =
    payload.enrollment_execution === false ||
    payload.no_enrollment_execution === true ||
    payload.enrollment_enabled === false ||
    payload.no_outreach_execution === true ||
    payload.search_execution_enabled === false

  if (!enrollmentDisabled) {
    failures.push("enrollment_not_explicitly_disabled")
  }

  return { ok: failures.length === 0, failures }
}

export function runGrowthEngineSafetyAudit(cwd = process.cwd()): GrowthEngineE2ESafetyAuditResult {
  const violations: GrowthEngineE2ESafetyAuditResult["violations"] = []

  for (const relativePath of [...GS_ACTION_ROUTES, ...GS_PANELS]) {
    const absolutePath = path.join(cwd, relativePath)
    if (!fs.existsSync(absolutePath)) continue

    const source = fs.readFileSync(absolutePath, "utf8")

    for (const forbidden of FORBIDDEN_PATTERNS) {
      if (forbidden.pattern.test(source)) {
        violations.push({
          file: relativePath,
          pattern: forbidden.label,
          hint: `Remove or gate forbidden action: ${forbidden.label}`,
        })
      }
    }

    if (relativePath.includes("/actions/route.ts")) {
      const hasOutreachDisabled =
        source.includes("outreach_execution: false") ||
        source.includes("outreach_enabled: false") ||
        source.includes("message_send: false") ||
        source.includes("no_outreach_execution: true")
      if (!hasOutreachDisabled) {
        violations.push({
          file: relativePath,
          pattern: "missing_outreach_false",
          hint: "Actions route must declare outreach/message send disabled",
        })
      }
    }
  }

  return {
    routes_scanned: GS_ACTION_ROUTES.filter((p) => fs.existsSync(path.join(cwd, p))).length,
    panels_scanned: GS_PANELS.filter((p) => fs.existsSync(path.join(cwd, p))).length,
    violations,
    invariants_checked: GS_ACTION_ROUTES.length + GS_PANELS.length,
    invariants_passed: GS_ACTION_ROUTES.length + GS_PANELS.length - violations.length,
  }
}

export function assertCertificationSafetyInvariants(report: Record<string, unknown>): {
  ok: boolean
  failures: string[]
} {
  const failures: string[] = []

  if (report.requires_human_review !== undefined && report.requires_human_review !== true) {
    failures.push("cert_requires_human_review")
  }
  if (report.autonomous_execution_enabled !== undefined && report.autonomous_execution_enabled !== false) {
    failures.push("cert_autonomous_execution_enabled")
  }
  if (report.outreach_execution !== undefined && report.outreach_execution !== false) {
    failures.push("cert_outreach_execution")
  }
  if (report.outreach_enabled !== undefined && report.outreach_enabled !== false) {
    failures.push("cert_outreach_enabled")
  }
  if (report.enrollment_execution !== undefined && report.enrollment_execution !== false) {
    failures.push("cert_enrollment_execution")
  }
  if (report.enrollment_enabled !== undefined && report.enrollment_enabled !== false) {
    failures.push("cert_enrollment_enabled")
  }
  if (report.search_execution_enabled !== undefined && report.search_execution_enabled !== false) {
    failures.push("cert_search_execution_enabled")
  }

  return { ok: failures.length === 0, failures }
}
