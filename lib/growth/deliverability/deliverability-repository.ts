import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildDeliverabilityDashboard } from "@/lib/growth/deliverability/deliverability-dashboard"
import {
  appendDeliverabilityTimelineEvent,
  createDeliverabilityEvent,
  listDeliverabilityEvents,
} from "@/lib/growth/deliverability/deliverability-events"
import { buildDeliverabilityEventsFromValidation } from "@/lib/growth/deliverability/deliverability-event-builder"
import {
  computeAuthenticationScore,
  computeInfrastructureScore,
  deliverabilityScoreToRiskLevel,
} from "@/lib/growth/deliverability/deliverability-score"
import type {
  GrowthDeliverabilityDomainRow,
  GrowthDomainDnsCheck,
} from "@/lib/growth/deliverability/deliverability-types"
import { validateDnsDomain } from "@/lib/growth/deliverability/dns-validator"
import { listSenderDomains, updateSenderDomain } from "@/lib/growth/sender/sender-repository"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function dnsChecksTable(admin: SupabaseClient) {
  return admin.schema("growth").from("domain_dns_checks")
}

function snapshotsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("deliverability_snapshots")
}

function mapDnsCheck(row: Record<string, unknown>, domain: string): GrowthDomainDnsCheck {
  return {
    id: asString(row.id),
    domain_id: asString(row.domain_id),
    domain,
    spf_present: Boolean(row.spf_present),
    spf_valid: Boolean(row.spf_valid),
    dkim_present: Boolean(row.dkim_present),
    dkim_valid: Boolean(row.dkim_valid),
    dmarc_present: Boolean(row.dmarc_present),
    dmarc_valid: Boolean(row.dmarc_valid),
    mx_present: Boolean(row.mx_present),
    mx_valid: Boolean(row.mx_valid),
    mx_provider: asString(row.mx_provider) || null,
    dns_health_score: asNumber(row.dns_health_score, 0),
    health_tier: asString(row.health_tier) as GrowthDomainDnsCheck["health_tier"],
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    recommendations: Array.isArray(row.recommendations) ? row.recommendations.map(String) : [],
    last_checked_at: asString(row.last_checked_at),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  }
}

