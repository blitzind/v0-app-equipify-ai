/**
 * GE-AIOS-INSTITUTIONAL-LEARNING-1B — Canonical display identity (client-safe).
 * Computed once at Growth 5F package generation; reused downstream. No persistence table.
 */

import { canonicalNormalizedCompanyName } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import {
  CANONICAL_IDENTITY_PRECEDENCE,
  GROWTH_AIOS_CANONICAL_DISPLAY_IDENTITY_1B_QA_MARKER,
  type GrowthCanonicalDisplayIdentity,
  type GrowthCanonicalIdentityEntity,
  type GrowthCanonicalIdentityKind,
  type GrowthCanonicalIdentitySource,
} from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b-types"

export {
  CANONICAL_IDENTITY_PRECEDENCE,
  GROWTH_AIOS_CANONICAL_DISPLAY_IDENTITY_1B_QA_MARKER,
} from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b-types"
export type {
  GrowthCanonicalDisplayIdentity,
  GrowthCanonicalIdentityEntity,
  GrowthCanonicalIdentityKind,
  GrowthCanonicalIdentitySource,
} from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b-types"

/** Authoritative brand spellings — not title-case rules; exact forms only. */
export const AUTHORITATIVE_BRAND_CANONICALS: Record<string, string> = {
  "block imaging": "Block Imaging",
  equipify: "Equipify.ai",
  "equipify.ai": "Equipify.ai",
  "ge healthcare": "GE HealthCare",
  "siemens healthineers": "Siemens Healthineers",
  mckesson: "McKesson",
  eclinicalworks: "eClinicalWorks",
  "johnson controls": "Johnson Controls",
  "fisherman's village": "Fisherman's Village",
  "fishermans village": "Fisherman's Village",
}

