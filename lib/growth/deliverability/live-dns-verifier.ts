import "server-only"

import { Resolver } from "node:dns/promises"
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

export type LiveDnsProbeLogEntry = {
  domain: string
  resolver_used: string[]
  spf_records_returned: string[]
  dmarc_records_returned: string[]
  dkim_selector_attempted: string | null
  resolver_error: string | null
}

const PUBLIC_DNS_RESOLVERS = ["1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4"] as const

const RECOVERABLE_DNS_ERROR_CODES = new Set([
  "ENODATA",
  "ENOTFOUND",
  "ETIMEOUT",
  "ETIMEDOUT",
  "ESERVFAIL",
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
])

const DEFAULT_DKIM_SELECTORS = ["google", "default", "s1", "selector1", "k1"]

const EMPTY_DKIM_PROBE = {
  present: false,
  valid: false,
  selector: null as string | null,
  records: [] as string[],
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@/, "")
}

function createPublicDnsResolver(): Resolver {
  const resolver = new Resolver()
  resolver.setServers([...PUBLIC_DNS_RESOLVERS])
  return resolver
}

function resolverErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code
    return code ? `${code}: ${error.message}` : error.message
  }
  return String(error)
}

function isRecoverableDnsError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code
  return typeof code === "string" && RECOVERABLE_DNS_ERROR_CODES.has(code)
}

function logLiveDnsProbe(entry: LiveDnsProbeLogEntry): void {
  console.info("[growth-live-dns]", JSON.stringify(entry))
}

async function resolveTxtSafe(resolver: Resolver, name: string): Promise<{ records: string[][]; error: string | null }> {
  try {
    return { records: await resolver.resolveTxt(name), error: null }
  } catch (error) {
    if (isRecoverableDnsError(error)) {
      return { records: [], error: resolverErrorMessage(error) }
    }
    throw error
  }
}