async function getLatestDnsCheckByDomain(
  admin: SupabaseClient,
  domainId: string,
): Promise<GrowthDomainDnsCheck | null> {
  const { data, error } = await dnsChecksTable(admin)
    .select("*")
    .eq("domain_id", domainId)
    .order("last_checked_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const { data: domainRow } = await admin.schema("growth").from("sender_domains").select("domain").eq("id", domainId).maybeSingle()
  return mapDnsCheck(data as Record<string, unknown>, asString((domainRow as Record<string, unknown> | null)?.domain))
}

async function buildDomainRows(admin: SupabaseClient): Promise<GrowthDeliverabilityDomainRow[]> {
  const domains = await listSenderDomains(admin)
  const rows: GrowthDeliverabilityDomainRow[] = []

  for (const domain of domains) {
    const latest = await getLatestDnsCheckByDomain(admin, domain.id)
    const deliverability_score = latest?.dns_health_score ?? domain.deliverability_score
    rows.push({
      domain_id: domain.id,
      domain: domain.domain,
      spf_present: latest?.spf_present ?? domain.spf_valid,
      spf_valid: latest?.spf_valid ?? domain.spf_valid,
      dkim_present: latest?.dkim_present ?? domain.dkim_valid,
      dkim_valid: latest?.dkim_valid ?? domain.dkim_valid,
      dmarc_present: latest?.dmarc_present ?? domain.dmarc_valid,
      dmarc_valid: latest?.dmarc_valid ?? domain.dmarc_valid,
      mx_present: latest?.mx_present ?? domain.mx_valid,
      mx_valid: latest?.mx_valid ?? domain.mx_valid,
      dns_health_score: deliverability_score,
      health_tier: latest?.health_tier ?? (deliverability_score >= 90 ? "healthy" : deliverability_score >= 70 ? "warning" : deliverability_score >= 40 ? "degraded" : "critical"),
      deliverability_score,
      risk_level: deliverabilityScoreToRiskLevel(deliverability_score),
      last_checked_at: latest?.last_checked_at ?? domain.dns_checked_at,
      recommendations: latest?.recommendations ?? [],
    })
  }

  return rows
}

export async function fetchDeliverabilityOverview(admin: SupabaseClient): Promise<{
  domains: GrowthDeliverabilityDomainRow[]
  dns_checks: GrowthDomainDnsCheck[]
}> {
  const domains = await listSenderDomains(admin)
  const domainMap = new Map(domains.map((domain) => [domain.id, domain.domain]))

  const { data, error } = await dnsChecksTable(admin)
    .select("*")
    .order("last_checked_at", { ascending: false })
    .limit(200)

  if (error) throw new Error(error.message)

  const seen = new Set<string>()
  const dns_checks: GrowthDomainDnsCheck[] = []
  for (const row of data ?? []) {
    const domainId = asString((row as Record<string, unknown>).domain_id)
    if (seen.has(domainId)) continue
    seen.add(domainId)
    dns_checks.push(mapDnsCheck(row as Record<string, unknown>, domainMap.get(domainId) ?? ""))
  }

  return {
    domains: await buildDomainRows(admin),
    dns_checks,
  }
}

export async function fetchDeliverabilityDashboard(admin: SupabaseClient) {
  const domains = await buildDomainRows(admin)
  return buildDeliverabilityDashboard(domains)
}

export async function validateDeliverabilityDomain(
  admin: SupabaseClient,
  domainId: string,
  input?: {
    hints?: Partial<{
      spf_valid: boolean
      dkim_valid: boolean
      dmarc_valid: boolean
      mx_valid: boolean
      mx_provider: string | null
    }>
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<{ domain: GrowthDeliverabilityDomainRow; dns_check: GrowthDomainDnsCheck }> {
  const { data: domainRow, error: loadError } = await admin
    .schema("growth")
    .from("sender_domains")
    .select("*")
    .eq("id", domainId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!domainRow) throw new Error("domain_not_found")

  const domainName = asString((domainRow as Record<string, unknown>).domain)
  const previousCheck = await getLatestDnsCheckByDomain(admin, domainId)
  const previousScore = previousCheck?.dns_health_score ?? asNumber((domainRow as Record<string, unknown>).deliverability_score, 0)

  const validation = validateDnsDomain({
    domain: domainName,
    stub_mode: true,
    hints: {
      spf_valid: input?.hints?.spf_valid ?? Boolean((domainRow as Record<string, unknown>).spf_valid),
      dkim_valid: input?.hints?.dkim_valid ?? Boolean((domainRow as Record<string, unknown>).dkim_valid),
      dmarc_valid: input?.hints?.dmarc_valid ?? Boolean((domainRow as Record<string, unknown>).dmarc_valid),
      mx_valid: input?.hints?.mx_valid ?? Boolean((domainRow as Record<string, unknown>).mx_valid),
      mx_provider: input?.hints?.mx_provider ?? null,
    },
  })

  const now = new Date().toISOString()
  const { data: insertedCheck, error: insertError } = await dnsChecksTable(admin)
    .insert({
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
      updated_at: now,
    })
    .select("*")
    .single()

  if (insertError) throw new Error(insertError.message)

  const authentication_score = computeAuthenticationScore(validation)
  const infrastructure_score = computeInfrastructureScore(validation)
  const bounce_risk = Math.max(0, 100 - validation.dns_health_score)
  const spam_risk = validation.warnings.some((w) => /critical/i.test(w)) ? 60 : 30
  const risk_level = deliverabilityScoreToRiskLevel(validation.dns_health_score)
  const snapshotDate = validation.checked_at.slice(0, 10)

  const { error: snapshotError } = await snapshotsTable(admin).upsert(
    {
      domain_id: domainId,
      snapshot_date: snapshotDate,
      deliverability_score: validation.dns_health_score,
      bounce_risk,
      spam_risk,
      authentication_score,
      infrastructure_score,
      health_summary: `${validation.dns_health_score}/100 DNS health (${validation.health_tier}).`,
      risk_level,
    },
    { onConflict: "domain_id,snapshot_date" },
  )
  if (snapshotError) throw new Error(snapshotError.message)

  await updateSenderDomain(admin, domainId, {
    spf_valid: validation.spf_valid,
    dkim_valid: validation.dkim_valid,
    dmarc_valid: validation.dmarc_valid,
    mx_valid: validation.mx_valid,
    actorUserId: input?.actorUserId,
    actorEmail: input?.actorEmail,
  })

  const eventDrafts = buildDeliverabilityEventsFromValidation(domainName, validation, previousScore)
  for (const draft of eventDrafts) {
    await createDeliverabilityEvent(admin, {
      domain_id: domainId,
      event_type: draft.event_type,
      severity: draft.severity,
      title: draft.title,
      description: draft.description,
      metadata: draft.metadata,
    })
    if (draft.timeline_type) {
      await appendDeliverabilityTimelineEvent(admin, {
        eventType: draft.timeline_type,
        title: draft.title,
        summary: draft.description,
        domainId,
        payload: draft.metadata,
        actorUserId: input?.actorUserId,
        actorEmail: input?.actorEmail,
      })
    }
  }

  const dns_check = mapDnsCheck(insertedCheck as Record<string, unknown>, domainName)
  const domain: GrowthDeliverabilityDomainRow = {
    domain_id: domainId,
    domain: domainName,
    spf_present: validation.spf_present,
    spf_valid: validation.spf_valid,
    dkim_present: validation.dkim_present,
    dkim_valid: validation.dkim_valid,
    dmarc_present: validation.dmarc_present,
    dmarc_valid: validation.dmarc_valid,
    mx_present: validation.mx_present,
    mx_valid: validation.mx_valid,
    dns_health_score: validation.dns_health_score,
    health_tier: validation.health_tier,
    deliverability_score: validation.dns_health_score,
    risk_level,
    last_checked_at: validation.checked_at,
    recommendations: validation.recommendations,
  }

  return { domain, dns_check }
}

export { listDeliverabilityEvents }
