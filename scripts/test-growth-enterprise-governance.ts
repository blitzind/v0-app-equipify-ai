/**
 * Regression checks for Enterprise Governance + Controls (Phase 2U).
 * Run: pnpm test:growth-enterprise-governance
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateAiRequiresReview,
  evaluateAllowedSendWindows,
  evaluateApprovalRequiredAboveVolume,
  evaluateMaxDailySends,
  evaluateRestrictedDomain,
  evaluateRestrictedProvider,
  extractDomainFromEmail,
} from "../lib/growth/governance/sending-policy"
import {
  evaluateRoleCanApprove,
  evaluateRoleCanExport,
  evaluateRoleCanSend,
} from "../lib/growth/governance/role-restrictions"
import {
  evaluateGovernancePolicies,
  GovernancePolicyBlockedError,
} from "../lib/growth/governance/policy-engine"
import {
  evaluateRetentionEligible,
  pickEffectiveRetentionPolicy,
} from "../lib/growth/governance/retention-policy"
import {
  GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE,
  GROWTH_ENTERPRISE_GOVERNANCE_QA_MARKER,
  GROWTH_GOVERNANCE_EXPORT_TYPES,
  GROWTH_GOVERNANCE_POLICY_CATEGORIES,
  GROWTH_GOVERNANCE_POLICY_STATUSES,
  GROWTH_GOVERNANCE_RULE_TYPES,
  sanitizeGovernanceExportValue,
} from "../lib/growth/governance/governance-types"
import { GROWTH_ENTERPRISE_GOVERNANCE_SCHEMA_MIGRATION } from "../lib/growth/governance/schema-health"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_ENTERPRISE_GOVERNANCE_QA_MARKER, "growth-enterprise-governance-v1")
  assert.match(GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE, /server-side only/i)
  assert.match(GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE, /No autonomous send changes/i)
  assert.match(GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE, /no raw secrets/i)
  assert.equal(GROWTH_GOVERNANCE_POLICY_CATEGORIES.length, 10)
  assert.equal(GROWTH_GOVERNANCE_POLICY_STATUSES.length, 4)
  assert.equal(GROWTH_GOVERNANCE_RULE_TYPES.length, 12)
  assert.equal(GROWTH_GOVERNANCE_EXPORT_TYPES.length, 5)

  const migration = readSource(`supabase/migrations/${GROWTH_ENTERPRISE_GOVERNANCE_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.governance_policies/)
  assert.match(migration, /growth\.governance_policy_rules/)
  assert.match(migration, /growth\.governance_approval_audit/)
  assert.match(migration, /growth\.governance_activity_exports/)
  assert.match(migration, /growth\.governance_compliance_exports/)
  assert.match(migration, /growth\.governance_retention_policies/)
  assert.match(migration, /growth\.governance_policy_events/)
  assert.match(migration, /max_daily_sends/)
  assert.match(migration, /legal_hold/)
  assert.match(migration, /governance_policy_violation/)
  assert.match(migration, /service role only/i)

  const sanitized = sanitizeGovernanceExportValue({
    password: "secret123",
    note: "Bearer abcdef",
    nested: { token: "hidden" },
  }) as Record<string, unknown>
  assert.equal(sanitized.password, "[redacted]")
  assert.match(String(sanitized.note), /\[redacted\]/)
  assert.equal((sanitized.nested as Record<string, unknown>).token, "[redacted]")

  const maxDaily = evaluateMaxDailySends(120, { max: 100 })
  assert.ok(maxDaily)
  assert.equal(maxDaily!.ruleType, "max_daily_sends")

  const windowViolation = evaluateAllowedSendWindows({ start: "23:00", end: "23:30", timezone: "UTC" })
  assert.ok(windowViolation)

  const blockedDomain = evaluateRestrictedDomain("blocked.com", { domains: ["blocked.com"] }, "blocked_recipient_domains")
  assert.ok(blockedDomain)
  assert.equal(extractDomainFromEmail("user@example.com"), "example.com")

  const restrictedProvider = evaluateRestrictedProvider("mailgun", { providers: ["mailgun"] })
  assert.ok(restrictedProvider)

  const approvalVolume = evaluateApprovalRequiredAboveVolume(50, false, { threshold: 40 })
  assert.ok(approvalVolume)

  const aiReview = evaluateAiRequiresReview(true, false)
  assert.ok(aiReview)

  assert.equal(evaluateMaxDailySends(10, { max: 100 }), null)

  const blockedPolicy = evaluateGovernancePolicies(
    [
      {
        id: "p1",
        name: "Outbound guardrails",
        description: "",
        category: "sending",
        status: "active",
        version: 1,
        activatedAt: null,
        pausedAt: null,
        updatedAt: new Date().toISOString(),
        rules: [
          {
            id: "r1",
            policyId: "p1",
            ruleType: "blocked_recipient_domains",
            ruleConfig: { domains: ["blocked.com"] },
            enabled: true,
            priority: 1,
          },
        ],
      },
    ],
    {
      action: "provider_send",
      actorUserId: "u1",
      actorEmail: "admin@equipify.ai",
      sourceRoute: "test",
      recipientEmail: "lead@blocked.com",
      humanApprovalConfirmed: true,
    },
  )
  assert.equal(blockedPolicy.allowed, false)
  assert.ok(blockedPolicy.violations.length > 0)

  const allowedPolicy = evaluateGovernancePolicies([], {
    action: "provider_send",
    actorUserId: "u1",
    actorEmail: "admin@equipify.ai",
    sourceRoute: "test",
    humanApprovalConfirmed: true,
  })
  assert.equal(allowedPolicy.allowed, true)

  const retention = pickEffectiveRetentionPolicy(
    [
      {
        id: "ret1",
        scope: "audit",
        retentionDays: 365,
        legalHold: true,
        status: "active",
        description: "",
        updatedAt: new Date().toISOString(),
      },
    ],
    "audit",
  )
  assert.ok(retention?.legalHold)
  assert.equal(evaluateRetentionEligible(new Date().toISOString(), 30, true).blockedByLegalHold, true)

  const err = new GovernancePolicyBlockedError([
    {
      ruleType: "role_can_send",
      policyId: "p1",
      policyName: "Roles",
      message: "blocked",
      severity: "critical",
    },
  ])
  assert.equal(err.message, "governance_policy_blocked")

  const dashboardRoute = readSource("app/api/platform/growth/governance/dashboard/route.ts")
  assert.match(dashboardRoute, /requireGrowthEnginePlatformAccess/)
  assert.match(dashboardRoute, /isGrowthEnterpriseGovernanceSchemaReady/)

  const exportRoute = readSource("app/api/platform/growth/governance/exports/route.ts")
  assert.match(exportRoute, /humanApprovalConfirmed/)
  assert.match(exportRoute, /generateGovernanceExport/)

  const navSource = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
  assert.match(navSource, /settings\/governance/)
  assert.match(navSource, /Governance/)

  const sequenceSource = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
  assert.match(sequenceSource, /enforceGovernanceIfReady/)
  assert.match(sequenceSource, /sequence_job_run/)

  const replySource = readSource("lib/growth/replies/reply-draft-repository.ts")
  assert.match(replySource, /enforceGovernanceIfReady/)
  assert.match(replySource, /reply_draft_send/)

  const transportSource = readSource("lib/growth/providers/transport/transport-orchestrator.ts")
  assert.match(transportSource, /enforceGovernanceIfReady/)
  assert.match(transportSource, /provider_send/)

  const templateSource = readSource("lib/growth/content/template-repository.ts")
  assert.match(templateSource, /content_template_approve/)

  const complianceSource = readSource("components/growth/growth-compliance-dashboard.tsx")
  assert.match(complianceSource, /Governance Exports/)

  console.log("growth enterprise governance checks passed")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
