import "server-only"

import { promises as dns } from "node:dns"
import { evaluateDnsHealth } from "@/lib/growth/deliverability/dns-health"
import { generateDnsWarnings, generateDnsRecommendations } from "@/lib/growth/deliverability/dns-recommendations"
import type { GrowthDnsCheckResult } from "@/lib/growth/deliverability/deliverability-types"
import type { GrowthDnsVerificationSource } from "@/lib/growth/deliverability/deliverability-intelligence-types"

export type LiveDnsVerifyInput = {
  domain: string
  dkimSelectors?: string[]
  trackingDomain?: string | null
  manualOverride?: boolean
}

export type LiveDnsVerifyResult = {
  source: GrowthDnsVerificationSource
  check: GrowthDnsCheckResult
  dns_health_score: number
  health_tier: ReturnType<typeof evaluateDnsHealth>["health_tier"]
  warnings: string[]
  recommendations: string[]
  raw_dns_responses: Record<string, unknown>
  verification_error: string | null
  probe_duration_ms: number
  last_verified_at: string
  tracking_domain_ready: boolean
}

const DEFAULT_DKIM_SELECTORS = ["google", "default", "s1", "selector1", "k1"]

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@/, "")
}

async function resolveTxtSafe(name: string): Promise<string[][]> {
  try {
    return await dns.resolveTxt(name)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ENODATA" || code === "ENOTFOUND") return []
    throw error
  }
}

async function resolveMxSafe(domain: string): Promise<Array<{ exchange: string; priority: number }>> {
  try {
    return await dns.resolveMx(domain)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ENODATA" || code === "ENOTFOUND") return []
    throw error
  }
}

function flattenTxt(records: string[][]): string[] {
  return records.map((chunks) => chunks.join(""))
}

function findSpfRecord(txtRecords: string[]): string | null {
  return txtRecords.find((record) => record.toLowerCase().startsWith("v=spf1")) ?? null
}

function findDmarcRecord(txtRecords: string[]): string | null {
  return txtRecords.find((record) => record.toLowerCase().startsWith("v=dmarc1")) ?? null
}

function validateSpf(spf: string | null): { present: boolean; valid: boolean } {
  if (!spf) return { present: false, valid: false }
  const valid = /^v=spf1/i.test(spf) && spf.length <= 450
  return { present: true, valid }
}

function validateDmarc(dmarc: string | null): { present: boolean; valid: boolean } {
  if (!dmarc) return { present: false, valid: false }
  const valid = /^v=dmarc1/i.test(dmarc) && /;\s*p\s*=/i.test(dmarc)
  return { present: true, valid }
}

async function probeDkim(domain: string, selectors: string[]): Promise<{ present: boolean; valid: boolean; selector: string | null; records: string[] }> {
  for (const selector of selectors) {
    const host = `${selector}._domainkey.${domain}`
    const txt = flattenTxt(await resolveTxtSafe(host))
    const dkim = txt.find((record) => record.includes("v=DKIM1") || record.includes("p="))
    if (dkim) {
      return { present: true, valid: dkim.includes("p="), selector, records: txt }
    }
  }
  return { present: false, valid: false, selector: null, records: [] }
}

function inferMxProvider(mxRecords: Array<{ exchange: string; priority: number }>): string | null {
  if (mxRecords.length === 0) return null
  const host = mxRecords.sort((a, b) => a.priority - b.priority)[0]?.exchange.toLowerCase() ?? ""
  if (host.includes("google") || host.includes("gmail")) return "google"
  if (host.includes("outlook") || host.includes("microsoft")) return "microsoft"
  return host.split(".").slice(-2).join(".") || null
}

export function isLiveDnsVerificationEnabled(): boolean {
  return process.env.GROWTH_LIVE_DNS_VERIFICATION?.trim() === "true"
}