async function resolveMxSafe(
  resolver: Resolver,
  domain: string,
): Promise<{ records: Array<{ exchange: string; priority: number }>; error: string | null }> {
  try {
    return { records: await resolver.resolveMx(domain), error: null }
  } catch (error) {
    if (isRecoverableDnsError(error)) {
      return { records: [], error: resolverErrorMessage(error) }
    }
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

async function probeDkim(
  resolver: Resolver,
  domain: string,
  selectors: string[],
  probeLog: LiveDnsProbeLogEntry[],
): Promise<{ present: boolean; valid: boolean; selector: string | null; records: string[]; selector_errors: string[] }> {
  const selector_errors: string[] = []

  for (const selector of selectors) {
    const host = `${selector}._domainkey.${domain}`
    const { records: txtChunks, error } = await resolveTxtSafe(resolver, host)
    const txt = flattenTxt(txtChunks)

    probeLog.push({
      domain,
      resolver_used: [...PUBLIC_DNS_RESOLVERS],
      spf_records_returned: [],
      dmarc_records_returned: [],
      dkim_selector_attempted: selector,
      resolver_error: error,
    })

    if (error) {
      selector_errors.push(`${selector}: ${error}`)
      continue
    }

    const dkim = txt.find((record) => record.includes("v=DKIM1") || record.includes("p="))
    if (dkim) {
      return { present: true, valid: dkim.includes("p="), selector, records: txt, selector_errors }
    }
  }

  return { present: false, valid: false, selector: null, records: [], selector_errors }
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

export function normalizeLiveDnsRawResponses(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    resolver_used: raw.resolver_used ?? [...PUBLIC_DNS_RESOLVERS],
    probe_log: raw.probe_log ?? [],
    root_txt: raw.root_txt ?? [],
    dmarc_txt: raw.dmarc_txt ?? [],
    mx: raw.mx ?? [],
    dkim: raw.dkim ?? EMPTY_DKIM_PROBE,
    ...raw,
  }
}

/** Live DNS verification — explicit public resolvers; partial results preserved on probe errors. */
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

  const resolver = createPublicDnsResolver()
  const probeLog: LiveDnsProbeLogEntry[] = []
  const raw_dns_responses: Record<string, unknown> = {
    resolver_used: [...PUBLIC_DNS_RESOLVERS],
    probe_log: probeLog,
    root_txt: [],
    dmarc_txt: [],
    mx: [],
    dkim: EMPTY_DKIM_PROBE,
  }

  let verification_error: string | null = null
  const warnings: string[] = []

  const rootLookup = await resolveTxtSafe(resolver, domain)
  const rootTxt = flattenTxt(rootLookup.records)
  raw_dns_responses.root_txt = rootTxt
  logLiveDnsProbe({
    domain,
    resolver_used: [...PUBLIC_DNS_RESOLVERS],
    spf_records_returned: rootTxt,
    dmarc_records_returned: [],
    dkim_selector_attempted: null,
    resolver_error: rootLookup.error,
  })
  if (rootLookup.error) {
    warnings.push(`SPF lookup warning: ${rootLookup.error}`)
  }

  const spf = validateSpf(findSpfRecord(rootTxt))

  const dmarcLookup = await resolveTxtSafe(resolver, `_dmarc.${domain}`)
  const dmarcTxt = flattenTxt(dmarcLookup.records)
  raw_dns_responses.dmarc_txt = dmarcTxt
  logLiveDnsProbe({
    domain,
    resolver_used: [...PUBLIC_DNS_RESOLVERS],
    spf_records_returned: [],
    dmarc_records_returned: dmarcTxt,
    dkim_selector_attempted: null,
    resolver_error: dmarcLookup.error,
  })
  if (dmarcLookup.error) {
    warnings.push(`DMARC lookup warning: ${dmarcLookup.error}`)
  }

  const dmarc = validateDmarc(findDmarcRecord(dmarcTxt))

  const mxLookup = await resolveMxSafe(resolver, domain)
  raw_dns_responses.mx = mxLookup.records
  if (mxLookup.error) {
    warnings.push(`MX lookup warning: ${mxLookup.error}`)
  }

  const mx_present = mxLookup.records.length > 0
  const mx_valid = mx_present
  const mx_provider = inferMxProvider(mxLookup.records)

  const selectors = [...new Set([...(input.dkimSelectors ?? []), ...DEFAULT_DKIM_SELECTORS])]
  const dkim = await probeDkim(resolver, domain, selectors, probeLog)
  raw_dns_responses.dkim = {
    present: dkim.present,
    valid: dkim.valid,
    selector: dkim.selector,
    records: dkim.records,
    selector_errors: dkim.selector_errors,
  }
  if (dkim.selector_errors.length > 0) {
    warnings.push(`DKIM selector probe warnings: ${dkim.selector_errors.join("; ")}`)
  }

  let tracking_domain_ready = false
  if (input.trackingDomain?.trim()) {
    const tracking = normalizeDomain(input.trackingDomain)
    try {
      const cname = await resolver.resolveCname(tracking).catch(() => null)
      raw_dns_responses.tracking_cname = cname
      tracking_domain_ready = Boolean(cname)
    } catch (error) {
      if (isRecoverableDnsError(error)) {
        raw_dns_responses.tracking_cname = null
        warnings.push(`Tracking domain lookup warning: ${resolverErrorMessage(error)}`)
      } else {
        throw error
      }
    }
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
  const recommendations = generateDnsRecommendations({ ...check, stub_mode: false })
  warnings.push(...generateDnsWarnings({ ...check, stub_mode: false }))

  if (!spf.valid) warnings.push("SPF record missing or invalid (live probe).")
  if (!dkim.valid) warnings.push("DKIM record not found for configured selectors (live probe).")
  if (!dmarc.valid) warnings.push("DMARC record missing or policy not found (live probe).")
  if (!mx_valid) warnings.push("MX records missing (live probe).")

  return {
    source: "live",
    check,
    dns_health_score: evaluation.dns_health_score,
    health_tier: evaluation.health_tier,
    warnings: [...new Set(warnings)],
    recommendations,
    raw_dns_responses: normalizeLiveDnsRawResponses(raw_dns_responses),
    verification_error,
    probe_duration_ms: Date.now() - started,
    last_verified_at,
    tracking_domain_ready,
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
