/**
 * Regression checks for Growth Engine browser extension intake V3.
 * Run: pnpm test:growth-browser-intake
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  browserIntakeHasContactData,
  browserIntakeInputToImportRow,
  browserIntakeIsCompanyOnlyCapture,
  GROWTH_BROWSER_INTAKE_QA_MARKER,
  GROWTH_BROWSER_INTAKE_SOURCE_PLATFORMS,
  normalizeBrowserIntakeSourcePlatform,
  resolveBrowserIntakeContactName,
} from "../lib/growth/browser-intake/browser-intake-types"
import {
  formatBrowserIntakeMatchRuleLabel,
  GROWTH_BROWSER_INTAKE_MATCH_RULE_LABELS,
} from "../lib/growth/browser-intake/browser-intake-match-labels"
import {
  compareBrowserIntakeLeadMatches,
  pickBestBrowserIntakeLeadMatchByPriority,
} from "../lib/growth/browser-intake/browser-intake-lookup-priority"
import {
  buildLinkedInLookupQuery,
  detectLinkedInPageKind,
  inferLinkedInProfileNameFromTitle,
  normalizeLinkedInLookupUrl,
} from "../lib/growth/browser-intake/linkedin-context-detect"
import {
  formatLinkedInLeadMatchSummary,
  GROWTH_LINKEDIN_EXTENSION_STATUS_BADGE_LABELS,
  resolveLinkedInLeadStatusBadge,
} from "../lib/growth/browser-intake/linkedin-lead-status-badge"
import {
  detectBrowserIntakeSourcePlatform,
  inferCompanyNameFromLinkedInTitle,
  inferCompanyNameFromPageTitle,
  mergeBrowserIntakePageMetadata,
  websiteOriginFromUrl,
} from "../lib/growth/browser-intake/page-metadata-extract"

assert.equal(GROWTH_BROWSER_INTAKE_QA_MARKER, "growth-browser-intake-v2")
assert.equal("growth-browser-intake-lookup-v1", "growth-browser-intake-lookup-v1")
assert.equal(
  "growth-browser-intake-contact-discovery-queue-v1",
  "growth-browser-intake-contact-discovery-queue-v1",
)
assert.deepEqual(GROWTH_BROWSER_INTAKE_SOURCE_PLATFORMS, ["linkedin", "website", "manual", "other"])

assert.equal(formatBrowserIntakeMatchRuleLabel("website_domain"), "Matched by domain")
assert.equal(formatBrowserIntakeMatchRuleLabel("linkedin"), "Matched by LinkedIn URL")
assert.equal(formatBrowserIntakeMatchRuleLabel("company_name"), "Matched by company name")
assert.equal(GROWTH_BROWSER_INTAKE_MATCH_RULE_LABELS.linkedin_metadata, "Matched by LinkedIn URL")

assert.equal(detectLinkedInPageKind("https://www.linkedin.com/in/jane-doe/"), "profile")
assert.equal(detectLinkedInPageKind("https://www.linkedin.com/company/acme-medical/"), "company")
assert.equal(
  normalizeLinkedInLookupUrl("https://www.linkedin.com/in/jane-doe/details/experience"),
  "https://www.linkedin.com/in/jane-doe/",
)
assert.equal(
  inferLinkedInProfileNameFromTitle("Jane Doe - CEO - Acme Medical | LinkedIn"),
  "Jane Doe",
)

const linkedinQuery = buildLinkedInLookupQuery({
  url: "https://www.linkedin.com/in/jane-doe/",
  page_title: "Jane Doe - CEO - Acme Medical | LinkedIn",
  company_name: "Acme Medical",
})
assert.equal(linkedinQuery.linkedin_page_kind, "profile")
assert.equal(linkedinQuery.contact_name, "Jane Doe")
assert.equal(linkedinQuery.linkedin_url, "https://www.linkedin.com/in/jane-doe/")

assert.equal(
  resolveLinkedInLeadStatusBadge({ matched: false, confidence: 0 }),
  "not_added",
)
assert.equal(
  resolveLinkedInLeadStatusBadge({
    matched: true,
    confidence: 0.9,
    capture_type: "contact",
    review_status: "reviewed",
    verification_status: "none",
  }),
  "already_added",
)
assert.equal(
  resolveLinkedInLeadStatusBadge({
    matched: true,
    confidence: 0.9,
    capture_type: "contact",
    review_status: "needs_review",
    verification_status: "verified",
  }),
  "needs_review",
)
assert.equal(
  resolveLinkedInLeadStatusBadge({
    matched: true,
    confidence: 0.9,
    capture_type: "company_only",
    review_status: "needs_review",
    verification_status: "verified",
  }),
  "company_captured_only",
)
assert.equal(
  formatLinkedInLeadMatchSummary({ match_label: "Matched by LinkedIn URL", confidence: 0.88 }),
  "Matched by LinkedIn URL · 88% confidence",
)
assert.equal(GROWTH_LINKEDIN_EXTENSION_STATUS_BADGE_LABELS.verified, "Verified")

const prioritized = pickBestBrowserIntakeLeadMatchByPriority([
  {
    lead_id: "a",
    company_name: "Acme",
    website: null,
    contact_name: null,
    contact_email: null,
    status: "new",
    rule: "company_name",
    confidence: 0.95,
    dedupe_key: "acme",
  },
  {
    lead_id: "b",
    company_name: "Acme",
    website: null,
    contact_name: "Jane",
    contact_email: null,
    status: "new",
    rule: "linkedin",
    confidence: 0.88,
    dedupe_key: "linkedin:jane",
  },
])
assert.equal(prioritized?.lead_id, "b")
assert.ok(compareBrowserIntakeLeadMatches(
  { rule: "linkedin", confidence: 0.8 } as never,
  { rule: "company_name", confidence: 0.99 } as never,
) < 0)

// Company detection
assert.equal(detectBrowserIntakeSourcePlatform("https://www.linkedin.com/company/acme"), "linkedin")
assert.equal(detectBrowserIntakeSourcePlatform("https://acme.com/about"), "website")
assert.equal(
  inferCompanyNameFromLinkedInTitle("Jane Doe - CEO - Acme Medical | LinkedIn"),
  "Acme Medical",
)
assert.equal(inferCompanyNameFromPageTitle("About Us | Acme Medical"), "About Us")
assert.equal(websiteOriginFromUrl("https://www.acme.com/team"), "https://www.acme.com")

const merged = mergeBrowserIntakePageMetadata("https://www.linkedin.com/company/acme/", {
  page_title: "Acme Medical | LinkedIn",
  company_name: "Acme Medical",
  source_platform: "linkedin",
})
assert.equal(merged.company_name, "Acme Medical")
assert.equal(merged.linkedin_url, "https://www.linkedin.com/company/acme/")
assert.equal(merged.source_platform, "linkedin")

// Company-only capture
assert.equal(browserIntakeIsCompanyOnlyCapture({ company_name: "Acme" }), true)
assert.equal(browserIntakeIsCompanyOnlyCapture({ company_name: "Acme", company_only: true }), true)
assert.equal(
  browserIntakeIsCompanyOnlyCapture({ company_name: "Acme", contact_name: "Jane Doe" }),
  false,
)
assert.equal(
  browserIntakeHasContactData({ company_name: "Acme", email: "jane@acme.com" }),
  true,
)

const companyOnlyRow = browserIntakeInputToImportRow(
  { company_name: "Acme Medical", source_url: "https://acme.com" },
  "browser_extension:company-only",
)
assert.equal(companyOnlyRow.companyName, "Acme Medical")
assert.equal(companyOnlyRow.contactName, null)

assert.equal(
  resolveBrowserIntakeContactName({ company_name: "Acme", email: "jane.doe@acme.com" }),
  "jane doe",
)

assert.equal(normalizeBrowserIntakeSourcePlatform("LinkedIn"), "linkedin")

const serviceSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/browser-intake/create-browser-intake-contact.ts"),
  "utf8",
)
assert.match(serviceSource, /page_title/)
assert.match(serviceSource, /capture_method/)
assert.match(serviceSource, /company_only/)
assert.match(serviceSource, /queue_contact_discovery/)
assert.match(serviceSource, /verify_email/)
assert.match(serviceSource, /intake_mode/)
assert.match(serviceSource, /queueBrowserIntakeContactDiscovery/)
assert.match(serviceSource, /company_prospect/)
assert.match(serviceSource, /verifyEmailWithProvider/)
assert.match(serviceSource, /email_status/)
assert.doesNotMatch(serviceSource, /lead\.inbox|sendEmail|enroll/i)

const lookupSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/browser-intake/browser-intake-lead-lookup.ts"),
  "utf8",
)
assert.match(lookupSource, /findBrowserIntakeExistingLeads/)
assert.match(lookupSource, /website_domain/)
assert.match(lookupSource, /company_name/)
assert.match(lookupSource, /email/)
assert.match(lookupSource, /sortBrowserIntakeLeadMatches/)

const queueSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/browser-intake/queue-browser-intake-contact-discovery.ts"),
  "utf8",
)
assert.match(queueSource, /scheduleBrowserIntakeContactDiscovery/)
assert.match(queueSource, /runContactDiscoveryForCompany/)
assert.match(queueSource, /contact_discovery_queue/)
assert.match(queueSource, /capture_method: "chrome_extension"/)

const lookupRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/lookup/route.ts"),
  "utf8",
)
assert.match(lookupRoute, /findBrowserIntakeExistingLeads/)
assert.match(lookupRoute, /existing_lead_found/)
assert.match(lookupRoute, /enrichBrowserIntakeLookupMatches/)
assert.match(lookupRoute, /status_badge/)
assert.match(lookupRoute, /email/)

const apiSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/contact/route.ts"),
  "utf8",
)
assert.match(apiSource, /page_title/)
assert.match(apiSource, /queue_contact_discovery/)
assert.match(apiSource, /verify_email/)
assert.match(apiSource, /company_only/)
assert.match(apiSource, /intake_mode/)

const manifestSource = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/manifest.json"),
  "utf8",
)
assert.match(manifestSource, /"version": "3.1.0"/)
assert.match(manifestSource, /content_scripts/)
assert.match(manifestSource, /linkedin-page-badge.js/)
assert.match(manifestSource, /scripting/)
assert.match(manifestSource, /sidePanel/)
assert.match(manifestSource, /side_panel/)
assert.match(manifestSource, /storage/)
assert.match(manifestSource, /background.js/)

const intakeAppJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/intake-app.js"),
  "utf8",
)
assert.match(intakeAppJs, /LOOKUP_PATH/)
assert.match(intakeAppJs, /INTAKE_PATH/)
assert.match(intakeAppJs, /Existing lead found|existing-lead-panel/)
assert.match(intakeAppJs, /company_only/)
assert.match(intakeAppJs, /page-metadata.js/)
assert.match(intakeAppJs, /update_existing/)
assert.match(intakeAppJs, /create_new/)
assert.match(intakeAppJs, /verify_email/)
assert.match(intakeAppJs, /recent-captures/)
assert.match(intakeAppJs, /success-panel/)
assert.match(intakeAppJs, /match_label|formatMatchRuleLabel/)
assert.match(intakeAppJs, /loadExtensionSettings/)
assert.doesNotMatch(intakeAppJs, /api[_-]?key|secret|password|token/i)
assert.match(intakeAppJs, /linkedin-status-panel/)
assert.match(intakeAppJs, /renderLinkedInStatusPanel/)
assert.match(intakeAppJs, /markLeadReviewed/)
assert.match(intakeAppJs, /buildLinkedInLookupQuery/)
assert.doesNotMatch(intakeAppJs, /sendEmail|enroll|auto.?message/i)

const linkedinContextJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/linkedin-context.js"),
  "utf8",
)
assert.match(linkedinContextJs, /detectLinkedInPageKind/)
assert.match(linkedinContextJs, /normalizeLinkedInLookupUrl/)

const linkedinStatusJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/linkedin-status-shared.js"),
  "utf8",
)
assert.match(linkedinStatusJs, /Not in Equipify/)
assert.match(linkedinStatusJs, /resolveStatusFromLookup/)

const linkedinPageBadgeJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/linkedin-page-badge.js"),
  "utf8",
)
assert.match(linkedinPageBadgeJs, /LOOKUP_PATH/)
assert.doesNotMatch(linkedinPageBadgeJs, /sendEmail|enroll|auto.?message|XMLHttpRequest/i)

const extensionConfigJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-config.js"),
  "utf8",
)
assert.match(extensionConfigJs, /Matched by domain/)
assert.match(extensionConfigJs, /Matched by LinkedIn URL/)
assert.match(extensionConfigJs, /Matched by company name/)
assert.match(extensionConfigJs, /localhost:3000/)

const extensionStorageJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-storage.js"),
  "utf8",
)
assert.match(extensionStorageJs, /MAX_RECENT_CAPTURES = 5/)
assert.match(extensionStorageJs, /chrome.storage/)

const pageMetadataJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/page-metadata.js"),
  "utf8",
)
assert.match(pageMetadataJs, /og:site_name/)
assert.match(pageMetadataJs, /application\/ld\+json/)
assert.match(pageMetadataJs, /canonical/)
assert.doesNotMatch(pageMetadataJs, /fetch\(|XMLHttpRequest|linkedin.*api/i)

console.log("growth-browser-intake v3.1 linkedin status checks passed")
