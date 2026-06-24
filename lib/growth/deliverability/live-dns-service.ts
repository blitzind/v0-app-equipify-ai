import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isLiveDnsVerificationEnabled,
  normalizeLiveDnsRawResponses,
  verifyDomainDnsLive,
  type LiveDnsVerifyResult,
} from "@/lib/growth/deliverability/live-dns-verifier"
import { validateDnsDomain } from "@/lib/growth/deliverability/dns-validator"
import { appendDeliverabilityTimelineEvent } from "@/lib/growth/deliverability/deliverability-events"
import { recordDeliveryTimelineEvent } from "@/lib/growth/deliverability/delivery-event-timeline"
import { listSenderDomains, updateSenderDomain } from "@/lib/growth/sender/sender-repository"
import { computeDomainOperationalHealth } from "@/lib/growth/deliverability/domain-health-engine"
import { evaluateDeliverabilityProtections } from "@/lib/growth/deliverability/protection-rules"

export const GROWTH_DELIVERABILITY_INTELLIGENCE_MIGRATION =
  "20270529120000_growth_deliverability_intelligence.sql" as const

function dnsChecksTable(admin: SupabaseClient) {
  return admin.schema("growth").from("domain_dns_checks")
}

export async function isDeliverabilityIntelligenceSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("delivery_event_timeline").select("id").limit(1)
  return !error
}

async function persistLiveDnsCheck(
  admin: SupabaseClient,
  domainId: string,
  result: LiveDnsVerifyResult,
): Promise<void> {
  const now = new Date().toISOString()
  const raw_dns_responses =
    result.source === "live"
      ? normalizeLiveDnsRawResponses(result.raw_dns_responses)
      : result.raw_dns_responses

  await dnsChecksTable(admin).insert({
    domain_id: domainId,
    spf_present: result.check.spf_present,
    spf_valid: result.check.spf_valid,
    dkim_present: result.check.dkim_present,
    dkim_valid: result.check.dkim_valid,
    dmarc_present: result.check.dmarc_present,
    dmarc_valid: result.check.dmarc_valid,
    mx_present: result.check.mx_present,
    mx_valid: result.check.mx_valid,
    mx_provider: result.check.mx_provider,
    dns_health_score: result.dns_health_score,
    health_tier: result.health_tier,
    warnings: result.warnings,
    recommendations: result.recommendations,
    last_checked_at: result.last_verified_at,
    last_verified_at: result.last_verified_at,
    verification_source: result.source,
    verification_error: result.verification_error,
    raw_dns_responses,
    probe_duration_ms: result.probe_duration_ms,
    updated_at: now,
  })
}

