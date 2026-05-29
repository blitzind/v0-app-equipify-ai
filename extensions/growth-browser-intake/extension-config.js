/** Shared extension constants — visible metadata only, no hidden scraping. */

const EXTENSION_API_PRESETS = {
  production: "https://app.equipify.ai",
  local: "http://localhost:3000",
}

const INTAKE_PATH = "/api/platform/growth/browser-intake/contact"
const LOOKUP_PATH = "/api/platform/growth/browser-intake/lookup"
const CAPTURED_LEADS_PATH = "/admin/growth/leads/captured"
const SIGN_IN_PATH = "/admin/growth/browser-intake-test"

const MATCH_RULE_LABELS = {
  website_domain: "Matched by domain",
  website_company: "Matched by domain and company name",
  linkedin: "Matched by LinkedIn URL",
  linkedin_metadata: "Matched by LinkedIn URL",
  company_name: "Matched by company name",
  email: "Matched by email",
  explicit: "Existing lead selected",
  explicit_target: "Updating selected lead",
}

function formatMatchRuleLabel(rule) {
  const key = (rule ?? "").trim()
  if (!key) return "Matched existing lead"
  return MATCH_RULE_LABELS[key] ?? `Matched by ${key.replace(/_/g, " ")}`
}

function formatEmailStatus(status, verifiedByProvider) {
  if (!status) return "No email on capture"
  if (status === "unknown") return "Not verified"
  const label = status.replace(/_/g, " ")
  if (verifiedByProvider) return `${label} (provider verified)`
  return label
}

function formatDiscoveryStatus(queued) {
  return queued ? "Queued for contact discovery" : "Not queued"
}

window.EquipifyGrowthExtensionConfig = {
  EXTENSION_API_PRESETS,
  INTAKE_PATH,
  LOOKUP_PATH,
  CAPTURED_LEADS_PATH,
  SIGN_IN_PATH,
  formatMatchRuleLabel,
  formatEmailStatus,
  formatDiscoveryStatus,
}