function cleanDisplay(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ")
  return trimmed || null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeKey(value: string): string {
  return canonicalNormalizedCompanyName(value) ?? value.trim().toLowerCase()
}

export function resolveAuthoritativeForm(value: string): string {
  const key = normalizeKey(value)
  return AUTHORITATIVE_BRAND_CANONICALS[key] ?? value.trim().replace(/\s+/g, " ")
}

function appendKnownBrandDegradedForms(canonical: string, degraded: Set<string>): void {
  for (const [key, value] of Object.entries(AUTHORITATIVE_BRAND_CANONICALS)) {
    if (value !== canonical) continue
    degraded.add(key)
    degraded.add(key.toLowerCase())
    if (/^[a-z]/.test(key)) {
      degraded.add(
        key.replace(/\b\w/g, (char) => char.toUpperCase()),
      )
    }
  }
}

function buildDegradedForms(canonical: string, candidates: Array<string | null | undefined>): string[] {
  const degraded = new Set<string>()
  const canonicalKey = normalizeKey(canonical)

  for (const candidate of candidates) {
    const cleaned = cleanDisplay(candidate)
    if (!cleaned || cleaned === canonical) continue
    if (normalizeKey(cleaned) !== canonicalKey) continue
    degraded.add(cleaned)
    degraded.add(cleaned.toLowerCase())
    if (/^[A-Z]/.test(canonical) && cleaned !== canonical) {
      degraded.add(cleaned)
    }
  }

  degraded.add(canonical.toLowerCase())
  appendKnownBrandDegradedForms(canonical, degraded)

  if (/^[a-z]/.test(canonical)) {
    const titleCased = canonical.replace(/\b\w/g, (char) => char.toUpperCase())
    if (titleCased !== canonical) degraded.add(titleCased)
  }

  degraded.delete(canonical)
  return [...degraded].filter(Boolean)
}

function buildEntity(input: {
  kind: GrowthCanonicalIdentityKind
  canonical: string
  source: GrowthCanonicalIdentitySource
  candidates: Array<string | null | undefined>
}): GrowthCanonicalIdentityEntity {
  const canonical = resolveAuthoritativeForm(input.canonical)
  return {
    kind: input.kind,
    canonical,
    source: input.source,
    degradedForms: buildDegradedForms(canonical, input.candidates),
  }
}

function pickByPrecedence(
  candidates: Array<{ value: string | null | undefined; source: GrowthCanonicalIdentitySource }>,
): { value: string; source: GrowthCanonicalIdentitySource } | null {
  for (const precedence of CANONICAL_IDENTITY_PRECEDENCE) {
    const match = candidates.find((row) => row.source === precedence && cleanDisplay(row.value))
    if (match?.value) {
      return { value: resolveAuthoritativeForm(match.value), source: match.source }
    }
  }
  return null
}

export function extractVerifiedCompanyNameFromEvidence(
  verifiedEvidence: string[] | null | undefined,
): string | null {
  for (const line of verifiedEvidence ?? []) {
    const match = line.match(
      /Verified description[^:]*:\s*([A-Za-z0-9][^.]{1,120}?)\s+(?:is|was|specializ|provid|operat|deliver|offer|focus)/i,
    )
    if (match?.[1]) return cleanDisplay(match[1])
  }
  return null
}

export function extractWebsiteBrandingName(input: {
  website?: string | null
  verifiedEvidence?: string[] | null
  prospectKnowledgePackCompanyName?: string | null
}): string | null {
  const fromEvidence = extractVerifiedCompanyNameFromEvidence(input.verifiedEvidence)
  if (fromEvidence) return fromEvidence
  return cleanDisplay(input.prospectKnowledgePackCompanyName)
}

export function resolveCanonicalDisplayIdentity(input: {
  originalCompanyName: string | null | undefined
  verifiedCanonicalCompanyName?: string | null
  websiteBrandingName?: string | null
  crmCompanyName?: string | null
  prospectResearchCompanyName?: string | null
  operatorCompanyOverride?: string | null
  contactName?: string | null
  sellerCompanyName?: string | null
  sellerWebsite?: string | null
  productNames?: string[] | null
  preserveOperatorOverrides?: Partial<Record<GrowthCanonicalIdentityKind, string>> | null
}): GrowthCanonicalDisplayIdentity {
  const allCompanyCandidates: Array<{
    value: string | null | undefined
    source: GrowthCanonicalIdentitySource
  }> = [
    { value: input.operatorCompanyOverride, source: "operator_override" },
    { value: input.preserveOperatorOverrides?.company, source: "operator_override" },
    { value: input.verifiedCanonicalCompanyName, source: "verified_company_identity" },
    { value: input.websiteBrandingName, source: "official_website_branding" },
    { value: input.crmCompanyName, source: "canonical_crm_record" },
    { value: input.prospectResearchCompanyName, source: "prospect_research" },
    { value: input.originalCompanyName, source: "original_source" },
  ]

  const picked = pickByPrecedence(allCompanyCandidates)
  const companyCanonical =
    picked?.value ?? resolveAuthoritativeForm(input.originalCompanyName ?? "this company")

  const companyCandidates = allCompanyCandidates.map((row) => row.value)

  const operatorOverrides: Partial<Record<GrowthCanonicalIdentityKind, string>> = {
    ...(input.preserveOperatorOverrides ?? {}),
  }
  if (input.operatorCompanyOverride) {
    operatorOverrides.company = resolveAuthoritativeForm(input.operatorCompanyOverride)
  }

  const sellerCanonical = input.sellerCompanyName
    ? resolveAuthoritativeForm(input.sellerCompanyName)
    : input.sellerWebsite?.includes("equipify")
      ? "Equipify.ai"
      : null

  const people: GrowthCanonicalIdentityEntity[] = []
  const contact = cleanDisplay(input.contactName)
  if (contact) {
    people.push(
      buildEntity({
        kind: "person",
        canonical: contact,
        source: "original_source",
        candidates: [contact],
      }),
    )
  }

  const products = (input.productNames ?? [])
    .map((name) => cleanDisplay(name))
    .filter((name): name is string => Boolean(name))
    .slice(0, 8)
    .map((name) =>
      buildEntity({
        kind: "product",
        canonical: resolveAuthoritativeForm(name),
        source: "prospect_research",
        candidates: [name],
      }),
    )

  const brands: GrowthCanonicalIdentityEntity[] = []
  if (sellerCanonical) {
    brands.push(
      buildEntity({
        kind: "brand",
        canonical: sellerCanonical,
        source: "verified_company_identity",
        candidates: [input.sellerCompanyName, input.sellerWebsite],
      }),
    )
  }

  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DISPLAY_IDENTITY_1B_QA_MARKER,
    company: buildEntity({
      kind: "company",
      canonical: operatorOverrides.company ?? companyCanonical,
      source: picked?.source ?? "original_source",
      candidates: companyCandidates,
    }),
    sellerCompany: sellerCanonical
      ? buildEntity({
          kind: "organization",
          canonical: sellerCanonical,
          source: "verified_company_identity",
          candidates: [input.sellerCompanyName, input.sellerWebsite],
        })
      : null,
    products,
    people,
    brands,
    operatorOverrides,
  }
}

