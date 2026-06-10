/** Apollo organization / location match guards — client-safe post-search filters. */

import type { ApolloPersonRecord } from "@/lib/growth/providers/apollo/apollo-types"

function asTrimmedString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

function normalizeOrgToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^www\./i, "")
}

export function personOrganizationMatchesTarget(
  person: ApolloPersonRecord,
  targetDomain: string | null,
  targetCompanyName: string,
): boolean | null {
  const orgDomain = normalizeOrgToken(person.organization?.primary_domain)
  const orgName = normalizeOrgToken(person.organization?.name)
  if (!orgDomain && !orgName) return null

  const targetDomainNorm = normalizeOrgToken(targetDomain)
  if (targetDomainNorm && orgDomain) {
    if (
      orgDomain === targetDomainNorm ||
      orgDomain.endsWith(`.${targetDomainNorm}`) ||
      targetDomainNorm.endsWith(`.${orgDomain}`)
    ) {
      return true
    }
  }

  const targetNameNorm = targetCompanyName.trim().toLowerCase()
  if (targetNameNorm && orgName) {
    const simplify = (value: string) => value.replace(/[^a-z0-9]/g, "")
    const targetToken = simplify(targetNameNorm).slice(0, 12)
    const orgToken = simplify(orgName)
    if (targetToken.length >= 6 && orgToken.includes(targetToken)) return true
    if (orgName.includes(targetNameNorm.slice(0, Math.min(14, targetNameNorm.length)))) return true
  }

  if (targetDomainNorm && orgDomain && orgDomain !== targetDomainNorm) return false
  if (targetNameNorm && orgName && !orgName.includes(targetNameNorm.slice(0, 8))) return false
  return null
}

export function personLocationMatchesTarget(
  person: ApolloPersonRecord,
  targetCity: string | null,
  targetState: string | null,
): boolean | null {
  const personState = asTrimmedString(person.state)?.toLowerCase() ?? null
  const personCity = asTrimmedString(person.city)?.toLowerCase() ?? null
  const state = asTrimmedString(targetState)?.toLowerCase() ?? null
  const city = asTrimmedString(targetCity)?.toLowerCase() ?? null

  if (!state && !city) return null
  if (!personState && !personCity) return null

  if (state && personState) {
    const stateToken = state.replace(/\./g, "").slice(0, 2)
    const personStateToken = personState.replace(/\./g, "").slice(0, 2)
    if (personState === state || personStateToken === stateToken) return true
    if (personState.includes(state) || state.includes(personState)) return true
  }

  if (city && personCity) {
    if (personCity === city || personCity.includes(city) || city.includes(personCity)) return true
  }

  if (state && !personState && !personCity) return false
  if (city && !personCity) return false
  return null
}

export function evaluateApolloOrganizationMatch(input: {
  person: ApolloPersonRecord
  target_domain: string | null
  target_company_name: string
  target_city?: string | null
  target_state?: string | null
  require_organization_match: boolean
  require_location_match: boolean
}): { accepted: boolean; reason: string | null } {
  if (!input.require_organization_match && !input.require_location_match) {
    return { accepted: true, reason: null }
  }

  const orgMatch = personOrganizationMatchesTarget(
    input.person,
    input.target_domain,
    input.target_company_name,
  )

  if (input.require_organization_match) {
    if (orgMatch === false) {
      return { accepted: false, reason: "organization_mismatch" }
    }
    if (orgMatch !== true && !input.target_domain) {
      return { accepted: false, reason: "weak_company_name_mismatch" }
    }
  }

  if (input.require_location_match && !input.target_domain) {
    const locationMatch = personLocationMatchesTarget(
      input.person,
      input.target_city ?? null,
      input.target_state ?? null,
    )
    if (locationMatch === false) {
      return { accepted: false, reason: "location_mismatch" }
    }
    if (locationMatch !== true) {
      return { accepted: false, reason: "location_unverified" }
    }
  }

  return { accepted: true, reason: null }
}
