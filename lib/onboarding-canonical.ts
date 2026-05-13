/**
 * Canonical onboarding form value helpers.
 *
 * Marketing forms (industry landing pages, /free-trial) and the onboarding
 * page can use slightly different display labels and option lists. This module
 * is the single normalization layer that converts any incoming variant
 * (slug, label, legacy value) into the canonical option used by the
 * onboarding `<select>` controls so prepopulation and persistence "just work".
 *
 * Keep this file in sync with the marketing site's `lib/onboarding-canonical*`
 * module (mirrored there) so both ends agree on canonical values.
 */

import { normalizeIndustryKey } from "@/lib/demo-seeding/profiles"
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"

/** Canonical team-size buckets shown in the onboarding workspace step. */
export const ONBOARDING_TEAM_SIZE_OPTIONS = [
  "1-3",
  "4-10",
  "11-25",
  "26-50",
  "51-100",
  "100+",
] as const
export type OnboardingTeamSize = (typeof ONBOARDING_TEAM_SIZE_OPTIONS)[number]

/** Canonical "current system" options shown in the onboarding workspace step. */
export const ONBOARDING_CURRENT_SYSTEM_OPTIONS = [
  "Spreadsheets / Paper",
  "ServiceTitan",
  "Housecall Pro",
  "Jobber",
  "FieldEdge",
  "Workiz",
  "FieldPulse",
  "Knowify",
  "ServiceMax",
  "Salesforce Field Service",
  "Custom / In-house",
  "Other FSM Software",
  "None / Starting Fresh",
] as const
export type OnboardingCurrentSystem = (typeof ONBOARDING_CURRENT_SYSTEM_OPTIONS)[number]

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

/** ---- Industry ---- */

export function normalizeOnboardingIndustry(
  value: string | null | undefined,
): WorkspaceIndustryKey {
  return normalizeIndustryKey(value)
}

/** ---- Team size ---- */

/**
 * Aliases mapping common marketing-form values (slugs and human labels) onto
 * canonical team-size buckets. Stored slug-form for stable lookup.
 */
const TEAM_SIZE_ALIASES: Record<string, OnboardingTeamSize> = {
  // Marketing labels (slugified)
  "just-me": "1-3",
  "1": "1-3",
  "1-2": "1-3",
  "2-3": "1-3",
  "2-5-people": "4-10",
  "3-5": "4-10",
  "5-10": "4-10",
  "6-15-people": "11-25",
  "11-20": "11-25",
  "16-50-people": "26-50",
  "20-50": "26-50",
  "50-people": "51-100",
  "50-100": "51-100",
  "100-people": "100+",
  "100": "100+",
  "100-plus": "100+",
  // Canonical (slugified for safe lookup)
  "1-3": "1-3",
  "4-10": "4-10",
  "11-25": "11-25",
  "26-50": "26-50",
  "51-100": "51-100",
}

const ONBOARDING_TEAM_SIZE_SET = new Set<string>(ONBOARDING_TEAM_SIZE_OPTIONS)

export function normalizeOnboardingTeamSize(
  value: string | null | undefined,
): OnboardingTeamSize | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (ONBOARDING_TEAM_SIZE_SET.has(trimmed)) return trimmed as OnboardingTeamSize
  const slug = slugify(trimmed)
  // "100+" slugifies to "100"; check explicit canonicals first.
  if (slug === "100" && trimmed.includes("+")) return "100+"
  return TEAM_SIZE_ALIASES[slug] ?? null
}

/** ---- Current system ---- */