export async function runLiveDnsVerificationForDomain(
  admin: SupabaseClient,
  domainId: string,
): Promise<{ ok: boolean; result?: LiveDnsVerifyResult; error?: string }> {
  const { data: domainRow, error } = await admin.schema("growth").from("sender_domains").select("*").eq("id", domainId).maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!domainRow) return { ok: false, error: "domain_not_found" }

  const domain = String((domainRow as Record<string, unknown>).domain ?? "")
  const manualOverride = Boolean((domainRow as Record<string, unknown>).manual_override)
  const dkimSelector = String((domainRow as Record<string, unknown>).dkim_selector ?? "") || undefined
  const trackingDomain = String((domainRow as Record<string, unknown>).tracking_domain ?? "") || null

  let result: LiveDnsVerifyResult

  if (manualOverride) {
    result = await verifyDomainDnsLive({ domain, manualOverride: true })
  } else if (isLiveDnsVerificationEnabled()) {
    result = await verifyDomainDnsLive({
      domain,
      dkimSelectors: dkimSelector ? [dkimSelector] : undefined,
      trackingDomain,
    })
  } else {
    return { ok: false, error: "live_dns_verification_disabled" }
  }

  await persistLiveDnsCheck(admin, domainId, result)

  await updateSenderDomain(admin, domainId, {
    spf_valid: result.check.spf_valid,
    dkim_valid: result.check.dkim_valid,
    dmarc_valid: result.check.dmarc_valid,
    mx_valid: result.check.mx_valid,
  })

  await admin.schema("growth").from("sender_domains").update({
    dns_checked_at: result.last_verified_at,
    deliverability_score: result.dns_health_score,
    verification_source: result.source,
    last_verified_at: result.last_verified_at,
    verification_error: result.verification_error,
    updated_at: new Date().toISOString(),
  }).eq("id", domainId)

  const health = await computeDomainOperationalHealth(admin, domainId)
  await admin.schema("growth").from("sender_domains").update({
    domain_health_score: health.domainHealthScore,
    domain_risk_level: health.domainRiskLevel,
    operational_status: health.operationalStatus,
    health_summary: health.riskReasons.join("; ") || null,
    updated_at: new Date().toISOString(),
  }).eq("id", domainId)

  if (result.verification_error || result.health_tier === "critical" || result.health_tier === "degraded") {
    await recordDeliveryTimelineEvent(admin, {
      normalizedType: "dns_failure",
      severity: result.health_tier === "critical" ? "critical" : "high",
      title: `DNS verification ${result.verification_error ? "failed" : "degraded"}: ${domain}`,
      summary: result.verification_error ?? result.warnings.join(" "),
      domainId,
      occurredAt: result.last_verified_at,
      dedupeKey: `dns-verify:${domainId}:${result.last_verified_at.slice(0, 13)}`,
      metadata: { verification_source: result.source, health_tier: result.health_tier },
    }).catch(() => undefined)

    await appendDeliverabilityTimelineEvent(admin, {
      domainId,
      eventType: "dns_health_declined",
      title: `DNS health ${result.health_tier}: ${domain}`,
      summary: result.warnings[0] ?? result.verification_error ?? "DNS degraded",
      severity: result.health_tier === "critical" ? "critical" : "high",
    }).catch(() => undefined)
  }

  await evaluateDeliverabilityProtections(admin, { domainId, trigger: "dns_verification" }).catch(() => undefined)

  return { ok: true, result }
}

export async function runLiveDnsVerificationForAllDomains(
  admin: SupabaseClient,
  limit = 25,
): Promise<{ verified: number; failed: number; skipped: number }> {
  if (!isLiveDnsVerificationEnabled()) {
    return { verified: 0, failed: 0, skipped: 0 }
  }

  const domains = await listSenderDomains(admin)
  let verified = 0
  let failed = 0
  let skipped = 0

  for (const domain of domains.slice(0, limit)) {
    if (domain.manual_override) {
      skipped += 1
      continue
    }
    const outcome = await runLiveDnsVerificationForDomain(admin, domain.id)
    if (outcome.ok) verified += 1
    else failed += 1
  }

  return { verified, failed, skipped }
}

/** Stub validation path — explicit only, never silent fallback when live is enabled. */
export async function runStubDnsValidationForDomain(
  admin: SupabaseClient,
  domainId: string,
  hints?: Record<string, boolean>,
): Promise<void> {
  if (isLiveDnsVerificationEnabled()) {
    throw new Error("stub_dns_blocked_when_live_enabled")
  }

  const { data: domainRow } = await admin.schema("growth").from("sender_domains").select("domain").eq("id", domainId).maybeSingle()
  if (!domainRow) throw new Error("domain_not_found")

  const validation = validateDnsDomain({
    domain: String((domainRow as Record<string, unknown>).domain),
    stub_mode: true,
    hints,
  })

  await dnsChecksTable(admin).insert({
    domain_id: domainId,
    spf_present: validation.spf_present,
    spf_valid: validation.spf_valid,
    dkim_present: validation.dkim_present,
    dkim_valid: validation.dkim_valid,
    dmarc_present: validation.dmarc_present,
    dmarc_valid: validation.dmarc_valid,
    mx_present: validation.mx_present,
    mx_valid: validation.mx_valid,
    mx_provider: validation.mx_provider,
    dns_health_score: validation.dns_health_score,
    health_tier: validation.health_tier,
    warnings: validation.warnings,
    recommendations: validation.recommendations,
    last_checked_at: validation.checked_at,
    last_verified_at: validation.checked_at,
    verification_source: "stub",
    updated_at: new Date().toISOString(),
  })
}
