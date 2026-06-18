/** Phase GE-OPS-1 — Operator readiness review (client-safe, recommendations only). */

import fs from "node:fs"
import path from "node:path"
import { runGrowthEngineUxReview } from "@/lib/growth/e2e/growth-engine-hardening-audit"
import type { OpsFinding } from "@/lib/growth/e2e/growth-engine-ops-types"

const OPERATOR_SURFACES = [
  "components/growth/growth-command-center-dashboard.tsx",
  "components/growth/growth-command-center-unified-workspace.tsx",
  "components/growth/growth-operator-inbox-panel.tsx",
  "components/growth/inbox/growth-inbox-workspace-v2-panel.tsx",
  "components/growth/growth-agent-orchestration-panel.tsx",
] as const

export function auditOperatorReadiness(cwd = process.cwd()): OpsFinding[] {
  const findings: OpsFinding[] = []

  for (const relativePath of OPERATOR_SURFACES) {
    const source = readSource(relativePath, cwd)
    if (!source) continue

    if (!/GrowthEnginePanelResilience|GrowthEngineHonestEmptyState/.test(source)) {
      findings.push({
        finding_id: `operator_resilience_${relativePath}`,
        severity: "info",
        category: "operator",
        description: `${relativePath} should use GE-HARDEN-3 resilience primitives`,
        remediation: "Wire GrowthEnginePanelResilience for loading/error/retry/empty",
      })
    }

    const inboxPanelJsxCount = (source.match(/<GrowthOperatorInboxPanel[\s/>]/g) ?? []).length
    if (inboxPanelJsxCount > 1) {
      findings.push({
        finding_id: `operator_duplicate_inbox_${relativePath}`,
        severity: "warning",
        category: "operator",
        description: "Potential duplicate nested operator inbox panels",
        remediation: "Avoid rendering inbox panel inside inbox workspace",
      })
    }

    if (!/requires_human_review|human review|Human review/i.test(source)) {
      findings.push({
        finding_id: `operator_approval_clarity_${relativePath}`,
        severity: "info",
        category: "operator",
        description: `${relativePath} may lack explicit human-review messaging`,
        remediation: "Surface human approval requirement in operator-facing copy",
      })
    }
  }

  for (const ux of runGrowthEngineUxReview(cwd)) {
    findings.push({
      finding_id: ux.finding_id,
      severity: ux.severity === "critical" ? "critical" : ux.severity === "warning" ? "warning" : "info",
      category: "operator",
      description: ux.description,
      remediation: ux.remediation,
    })
  }

  return findings
}

function readSource(relativePath: string, cwd: string): string | null {
  const absolutePath = path.join(cwd, relativePath)
  if (!fs.existsSync(absolutePath)) return null
  return fs.readFileSync(absolutePath, "utf8")
}

export function buildOperatorRecommendations(findings: OpsFinding[]): string[] {
  const recs: string[] = []

  if (findings.some((f) => f.finding_id.includes("duplicate"))) {
    recs.push("Consolidate duplicate inbox panels in Command Center and inbox workspace v2.")
  }
  if (findings.some((f) => f.description.includes("refresh"))) {
    recs.push("Debounce Command Center refresh; use 45s polling fallback for realtime subscriptions.")
  }
  if (findings.some((f) => f.description.includes("resilience"))) {
    recs.push("Ensure all GS panels use GrowthEnginePanelResilience for graceful error recovery.")
  }

  recs.push("Approval workflow: mark_reviewed/dismiss only — no execute outreach from operator panels.")
  recs.push("Empty states: read-only honest empty states — no execution affordances in zero-data views.")

  if (recs.length === 2) {
    recs.unshift("Operator surfaces meet GE-HARDEN-3 resilience standards — monitor refresh behavior in production.")
  }

  return recs
}
