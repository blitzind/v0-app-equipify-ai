import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildGoogleWorkspaceSpfRecord,
  buildRecommendedDmarcRecord,
  computeEqualWeightDeliverabilityBreakdown,
  deliverabilitySetupHealthLabel,
  GOOGLE_WORKSPACE_MX_RECORDS,
  GROWTH_DOMAIN_DELIVERABILITY_SETUP_QA_MARKER,
  pointsForRecordStatus,
  recordStatusFromCheck,
  type GrowthDomainCopySetupCandidate,
  type GrowthDomainDnsRecordEntry,
  type GrowthDomainDnsRecordSection,
  type GrowthDomainDeliverabilitySetupInstructions,
} from "@/lib/growth/deliverability/domain-deliverability-setup-types"
import type { GrowthDnsCheckResult } from "@/lib/growth/deliverability/deliverability-types"
import { isLiveDnsVerificationEnabled } from "@/lib/growth/deliverability/live-dns-verifier"
import { listSenderDomains } from "@/lib/growth/sender/sender-repository"

type DnsCheckRow = {
  spf_present: boolean
  spf_valid: boolean
  dkim_present: boolean
  dkim_valid: boolean
  dmarc_present: boolean
  dmarc_valid: boolean
  mx_present: boolean
  mx_valid: boolean
  mx_provider: string | null
  last_checked_at: string | null
  last_verified_at: string | null
  raw_dns_responses: Record<string, unknown> | null
}

type SenderDomainRow = {
  id: string
  domain: string
  dkim_selector: string | null
  deliverability_score: number
  last_verified_at: string | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function dnsChecksTable(admin: SupabaseClient) {
  return admin.schema("growth").from("domain_dns_checks")
}

async function loadSenderDomain(admin: SupabaseClient, domainId: string): Promise<SenderDomainRow | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("sender_domains")
    .select("id, domain, dkim_selector, deliverability_score, last_verified_at")
    .eq("id", domainId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as Record<string, unknown>
  return {
    id: asString(row.id),
    domain: asString(row.domain),
    dkim_selector: asString(row.dkim_selector) || null,
    deliverability_score: Number(row.deliverability_score ?? 0),
    last_verified_at: asString(row.last_verified_at) || null,
  }
}

async function loadLatestDnsCheck(admin: SupabaseClient, domainId: string): Promise<DnsCheckRow | null> {
  const { data, error } = await dnsChecksTable(admin)
    .select(
      "spf_present, spf_valid, dkim_present, dkim_valid, dmarc_present, dmarc_valid, mx_present, mx_valid, mx_provider, last_checked_at, last_verified_at, raw_dns_responses",
    )
    .eq("domain_id", domainId)
    .order("last_checked_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as Record<string, unknown>
  const raw = row.raw_dns_responses
  return {
    spf_present: Boolean(row.spf_present),
    spf_valid: Boolean(row.spf_valid),
    dkim_present: Boolean(row.dkim_present),
    dkim_valid: Boolean(row.dkim_valid),
    dmarc_present: Boolean(row.dmarc_present),
    dmarc_valid: Boolean(row.dmarc_valid),
    mx_present: Boolean(row.mx_present),
    mx_valid: Boolean(row.mx_valid),
    mx_provider: asString(row.mx_provider) || null,
    last_checked_at: asString(row.last_checked_at) || null,
    last_verified_at: asString(row.last_verified_at) || null,
    raw_dns_responses:
      raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null,
  }
}

async function hasGoogleMailboxOnDomain(admin: SupabaseClient, domain: string): Promise<boolean> {
  const suffix = `@${domain.trim().toLowerCase()}`
  const { data, error } = await admin
    .schema("growth")
    .from("sender_accounts")
    .select("id, email_address, provider_family")
    .ilike("email_address", `%${suffix}`)
    .limit(20)

  if (error) return false

  return (data ?? []).some((row) => {
    const email = asString((row as Record<string, unknown>).email_address).toLowerCase()
    const provider = asString((row as Record<string, unknown>).provider_family).toLowerCase()
    return email.endsWith(suffix) && provider === "google"
  })
}

function extractSpfFromRaw(raw: Record<string, unknown> | null): string | null {
  const rootTxt = raw?.root_txt
  if (!Array.isArray(rootTxt)) return null
  const match = rootTxt.map(String).find((record) => record.toLowerCase().startsWith("v=spf1"))
  return match ?? null
}

function extractDmarcFromRaw(raw: Record<string, unknown> | null): string | null {
  const dmarcTxt = raw?.dmarc_txt
  if (!Array.isArray(dmarcTxt)) return null
  const match = dmarcTxt.map(String).find((record) => record.toLowerCase().startsWith("v=dmarc1"))
  return match ?? null
}

function extractMxFromRaw(raw: Record<string, unknown> | null): GrowthDomainDnsRecordEntry[] {
  const mx = raw?.mx
  if (!Array.isArray(mx)) return []

  return mx
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const record = entry as Record<string, unknown>
      const exchange = asString(record.exchange)
      const priority = Number(record.priority)
      if (!exchange) return null
      return {
        record_type: "MX" as const,
        host: "@",
        value: exchange,
        priority: Number.isFinite(priority) ? priority : undefined,
      }
    })
    .filter((entry): entry is GrowthDomainDnsRecordEntry => entry !== null)
}