export function listCanonicalIdentityEntities(
  identity: GrowthCanonicalDisplayIdentity | null | undefined,
): GrowthCanonicalIdentityEntity[] {
  if (!identity) return []
  return [
    identity.company,
    identity.sellerCompany,
    ...identity.products,
    ...identity.people,
    ...identity.brands,
  ].filter((row): row is GrowthCanonicalIdentityEntity => Boolean(row?.canonical))
}

export function applyCanonicalIdentityToCopy(
  text: string,
  identity: GrowthCanonicalDisplayIdentity | null | undefined,
): string {
  if (!text.trim() || !identity) return text

  const entities = listCanonicalIdentityEntities(identity)
  const placeholders = new Map<string, string>()
  let out = text
  let placeholderIndex = 0

  const protectCanonicalTokens = (value: string): string => {
    let protectedText = value
    for (const entity of entities) {
      if (!entity.canonical) continue
      const canonicalPattern = new RegExp(escapeRegExp(entity.canonical), "g")
      protectedText = protectedText.replace(canonicalPattern, () => {
        const token = `\u0000CANONICAL_${placeholderIndex++}\u0000`
        placeholders.set(token, entity.canonical)
        return token
      })
    }
    return protectedText
  }

  for (const entity of entities) {
    const degradedForms = [...entity.degradedForms].sort((a, b) => b.length - a.length)
    for (const degraded of degradedForms) {
      if (!degraded || degraded === entity.canonical) continue
      const pattern = new RegExp(`\\b${escapeRegExp(degraded)}\\b`, "gi")
      out = out.replace(pattern, entity.canonical)
      out = protectCanonicalTokens(out)
    }
  }

  for (const [token, value] of placeholders) {
    out = out.split(token).join(value)
  }

  return out
}

function isDegradedIdentityOccurrence(match: string, canonical: string): boolean {
  return match !== canonical
}

export function reviewCanonicalIdentityConstitution(
  text: string,
  identity: GrowthCanonicalDisplayIdentity | null | undefined,
): string[] {
  if (!text.trim() || !identity) return []
  const failures: string[] = []
  for (const entity of listCanonicalIdentityEntities(identity)) {
    for (const degraded of entity.degradedForms) {
      if (!degraded || degraded === entity.canonical) continue
      if (
        entity.canonical.includes(".") &&
        entity.canonical.toLowerCase().startsWith(`${degraded.toLowerCase()}.`)
      ) {
        continue
      }
      const pattern = new RegExp(`\\b${escapeRegExp(degraded)}\\b`, "g")
      const matches = text.match(pattern) ?? []
      if (matches.some((match) => isDegradedIdentityOccurrence(match, entity.canonical))) {
        failures.push(
          `canonical_identity:degraded_${entity.kind}:${degraded.replace(/\s+/g, "_")}`,
        )
      }
    }
    // Reject title-case corruption of mixed-case brands (Equipify.Ai, Ge Healthcare)
    if (/[a-z][A-Z]|[A-Z]{2,}[a-z]/.test(entity.canonical)) {
      const wrongTitle = entity.canonical
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ")
      if (
        wrongTitle !== entity.canonical &&
        wrongTitle.toLowerCase() !== entity.canonical.toLowerCase() &&
        new RegExp(`\\b${escapeRegExp(wrongTitle)}\\b`).test(text)
      ) {
        failures.push(`canonical_identity:title_case_corruption:${entity.kind}`)
      }
    }
  }
  return failures
}

export function resolveCanonicalCompanyDisplayName(
  identity: GrowthCanonicalDisplayIdentity | null | undefined,
  fallback: string,
): string {
  return identity?.company.canonical ?? resolveAuthoritativeForm(fallback)
}
