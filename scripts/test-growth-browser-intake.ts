/**
 * Regression checks for Growth Engine browser extension intake V4.
 * Run: pnpm test:growth-browser-intake
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { assembleBrowserIntakeCallPrep } from "../lib/growth/browser-intake/assemble-browser-intake-call-prep"
import { GROWTH_BROWSER_INTAKE_CALL_PREP_QA_MARKER } from "../lib/growth/browser-intake/browser-intake-call-prep-types"
import {
  formatBrowserIntakeSimilarCompanyLocation,
  GROWTH_BROWSER_INTAKE_SIMILAR_COMPANIES_QA_MARKER,
  mapBrowserIntakeRelationshipToSimilarCompany,
} from "../lib/growth/browser-intake/browser-intake-similar-companies-types"
import {
  aggregateBrowserExtensionAnalytics,
  GROWTH_BROWSER_EXTENSION_ANALYTICS_QA_MARKER,
} from "../lib/growth/browser-intake/extension-analytics-types"
import {
  buildGrowthBrowserExtensionLookupCacheKey,
  GROWTH_BROWSER_EXTENSION_LOOKUP_CACHE_TTL_MS,
  readGrowthBrowserExtensionLookupCache,
  writeGrowthBrowserExtensionLookupCache,
} from "../lib/growth/browser-intake/extension-lookup-cache-types"
import {
  compareSemver,
  formatGrowthBrowserExtensionVersionSnapshot,
  isGrowthBrowserExtensionOutdated,
} from "../lib/growth/browser-intake/extension-version-types"
import { assembleBrowserIntakeResearchBrief } from "../lib/growth/browser-intake/assemble-browser-intake-research-brief"
import { GROWTH_BROWSER_INTAKE_RESEARCH_BRIEF_QA_MARKER } from "../lib/growth/browser-intake/browser-intake-research-brief-types"
import {
  GROWTH_BROWSER_INTAKE_BUYING_COMMITTEE_QA_MARKER,
  GROWTH_BROWSER_INTAKE_BUYING_COMMITTEE_TARGET_ROLES,
} from "../lib/growth/browser-intake/browser-intake-buying-committee-types"
import {
  matchBrowserIntakeBuyingCommitteeTargetRole,
  scoreBrowserIntakeBuyingCommitteeCandidate,
} from "../lib/growth/browser-intake/match-browser-intake-buying-committee-role"
import {
  GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_ACTIONS,
  GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_QA_MARKER,
  inferBrowserIntakeProspectQueueItemKind,
} from "../lib/growth/browser-intake/prospect-queue-types"
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
  formatGrowthBrowserIntakeActivityWhen,
  formatGrowthLeadStatusLabel,
} from "../lib/growth/browser-intake/browser-intake-crm-context-types"
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
assert.equal(formatGrowthLeadStatusLabel("in_outreach"), "In Outreach")

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
assert.match(manifestSource, /"name": "Equipify Sales"/)
assert.match(manifestSource, /"version": "4.3.0"/)
assert.match(manifestSource, /linkedin-inpage-sidebar\.js/)
assert.match(manifestSource, /inpage-sidebar\.html/)
assert.match(manifestSource, /assets\/equipify-sales-logo\.png/)
assert.match(manifestSource, /assets\/icon-16\.png/)
assert.match(manifestSource, /assets\/icon-32\.png/)
assert.match(manifestSource, /assets\/icon-48\.png/)
assert.match(manifestSource, /assets\/icon-128\.png/)
assert.match(manifestSource, /linkedin-floating-dock\.js/)
assert.match(manifestSource, /extension-lookup-cache.js/)
assert.match(manifestSource, /content_scripts/)
assert.match(manifestSource, /linkedin-crm-overlay.js/)
assert.match(manifestSource, /scripting/)
assert.match(manifestSource, /sidePanel/)
assert.match(manifestSource, /side_panel/)
assert.match(manifestSource, /storage/)
assert.match(manifestSource, /tabs/)
assert.doesNotMatch(manifestSource, /default_popup/)
assert.match(manifestSource, /background.js/)

const contextRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/context/route.ts"),
  "utf8",
)
assert.match(contextRoute, /resolveBrowserIntakeCrmContextFromLookup/)
assert.match(contextRoute, /GROWTH_BROWSER_INTAKE_CRM_CONTEXT_QA_MARKER/)

const crmContextBuilder = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/browser-intake/build-browser-intake-crm-context.ts"),
  "utf8",
)
assert.match(crmContextBuilder, /fetchGrowthOpportunityByLeadId/)
assert.match(crmContextBuilder, /listGrowthLeadTimelineEvents/)
assert.match(crmContextBuilder, /company_contacts_count/)
assert.match(crmContextBuilder, /fetchGrowthRepByUserId/)
assert.doesNotMatch(crmContextBuilder, /sendEmail|enroll|auto.?message/i)

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
assert.match(intakeAppJs, /loadVersionInfo/)
assert.match(intakeAppJs, /EquipifyGrowthExtensionLookupCache/)
assert.match(intakeAppJs, /EquipifyGrowthExtensionVersion/)
assert.match(intakeAppJs, /scheduleBootstrap/)
assert.match(intakeAppJs, /showFallbackError/)
assert.match(intakeAppJs, /logError/)
assert.match(intakeAppJs, /refreshOperatorAnalytics/)
assert.match(intakeAppJs, /extension-version-warning/)
assert.doesNotMatch(intakeAppJs, /api[_-]?key|secret|password|token/i)
assert.match(intakeAppJs, /CRM_CONTEXT_PATH/)
assert.match(intakeAppJs, /fetchCrmContext/)
assert.match(intakeAppJs, /linkedin-crm-context/)
assert.match(intakeAppJs, /appendLeadNote/)
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
assert.match(linkedinStatusJs, /Not In Equipify/)
assert.match(linkedinStatusJs, /resolveProspectDisplayBadge/)
assert.match(linkedinStatusJs, /existing_opportunity/)

const linkedinCrmOverlayJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/linkedin-crm-overlay.js"),
  "utf8",
)
assert.match(linkedinCrmOverlayJs, /CRM_CONTEXT_PATH/)
assert.match(linkedinCrmOverlayJs, /EquipifyGrowthExtensionLookupCache/)
assert.match(linkedinCrmOverlayJs, /equipify-sales-linkedin-badge/)
assert.match(linkedinCrmOverlayJs, /EquipifySalesInpageSidebar/)
assert.match(linkedinCrmOverlayJs, /prospectingMode/)
assert.doesNotMatch(linkedinCrmOverlayJs, /sendEmail|enroll|auto.?message/i)

const linkedinFloatingDockJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/linkedin-floating-dock.js"),
  "utf8",
)
assert.match(linkedinFloatingDockJs, /equipify-sales-floating-dock/)
assert.match(linkedinFloatingDockJs, /loadLinkedInFloatingDockPrefs/)
assert.match(linkedinFloatingDockJs, /saveLinkedInFloatingDockPrefs/)
assert.match(linkedinFloatingDockJs, /EquipifySalesInpageSidebar/)
assert.match(linkedinFloatingDockJs, /equipify-open-inpage-sidebar/)
assert.match(linkedinFloatingDockJs, /startDrag/)
assert.match(linkedinFloatingDockJs, /hideDock/)
assert.match(linkedinFloatingDockJs, /topPx/)
assert.doesNotMatch(linkedinFloatingDockJs, /sendEmail|enroll|auto.?message/i)

const linkedinInpageSidebarJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/linkedin-inpage-sidebar.js"),
  "utf8",
)
assert.match(linkedinInpageSidebarJs, /equipify-sales-inpage-sidebar/)
assert.match(linkedinInpageSidebarJs, /equipify-open-inpage-sidebar/)
assert.match(linkedinInpageSidebarJs, /420/)
assert.match(linkedinInpageSidebarJs, /EquipifySalesInpageSidebar/)

const inpageSidebarHtml = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/inpage-sidebar.html"),
  "utf8",
)
assert.match(inpageSidebarHtml, /equipify-sales-logo\.png/)
assert.doesNotMatch(inpageSidebarHtml, /equipify-lightning\.png/)
assert.match(inpageSidebarHtml, /inpage-sidebar-close-btn/)
assert.match(inpageSidebarHtml, /surface-inpage/)
assert.match(inpageSidebarHtml, /Find contact details/)

for (const iconSize of [16, 32, 48, 128]) {
  assert.ok(
    fs.existsSync(
      path.join(process.cwd(), `extensions/growth-browser-intake/assets/icon-${iconSize}.png`),
    ),
    `missing icon-${iconSize}.png`,
  )
}

assert.ok(
  fs.existsSync(
    path.join(process.cwd(), "extensions/growth-browser-intake/assets/equipify-sales-logo.png"),
  ),
  "missing equipify-sales-logo.png",
)


const contactEnrichmentRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/contact-enrichment/route.ts"),
  "utf8",
)
assert.match(contactEnrichmentRoute, /discoverWebsiteContacts/)
assert.match(contactEnrichmentRoute, /website_public_extract/)
assert.match(contactEnrichmentRoute, /Contact enrichment provider not configured/)
assert.doesNotMatch(contactEnrichmentRoute, /linkedin.*scrap|hidden LinkedIn/i)

const extensionConfigJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-config.js"),
  "utf8",
)
assert.match(extensionConfigJs, /Matched by domain/)
assert.match(extensionConfigJs, /Matched by LinkedIn URL/)
assert.match(extensionConfigJs, /Matched by company name/)
assert.match(extensionConfigJs, /CRM_CONTEXT_PATH/)
assert.match(extensionConfigJs, /CONTACT_ENRICHMENT_PATH/)
assert.match(extensionConfigJs, /PACKAGE_METADATA_DOWNLOAD_PATH/)

const extensionStorageJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-storage.js"),
  "utf8",
)
assert.match(extensionStorageJs, /MAX_RECENT_CAPTURES = 5/)
assert.match(extensionStorageJs, /prospectingMode/)
assert.match(extensionStorageJs, /loadLinkedInFloatingDockPrefs/)
assert.match(extensionStorageJs, /saveLinkedInFloatingDockPrefs/)
assert.match(extensionStorageJs, /equipifySalesLinkedInFloatingDock/)
assert.match(extensionStorageJs, /chrome.storage/)

const pageMetadataJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/page-metadata.js"),
  "utf8",
)
assert.match(pageMetadataJs, /og:site_name/)
assert.match(pageMetadataJs, /application\/ld\+json/)
assert.match(pageMetadataJs, /canonical/)
assert.doesNotMatch(pageMetadataJs, /fetch\(|XMLHttpRequest|linkedin.*api/i)

assert.equal(GROWTH_BROWSER_INTAKE_CALL_PREP_QA_MARKER, "growth-browser-intake-call-prep-v1")
assert.equal(
  GROWTH_BROWSER_INTAKE_SIMILAR_COMPANIES_QA_MARKER,
  "growth-browser-intake-similar-companies-v1",
)
assert.equal(
  GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_QA_MARKER,
  "growth-browser-intake-prospect-queue-v1",
)
assert.deepEqual(GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_ACTIONS, [
  "process_queue",
  "run_contact_discovery",
  "verify_emails",
  "create_leads",
])

assert.equal(formatBrowserIntakeSimilarCompanyLocation({ city: "Austin", state: "TX" }), "Austin, TX")
assert.equal(
  mapBrowserIntakeRelationshipToSimilarCompany({
    related_company_name: "Beta HVAC",
    relationship_strength: 82,
    evidence_excerpt: "Same industry: HVAC",
    relationship_type: "same_industry",
    website: "https://beta.example",
    city: "Dallas",
    state: "TX",
    lead_id: "lead-1",
  }).confidence,
  82,
)

assert.equal(
  inferBrowserIntakeProspectQueueItemKind({
    linkedin_url: "https://www.linkedin.com/company/acme/",
  }),
  "linkedin_page",
)
assert.equal(
  inferBrowserIntakeProspectQueueItemKind({
    company_name: "Acme",
    contact_name: "Jane Doe",
  }),
  "contact",
)
assert.equal(inferBrowserIntakeProspectQueueItemKind({ company_name: "Acme" }), "company")

const callPrepArtifact = assembleBrowserIntakeCallPrep({
  lead: {
    id: "lead-1",
    companyName: "Acme Medical",
    contactName: "Jane Doe",
    title: "Operations Director",
    website: "https://acme.example",
    city: "Austin",
    state: "TX",
    status: "qualified",
    score: 78,
    notes: null,
    nextBestAction: "call_now",
    nextBestActionReason: "High intent signal",
  },
  researchRun: {
    id: "run-1",
    leadId: "lead-1",
    status: "completed",
    websiteUrl: "https://acme.example",
    companyName: "Acme Medical",
    industryGuess: "Medical Equipment",
    employeeSizeGuess: "26-100",
    revenueSizeGuess: null,
    websiteMaturityScore: 55,
    socialPresenceScore: null,
    reputationScore: null,
    technologyScore: null,
    detectedTechnologies: ["WordPress"],
    signals: { painSignals: ["missing_online_booking"] },
    competitors: [],
    researchSummary: "Acme Medical operates in medical equipment with moderate website maturity.",
    suggestedPitchAngle: "Improve customer scheduling",
    suggestedSequence: null,
    suggestedCallOpening: "Hi Jane — I noticed Acme Medical and wanted to learn how you handle scheduling.",
    recommendedNextAction: "Call Prospect",
    researchConfidence: 72,
    completedAt: new Date().toISOString(),
    failedReason: null,
    createdAt: new Date().toISOString(),
  },
  accountBrief: null,
  companyDiscovery: null,
  decisionMakerHypothesis: null,
  verificationTriage: null,
  decisionMakers: [],
  timelineSummaries: ["Lead created from browser extension"],
})

assert.match(callPrepArtifact.who_they_are, /Jane Doe/)
assert.match(callPrepArtifact.company_overview, /Acme Medical/)
assert.match(callPrepArtifact.suggested_opener, /Hi Jane/)
assert.ok(callPrepArtifact.discovery_questions.length >= 2)
assert.ok(callPrepArtifact.likely_objections.length >= 1)
assert.ok(callPrepArtifact.relevant_signals.some((signal) => signal.includes("missing online booking")))
assert.match(callPrepArtifact.recommended_next_step, /Call now/)

const callPrepRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/call-prep/route.ts"),
  "utf8",
)
assert.match(callPrepRoute, /buildBrowserIntakeCallPrep/)
assert.match(callPrepRoute, /GROWTH_BROWSER_INTAKE_CALL_PREP_QA_MARKER/)

const similarRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/similar-companies/route.ts"),
  "utf8",
)
assert.match(similarRoute, /discoverBrowserIntakeSimilarCompanies/)

const queueRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/prospect-queue/route.ts"),
  "utf8",
)
assert.match(queueRoute, /processBrowserIntakeProspectQueue/)
assert.match(queueRoute, /GROWTH_BROWSER_INTAKE_PROSPECT_QUEUE_ACTIONS/)

const queueProcessor = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/browser-intake/process-browser-intake-prospect-queue.ts"),
  "utf8",
)
assert.match(queueProcessor, /createBrowserIntakeContact/)
assert.match(queueProcessor, /queueBrowserIntakeContactDiscovery/)
assert.match(queueProcessor, /verifyEmailWithProvider/)
assert.doesNotMatch(queueProcessor, /sendEmail|enroll|auto.?message/i)

const phase2Js = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-phase2.js"),
  "utf8",
)
assert.match(phase2Js, /CALL_PREP_PATH/)
assert.match(phase2Js, /SIMILAR_COMPANIES_PATH/)
assert.match(phase2Js, /PROSPECT_QUEUE_PATH/)
assert.match(phase2Js, /process_queue/)
assert.match(phase2Js, /verify_emails/)
assert.doesNotMatch(phase2Js, /auto.?message|enroll|sendEmail/i)

const prospectQueueJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-prospect-queue.js"),
  "utf8",
)
assert.match(prospectQueueJs, /chrome.storage.local/)
assert.match(prospectQueueJs, /MAX_QUEUE_ITEMS/)

assert.match(crmContextBuilder, /timeline_preview/)
assert.match(crmContextBuilder, /company_relationship_map/)

assert.equal(GROWTH_BROWSER_EXTENSION_ANALYTICS_QA_MARKER, "growth-browser-extension-analytics-v1")
assert.equal(GROWTH_BROWSER_INTAKE_RESEARCH_BRIEF_QA_MARKER, "growth-browser-intake-research-brief-v1")
assert.equal(GROWTH_BROWSER_INTAKE_BUYING_COMMITTEE_QA_MARKER, "growth-browser-intake-buying-committee-v1")
assert.equal(GROWTH_BROWSER_INTAKE_BUYING_COMMITTEE_TARGET_ROLES.length, 8)

assert.equal(matchBrowserIntakeBuyingCommitteeTargetRole({ job_title: "VP Operations" })?.role, "VP Operations")
assert.equal(
  scoreBrowserIntakeBuyingCommitteeCandidate({ job_title: "Service Manager", sourceConfidence: 0.8 })
    .matched_target_role,
  "Service Manager",
)

const researchBrief = assembleBrowserIntakeResearchBrief({
  lead: { id: "lead-1", companyName: "Acme", nextBestActionReason: "High intent" },
  researchRun: {
    id: "run-1",
    leadId: "lead-1",
    status: "completed",
    websiteUrl: "https://acme.example",
    companyName: "Acme",
    industryGuess: "HVAC",
    employeeSizeGuess: null,
    revenueSizeGuess: null,
    websiteMaturityScore: 50,
    socialPresenceScore: null,
    reputationScore: null,
    technologyScore: null,
    detectedTechnologies: [],
    signals: { painSignals: [] },
    competitors: [],
    researchSummary: "Acme summary",
    suggestedPitchAngle: "Angle",
    suggestedSequence: null,
    suggestedCallOpening: null,
    recommendedNextAction: "Call Prospect",
    researchConfidence: 70,
    completedAt: new Date().toISOString(),
    failedReason: null,
    createdAt: new Date().toISOString(),
  },
  accountBrief: null,
  companyDiscovery: null,
})
assert.match(researchBrief.company_summary, /Acme/)

const analyticsSummary = aggregateBrowserExtensionAnalytics(
  [
    { type: "captures_created", at: new Date().toISOString() },
    { type: "queue_saves", at: new Date().toISOString() },
  ],
  "today",
)
assert.equal(analyticsSummary.counts.captures_created, 1)
assert.equal(analyticsSummary.counts.queue_saves, 1)

const committeeDiscoverRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/buying-committee/discover/route.ts"),
  "utf8",
)
assert.match(committeeDiscoverRoute, /discoverBrowserIntakeBuyingCommittee/)

const committeeImportRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/buying-committee/import/route.ts"),
  "utf8",
)
assert.match(committeeImportRoute, /importBrowserIntakeBuyingCommitteeSelections/)

const researchBriefRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/research-brief/route.ts"),
  "utf8",
)
assert.match(researchBriefRoute, /buildBrowserIntakeResearchBrief/)

const copilotJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-copilot.js"),
  "utf8",
)
assert.match(copilotJs, /data-copilot-tab-btn/)
assert.match(copilotJs, /"analytics"/)
assert.match(copilotJs, /es-timeline-item/)
assert.match(copilotJs, /RESEARCH_BRIEF_PATH/)
assert.match(copilotJs, /BUYING_COMMITTEE_DISCOVER_PATH/)
assert.match(copilotJs, /BUYING_COMMITTEE_IMPORT_PATH/)
assert.match(copilotJs, /importSelectedCommittee/)
assert.doesNotMatch(copilotJs, /auto.?import|enroll|sendEmail/i)

const analyticsJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-analytics.js"),
  "utf8",
)
assert.match(analyticsJs, /research_briefs_generated/)
assert.match(analyticsJs, /call_preps_generated/)
assert.match(analyticsJs, /duplicates_prevented/)

const sidepanelHtml = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/sidepanel.html"),
  "utf8",
)
assert.match(sidepanelHtml, /es-sales-workspace/)
assert.match(sidepanelHtml, /equipify-sales-logo\.png/)
assert.doesNotMatch(sidepanelHtml, /equipify-lightning\.png/)
assert.match(sidepanelHtml, /extension-workspace.js/)
assert.match(sidepanelHtml, /sales-workspace.css/)
assert.match(sidepanelHtml, /workspace-refresh-btn/)
assert.match(sidepanelHtml, /prospecting-mode/)
assert.match(sidepanelHtml, /linkedin-floating-dock/)
assert.match(sidepanelHtml, /es-ws-add-btn/)
assert.match(sidepanelHtml, /analytics-today/)
assert.match(sidepanelHtml, /extension-version-banner/)
assert.match(sidepanelHtml, /bootstrap-loading/)

const popupHtml = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/popup.html"),
  "utf8",
)
assert.match(popupHtml, /Equipify Sales/)
assert.match(popupHtml, /extension-ui.js/)
assert.match(popupHtml, /equipify-sales-logo\.png/)
assert.match(popupHtml, /es-launcher/)
assert.match(popupHtml, /open-side-panel-btn/)
assert.doesNotMatch(popupHtml, /equipify-lightning\.png/)
assert.match(popupHtml, /prospecting-mode/)
assert.match(popupHtml, /linkedin-floating-dock/)
assert.match(popupHtml, /extension-version-banner/)
assert.match(popupHtml, /bootstrap-loading/)
assert.match(popupHtml, /Open sidebar on LinkedIn/)
assert.match(popupHtml, /Could not read this page|context-warning/)
assert.match(popupHtml, /extension-version.js/)
assert.doesNotMatch(popupHtml, /data-popup-tab-btn/)

const versionJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-version.js"),
  "utf8",
)
assert.match(versionJs, /resolveVersionSnapshot/)
assert.match(versionJs, /isOutdated/)

const lookupCacheJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-lookup-cache.js"),
  "utf8",
)
assert.match(lookupCacheJs, /TTL_MS/)
assert.match(lookupCacheJs, /invalidate/)

assert.equal(compareSemver("4.0.0", "3.2.0"), 1)
assert.equal(compareSemver("3.2.0", "4.0.0"), -1)
assert.equal(isGrowthBrowserExtensionOutdated("3.2.0", "4.0.0"), true)
assert.equal(isGrowthBrowserExtensionOutdated("4.0.0", "4.0.0"), false)

const lookupCache = new Map()
const cacheKey = buildGrowthBrowserExtensionLookupCacheKey("crm_context", "company_name=Acme")
writeGrowthBrowserExtensionLookupCache(lookupCache, cacheKey, { ok: true }, GROWTH_BROWSER_EXTENSION_LOOKUP_CACHE_TTL_MS, 1_000)
assert.deepEqual(readGrowthBrowserExtensionLookupCache(lookupCache, cacheKey, 1_050), { ok: true })
assert.equal(readGrowthBrowserExtensionLookupCache(lookupCache, cacheKey, 50_000), null)

assert.match(
  formatGrowthBrowserExtensionVersionSnapshot({
    installed_version: "3.2.0",
    packaged_version: "4.0.0",
    latest_available_version: "4.0.0",
    git_sha: "abc1234",
    build_timestamp: "2026-05-28T12:00:00.000Z",
    is_outdated: true,
  }),
  /Installed v3.2.0/,
)

assert.match(intakeAppJs, /initExtensionCopilot/)
assert.match(extensionConfigJs, /RESEARCH_BRIEF_PATH/)

console.log("growth-browser-intake v4 checks passed")
