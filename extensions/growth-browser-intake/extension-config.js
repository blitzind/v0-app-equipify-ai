/** Shared extension constants — visible metadata only, no hidden scraping. */

const EXTENSION_API_PRESETS = {
  production: "https://app.equipify.ai",
  local: "http://localhost:3000",
}

const INTAKE_PATH = "/api/platform/growth/browser-intake/contact"
const LOOKUP_PATH = "/api/platform/growth/browser-intake/lookup"
const CRM_CONTEXT_PATH = "/api/platform/growth/browser-intake/context"
const CALL_PREP_PATH = "/api/platform/growth/browser-intake/call-prep"
const SIMILAR_COMPANIES_PATH = "/api/platform/growth/browser-intake/similar-companies"
const PROSPECT_QUEUE_PATH = "/api/platform/growth/browser-intake/prospect-queue"
const RESEARCH_BRIEF_PATH = "/api/platform/growth/browser-intake/research-brief"
const BUYING_COMMITTEE_DISCOVER_PATH = "/api/platform/growth/browser-intake/buying-committee/discover"
const BUYING_COMMITTEE_IMPORT_PATH = "/api/platform/growth/browser-intake/buying-committee/import"
const LEAD_PATH = "/api/platform/growth/leads"
const LEAD_TIMELINE_PATH = "/api/platform/growth/leads"
const CAPTURED_LEADS_PATH = "/admin/growth/leads/captured"
const SIGN_IN_PATH = "/admin/growth/browser-intake-test"
const CAPTURED_LEAD_ACTIONS_PATH = "/api/platform/growth/captured-leads"
const PACKAGE_METADATA_DOWNLOAD_PATH = "/downloads/equipify-sales-package-metadata.json"

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

function capturedLeadActionUrl(apiBase, leadId) {
  return `${apiBase}${CAPTURED_LEAD_ACTIONS_PATH}/${leadId}/actions`
}

window.EquipifyGrowthExtensionConfig = {
  EXTENSION_API_PRESETS,
  INTAKE_PATH,
  LOOKUP_PATH,
  CRM_CONTEXT_PATH,
  CALL_PREP_PATH,
  SIMILAR_COMPANIES_PATH,
  PROSPECT_QUEUE_PATH,
  RESEARCH_BRIEF_PATH,
  BUYING_COMMITTEE_DISCOVER_PATH,
  BUYING_COMMITTEE_IMPORT_PATH,
  LEAD_PATH,
  LEAD_TIMELINE_PATH,
  CAPTURED_LEADS_PATH,
  CAPTURED_LEAD_ACTIONS_PATH,
  PACKAGE_METADATA_DOWNLOAD_PATH,
  SIGN_IN_PATH,
  capturedLeadActionUrl,
  formatMatchRuleLabel,
  formatEmailStatus,
  formatDiscoveryStatus,
}
