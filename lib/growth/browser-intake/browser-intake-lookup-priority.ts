/** Match priority for browser intake lookup — client-safe. */

import type { BrowserIntakeLeadLookupMatch } from "@/lib/growth/browser-intake/browser-intake-types"

const MATCH_RULE_PRIORITY: Record<string, number> = {
  linkedin: 10,
  linkedin_metadata: 20,
  email: 30,
  website_company: 40,
  website_domain: 50,
  company_name: 60,
  explicit: 0,
  explicit_target: 1,
}

export function browserIntakeMatchRulePriority(rule: string | null | undefined): number {
  return MATCH_RULE_PRIORITY[(rule ?? "").trim()] ?? 99
}

export function compareBrowserIntakeLeadMatches(
  a: BrowserIntakeLeadLookupMatch,
  b: BrowserIntakeLeadLookupMatch,
): number {
  const priorityDiff =
    browserIntakeMatchRulePriority(a.rule) - browserIntakeMatchRulePriority(b.rule)
  if (priorityDiff !== 0) return priorityDiff
  return b.confidence - a.confidence
}

export function sortBrowserIntakeLeadMatches(
  matches: BrowserIntakeLeadLookupMatch[],
): BrowserIntakeLeadLookupMatch[] {
  return [...matches].sort(compareBrowserIntakeLeadMatches)
}

export function pickBestBrowserIntakeLeadMatchByPriority(
  matches: BrowserIntakeLeadLookupMatch[],
): BrowserIntakeLeadLookupMatch | null {
  const sorted = sortBrowserIntakeLeadMatches(matches)
  return sorted[0] ?? null
}
