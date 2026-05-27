/**
 * Regression checks for DNS Validation + Deliverability Foundation (Phase 1C).
 * Run: pnpm test:growth-deliverability
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildDeliverabilityDashboard,
  collectTopIssues,
} from "../lib/growth/deliverability/deliverability-dashboard"
import { buildDeliverabilityEventsFromValidation } from "../lib/growth/deliverability/deliverability-event-builder"
import {
  computeDeliverabilityScore,
  deliverabilityScoreToTier,
} from "../lib/growth/deliverability/deliverability-score"
import { generateDnsRecommendations } from "../lib/growth/deliverability/dns-recommendations"
import { evaluateDnsHealth } from "../lib/growth/deliverability/dns-health"
import { validateDnsDomain } from "../lib/growth/deliverability/dns-validator"
import {
  GROWTH_DELIVERABILITY_TIMELINE_EVENT_TYPES,
  GROWTH_DNS_DELIVERABILITY_PRIVACY_NOTE,
  GROWTH_DNS_DELIVERABILITY_QA_MARKER,
} from "../lib/growth/deliverability/deliverability-types"
import { GROWTH_DNS_DELIVERABILITY_SCHEMA_MIGRATION } from "../lib/growth/deliverability/deliverability-schema-health"
import { GROWTH_SENDER_PROVIDER_CAPABILITIES } from "../lib/growth/sender/provider-sender-capabilities"

async function main(): Promise<void> {
  assert.equal(GROWTH_DNS_DELIVERABILITY_QA_MARKER, "growth-dns-deliverability-v1")
  assert.match(GROWTH_DNS_DELIVERABILITY_PRIVACY_NOTE, /stub-safe|no live dns/i)
  assert.equal(GROWTH_DELIVERABILITY_TIMELINE_EVENT_TYPES.length, 6)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_DNS_DELIVERABILITY_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.domain_dns_checks/)
  assert.match(migration, /growth\.deliverability_snapshots/)
  assert.match(migration, /growth\.deliverability_events/)
  assert.match(migration, /spf_missing/)
  assert.match(migration, /domain_warning_created/)
  assert.match(migration, /service role only/)
  assert.match(migration, /grant select, insert, update, delete on table growth\.domain_dns_checks to service_role/)

  assert.equal(
    computeDeliverabilityScore({
      spf_present: true,
      spf_valid: true,
      dkim_present: true,
      dkim_valid: true,
      dmarc_present: true,
      dmarc_valid: true,
      mx_present: true,
      mx_valid: true,
      mx_provider: null,
      warnings: [],
    }),
    100,
  )
  assert.equal(deliverabilityScoreToTier(100), "healthy")
  assert.equal(deliverabilityScoreToTier(75), "warning")
  assert.equal(deliverabilityScoreToTier(55), "degraded")
  assert.equal(deliverabilityScoreToTier(20), "critical")

  assert.equal(
    computeDeliverabilityScore({
      spf_present: false,
      spf_valid: false,
      dkim_present: true,
      dkim_valid: true,
      dmarc_present: true,
      dmarc_valid: true,
      mx_present: true,
      mx_valid: true,
      mx_provider: null,
      warnings: [],
    }),
    75,
  )

  const recommendations = generateDnsRecommendations({
    spf_present: false,
    spf_valid: false,
    dkim_present: false,
    dkim_valid: false,
    dmarc_present: false,
    dmarc_valid: false,
    mx_present: false,
    mx_valid: false,
    mx_provider: null,
  })
  assert.deepEqual(recommendations, [
    "Add SPF authentication",
    "Configure DKIM signing",
    "Add DMARC enforcement",
    "Verify mail routing",
  ])

  const validation = validateDnsDomain({
    domain: "Example.COM",
    hints: {
      spf_valid: true,
      dkim_valid: false,
      dmarc_valid: false,
      mx_valid: true,
    },
  })
  assert.equal(validation.domain, "example.com")
  assert.equal(validation.spf_present, true)
  assert.equal(validation.dkim_present, false)
  assert.ok(validation.warnings.length > 0)
  assert.ok(validation.recommendations.includes("Configure DKIM signing"))

  const health = evaluateDnsHealth({
    spf_present: true,
    spf_valid: true,
    dkim_present: true,
    dkim_valid: true,
    dmarc_present: true,
    dmarc_valid: true,
    mx_present: true,
    mx_valid: true,
    mx_provider: "google",
    stub_mode: true,
  })
  assert.equal(health.health_tier, "healthy")
  assert.equal(health.dns_health_score, 100)

  const events = buildDeliverabilityEventsFromValidation("example.com", validation, 90)
  assert.ok(events.some((event) => event.event_type === "dkim_missing" && event.timeline_type === "dkim_missing"))
  assert.ok(events.some((event) => event.event_type === "dns_health_declined"))
  assert.ok(events.some((event) => event.event_type === "domain_warning"))

  const improved = buildDeliverabilityEventsFromValidation(
    "example.com",
    { ...validation, dns_health_score: 95, health_tier: "healthy" },
    70,
  )
  assert.ok(improved.some((event) => event.timeline_type === "deliverability_improved"))

  const dashboard = buildDeliverabilityDashboard([
    {
      domain_id: "d1",
      domain: "alpha.com",
      spf_present: true,
      spf_valid: true,
      dkim_present: true,
      dkim_valid: true,
      dmarc_present: true,
      dmarc_valid: true,
      mx_present: true,
      mx_valid: true,
      dns_health_score: 95,
      health_tier: "healthy",
      deliverability_score: 95,
      risk_level: "low",
      last_checked_at: new Date().toISOString(),
      recommendations: [],
    },
    {
      domain_id: "d2",
      domain: "beta.com",
      spf_present: false,
      spf_valid: false,
      dkim_present: false,
      dkim_valid: false,
      dmarc_present: false,
      dmarc_valid: false,
      mx_present: false,
      mx_valid: false,
      dns_health_score: 20,
      health_tier: "critical",
      deliverability_score: 20,
      risk_level: "critical",
      last_checked_at: null,
      recommendations: ["Add SPF authentication", "Configure DKIM signing"],
    },
  ])
  assert.equal(dashboard.qa_marker, GROWTH_DNS_DELIVERABILITY_QA_MARKER)
  assert.equal(dashboard.healthy_count, 1)
  assert.equal(dashboard.critical_count, 1)
  assert.equal(dashboard.spf_coverage_percent, 50)
  assert.ok(dashboard.top_recommendations.length > 0)

  const issues = collectTopIssues([
    {
      domain_id: "d2",
      domain: "beta.com",
      spf_present: false,
      spf_valid: false,
      dkim_present: true,
      dkim_valid: true,
      dmarc_present: true,
      dmarc_valid: true,
      mx_present: true,
      mx_valid: true,
      dns_health_score: 75,
      health_tier: "warning",
      deliverability_score: 75,
      risk_level: "medium",
      last_checked_at: null,
      recommendations: [],
    },
  ])
  assert.ok(issues.some((issue) => issue.includes("SPF missing")))

  assert.equal(GROWTH_SENDER_PROVIDER_CAPABILITIES.google.supportsDnsValidation, true)
  assert.equal(GROWTH_SENDER_PROVIDER_CAPABILITIES.custom.supportsDnsValidation, false)
  assert.equal(GROWTH_SENDER_PROVIDER_CAPABILITIES.smtp.supportsDeliverabilityMonitoring, true)

  const repoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/deliverability/deliverability-repository.ts"),
    "utf8",
  )
  assert.match(repoSource, /validateDeliverabilityDomain/)
  assert.match(repoSource, /appendDeliverabilityTimelineEvent/)
  assert.match(repoSource, /domain_dns_checks/)
  assert.doesNotMatch(repoSource, /dns\.resolve|lookup/i)

  const validatorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/deliverability/dns-validator.ts"),
    "utf8",
  )
  assert.match(validatorSource, /validateDnsDomain/)
  assert.match(validatorSource, /no live DNS/i)
  assert.doesNotMatch(validatorSource, /dns\.resolve|lookup/i)

  for (const route of [
    "app/api/platform/growth/deliverability/route.ts",
    "app/api/platform/growth/deliverability/dashboard/route.ts",
    "app/api/platform/growth/deliverability/domain/[id]/validate/route.ts",
    "app/api/platform/growth/deliverability/events/[id]/route.ts",
  ]) {
    const apiSource = fs.readFileSync(path.join(process.cwd(), route), "utf8")
    assert.match(apiSource, /requireGrowthEnginePlatformAccess/)
  }

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-deliverability-dashboard.tsx"),
    "utf8",
  )
  assert.match(uiSource, /DNS Health/)
  assert.match(uiSource, /Authentication Coverage/)
  assert.match(uiSource, /Validate Domain/)
  assert.match(uiSource, /Coming Soon/)
  assert.match(uiSource, /GROWTH_DNS_DELIVERABILITY_QA_MARKER/)

  const navSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
    "utf8",
  )
  assert.match(navSource, /\/admin\/growth\/infrastructure\/deliverability/)

  console.log("growth-deliverability: all checks passed")
}

void main()