/** Synonyms / legacy phrasing → canonical option. Lookup is slug-form. */
const CURRENT_SYSTEM_ALIASES: Record<string, OnboardingCurrentSystem> = {
  // Spreadsheets / paper variants
  "spreadsheets-paper": "Spreadsheets / Paper",
  "spreadsheets": "Spreadsheets / Paper",
  "paper": "Spreadsheets / Paper",
  "excel": "Spreadsheets / Paper",
  "google-sheets": "Spreadsheets / Paper",
  // FSM products
  "servicetitan": "ServiceTitan",
  "service-titan": "ServiceTitan",
  "housecall-pro": "Housecall Pro",
  "housecallpro": "Housecall Pro",
  "jobber": "Jobber",
  "fieldedge": "FieldEdge",
  "field-edge": "FieldEdge",
  "workiz": "Workiz",
  "fieldpulse": "FieldPulse",
  "field-pulse": "FieldPulse",
  "knowify": "Knowify",
  "servicemax": "ServiceMax",
  "service-max": "ServiceMax",
  "salesforce-field-service": "Salesforce Field Service",
  "salesforce": "Salesforce Field Service",
  "custom-in-house": "Custom / In-house",
  "custom-inhouse": "Custom / In-house",
  "in-house": "Custom / In-house",
  "custom": "Custom / In-house",
  // "Other" variants (marketing forms use "Other"; app uses "Other FSM Software")
  "other": "Other FSM Software",
  "other-fsm-software": "Other FSM Software",
  "other-fsm": "Other FSM Software",
  "other-field-service": "Other FSM Software",
  // "None" variants (marketing forms use "None / Not using one"; app uses "None / Starting Fresh")
  "none": "None / Starting Fresh",
  "none-not-using-one": "None / Starting Fresh",
  "none-starting-fresh": "None / Starting Fresh",
  "starting-fresh": "None / Starting Fresh",
  "nothing": "None / Starting Fresh",
}

const ONBOARDING_CURRENT_SYSTEM_SET = new Set<string>(ONBOARDING_CURRENT_SYSTEM_OPTIONS)

export function normalizeOnboardingCurrentSystem(
  value: string | null | undefined,
): OnboardingCurrentSystem | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (ONBOARDING_CURRENT_SYSTEM_SET.has(trimmed)) {
    return trimmed as OnboardingCurrentSystem
  }
  const slug = slugify(trimmed)
  return CURRENT_SYSTEM_ALIASES[slug] ?? null
}

/** ---- Search-param shape & parser ---- */

export type OnboardingPrefill = {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  company: string | null
  industry: WorkspaceIndustryKey
  /** True when industry was supplied via query (vs. defaulted) */
  industryFromQuery: boolean
  teamSize: OnboardingTeamSize | null
  currentSystem: OnboardingCurrentSystem | null
}

type SearchParamsLike = {
  get(key: string): string | null
}

function trimToNull(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Single source of truth for reading & normalizing onboarding query params.
 * Supports legacy aliases:
 *   - `industry` | `ainsleyIndustry`
 *   - `currentSystem` | `current_system`
 *   - `teamSize` | `team_size` | `numberOfTechs`
 */
export function parseOnboardingSearchParams(searchParams: SearchParamsLike): OnboardingPrefill {
  const rawIndustry =
    trimToNull(searchParams.get("industry")) ??
    trimToNull(searchParams.get("ainsleyIndustry"))
  const rawTeamSize =
    trimToNull(searchParams.get("teamSize")) ??
    trimToNull(searchParams.get("team_size")) ??
    trimToNull(searchParams.get("numberOfTechs"))
  const rawCurrentSystem =
    trimToNull(searchParams.get("currentSystem")) ??
    trimToNull(searchParams.get("current_system"))

  return {
    firstName: trimToNull(searchParams.get("firstName")),
    lastName: trimToNull(searchParams.get("lastName")),
    email: trimToNull(searchParams.get("email")),
    phone: trimToNull(searchParams.get("phone")),
    company: trimToNull(searchParams.get("company")),
    industry: normalizeOnboardingIndustry(rawIndustry),
    industryFromQuery: rawIndustry !== null,
    teamSize: normalizeOnboardingTeamSize(rawTeamSize),
    currentSystem: normalizeOnboardingCurrentSystem(rawCurrentSystem),
  }
}
