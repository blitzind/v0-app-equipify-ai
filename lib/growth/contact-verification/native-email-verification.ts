/**
 * GE-EI-IMP-5A — AI OS native email verification engine (diagnostic foundation).
 * Deterministic syntax/domain/DNS checks only. No SMTP probing. Not default runtime path.
 */

import {
  resolveNativeRecipientEmailConfidence,
  type NativeRecipientEmailConfidenceResult,
} from "@/lib/growth/contact-verification/confidence-signals-native"
import {
  isDisposableEmailDomain,
  isFreeEmailDomain,
  isRoleEmailLocalPart,
} from "@/lib/growth/import/email-classifiers"
import { isValidGrowthEmailFormat } from "@/lib/growth/import/email-format"
import { normalizeEmail, parseEmailDomain, parseEmailLocalPart } from "@/lib/growth/import/normalize"

export const GROWTH_NATIVE_EMAIL_VERIFICATION_QA_MARKER = "native-email-verification-v1" as const

export type NativeEmailVerificationEngineVersion = typeof GROWTH_NATIVE_EMAIL_VERIFICATION_QA_MARKER

export type NativeEmailVerificationInput = {
  email: string
  skipDns?: boolean
  timeoutMs?: number
}

export type NativeEmailVerificationStatus = "valid" | "risky" | "invalid" | "unknown"

export type NativeEmailVerificationResult = {
  normalized_email: string | null
  domain: string | null
  local_part: string | null
  syntax_valid: boolean
  domain_parsed: boolean
  disposable: boolean
  role_account: boolean
  free_email: boolean
  business_domain: boolean
  mx_checked: boolean
  mx_exists: boolean | null
  mx_records: string[]
  spf_checked: boolean
  spf_present: boolean | null
  dmarc_checked: boolean
  dmarc_present: boolean | null
  catch_all_checked: false
  catch_all: null
  smtp_checked: false
  smtp_verified: null
  confidence: NativeRecipientEmailConfidenceResult
  status: NativeEmailVerificationStatus
  reasons: string[]
  warnings: string[]
  duration_ms: number
  engine_version: NativeEmailVerificationEngineVersion
}

export type NativeEmailVerificationDnsLookup = {
  resolveMx: (domain: string) => Promise<Array<{ exchange: string; priority?: number }>>
  resolveTxt: (hostname: string) => Promise<string[][]>
}

export type NativeEmailVerificationDependencies = {
  dnsLookup?: NativeEmailVerificationDnsLookup
  now?: () => number
}

const DEFAULT_TIMEOUT_MS = 3_000

let cachedDefaultDnsLookup: NativeEmailVerificationDnsLookup | null = null

async function getDefaultDnsLookup(): Promise<NativeEmailVerificationDnsLookup> {
  if (cachedDefaultDnsLookup) return cachedDefaultDnsLookup
  const { promises: dns } = await import("node:dns")
  cachedDefaultDnsLookup = {
    resolveMx: (domain) => dns.resolveMx(domain),
    resolveTxt: (hostname) => dns.resolveTxt(hostname),
  }
  return cachedDefaultDnsLookup
}

