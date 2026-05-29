/** Human-readable labels for browser intake duplicate match rules — client-safe. */

export const GROWTH_BROWSER_INTAKE_MATCH_RULE_LABELS: Record<string, string> = {
  website_domain: "Matched by domain",
  website_company: "Matched by domain and company name",
  linkedin: "Matched by LinkedIn URL",
  linkedin_metadata: "Matched by LinkedIn URL",
  company_name: "Matched by company name",
  email: "Matched by email",
  explicit: "Existing lead selected",
  explicit_target: "Updating selected lead",
}

export function formatBrowserIntakeMatchRuleLabel(rule: string | null | undefined): string {
  const key = (rule ?? "").trim()
  if (!key) return "Matched existing lead"
  return GROWTH_BROWSER_INTAKE_MATCH_RULE_LABELS[key] ?? `Matched by ${key.replace(/_/g, " ")}`
}