function extractDkimFromRaw(
  raw: Record<string, unknown> | null,
  domain: string,
  fallbackSelector: string | null,
): { records: GrowthDomainDnsRecordEntry[]; selector: string | null } {
  const dkim = raw?.dkim
  if (!dkim || typeof dkim !== "object" || Array.isArray(dkim)) {
    return { records: [], selector: fallbackSelector }
  }

  const record = dkim as Record<string, unknown>
  const selector = asString(record.selector) || fallbackSelector
  const txtRecords = Array.isArray(record.records) ? record.records.map(String) : []
  const value = txtRecords.find((line) => line.includes("p=") || line.toLowerCase().includes("v=dkim1"))

  if (!selector || !value) {
    return { records: [], selector }
  }

  return {
    selector,
    records: [
      {
        record_type: "TXT",
        host: `${selector}._domainkey.${domain}`,
        value,
      },
    ],
  }
}

function buildGoogleMxRecordEntries(): GrowthDomainDnsRecordEntry[] {
  return GOOGLE_WORKSPACE_MX_RECORDS.map((record) => ({
    record_type: "MX",
    host: "@",
    value: record.exchange,
    priority: record.priority,
  }))
}

function buildMxSection(
  domain: string,
  check: GrowthDnsCheckResult,
  verifiedAt: string | null,
  isGoogle: boolean,
  observedRecords: GrowthDomainDnsRecordEntry[],
): GrowthDomainDnsRecordSection {
  const status = recordStatusFromCheck(check.mx_present, check.mx_valid)
  const records =
    observedRecords.length > 0
      ? observedRecords
      : isGoogle
        ? buildGoogleMxRecordEntries()
        : [
            {
              record_type: "MX" as const,
              host: "@",
              value: "mail.your-provider.example",
              priority: 10,
            },
          ]

  return {
    kind: "mx",
    title: "MX Records",
    purpose:
      "Mail exchanger (MX) records tell receiving servers where to deliver inbound email for your domain.",
    records,
    operator_instructions: isGoogle
      ? "Google Workspace uses the five MX hosts below. Remove legacy MX records before adding Google's."
      : "Add MX records from your mailbox provider. If you use Google Workspace, switch detection or copy from a verified Google domain.",
    status,
    points: pointsForRecordStatus(status),
    verified_at: verifiedAt,
  }
}

function buildSpfSection(
  domain: string,
  check: GrowthDnsCheckResult,
  verifiedAt: string | null,
  isGoogle: boolean,
  observedValue: string | null,
): GrowthDomainDnsRecordSection {
  const status = recordStatusFromCheck(check.spf_present, check.spf_valid)
  const value = observedValue ?? (isGoogle ? buildGoogleWorkspaceSpfRecord() : `v=spf1 include:send.${domain} ~all`)

  return {
    kind: "spf",
    title: "SPF Record",
    purpose:
      "Sender Policy Framework (SPF) authorizes which mail servers can send email on behalf of your domain.",
    records: [
      {
        record_type: "TXT",
        host: "@",
        value,
      },
    ],
    operator_instructions: isGoogle
      ? "Publish this TXT record at the root of your domain. Only one SPF record is allowed."
      : "Replace the include host with your outbound provider if you are not on Google Workspace.",
    status,
    points: pointsForRecordStatus(status),
    verified_at: verifiedAt,
  }
}