async function withDnsTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<{ ok: true; value: T } | { ok: false; timedOut: boolean; error?: string }> {
  let timer: NodeJS.Timeout | undefined
  try {
    const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
      timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs)
    })
    const result = await Promise.race([
      promise.then((value) => ({ kind: "value" as const, value })),
      timeoutPromise.then((value) => ({ kind: "timeout" as const, ...value })),
    ])
    if (result.kind === "timeout") {
      return { ok: false, timedOut: true }
    }
    return { ok: true, value: result.value }
  } catch (error) {
    return {
      ok: false,
      timedOut: false,
      error: error instanceof Error ? error.message : "dns_lookup_failed",
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function txtRecordsIncludeSpf(records: string[][]): boolean {
  return records.some((row) => row.some((entry) => entry.trim().toLowerCase().startsWith("v=spf1")))
}

function txtRecordsIncludeDmarc(records: string[][]): boolean {
  return records.some((row) => row.some((entry) => entry.trim().toLowerCase().startsWith("v=dmarc1")))
}

function resolveNativeVerificationStatus(input: {
  syntax_valid: boolean
  domain_parsed: boolean
  disposable: boolean
  role_account: boolean
  free_email: boolean
  business_domain: boolean
  mx_checked: boolean
  mx_exists: boolean | null
  dns_warning: boolean
}): NativeEmailVerificationStatus {
  if (!input.syntax_valid) return "invalid"
  if (input.disposable) return "invalid"
  if (!input.domain_parsed) return "invalid"
  if (input.mx_checked && input.mx_exists === false) return "invalid"

  if (input.role_account) return "risky"
  if (input.free_email) return "risky"
  if (input.dns_warning) return "risky"

  if (!input.mx_checked) return "unknown"

  if (input.business_domain && input.mx_exists === true) return "valid"

  return "risky"
}

export async function verifyEmailNatively(
  input: NativeEmailVerificationInput,
  dependencies: NativeEmailVerificationDependencies = {},
): Promise<NativeEmailVerificationResult> {
  const startedAt = dependencies.now?.() ?? Date.now()
  const reasons: string[] = []
  const warnings: string[] = []
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const dnsLookup = dependencies.dnsLookup ?? (await getDefaultDnsLookup())

  try {
    const normalizedEmail = normalizeEmail(input.email)
    const syntaxValid = isValidGrowthEmailFormat(input.email)
    const domain = parseEmailDomain(input.email)
    const localPart = parseEmailLocalPart(input.email)
    const domainParsed = Boolean(domain)
    const disposable = isDisposableEmailDomain(domain)
    const roleAccount = isRoleEmailLocalPart(localPart)
    const freeEmail = isFreeEmailDomain(domain)
    const businessDomain = domainParsed && !freeEmail && !disposable

    if (!syntaxValid) reasons.push("invalid_syntax")
    if (disposable) reasons.push("disposable_domain")
    if (!domainParsed) reasons.push("domain_unparsed")
    if (roleAccount) reasons.push("role_account")
    if (freeEmail) reasons.push("free_email_domain")
    if (businessDomain) reasons.push("business_domain")

    let mxChecked = false
    let mxExists: boolean | null = null
    let mxRecords: string[] = []
    let spfChecked = false
    let spfPresent: boolean | null = null
    let dmarcChecked = false
    let dmarcPresent: boolean | null = null
    let dnsWarning = false

    if (!input.skipDns && domainParsed && domain && syntaxValid && !disposable) {
      const mxResult = await withDnsTimeout(dnsLookup.resolveMx(domain), timeoutMs)
      mxChecked = true
      if (mxResult.ok) {
        mxRecords = mxResult.value
          .map((row) => row.exchange)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
        mxExists = mxRecords.length > 0
        if (mxExists) reasons.push("mx_records_found")
        else reasons.push("mx_records_missing")
      } else {
        mxExists = null
        dnsWarning = true
        warnings.push(mxResult.timedOut ? "mx_lookup_timeout" : "mx_lookup_failed")
        reasons.push(mxResult.timedOut ? "dns_timeout" : "dns_lookup_failed")
      }

      const spfResult = await withDnsTimeout(dnsLookup.resolveTxt(domain), timeoutMs)
      spfChecked = true
      if (spfResult.ok) {
        spfPresent = txtRecordsIncludeSpf(spfResult.value)
        if (spfPresent) reasons.push("spf_present")
        else reasons.push("spf_missing")
      } else {
        spfPresent = null
        dnsWarning = true
        warnings.push(spfResult.timedOut ? "spf_lookup_timeout" : "spf_lookup_failed")
      }

      const dmarcResult = await withDnsTimeout(dnsLookup.resolveTxt(`_dmarc.${domain}`), timeoutMs)
      dmarcChecked = true
      if (dmarcResult.ok) {
        dmarcPresent = txtRecordsIncludeDmarc(dmarcResult.value)
        if (dmarcPresent) reasons.push("dmarc_present")
        else reasons.push("dmarc_missing")
      } else {
        dmarcPresent = null
        dnsWarning = true
        warnings.push(dmarcResult.timedOut ? "dmarc_lookup_timeout" : "dmarc_lookup_failed")
      }
    } else if (input.skipDns) {
      warnings.push("dns_skipped")
      reasons.push("dns_skipped")
    }

    const status = resolveNativeVerificationStatus({
      syntax_valid: syntaxValid,
      domain_parsed: domainParsed,
      disposable,
      role_account: roleAccount,
      free_email: freeEmail,
      business_domain: businessDomain,
      mx_checked: mxChecked,
      mx_exists: mxExists,
      dns_warning: dnsWarning,
    })

    const confidence = resolveNativeRecipientEmailConfidence({
      email: normalizedEmail ?? input.email,
    })

    return {
      normalized_email: normalizedEmail,
      domain,
      local_part: localPart,
      syntax_valid: syntaxValid,
      domain_parsed: domainParsed,
      disposable,
      role_account: roleAccount,
      free_email: freeEmail,
      business_domain: businessDomain,
      mx_checked: mxChecked,
      mx_exists: mxExists,
      mx_records: mxRecords,
      spf_checked: spfChecked,
      spf_present: spfPresent,
      dmarc_checked: dmarcChecked,
      dmarc_present: dmarcPresent,
      catch_all_checked: false,
      catch_all: null,
      smtp_checked: false,
      smtp_verified: null,
      confidence,
      status,
      reasons,
      warnings,
      duration_ms: Math.max(0, (dependencies.now?.() ?? Date.now()) - startedAt),
      engine_version: GROWTH_NATIVE_EMAIL_VERIFICATION_QA_MARKER,
    }
  } catch (error) {
    const confidence = resolveNativeRecipientEmailConfidence({ email: input.email })
    return {
      normalized_email: null,
      domain: null,
      local_part: null,
      syntax_valid: false,
      domain_parsed: false,
      disposable: false,
      role_account: false,
      free_email: false,
      business_domain: false,
      mx_checked: false,
      mx_exists: null,
      mx_records: [],
      spf_checked: false,
      spf_present: null,
      dmarc_checked: false,
      dmarc_present: null,
      catch_all_checked: false,
      catch_all: null,
      smtp_checked: false,
      smtp_verified: null,
      confidence,
      status: "unknown",
      reasons: ["verification_failed_safely"],
      warnings: [error instanceof Error ? error.message : "unknown_error"],
      duration_ms: Math.max(0, (dependencies.now?.() ?? Date.now()) - startedAt),
      engine_version: GROWTH_NATIVE_EMAIL_VERIFICATION_QA_MARKER,
    }
  }
}