/** Live DNS verification — deterministic resolver probes only. No stub fallback when enabled. */
export async function verifyDomainDnsLive(input: LiveDnsVerifyInput): Promise<LiveDnsVerifyResult> {
  const started = Date.now()
  const domain = normalizeDomain(input.domain)
  const last_verified_at = new Date().toISOString()

  if (input.manualOverride) {
    return buildManualOverrideResult(domain, last_verified_at, started)
  }

  if (!isLiveDnsVerificationEnabled()) {
    throw new Error("live_dns_verification_disabled")
  }

  const raw_dns_responses: Record<string, unknown> = {}
  let verification_error: string | null = null

  try {
    const rootTxt = flattenTxt(await resolveTxtSafe(domain))
    raw_dns_responses.root_txt = rootTxt

    const spfRecord = findSpfRecord(rootTxt)
    const spf = validateSpf(spfRecord)

    const dmarcTxt = flattenTxt(await resolveTxtSafe(`_dmarc.${domain}`))
    raw_dns_responses.dmarc_txt = dmarcTxt
    const dmarc = validateDmarc(findDmarcRecord(dmarcTxt))

    const mxRecords = await resolveMxSafe(domain)
    raw_dns_responses.mx = mxRecords
    const mx_present = mxRecords.length > 0
    const mx_valid = mx_present
    const mx_provider = inferMxProvider(mxRecords)

    const selectors = [...new Set([...(input.dkimSelectors ?? []), ...DEFAULT_DKIM_SELECTORS])]
    const dkim = await probeDkim(domain, selectors)
    raw_dns_responses.dkim = dkim

    let tracking_domain_ready = false
    if (input.trackingDomain?.trim()) {
      const tracking = normalizeDomain(input.trackingDomain)
      const cname = await dns.resolveCname(tracking).catch(() => null)
      raw_dns_responses.tracking_cname = cname
      tracking_domain_ready = Boolean(cname)
    }

    const check: GrowthDnsCheckResult = {
      spf_present: spf.present,
      spf_valid: spf.valid,
      dkim_present: dkim.present,
      dkim_valid: dkim.valid,
      dmarc_present: dmarc.present,
      dmarc_valid: dmarc.valid,
      mx_present,
      mx_valid,
      mx_provider,
    }

    const evaluation = evaluateDnsHealth({ ...check, stub_mode: false })
    const warnings = generateDnsWarnings({ ...check, stub_mode: false })
    const recommendations = generateDnsRecommendations({ ...check, stub_mode: false })

    if (!spf.valid) warnings.push("SPF record missing or invalid (live probe).")
    if (!dkim.valid) warnings.push("DKIM record not found for configured selectors (live probe).")
    if (!dmarc.valid) warnings.push("DMARC record missing or policy not found (live probe).")
    if (!mx_valid) warnings.push("MX records missing (live probe).")

    return {
      source: "live",
      check,
      dns_health_score: evaluation.dns_health_score,
      health_tier: evaluation.health_tier,
      warnings,
      recommendations,
      raw_dns_responses,
      verification_error: null,
      probe_duration_ms: Date.now() - started,
      last_verified_at,
      tracking_domain_ready,
    }
  } catch (error) {
    verification_error = error instanceof Error ? error.message : String(error)
    const emptyCheck: GrowthDnsCheckResult = {
      spf_present: false,
      spf_valid: false,
      dkim_present: false,
      dkim_valid: false,
      dmarc_present: false,
      dmarc_valid: false,
      mx_present: false,
      mx_valid: false,
      mx_provider: null,
    }
    const evaluation = evaluateDnsHealth({ ...emptyCheck, stub_mode: false })
    return {
      source: "live",
      check: emptyCheck,
      dns_health_score: evaluation.dns_health_score,
      health_tier: "critical",
      warnings: [`Live DNS probe failed: ${verification_error}`],
      recommendations: ["Verify DNS propagation and retry live verification."],
      raw_dns_responses,
      verification_error,
      probe_duration_ms: Date.now() - started,
      last_verified_at,
      tracking_domain_ready: false,
    }
  }
}

function buildManualOverrideResult(domain: string, last_verified_at: string, started: number): LiveDnsVerifyResult {
  const check: GrowthDnsCheckResult = {
    spf_present: true,
    spf_valid: true,
    dkim_present: true,
    dkim_valid: true,
    dmarc_present: true,
    dmarc_valid: true,
    mx_present: true,
    mx_valid: true,
    mx_provider: null,
  }
  const evaluation = evaluateDnsHealth({ ...check, stub_mode: false })
  return {
    source: "manual_override",
    check,
    dns_health_score: evaluation.dns_health_score,
    health_tier: evaluation.health_tier,
    warnings: ["MANUAL OVERRIDE — operator attested DNS readiness; live probe skipped."],
    recommendations: [],
    raw_dns_responses: { manual_override: true, domain },
    verification_error: null,
    probe_duration_ms: Date.now() - started,
    last_verified_at,
    tracking_domain_ready: false,
  }
}