function buildDkimSection(
  domain: string,
  check: GrowthDnsCheckResult,
  verifiedAt: string | null,
  isGoogle: boolean,
  dkimSelector: string | null,
  observed: { records: GrowthDomainDnsRecordEntry[]; selector: string | null },
): GrowthDomainDnsRecordSection {
  const status = recordStatusFromCheck(check.dkim_present, check.dkim_valid)
  const selector = observed.selector ?? dkimSelector ?? (isGoogle ? "google" : "default")
  const records =
    observed.records.length > 0
      ? observed.records
      : [
          {
            record_type: "TXT" as const,
            host: `${selector}._domainkey.${domain}`,
            value: "Generate in your mailbox admin console — value is unique per domain.",
          },
        ]

  const googleInstructions = [
    "Sign in to Google Admin → Apps → Google Workspace → Gmail → Authenticate email.",
    `Start authentication for ${domain} and generate a DKIM key (selector is often "google").`,
    `Publish the TXT record at ${selector}._domainkey.${domain} with the value Google provides.`,
    "Click Start authentication in Admin after DNS propagates.",
  ].join(" ")

  return {
    kind: "dkim",
    title: "DKIM Record",
    purpose:
      "DomainKeys Identified Mail (DKIM) adds a cryptographic signature so receivers can verify message authenticity.",
    records,
    operator_instructions: isGoogle
      ? googleInstructions
      : `Create a DKIM TXT record at ${selector}._domainkey.${domain} using your provider's signing console.`,
    status,
    points: pointsForRecordStatus(status),
    verified_at: verifiedAt,
  }
}

function buildDmarcSection(
  domain: string,
  check: GrowthDnsCheckResult,
  verifiedAt: string | null,
  isGoogle: boolean,
  observedValue: string | null,
): GrowthDomainDnsRecordSection {
  const status = recordStatusFromCheck(check.dmarc_present, check.dmarc_valid)
  const value = observedValue ?? buildRecommendedDmarcRecord(domain)

  return {
    kind: "dmarc",
    title: "DMARC Record",
    purpose:
      "DMARC tells receivers how to handle mail that fails SPF/DKIM and where to send aggregate reports.",
    records: [
      {
        record_type: "TXT",
        host: `_dmarc.${domain}`,
        value,
      },
    ],
    operator_instructions: isGoogle
      ? "Start with p=none while monitoring reports, then tighten to quarantine or reject when authentication is stable."
      : "Adjust the rua mailbox to an address you monitor before tightening policy.",
    status,
    points: pointsForRecordStatus(status),
    verified_at: verifiedAt,
  }
}

