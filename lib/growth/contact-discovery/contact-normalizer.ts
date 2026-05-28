import { createHash } from "node:crypto"
import { scoreContactCandidateConfidence } from "@/lib/growth/contact-discovery/contact-confidence"
import type {
  GrowthContactDiscoveryAttribution,
  GrowthContactDiscoveryEvidence,
  GrowthContactVerificationState,
} from "@/lib/growth/contact-discovery/contact-discovery-types"
import type { GrowthContactDiscoveryProviderRawContact } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

const GUESSED_EMAIL_RE = /^[a-z]+[._-]?[a-z]+@/i

function isLinkedInUrl(value: string): boolean {
  return /linkedin\.com\/in\//i.test(value)
}

function splitName(fullName: string): { first: string | null; last: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: null, last: null }
  if (parts.length === 1) return { first: parts[0]!, last: null }
  return { first: parts[0]!, last: parts.slice(1).join(" ") }
}

export function buildContactDedupeHash(input: {
  company_candidate_id: string
  full_name: string
  job_title: string | null
}): string {
  const key = [
    input.company_candidate_id,
    input.full_name.toLowerCase(),
    (input.job_title ?? "").toLowerCase(),
  ].join("|")
  return createHash("sha256").update(key).digest("hex").slice(0, 40)
}

export type NormalizedContactCandidate = {
  full_name: string
  first_name: string | null
  last_name: string | null
  job_title: string | null
  department: string | null
  seniority: string | null
  linkedin_url: string | null
  email: string | null
  phone: string | null
  verification_state: GrowthContactVerificationState
  confidence: number
  evidence: GrowthContactDiscoveryEvidence[]
  source_attribution: GrowthContactDiscoveryAttribution[]
  dedupe_hash: string
  metadata: Record<string, unknown>
}

function sanitizePii(
  raw: GrowthContactDiscoveryProviderRawContact,
  provider_type: string,
): {
  email: string | null
  phone: string | null
  linkedin_url: string | null
  verification_state: GrowthContactVerificationState
} {
  const emailRaw = asString(raw.email)
  const phoneRaw = asString(raw.phone)
  const linkedinRaw = asString(raw.linkedin_url)
  const observed = raw.pii_observed === true

  if (!observed) {
    if (emailRaw || phoneRaw || linkedinRaw) {
      return {
        email: null,
        phone: null,
        linkedin_url: null,
        verification_state: "insufficient_evidence",
      }
    }
    return {
      email: null,
      phone: null,
      linkedin_url: null,
      verification_state: "unverified",
    }
  }

  let verification_state: GrowthContactVerificationState = "unverified"
  let email: string | null = null
  let phone: string | null = null
  let linkedin_url: string | null = null

  if (emailRaw) {
    if (GUESSED_EMAIL_RE.test(emailRaw) && !["internal_growth", "website_public_extract"].includes(provider_type)) {
      verification_state = "insufficient_evidence"
    } else if (emailRaw.includes("@")) {
      email = emailRaw
    }
  }

  if (phoneRaw && phoneRaw.replace(/\D/g, "").length >= 10) {
    phone = phoneRaw
  }

  if (linkedinRaw && isLinkedInUrl(linkedinRaw)) {
    linkedin_url = linkedinRaw
  }

  return { email, phone, linkedin_url, verification_state }
}

export function normalizeContactCandidate(
  raw: GrowthContactDiscoveryProviderRawContact,
  provider_name: string,
  provider_type: string,
  company_candidate_id: string,
): NormalizedContactCandidate | null {
  const full_name = asString(raw.full_name)
  if (!full_name || full_name.length < 2) return null

  const { first, last } = splitName(full_name)
  const job_title = asString(raw.job_title) || null
  const pii = sanitizePii(raw, provider_type)

  const evidence =
    raw.evidence.length > 0
      ? raw.evidence
      : [
          {
            claim: "Contact role candidate",
            evidence: `${full_name}${job_title ? ` — ${job_title}` : ""} from ${provider_name}.`,
            source: `growth.contact_discovery.${provider_type}`,
          },
        ]

  const source_attribution =
    raw.source_attribution.length > 0
      ? raw.source_attribution
      : [
          {
            source: `growth.contact_discovery.${provider_type}`,
            provider_type,
            provider_name,
            signal: "discover",
            evidence: evidence[0]!.evidence,
            confidence: typeof raw.confidence === "number" ? raw.confidence : 0.5,
          },
        ]

  const base_confidence =
    typeof raw.confidence === "number"
      ? Math.min(0.9, Math.max(0, raw.confidence))
      : source_attribution[0]!.confidence

  const confidence = scoreContactCandidateConfidence({
    base_confidence,
    evidence_count: evidence.length,
    verification_state: pii.verification_state,
    has_observed_email: Boolean(pii.email),
    has_observed_phone: Boolean(pii.phone),
    has_observed_linkedin: Boolean(pii.linkedin_url),
    title_role_match: Boolean(job_title),
  })

  return {
    full_name,
    first_name: asString(raw.first_name) || first,
    last_name: asString(raw.last_name) || last,
    job_title,
    department: asString(raw.department) || null,
    seniority: asString(raw.seniority) || null,
    linkedin_url: pii.linkedin_url,
    email: pii.email,
    phone: pii.phone,
    verification_state: pii.verification_state,
    confidence,
    evidence,
    source_attribution,
    dedupe_hash: buildContactDedupeHash({ company_candidate_id, full_name, job_title }),
    metadata: {
      ...(raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {}),
      pii_observed: raw.pii_observed === true,
    },
  }
}

export function dedupeNormalizedContacts(
  rows: NormalizedContactCandidate[],
): NormalizedContactCandidate[] {
  const seen = new Set<string>()
  const out: NormalizedContactCandidate[] = []
  for (const row of rows) {
    if (seen.has(row.dedupe_hash)) continue
    seen.add(row.dedupe_hash)
    out.push(row)
  }
  return out
}
