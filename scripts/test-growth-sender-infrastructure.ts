/**
 * Regression checks for Sender Infrastructure Foundation (Phase 1A).
 * Run: pnpm test:growth-sender-infrastructure
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeSenderScore,
  senderScoreToHealthStatus,
} from "../lib/growth/sender/sender-score"
import { evaluateSenderHealth } from "../lib/growth/sender/sender-health"
import { validateSenderDomainStub, extractDomainFromEmail } from "../lib/growth/sender/sender-domain-validator"
import {
  GROWTH_SENDER_INFRASTRUCTURE_PRIVACY_NOTE,
  GROWTH_SENDER_INFRASTRUCTURE_QA_MARKER,
  GROWTH_SENDER_TIMELINE_EVENT_TYPES,
} from "../lib/growth/sender/sender-types"
import { GROWTH_SENDER_INFRASTRUCTURE_SCHEMA_MIGRATION } from "../lib/growth/sender/sender-schema-health"
import {
  GROWTH_SENDER_PROVIDER_CAPABILITIES,
  listSenderProviderCapabilities,
} from "../lib/growth/sender/provider-sender-capabilities"

async function main(): Promise<void> {
  assert.equal(GROWTH_SENDER_INFRASTRUCTURE_QA_MARKER, "growth-sender-infrastructure-v1")
  assert.match(GROWTH_SENDER_INFRASTRUCTURE_PRIVACY_NOTE, /platform-admin|no secrets/i)
  assert.equal(GROWTH_SENDER_TIMELINE_EVENT_TYPES.length, 5)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_SENDER_INFRASTRUCTURE_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.sender_accounts/)
  assert.match(migration, /sender_domains/)
  assert.match(migration, /sender_health_events/)
  assert.match(migration, /sender_reputation_snapshots/)
  assert.match(migration, /deleted_at/)
  assert.match(migration, /sender_connected/)
  assert.match(migration, /domain_validated/)
  assert.match(migration, /service_role/)

  assert.equal(computeSenderScore({}), 100)
  assert.equal(computeSenderScore({ bounce_rate: 0.06 }), 75)
  assert.equal(computeSenderScore({ spam_risk: 60 }), 80)
  assert.equal(computeSenderScore({ spf_valid: false, dkim_valid: false, dmarc_valid: false }), 50)
  assert.equal(computeSenderScore({ status: "error" }), 75)
  assert.equal(
    computeSenderScore({
      bounce_rate: 0.1,
      spam_risk: 80,
      spf_valid: false,
      dkim_valid: false,
      dmarc_valid: false,
      daily_send_used: 60,
      daily_send_limit: 50,
      status: "error",
    }),
    0,
  )

  assert.equal(senderScoreToHealthStatus(95), "healthy")
  assert.equal(senderScoreToHealthStatus(75), "warming")
  assert.equal(senderScoreToHealthStatus(55), "degraded")
  assert.equal(senderScoreToHealthStatus(20), "critical")

  const health = evaluateSenderHealth({
    bounce_rate: 0.06,
    spf_valid: false,
    status: "warning",
  })
  assert.ok(health.sender_score < 100)
  assert.ok(health.reasons.length >= 2)

  const domain = validateSenderDomainStub({
    domain: "example.com",
    spf_valid: true,
    dkim_valid: true,
    dmarc_valid: true,
    mx_valid: true,
  })
  assert.equal(domain.status, "valid")
  assert.equal(domain.deliverability_score, 100)
  assert.equal(extractDomainFromEmail("ops@example.com"), "example.com")

  const capabilities = listSenderProviderCapabilities()
  assert.equal(capabilities.length, 4)
  assert.equal(GROWTH_SENDER_PROVIDER_CAPABILITIES.google.supportsOauth, true)
  assert.equal(GROWTH_SENDER_PROVIDER_CAPABILITIES.smtp.supportsOauth, false)
  assert.equal(GROWTH_SENDER_PROVIDER_CAPABILITIES.custom.supportsRotation, false)

  const repoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sender/sender-repository.ts"),
    "utf8",
  )
  assert.match(repoSource, /softDeleteSenderAccount/)
  assert.match(repoSource, /deleted_at/)
  assert.match(repoSource, /appendSenderTimelineEvent/)
  assert.match(repoSource, /sender_connected/)
  assert.match(repoSource, /sender_disabled/)
  assert.match(repoSource, /sender_score_changed/)
  assert.match(repoSource, /domain_validated/)
  assert.match(repoSource, /domain_health_declined/)
  assert.doesNotMatch(repoSource, /\bsendEmail\b|\boutbound\.send\b/i)

  const dashboardSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sender/sender-health-dashboard.ts"),
    "utf8",
  )
  assert.match(dashboardSource, /healthy_senders/)
  assert.match(dashboardSource, /warming_senders/)
  assert.match(dashboardSource, /critical_domains/)
  assert.match(dashboardSource, /average_sender_score/)
  assert.match(dashboardSource, /health_events_24h/)

  const apiSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/senders/route.ts"),
    "utf8",
  )
  assert.match(apiSource, /requireGrowthEnginePlatformAccess/)
  assert.doesNotMatch(apiSource, /credentials|secret|api_key/i)

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-sender-infrastructure-dashboard.tsx"),
    "utf8",
  )
  assert.match(uiSource, /Sender Accounts/)
  assert.match(uiSource, /Domains/)
  assert.match(uiSource, /Health Feed/)
  assert.match(uiSource, /GROWTH_SENDER_INFRASTRUCTURE_QA_MARKER/)

  const navSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
    "utf8",
  )
  assert.match(navSource, /\/admin\/growth\/infrastructure/)

  console.log("growth-sender-infrastructure: all checks passed")
}

void main()