function resolveCheckState(
  domainRow: SenderDomainRow,
  dnsCheck: DnsCheckRow | null,
): GrowthDnsCheckResult {
  if (dnsCheck) {
    return {
      spf_present: dnsCheck.spf_present,
      spf_valid: dnsCheck.spf_valid,
      dkim_present: dnsCheck.dkim_present,
      dkim_valid: dnsCheck.dkim_valid,
      dmarc_present: dnsCheck.dmarc_present,
      dmarc_valid: dnsCheck.dmarc_valid,
      mx_present: dnsCheck.mx_present,
      mx_valid: dnsCheck.mx_valid,
      mx_provider: dnsCheck.mx_provider,
    }
  }

  return {
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
}

async function buildCopySetupCandidates(
  admin: SupabaseClient,
  currentDomainId: string,
): Promise<GrowthDomainCopySetupCandidate[]> {
  const domains = await listSenderDomains(admin)
  const candidates: GrowthDomainCopySetupCandidate[] = []

  for (const domain of domains) {
    if (domain.id === currentDomainId) continue
    const check = await loadLatestDnsCheck(admin, domain.id)
    const googleMailbox = await hasGoogleMailboxOnDomain(admin, domain.domain)
    const isGoogle = check?.mx_provider === "google" || googleMailbox
    const breakdown = computeEqualWeightDeliverabilityBreakdown(resolveCheckState(
      { id: domain.id, domain: domain.domain, dkim_selector: domain.dkim_selector, deliverability_score: domain.deliverability_score, last_verified_at: domain.last_verified_at },
      check,
    ))

    candidates.push({
      domain_id: domain.id,
      domain: domain.domain,
      deliverability_score: breakdown.total,
      is_google_workspace: isGoogle,
    })
  }

  return candidates.sort((a, b) => b.deliverability_score - a.deliverability_score)
}

export function mergeObservedDnsFromSource(
  targetDomain: string,
  targetDkimSelector: string | null,
  sourceRaw: Record<string, unknown> | null,
  sourceMxProvider: string | null,
): {
  mxRecords: GrowthDomainDnsRecordEntry[]
  spfValue: string | null
  dmarcValue: string | null
  dkim: { records: GrowthDomainDnsRecordEntry[]; selector: string | null }
  isGoogle: boolean
} {
  const isGoogle = sourceMxProvider === "google"
  const mxRecords = extractMxFromRaw(sourceRaw)
  const spfValue = extractSpfFromRaw(sourceRaw)
  const dmarcValue = extractDmarcFromRaw(sourceRaw)
  const dkim = extractDkimFromRaw(sourceRaw, targetDomain, targetDkimSelector)

  if (isGoogle && mxRecords.length === 0) {
    return {
      mxRecords: buildGoogleMxRecordEntries(),
      spfValue: spfValue ?? buildGoogleWorkspaceSpfRecord(),
      dmarcValue: dmarcValue ?? buildRecommendedDmarcRecord(targetDomain),
      dkim,
      isGoogle: true,
    }
  }

  return {
    mxRecords,
    spfValue,
    dmarcValue: dmarcValue ?? (isGoogle ? buildRecommendedDmarcRecord(targetDomain) : null),
    dkim,
    isGoogle,
  }
}

export async function buildDomainDeliverabilitySetupInstructions(
  admin: SupabaseClient,
  domainId: string,
  options?: {
    copiedFromDomainId?: string | null
    copiedFromDomain?: string | null
    observedOverride?: {
      mxRecords?: GrowthDomainDnsRecordEntry[]
      spfValue?: string | null
      dmarcValue?: string | null
      dkim?: { records: GrowthDomainDnsRecordEntry[]; selector: string | null }
      isGoogle?: boolean
    }
  },
): Promise<GrowthDomainDeliverabilitySetupInstructions | null> {
  const domainRow = await loadSenderDomain(admin, domainId)
  if (!domainRow) return null

  const dnsCheck = await loadLatestDnsCheck(admin, domainId)
  const check = resolveCheckState(domainRow, dnsCheck)
  const verifiedAt =
    dnsCheck?.last_verified_at ?? dnsCheck?.last_checked_at ?? domainRow.last_verified_at ?? null

  const googleMailbox = await hasGoogleMailboxOnDomain(admin, domainRow.domain)
  const isGoogle =
    options?.observedOverride?.isGoogle ??
    (check.mx_provider === "google" || googleMailbox)

  const raw = dnsCheck?.raw_dns_responses ?? null
  const observedMx = options?.observedOverride?.mxRecords ?? extractMxFromRaw(raw)
  const observedSpf = options?.observedOverride?.spfValue ?? extractSpfFromRaw(raw)
  const observedDmarc = options?.observedOverride?.dmarcValue ?? extractDmarcFromRaw(raw)
  const observedDkim =
    options?.observedOverride?.dkim ?? extractDkimFromRaw(raw, domainRow.domain, domainRow.dkim_selector)

  const sections: GrowthDomainDnsRecordSection[] = [
    buildMxSection(domainRow.domain, check, verifiedAt, isGoogle, observedMx),
    buildSpfSection(domainRow.domain, check, verifiedAt, isGoogle, observedSpf),
    buildDkimSection(domainRow.domain, check, verifiedAt, isGoogle, domainRow.dkim_selector, observedDkim),
    buildDmarcSection(domainRow.domain, check, verifiedAt, isGoogle, observedDmarc),
  ]

  const scoreBreakdown = computeEqualWeightDeliverabilityBreakdown(check)

  return {
    qa_marker: GROWTH_DOMAIN_DELIVERABILITY_SETUP_QA_MARKER,
    domain_id: domainRow.id,
    domain: domainRow.domain,
    is_google_workspace: isGoogle,
    mx_provider: check.mx_provider,
    deliverability_score: scoreBreakdown.total,
    health_label: deliverabilitySetupHealthLabel(scoreBreakdown.total),
    score_breakdown: scoreBreakdown,
    sections,
    last_verified_at: verifiedAt,
    live_dns_enabled: isLiveDnsVerificationEnabled(),
    copy_setup_candidates: await buildCopySetupCandidates(admin, domainId),
    copied_from_domain_id: options?.copiedFromDomainId ?? null,
    copied_from_domain: options?.copiedFromDomain ?? null,
  }
}

export async function copyDomainDeliverabilitySetupFromSource(
  admin: SupabaseClient,
  targetDomainId: string,
  sourceDomainId: string,
): Promise<GrowthDomainDeliverabilitySetupInstructions | null> {
  if (targetDomainId === sourceDomainId) {
    throw new Error("copy_setup_same_domain")
  }

  const sourceRow = await loadSenderDomain(admin, sourceDomainId)
  if (!sourceRow) throw new Error("source_domain_not_found")

  const targetRow = await loadSenderDomain(admin, targetDomainId)
  if (!targetRow) return null

  const sourceCheck = await loadLatestDnsCheck(admin, sourceDomainId)
  const merged = mergeObservedDnsFromSource(
    targetRow.domain,
    targetRow.dkim_selector,
    sourceCheck?.raw_dns_responses ?? null,
    sourceCheck?.mx_provider ?? null,
  )

  return buildDomainDeliverabilitySetupInstructions(admin, targetDomainId, {
    copiedFromDomainId: sourceRow.id,
    copiedFromDomain: sourceRow.domain,
    observedOverride: {
      mxRecords: merged.mxRecords,
      spfValue: merged.spfValue,
      dmarcValue: merged.dmarcValue,
      dkim: merged.dkim,
      isGoogle: merged.isGoogle,
    },
  })
}
