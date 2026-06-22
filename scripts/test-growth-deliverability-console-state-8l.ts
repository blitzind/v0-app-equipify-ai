/**
 * GS-GROWTH-SETTINGS-HOTFIX-8L — deliverability console state classification.
 * Run: pnpm test:growth-deliverability-console-state-8l
 */
import assert from "node:assert/strict"
import {
  activeSendingDomainNames,
  DELIVERABILITY_SETUP_ONBOARDING_MESSAGE,
  emptyModuleStatusLabel,
  GROWTH_DELIVERABILITY_SETUP_IN_PROGRESS_QA_MARKER,
  hasDeliverabilitySetupInProgress,
  isDeliverabilityConsoleDegraded,
  isActiveSendingDomain,
} from "../lib/growth/deliverability/deliverability-console-state"
import { buildDeliverabilityOpsAlerts } from "../lib/growth/deliverability/deliverability-console-alerts"
import type { GrowthDeliverabilityModuleResult } from "../lib/growth/deliverability/deliverability-protection-console-types"
import type { GrowthSenderAccount } from "../lib/growth/sender/sender-types"

function moduleStub(
  moduleId: GrowthDeliverabilityModuleResult<unknown>["module_id"],
  status: GrowthDeliverabilityModuleResult<unknown>["status"],
): GrowthDeliverabilityModuleResult<unknown> {
  return {
    module_id: moduleId,
    status,
    qa_marker: "test",
    data: null,
    error: null,
    last_success_at: null,
    fetched_at: new Date().toISOString(),
    still_available: [],
  }
}

function testDegradedOnlyOnError() {
  const modules = {
    sender_health: moduleStub("sender_health", "empty"),
    queue_ops: moduleStub("queue_ops", "empty"),
    reputation_protection: moduleStub("reputation_protection", "empty"),
    dns_health: moduleStub("dns_health", "empty"),
    sequence_safety: moduleStub("sequence_safety", "ok"),
  }
  assert.equal(isDeliverabilityConsoleDegraded(modules), false)
  modules.queue_ops = moduleStub("queue_ops", "error")
  assert.equal(isDeliverabilityConsoleDegraded(modules), true)
}

function testSetupInProgressOnEmpty() {
  const allOk = {
    sender_health: moduleStub("sender_health", "ok"),
    queue_ops: moduleStub("queue_ops", "ok"),
    reputation_protection: moduleStub("reputation_protection", "ok"),
    dns_health: moduleStub("dns_health", "ok"),
    sequence_safety: moduleStub("sequence_safety", "ok"),
  }
  assert.equal(hasDeliverabilitySetupInProgress(allOk), false)

  const withEmpty = {
    ...allOk,
    queue_ops: moduleStub("queue_ops", "empty"),
  }
  assert.equal(hasDeliverabilitySetupInProgress(withEmpty), true)
}

function testEmptyModuleLabels() {
  assert.equal(emptyModuleStatusLabel("sender_health"), "Not Started")
  assert.equal(emptyModuleStatusLabel("dns_health"), "Setup In Progress")
  assert.equal(emptyModuleStatusLabel("queue_ops"), "Awaiting Activity")
  assert.equal(emptyModuleStatusLabel("reputation_protection"), "Awaiting Activity")
}

function testActiveSendingDomains() {
  const senders = [
    { email_address: "ops@active-send.com", status: "connected" },
    { email_address: "old@historical.com", status: "disabled" },
    { email_address: "warn@active-send.com", status: "warning" },
  ] as GrowthSenderAccount[]

  const active = activeSendingDomainNames(senders)
  assert.equal(active.has("active-send.com"), true)
  assert.equal(active.has("historical.com"), false)
  assert.equal(isActiveSendingDomain("Active-Send.COM", active), true)
}

function testDnsAlertsIgnoreInactiveDomains() {

  const modules = {
    sender_health: moduleStub("sender_health", "ok"),
    queue_ops: moduleStub("queue_ops", "ok"),
    reputation_protection: moduleStub("reputation_protection", "ok"),
    sequence_safety: moduleStub("sequence_safety", "ok"),
    dns_health: {
      ...moduleStub("dns_health", "ok"),
      data: {
        domains_tracked: 2,
        spf_ok: 0,
        dkim_ok: 0,
        dmarc_ok: 0,
        mx_ok: 0,
        failing_domains: [],
        warmup_readiness_issues: [],
        monitoring_configured: true,
      },
    },
  }

  const alerts = buildDeliverabilityOpsAlerts(modules)
  assert.equal(alerts.some((a) => a.id === "dns-failures"), false)

  modules.dns_health = {
    ...moduleStub("dns_health", "ok"),
    data: {
      domains_tracked: 1,
      spf_ok: 0,
      dkim_ok: 0,
      dmarc_ok: 0,
      mx_ok: 0,
      failing_domains: [{ domain: "live.example.com", issues: ["SPF missing"], health_tier: "warning" }],
      warmup_readiness_issues: [],
      monitoring_configured: true,
    },
  }
  const withDns = buildDeliverabilityOpsAlerts(modules)
  assert.equal(withDns.some((a) => a.id === "dns-failures"), true)
}

function testOnboardingCopy() {
  assert.match(DELIVERABILITY_SETUP_ONBOARDING_MESSAGE, /DNS configuration/)
  assert.equal(GROWTH_DELIVERABILITY_SETUP_IN_PROGRESS_QA_MARKER, "growth-deliverability-setup-in-progress-8l-v1")
}

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [
  { name: "degraded only on module error", fn: testDegradedOnlyOnError },
  { name: "setup in progress on empty modules", fn: testSetupInProgressOnEmpty },
  { name: "empty module status labels", fn: testEmptyModuleLabels },
  { name: "active sending domain names", fn: testActiveSendingDomains },
  { name: "dns alerts skip inactive domain failures", fn: testDnsAlertsIgnoreInactiveDomains },
  { name: "onboarding copy marker", fn: testOnboardingCopy },
]

void (async () => {
  let failed = 0
  for (const t of tests) {
    try {
      await Promise.resolve(t.fn())
      console.log(`ok\t${t.name}`)
    } catch (e) {
      failed += 1
      console.error(`fail\t${t.name}`)
      console.error(e)
    }
  }

  if (failed > 0) process.exit(1)
  console.log(`\nAll ${tests.length} growth-deliverability-console-state-8l tests passed.`)
})()
