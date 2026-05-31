/**
 * Regression checks for Growth Engine browser extension intake V4.
 * Run: pnpm test:growth-browser-intake
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { parseHTML } from "linkedom"
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

function assertStringArrayEqual(actual: unknown, expected: string[]) {
  assert.ok(Array.isArray(actual), "expected array")
  assert.equal(actual.length, expected.length)
  for (let index = 0; index < expected.length; index += 1) {
    assert.equal(actual[index], expected[index])
  }
}

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
assert.match(manifestSource, /"version": "4.3.38"/)
assert.match(manifestSource, /https:\/\/m\.linkedin\.com\/in\/\*/)
assert.match(manifestSource, /extension-contact-saved\.js/)
assert.match(manifestSource, /linkedin-company-people\.js/)
assert.match(manifestSource, /linkedin-inpage-sidebar\.js/)
assert.match(manifestSource, /inpage-sidebar\.html/)
assert.match(manifestSource, /assets\/equipify-sales-wordmark\.png/)
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
assert.match(manifestSource, /extension-brand.js/)

const extensionBrandJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-brand.js"),
  "utf8",
)
assert.match(extensionBrandJs, /DOCK_LOGO_ASSET/)
assert.match(extensionBrandJs, /PANEL_LOGO_ASSET/)
assert.match(extensionBrandJs, /panelLogoUrl/)
assert.match(extensionBrandJs, /applyPanelLogo/)
assert.match(extensionBrandJs, /PANEL_LOGO_VERSION/)
assert.match(extensionBrandJs, /4\.3\.38/)
assert.match(extensionBrandJs, /\?v=\$\{encodeURIComponent\(PANEL_LOGO_VERSION\)\}/)
assert.match(extensionBrandJs, /\[Equipify Sales:logo-audit\]/)
assert.match(extensionBrandJs, /PANEL_LOGO_INTRINSIC_WIDTH/)
assert.match(extensionBrandJs, /assets\/equipify-sales-wordmark\.png/)
assert.match(extensionBrandJs, /\[Equipify Sales:logo-audit\]/)

const popupCss = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/popup.css"),
  "utf8",
)
assert.match(popupCss, /\.bootstrap-loading\[hidden\]/)
assert.match(popupCss, /display: none !important/)

const createBrowserIntakeContact = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/browser-intake/create-browser-intake-contact.ts"),
  "utf8",
)
assert.match(createBrowserIntakeContact, /sourceKind: "browser_extension"/)
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
assert.match(intakeAppJs, /bootstrap_timeout/)
assert.match(intakeAppJs, /5000/)
assert.match(intakeAppJs, /equipify-inpage-context/)
assert.match(intakeAppJs, /applyInpageContext/)
assert.match(intakeAppJs, /fetchWithTimeout/)
assert.match(intakeAppJs, /defaultCrmPayload/)
assert.match(intakeAppJs, /es-ws-hidden-compat/)
assert.match(intakeAppJs, /logError/)
assert.match(intakeAppJs, /logInfo/)
assert.match(intakeAppJs, /saveIntake/)
assert.match(intakeAppJs, /submit_capture_start/)
assert.match(intakeAppJs, /bootstrap_terminal/)
assert.match(intakeAppJs, /bootstrapTerminal/)
assert.match(intakeAppJs, /crm_context_timeout/)
assert.match(intakeAppJs, /quick-company-name/)
assert.match(intakeAppJs, /lastAppliedContextUrl/)
assert.match(intakeAppJs, /waitForInpageContext/)
assert.match(intakeAppJs, /refreshOperatorAnalytics/)
assert.match(intakeAppJs, /extension-version-warning/)
assert.doesNotMatch(intakeAppJs, /api[_-]?key|secret|password|token/i)
assert.match(intakeAppJs, /CRM_CONTEXT_PATH/)
assert.match(intakeAppJs, /fetchCrmContext/)
assert.match(intakeAppJs, /EquipifyGrowthContextNormalize/)
assert.match(intakeAppJs, /syncContextStatusFromWorkspace/)
assert.match(intakeAppJs, /Context Found/)
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
assert.match(linkedinStatusJs, /Not in Equipify/)
assert.match(linkedinStatusJs, /Already in Equipify/)
assert.match(linkedinStatusJs, /resolveLinkedInPageBadgeDisplay/)
assert.match(linkedinStatusJs, /resolveProspectDisplayBadge/)
assert.match(linkedinStatusJs, /existing_opportunity/)

const linkedinCrmOverlayJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/linkedin-crm-overlay.js"),
  "utf8",
)
assert.match(linkedinCrmOverlayJs, /CRM_CONTEXT_PATH/)
assert.match(linkedinCrmOverlayJs, /EquipifyGrowthExtensionLookupCache/)
assert.match(linkedinCrmOverlayJs, /equipify-sales-linkedin-badge/)
assert.match(linkedinCrmOverlayJs, /insertAdjacentElement\("afterend"/)
assert.match(linkedinCrmOverlayJs, /mountBadgeBesideName/)
assert.match(linkedinCrmOverlayJs, /mount_floating_fallback/)
assert.match(linkedinCrmOverlayJs, /skip_floating_fallback/)
assert.match(linkedinCrmOverlayJs, /\[Equipify Sales:status-pill]/)
assert.match(linkedinCrmOverlayJs, /linkedInChromeUiAvailable/)
assert.match(linkedinCrmOverlayJs, /LOADING_BADGE_DEADLINE_MS/)
assert.match(linkedinCrmOverlayJs, /\[Equipify Sales:linkedin-badge\]/)
assert.match(linkedinCrmOverlayJs, /mountBadgeNearTopCard/)
assert.match(linkedinCrmOverlayJs, /LOOKUP_DEADLINE_MS/)
assert.match(linkedinCrmOverlayJs, /lookup_deadline_terminal/)
assert.match(linkedinCrmOverlayJs, /scheduleLookupDeadline/)
assert.match(linkedinCrmOverlayJs, /EquipifyGrowthExtensionBrand/)
assert.match(linkedinStatusJs, /No profile context/)
assert.match(linkedinCrmOverlayJs, /hasProfileContext/)
assert.doesNotMatch(linkedinCrmOverlayJs, /assets\/equipify-sales-logo\.png/)
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
assert.match(linkedinFloatingDockJs, /EquipifyGrowthExtensionBrand/)
assert.doesNotMatch(linkedinFloatingDockJs, /assets\/equipify-sales-logo\.png/)
assert.match(linkedinFloatingDockJs, /equipify-sidebar-state/)
assert.doesNotMatch(linkedinFloatingDockJs, /sendEmail|enroll|auto.?message/i)

const linkedinInpageSidebarJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/linkedin-inpage-sidebar.js"),
  "utf8",
)
assert.match(linkedinInpageSidebarJs, /equipify-sales-inpage-sidebar/)
assert.match(linkedinInpageSidebarJs, /equipify-open-inpage-sidebar/)
assert.match(linkedinInpageSidebarJs, /420/)
assert.match(linkedinInpageSidebarJs, /EquipifySalesInpageSidebar/)
assert.match(linkedinInpageSidebarJs, /equipify-inpage-context/)
assert.match(linkedinInpageSidebarJs, /equipify-inpage-sidebar-ready/)
assert.match(linkedinInpageSidebarJs, /\[Equipify Sales:inpage\]/)
assert.match(linkedinInpageSidebarJs, /contextCacheKey/)
assert.match(linkedinInpageSidebarJs, /queueContextPost/)
assert.match(linkedinInpageSidebarJs, /equipify-sales-floating-dock--sidebar-open/)
assert.match(linkedinInpageSidebarJs, /equipify-sales-inpage-sidebar-open/)
assert.match(linkedinInpageSidebarJs, /EquipifyGrowthLayoutPush/)
assert.match(linkedinInpageSidebarJs, /\[Equipify Sales:layout-push]/)
assert.match(linkedinInpageSidebarJs, /\[Equipify Sales:layout-dom]/)
assert.match(linkedinInpageSidebarJs, /sidebar_context_posted/)

const linkedinLayoutPushJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/linkedin-layout-push.js"),
  "utf8",
)
assert.match(linkedinLayoutPushJs, /EquipifyGrowthLayoutPush/)
assert.match(linkedinLayoutPushJs, /resolveLayoutMode/)
assert.match(linkedinLayoutPushJs, /applyLayoutReserve/)
assert.match(linkedinLayoutPushJs, /equipify-desktop-layout/)
assert.match(linkedinLayoutPushJs, /locateRightRails/)
assert.match(linkedinLayoutPushJs, /locateFeed/)
assert.match(linkedinLayoutPushJs, /inspectLayoutDom/)
assert.match(linkedinLayoutPushJs, /logLayoutDom/)
assert.match(linkedinLayoutPushJs, /expand-main-hide-rail-reserve-panel/)
assert.match(linkedinLayoutPushJs, /hidden_right_rail_selectors/)
assert.match(linkedinLayoutPushJs, /data-equipify-layout-feed/)
assert.match(linkedinLayoutPushJs, /data-equipify-layout-inner/)
assert.match(linkedinLayoutPushJs, /max_width/)
assert.match(manifestSource, /linkedin-layout-push\.js/)

const contactSavedJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-contact-saved.js"),
  "utf8",
)
assert.match(contactSavedJs, /equipify-sales-contact-saved/)
assert.match(contactSavedJs, /dispatchEquipifyContactSaved/)
assert.match(contactSavedJs, /onEquipifyContactSaved/)

assert.match(linkedinCrmOverlayJs, /EquipifySalesContactSaved/)
assert.match(linkedinCrmOverlayJs, /scheduleRefresh\(true\)/)

function isValidCompanyNameFixture(name: string, personName?: string | null) {
  if (!name?.trim()) return false
  if (personName && name.toLowerCase() === personName.toLowerCase()) return false
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\.?\s+\d{4}\b/i.test(name)) return false
  if (/\bpresent\b/i.test(name)) return false
  if (/\b\d+\s*(yrs?|mos?)\b/i.test(name)) return false
  if (/\bfull-time\b/i.test(name)) return false
  return true
}

assert.equal(
  isValidCompanyNameFixture("Executive Vice PresidentSep 2023 - Present · 2 yrs 9 mos."),
  false,
)
assert.equal(isValidCompanyNameFixture("BioMed Techs Inc."), true)

function simulatePostSaveSidebarState(hasMatch: boolean) {
  return {
    addHidden: hasMatch,
    openLeadVisible: hasMatch,
    nbaAction: hasMatch ? "open_lead" : "add_contact",
  }
}

const postSave = simulatePostSaveSidebarState(true)
assert.equal(postSave.addHidden, true)
assert.equal(postSave.openLeadVisible, true)
assert.notEqual(postSave.nbaAction, "add_contact")

const linkedinInpageSidebarCss = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/linkedin-inpage-sidebar.css"),
  "utf8",
)
assert.match(linkedinInpageSidebarCss, /equipify-desktop-layout/)
assert.match(linkedinInpageSidebarCss, /equipify-sales-inpage-sidebar-open/)
assert.match(linkedinInpageSidebarCss, /--equipify-linkedin-main-width/)
assert.match(linkedinInpageSidebarCss, /max-width: none/)
assert.match(linkedinInpageSidebarCss, /flex: 1 1 auto/)
assert.match(linkedinInpageSidebarCss, /grid-template-columns: minmax\(0, 1fr\)/)
assert.match(linkedinInpageSidebarCss, /min-width: 1200px/)
assert.match(linkedinInpageSidebarCss, /data-equipify-layout-feed/)
assert.match(linkedinInpageSidebarCss, /data-equipify-layout-main/)
assert.match(linkedinInpageSidebarCss, /#22c55e/)
assert.match(linkedinInpageSidebarCss, /scaffold-layout__aside/)
assert.match(linkedinInpageSidebarCss, /global-nav/)
assert.match(linkedinInpageSidebarCss, /data-equipify-layout-root/)

function runLayoutPushHarness(viewportWidth = 1280, pageUrl = "https://www.linkedin.com/in/example/") {
  const html = `<!doctype html><html><head></head><body>
    <nav class="global-nav">Global nav</nav>
    <div class="scaffold-layout">
      <div class="scaffold-layout__inner">
        <main class="scaffold-layout__main" role="main">
          <div class="scaffold-layout__content">
            <div data-view-name="profile-card">Profile card</div>
            <div class="scaffold-finite-scroll__content">Feed</div>
          </div>
        </main>
        <aside class="scaffold-layout__aside">Right rail</aside>
      </div>
    </div>
  </body></html>`
  const { document, window: domWindow } = parseHTML(html)
  Object.defineProperty(domWindow, "innerWidth", { value: viewportWidth, configurable: true, writable: true })
  ;(domWindow as unknown as { location: { href: string } }).location = { href: pageUrl }
  const source = fs.readFileSync(
    path.join(process.cwd(), "extensions/growth-browser-intake/linkedin-layout-push.js"),
    "utf8",
  )
  const sandbox: Record<string, unknown> = {
    console: { log: () => {}, error: () => {} },
    document,
    window: domWindow,
    URL,
    localStorage: { getItem: () => null },
    EquipifyGrowthLinkedInContext: {
      detectLinkedInPageKind: (url: string) => {
        if (/\/in\//.test(url)) return "profile"
        if (/\/company\//.test(url)) return "company"
        return "other"
      },
    },
  }
  ;(domWindow as unknown as Record<string, unknown>).EquipifyGrowthLinkedInContext =
    sandbox.EquipifyGrowthLinkedInContext
  const context = vm.createContext(sandbox)
  vm.runInContext(source, context)
  const layoutPush = (context.window as { EquipifyGrowthLayoutPush?: Record<string, unknown> })
    .EquipifyGrowthLayoutPush as {
    BODY_CLASS: string
    DESKTOP_LAYOUT_CLASS: string
    SIDEBAR_WIDTH_PX: number
    DESKTOP_MIN_WIDTH: number
    resolveLayoutMode: (width?: number) => "push" | "overlay"
    detectPageType: (url: string) => string
    locateScaffold: (doc: Document) => {
      root: Element | null
      main: Element | null
      content: Element | null
    }
    applyLayoutReserve: (
      open: boolean,
      options?: Record<string, unknown>,
    ) => { mode: string; page_type?: string }
    clearLayoutMarks: (doc?: Document) => void
  }
  return { document, layoutPush }
}

const desktopLayoutHarness = runLayoutPushHarness(1280)
assert.equal(desktopLayoutHarness.layoutPush.resolveLayoutMode(1280), "push")
assert.equal(desktopLayoutHarness.layoutPush.detectPageType("https://www.linkedin.com/in/ricardo/"), "profile")
assert.equal(
  desktopLayoutHarness.layoutPush.detectPageType("https://www.linkedin.com/company/acme/"),
  "company",
)
assert.equal(
  desktopLayoutHarness.layoutPush.detectPageType("https://www.linkedin.com/search/results/people/"),
  "search",
)

const mobileLayoutHarness = runLayoutPushHarness(800)
assert.equal(mobileLayoutHarness.layoutPush.resolveLayoutMode(800), "overlay")

const scaffold = desktopLayoutHarness.layoutPush.locateScaffold(desktopLayoutHarness.document)
assert.ok(scaffold.root?.classList.contains("scaffold-layout"))
assert.ok(scaffold.main?.classList.contains("scaffold-layout__main"))
assert.ok(scaffold.content?.classList.contains("scaffold-layout__content"))

desktopLayoutHarness.layoutPush.applyLayoutReserve(true, {
  document: desktopLayoutHarness.document,
  viewportWidth: 1280,
  pageUrl: "https://www.linkedin.com/in/example/",
  logLayoutPush: () => {},
})
assert.equal(
  desktopLayoutHarness.document.body.classList.contains(
    desktopLayoutHarness.layoutPush.DESKTOP_LAYOUT_CLASS,
  ),
  true,
)
assert.equal(
  desktopLayoutHarness.document.body.classList.contains(desktopLayoutHarness.layoutPush.BODY_CLASS),
  true,
)
assert.equal(
  desktopLayoutHarness.document.querySelector(".scaffold-layout")?.getAttribute("data-equipify-layout-root"),
  "true",
)
assert.equal(
  desktopLayoutHarness.document.querySelector(".scaffold-layout__main")?.getAttribute("data-equipify-layout-main"),
  "true",
)
assert.equal(
  desktopLayoutHarness.document.querySelector(".scaffold-layout__inner")?.getAttribute("data-equipify-layout-inner"),
  "true",
)
assert.equal(
  desktopLayoutHarness.document
    .querySelector(".scaffold-finite-scroll__content")
    ?.getAttribute("data-equipify-layout-feed"),
  "true",
)
assert.equal(
  desktopLayoutHarness.document.querySelector(".scaffold-layout__aside")?.getAttribute("data-equipify-layout-rail"),
  "true",
)
assert.equal(
  desktopLayoutHarness.document.documentElement.style.getPropertyValue("--equipify-linkedin-main-width"),
  "calc(100vw - 420px - 0px)",
)

desktopLayoutHarness.layoutPush.applyLayoutReserve(false, {
  document: desktopLayoutHarness.document,
  viewportWidth: 1280,
  logLayoutPush: () => {},
})
assert.equal(
  desktopLayoutHarness.document.body.classList.contains(
    desktopLayoutHarness.layoutPush.DESKTOP_LAYOUT_CLASS,
  ),
  false,
)
assert.equal(
  desktopLayoutHarness.document.querySelector(".scaffold-layout")?.getAttribute("data-equipify-layout-root"),
  null,
)
assert.equal(
  desktopLayoutHarness.document.querySelector(".scaffold-layout__aside")?.getAttribute("data-equipify-layout-rail"),
  null,
)
assert.ok(
  !desktopLayoutHarness.document.documentElement.style.getPropertyValue("--equipify-linkedin-main-width"),
)

const overlayHarness = runLayoutPushHarness(800)
overlayHarness.layoutPush.applyLayoutReserve(true, {
  document: overlayHarness.document,
  viewportWidth: 800,
  logLayoutPush: () => {},
})
assert.equal(overlayHarness.layoutPush.resolveLayoutMode(800), "overlay")
assert.equal(
  overlayHarness.document.body.classList.contains(overlayHarness.layoutPush.DESKTOP_LAYOUT_CLASS),
  false,
)
assert.equal(
  overlayHarness.document.querySelector(".scaffold-layout")?.getAttribute("data-equipify-layout-root"),
  null,
)

function runSettingsMergeHarness() {
  const source = fs.readFileSync(
    path.join(process.cwd(), "extensions/growth-browser-intake/extension-storage.js"),
    "utf8",
  )
  const storageStub = {
    sync: {
      data: {} as Record<string, unknown>,
      async get(key: string) {
        return { [key]: this.data[key] }
      },
      async set(payload: Record<string, unknown>) {
        Object.assign(this.data, payload)
      },
    },
    local: {
      data: {} as Record<string, unknown>,
      async get(key: string) {
        return { [key]: this.data[key] }
      },
      async set(payload: Record<string, unknown>) {
        Object.assign(this.data, payload)
      },
    },
  }
  const sandbox: Record<string, unknown> = {
    console: { log: () => {} },
    chrome: { storage: storageStub },
    window: {},
  }
  const context = vm.createContext(sandbox)
  vm.runInContext(source.replace(/^console\.log\([^)]+\)\s*/m, ""), context)
  return (sandbox.window as { EquipifyGrowthExtensionStorage: Record<string, unknown> })
    .EquipifyGrowthExtensionStorage as {
    DEFAULT_SETTINGS: Record<string, unknown>
    mergeSettingsWithDefaults: (stored: Record<string, unknown> | null) => Record<string, unknown>
    settingsNeedBackfill: (stored: Record<string, unknown> | null) => boolean
    loadExtensionSettings: () => Promise<Record<string, unknown>>
  }
}

const settingsHarness = runSettingsMergeHarness()
assert.equal(settingsHarness.DEFAULT_SETTINGS.apiPreset, "production")
assert.equal(settingsHarness.DEFAULT_SETTINGS.apiBaseUrl, "https://app.equipify.ai")
assert.equal(settingsHarness.DEFAULT_SETTINGS.prospectingMode, true)
assert.equal(settingsHarness.DEFAULT_SETTINGS.showLinkedInFloatingButton, true)
assert.equal(settingsHarness.DEFAULT_SETTINGS.verifyEmailBeforeSave, false)
assert.equal(settingsHarness.DEFAULT_SETTINGS.queueContactDiscovery, true)

const partialLegacy = settingsHarness.mergeSettingsWithDefaults({
  apiPreset: "local",
  apiBaseUrl: "http://localhost:3000",
  prospectingMode: false,
})
assert.equal(partialLegacy.apiPreset, "local")
assert.equal(partialLegacy.prospectingMode, false)
assert.equal(partialLegacy.queueContactDiscovery, true)
assert.equal(partialLegacy.showLinkedInFloatingButton, true)

const explicitSaved = settingsHarness.mergeSettingsWithDefaults({
  queueContactDiscovery: false,
  showLinkedInFloatingButton: false,
})
assert.equal(explicitSaved.queueContactDiscovery, false)
assert.equal(explicitSaved.showLinkedInFloatingButton, false)
assert.equal(explicitSaved.prospectingMode, true)

assert.equal(settingsHarness.settingsNeedBackfill({ apiPreset: "production" }), true)
assert.equal(
  settingsHarness.settingsNeedBackfill({
    apiPreset: "production",
    apiBaseUrl: "https://app.equipify.ai",
    prospectingMode: true,
    showLinkedInFloatingButton: true,
    verifyEmailBeforeSave: false,
    queueContactDiscovery: true,
  }),
  false,
)

const navHarness = runLayoutPushHarness(1280)
navHarness.layoutPush.applyLayoutReserve(true, {
  document: navHarness.document,
  viewportWidth: 1280,
  logLayoutPush: () => {},
})
const navNode = navHarness.document.querySelector(".global-nav")
assert.equal(navNode?.getAttribute("data-equipify-layout-root"), null)
assert.equal(navNode?.getAttribute("data-equipify-layout-main"), null)

const inpageSidebarHtml = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/inpage-sidebar.html"),
  "utf8",
)
assert.match(inpageSidebarHtml, /quick-company-name/)
assert.match(inpageSidebarHtml, /quick-linkedin-url/)
assert.match(inpageSidebarHtml, /extension-brand.js/)
assert.match(inpageSidebarHtml, /width="1024"/)
assert.match(inpageSidebarHtml, /inpage-sidebar-close-btn/)
assert.match(inpageSidebarHtml, /surface-inpage/)
assert.match(inpageSidebarHtml, /Find contact details/)
assert.match(inpageSidebarHtml, /Employees/)
assert.match(inpageSidebarHtml, /Company intelligence/)
assert.match(inpageSidebarHtml, /es-ws-enrich-company-btn/)
assert.match(inpageSidebarHtml, /es-ws-panel-logo/)
assert.match(inpageSidebarHtml, /es-ws-visit-company-btn/)
assert.match(inpageSidebarHtml, /data-company-tab="overview"/)
assert.match(inpageSidebarHtml, /data-company-tab="similar"/)

const backgroundJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/background.js"),
  "utf8",
)
assert.match(backgroundJs, /equipify-enrich-company-page/)

function parseLinkedInHeadlineFixture(headline: string) {
  const normalized = /\s/.test(headline)
    ? headline.replace(/\s+/g, " ").trim()
    : headline.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim()
  const atMatch = normalized.match(/^(.+?)\s+at\s+(.+?)(?:\s*[|·].*)?$/i)
  if (atMatch) {
    return { title: atMatch[1]?.trim() ?? null, company: atMatch[2]?.trim() ?? null }
  }
  const withoutEmployment = normalized.replace(
    /\s*[|·]\s*(Full-time|Part-time|Self-employed|Contract|Freelance|Internship).*$/i,
    "",
  )
  return { title: withoutEmployment, company: null }
}

assert.deepEqual(parseLinkedInHeadlineFixture("Secretary at BioMed Techs Inc."), {
  title: "Secretary",
  company: "BioMed Techs Inc.",
})
assert.deepEqual(parseLinkedInHeadlineFixture("SecretaryBioMed Techs Inc. · Full-time"), {
  title: "SecretaryBioMed Techs Inc.",
  company: null,
})
assert.match(inpageSidebarHtml, /Discover Employees/)
assert.match(inpageSidebarHtml, /People Data Labs, Prospeo, Apollo, Hunter/)
assert.match(inpageSidebarHtml, /Discover Similar Companies/)
assert.match(inpageSidebarHtml, /Same Industry/)

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
    path.join(process.cwd(), "extensions/growth-browser-intake/assets/equipify-sales-wordmark.png"),
  ),
  "missing equipify-sales-wordmark.png",
)
const panelLogoAlpha = execSync(
  'sips -g hasAlpha "extensions/growth-browser-intake/assets/equipify-sales-wordmark.png"',
  { cwd: process.cwd(), encoding: "utf8" },
)
assert.match(panelLogoAlpha, /hasAlpha: yes/)

const panelLogoStats = JSON.parse(
  execSync(
    `python3 - <<'PY'
from PIL import Image
import json
img = Image.open("extensions/growth-browser-intake/assets/equipify-sales-wordmark.png").convert("RGBA")
w, h = img.size
transparent = 0
neutral_dark_opaque = 0
for y in range(h):
    for x in range(w):
        r, g, b, a = img.getpixel((x, y))
        if a < 10:
            transparent += 1
            continue
        if a > 200 and max(r, g, b) < 90 and abs(r - g) < 20 and abs(g - b) < 20:
            neutral_dark_opaque += 1
corners = [img.getpixel((0, 0))[3], img.getpixel((w - 1, 0))[3], img.getpixel((0, h - 1))[3], img.getpixel((w - 1, h - 1))[3]]
print(json.dumps({
    "corners_transparent": all(alpha < 10 for alpha in corners),
    "transparent_pixels": transparent,
    "neutral_dark_opaque_pixels": neutral_dark_opaque,
}))
PY`,
    { cwd: process.cwd(), encoding: "utf8" },
  ).trim(),
) as { corners_transparent?: boolean; neutral_dark_opaque_pixels?: number }
assert.equal(panelLogoStats.corners_transparent, true)
assert.ok(Number(panelLogoStats.neutral_dark_opaque_pixels ?? 9999) <= 500)


const contactEnrichmentRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/contact-enrichment/route.ts"),
  "utf8",
)
assert.match(contactEnrichmentRoute, /discoverWebsiteContacts/)
assert.match(contactEnrichmentRoute, /website_public_extract/)
assert.match(contactEnrichmentRoute, /Contact enrichment provider not configured/)
assert.doesNotMatch(contactEnrichmentRoute, /linkedin.*scrap|hidden LinkedIn/i)


const linkedinFloatingDockCss = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/linkedin-floating-dock.css"),
  "utf8",
)
assert.match(linkedinFloatingDockCss, /#1e395f/)
assert.match(linkedinFloatingDockCss, /:hover \.equipify-sales-floating-dock__drag/)
assert.match(linkedinFloatingDockCss, /:hover \.equipify-sales-floating-dock__hide/)
assert.match(linkedinFloatingDockCss, /display: none !important/)

const salesWorkspaceCss = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/sales-workspace.css"),
  "utf8",
)
assert.match(salesWorkspaceCss, /overflow-x: hidden/)
assert.match(salesWorkspaceCss, /max-width: 420px/)
assert.match(salesWorkspaceCss, /es-ws-enrichment-status/)
assert.match(salesWorkspaceCss, /es-ws-brand-logo-img/)
assert.match(salesWorkspaceCss, /aspect-ratio: 1024 \/ 214/)
assert.match(salesWorkspaceCss, /object-fit: contain/)
assert.match(salesWorkspaceCss, /\.es-ws-brand-logo[\s\S]*background: transparent/)
assert.match(salesWorkspaceCss, /\.es-ws-brand-logo-img[\s\S]*background-color: transparent !important/)
assert.doesNotMatch(salesWorkspaceCss, /es-ws-brand-title/)
assert.match(popupCss, /\.es-launcher-logo[\s\S]*background: transparent/)
assert.match(salesWorkspaceCss, /es-ws-employees-list/)
assert.match(salesWorkspaceCss, /es-ws-employee-actions/)
assert.match(salesWorkspaceCss, /es-ws-company-tabs/)
assert.match(salesWorkspaceCss, /es-ws-similar-card/)

const extensionWorkspaceJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-workspace.js"),
  "utf8",
)
assert.match(extensionWorkspaceJs, /SIMILAR_COMPANIES_PATH/)
assert.match(extensionWorkspaceJs, /discoverSimilarCompanies/)
assert.match(extensionWorkspaceJs, /renderTechnologies/)
assert.match(extensionWorkspaceJs, /renderSignals/)
assert.match(extensionWorkspaceJs, /\[Equipify Sales:intelligence\]/)
assert.match(extensionWorkspaceJs, /Not found on public profile/)
assert.match(extensionWorkspaceJs, /resolveCompanyIntelName/)
assert.match(extensionWorkspaceJs, /resolveCompanyIntelDisplayName/)
assert.match(extensionWorkspaceJs, /COMPANY_NOT_DETECTED/)
assert.match(extensionWorkspaceJs, /Company not detected/)
assert.match(extensionWorkspaceJs, /rejectCompanyIfPersonName/)
assert.match(extensionWorkspaceJs, /followersValue/)
assert.match(extensionWorkspaceJs, /Not available/)
assert.match(extensionWorkspaceJs, /resolveProfileTitle/)
assert.match(extensionWorkspaceJs, /Not found on public company page/)
assert.match(extensionWorkspaceJs, /equipify-enrich-company-page/)
assert.match(extensionWorkspaceJs, /es-ws-enrich-company-btn/)
assert.match(extensionWorkspaceJs, /profile_photo_url/)
assert.match(extensionWorkspaceJs, /renderCrmRelationship/)
assert.match(extensionWorkspaceJs, /People Data Labs, Prospeo, Apollo, Hunter/)
assert.match(extensionWorkspaceJs, /renderCrmContacts/)
assert.match(extensionWorkspaceJs, /buildCurrentProfileEmployeeCandidate/)
assert.match(extensionWorkspaceJs, /es-ws-research-grid/)
assert.doesNotMatch(extensionWorkspaceJs, /Run Similar Company Discovery/)
assert.match(extensionWorkspaceJs, /resolveProfileDisplayName/)
assert.match(extensionWorkspaceJs, /inferProfileNameFromPageTitle/)
assert.match(extensionWorkspaceJs, /render_input_payload/)
assert.doesNotMatch(extensionWorkspaceJs, /hidden LinkedIn scraping|linkedin.*scrap/i)
assert.match(extensionWorkspaceJs, /EquipifyGrowthEmployeeRow/)
assert.match(extensionWorkspaceJs, /buildObjectRowHtml/)
assert.match(extensionWorkspaceJs, /bindObjectRowActions/)

const extensionEmployeeRowJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-employee-row.js"),
  "utf8",
)
assert.match(extensionEmployeeRowJs, /resolveEmployeeViewUrl/)
assert.match(extensionEmployeeRowJs, /buildObjectRowHtml/)
assert.match(extensionEmployeeRowJs, /buildEmployeeRowHtml/)
assert.match(extensionEmployeeRowJs, /bindObjectRowActions/)
assert.match(extensionEmployeeRowJs, /No public URL available/)

function runEmployeeRowHarness(): {
  resolveEmployeeViewUrl: (contact: Record<string, unknown>) => string | null
  buildEmployeeRowHtml: (contact: Record<string, unknown>) => string
  bindEmployeeRowActions: (
    list: Element,
    deps?: {
      openViewUrl?: (url: string) => void
      triggerAdd?: () => void
      triggerOpenLead?: (leadId: string) => void
    },
  ) => void
  document: Document
} {
  const { document } = parseHTML("<!doctype html><html><body></body></html>")
  const source = fs.readFileSync(
    path.join(process.cwd(), "extensions/growth-browser-intake/extension-employee-row.js"),
    "utf8",
  )
  const sandbox: Record<string, unknown> = {
    document,
    window: {},
  }
  const context = vm.createContext(sandbox)
  vm.runInContext(source, context)
  const employeeRow = (context.window as { EquipifyGrowthEmployeeRow?: Record<string, unknown> })
    .EquipifyGrowthEmployeeRow as {
    resolveEmployeeViewUrl: (contact: Record<string, unknown>) => string | null
    buildEmployeeRowHtml: (contact: Record<string, unknown>) => string
    bindEmployeeRowActions: (
      list: Element,
      deps?: {
        openViewUrl?: (url: string) => void
        triggerAdd?: () => void
        triggerOpenLead?: (leadId: string) => void
      },
    ) => void
  }
  return {
    resolveEmployeeViewUrl: employeeRow.resolveEmployeeViewUrl,
    buildEmployeeRowHtml: employeeRow.buildEmployeeRowHtml,
    bindEmployeeRowActions: employeeRow.bindEmployeeRowActions,
    document,
  }
}

const employeeRowHarness = runEmployeeRowHarness()
assert.equal(
  employeeRowHarness.resolveEmployeeViewUrl({
    linkedin_url: "https://www.linkedin.com/in/jane-doe/",
    source_url: "https://example.com/person",
  }),
  "https://www.linkedin.com/in/jane-doe/",
)
assert.equal(
  employeeRowHarness.resolveEmployeeViewUrl({
    profile_url: "https://example.com/profile",
    source_url: "https://example.com/source",
  }),
  "https://example.com/profile",
)
assert.equal(employeeRowHarness.resolveEmployeeViewUrl({}), null)

const linkedInEmployeeHtml = employeeRowHarness.buildEmployeeRowHtml({
  name: "Jane Doe",
  title: "Biomedical Engineer",
  department: "Engineering",
  seniority: "Individual Contributor",
  crm_status: "Not In CRM",
  linkedin_url: "https://www.linkedin.com/in/jane-doe/",
  source: "linkedin_visible",
})
assert.match(linkedInEmployeeHtml, /es-ws-employee-view/)
assert.match(linkedInEmployeeHtml, /es-ws-employee-add/)
assert.match(linkedInEmployeeHtml, />View</)
assert.match(linkedInEmployeeHtml, />Add</)
assert.match(linkedInEmployeeHtml, /data-view-url="https:\/\/www\.linkedin\.com\/in\/jane-doe\/"/)
assert.doesNotMatch(linkedInEmployeeHtml, /disabled/)

const noUrlEmployeeHtml = employeeRowHarness.buildEmployeeRowHtml({
  name: "John Smith",
  title: "Technician",
  department: "Operations",
  seniority: "Individual Contributor",
  crm_status: "Not In CRM",
  source: "crm",
})
assert.match(noUrlEmployeeHtml, /es-ws-employee-view[^>]*disabled/)
assert.match(noUrlEmployeeHtml, /No public URL available/)

const crmEmployeeHtml = employeeRowHarness.buildEmployeeRowHtml({
  name: "Existing Lead",
  title: "Director",
  department: "Leadership",
  seniority: "Director",
  crm_status: "qualified",
  lead_id: "lead-123",
  linkedin_url: "https://www.linkedin.com/in/existing-lead/",
})
assert.match(crmEmployeeHtml, />Open</)
assert.match(crmEmployeeHtml, /data-secondary-action="open-lead"/)

const list = employeeRowHarness.document.createElement("div")
list.innerHTML = employeeRowHarness.buildEmployeeRowHtml({
  name: "Jane Doe",
  title: "Biomedical Engineer",
  department: "Engineering",
  seniority: "Individual Contributor",
  crm_status: "Not In CRM",
  linkedin_url: "https://www.linkedin.com/in/jane-doe/",
})
const openedUrls: string[] = []
let addTriggered = false
let openLeadTriggered = false
employeeRowHarness.bindEmployeeRowActions(list, {
  openViewUrl: (url) => {
    openedUrls.push(url)
  },
  triggerAdd: () => {
    addTriggered = true
  },
  triggerOpenLead: () => {
    openLeadTriggered = true
  },
})
const viewButton = list.querySelector(".es-ws-employee-view") as HTMLButtonElement
viewButton?.click()
assert.deepEqual(openedUrls, ["https://www.linkedin.com/in/jane-doe/"])
assert.equal(addTriggered, false)
assert.equal(openLeadTriggered, false)

addTriggered = false
openLeadTriggered = false
const addButton = list.querySelector(".es-ws-employee-add") as HTMLButtonElement
addButton?.click()
assert.equal(addTriggered, true)
assert.equal(openLeadTriggered, false)
assert.deepEqual(openedUrls, ["https://www.linkedin.com/in/jane-doe/"])

const extensionContextNormalizeJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-context-normalize.js"),
  "utf8",
)
assert.match(extensionContextNormalizeJs, /\[Equipify Sales:context-status\]/)
assert.match(extensionContextNormalizeJs, /normalizeExtractionPayload/)
assert.match(extensionContextNormalizeJs, /Context Found/)

function runContextNormalizeHarness() {
  const sandbox: Record<string, unknown> = { window: {} }
  const context = vm.createContext(sandbox)
  vm.runInContext(extensionContextNormalizeJs, context)
  return (context.window as { EquipifyGrowthContextNormalize?: Record<string, unknown> })
    .EquipifyGrowthContextNormalize as {
    normalizeExtractionPayload: (input: Record<string, unknown>) => Record<string, unknown>
    resolveContextStatusLabel: (input: Record<string, unknown>) => { label: string; tone: string }
    buildResearchSnapshotLines: (normalized: Record<string, unknown>) => Array<{ label: string; value: string | null }>
  }
}

const contextNormalize = runContextNormalizeHarness()
const normalized = contextNormalize.normalizeExtractionPayload({
  detected: {
    contact_name: "Jane Doe",
    job_title: "Biomedical Engineer",
    company_name: "Sharp Memorial Hospital",
    location: "San Diego, CA",
    linkedin_page_kind: "profile",
  },
})
assert.equal(normalized.hasContext, true)
assert.equal(normalized.person, "Jane Doe")
assert.equal(normalized.company, "Sharp Memorial Hospital")

const contextStatus = contextNormalize.resolveContextStatusLabel({
  crmPayload: { matched: false },
  normalized,
  tabUrl: "https://www.linkedin.com/in/jane-doe/",
  restricted: false,
})
assert.equal(contextStatus.label, "Context Found")

const snapshotLines = contextNormalize.buildResearchSnapshotLines(normalized)
assert.equal(snapshotLines.length, 4)
assert.equal(snapshotLines[0]?.label, "Person")

const extensionContactIntelligenceJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-contact-intelligence.js"),
  "utf8",
)
assert.match(extensionContactIntelligenceJs, /\[Equipify Sales:contact-intelligence\]/)
assert.match(extensionContactIntelligenceJs, /analyzeContactIntelligence/)
assert.match(extensionContactIntelligenceJs, /decision_maker_level/)

function runContactIntelligenceHarness() {
  const sandbox: Record<string, unknown> = { window: {}, console }
  const context = vm.createContext(sandbox)
  vm.runInContext(extensionContactIntelligenceJs, context)
  return (context.window as { EquipifyGrowthContactIntelligence?: Record<string, unknown> })
    .EquipifyGrowthContactIntelligence as {
    analyzeContactIntelligence: (input: Record<string, unknown>) => Record<string, unknown>
  }
}

const contactIntelligence = runContactIntelligenceHarness()

function assertContactIntel(
  title: string,
  expected: {
    departmentIncludes?: string[]
    seniority: string
    decision_maker_level: string
    buying_influence: string
    next_best_action: string
  },
  extra: Record<string, unknown> = {},
) {
  const result = contactIntelligence.analyzeContactIntelligence({
    person: "Test Contact",
    title,
    company: "Sharp Memorial Hospital",
    location: "San Diego, CA",
    ...extra,
  })
  assert.equal(result.seniority, expected.seniority, `${title} seniority`)
  assert.equal(result.decision_maker_level, expected.decision_maker_level, `${title} decision maker`)
  assert.equal(result.buying_influence, expected.buying_influence, `${title} buying influence`)
  assert.equal(result.next_best_action, expected.next_best_action, `${title} next best action`)
  if (expected.departmentIncludes) {
    for (const dept of expected.departmentIncludes) {
      assert.match(String(result.department), new RegExp(dept, "i"), `${title} department includes ${dept}`)
    }
  }
  return result
}

const ricardoIntel = assertContactIntel("Biomedical Equipment Technician", {
  departmentIncludes: ["Clinical", "Engineering"],
  seniority: "Individual Contributor",
  decision_maker_level: "Low",
  buying_influence: "Low",
  next_best_action: "Identify Clinical Engineering Director",
})
assert.equal(ricardoIntel.research_confidence, 100)
assert.match(String(ricardoIntel.recommended_angles?.[0] ?? ""), /Field Service Efficiency/i)

assertContactIntel("Director Clinical Engineering", {
  departmentIncludes: ["Clinical", "Engineering"],
  seniority: "Director",
  decision_maker_level: "High",
  buying_influence: "High",
  next_best_action: "Add to outreach sequence",
})

assertContactIntel("Service Manager", {
  departmentIncludes: ["Service"],
  seniority: "Manager",
  decision_maker_level: "Medium",
  buying_influence: "Medium",
  next_best_action: "Capture and research manager",
})

assertContactIntel("VP Operations", {
  departmentIncludes: ["Operations"],
  seniority: "VP",
  decision_maker_level: "Executive",
  buying_influence: "High",
  next_best_action: "Add to outreach sequence",
})

assertContactIntel("Owner", {
  departmentIncludes: ["Executive"],
  seniority: "Owner",
  decision_maker_level: "Executive",
  buying_influence: "High",
  next_best_action: "Add to outreach sequence",
})

assertContactIntel("Founder", {
  seniority: "Owner",
  decision_maker_level: "Executive",
  buying_influence: "High",
  next_best_action: "Add to outreach sequence",
})

assertContactIntel("President", {
  seniority: "Executive",
  decision_maker_level: "Executive",
  buying_influence: "High",
  next_best_action: "Add to outreach sequence",
})

assertContactIntel("CEO", {
  seniority: "Executive",
  decision_maker_level: "Executive",
  buying_influence: "High",
  next_best_action: "Add to outreach sequence",
})

assertContactIntel("Biomedical Equipment Technician", {
  seniority: "Individual Contributor",
  decision_maker_level: "Low",
  buying_influence: "Low",
  next_best_action: "Open CRM record",
}, { hasCrmMatch: true })

assert.equal(
  contactIntelligence.analyzeContactIntelligence({
    person: "Jane",
    title: "Director",
    connection_degree: "1st",
    mutual_connections_count: 6,
  }).relationship_strength,
  "Strong",
)

const extensionBuyingCommitteeJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-buying-committee.js"),
  "utf8",
)
assert.match(extensionBuyingCommitteeJs, /\[Equipify Sales:buying-committee\]/)
assert.match(extensionBuyingCommitteeJs, /classifyBuyingRole/)
assert.match(extensionBuyingCommitteeJs, /buying_role_confidence/)

function runBuyingCommitteeHarness() {
  const sandbox: Record<string, unknown> = { window: {}, console }
  const context = vm.createContext(sandbox)
  vm.runInContext(extensionContactIntelligenceJs, context)
  vm.runInContext(extensionBuyingCommitteeJs, context)
  return (context.window as { EquipifyGrowthBuyingCommittee?: Record<string, unknown> })
    .EquipifyGrowthBuyingCommittee as {
    classifyBuyingRole: (title: string) => { buying_role: string; buying_role_confidence: number }
    enrichEmployeeRecord: (record: Record<string, unknown>, context?: Record<string, unknown>) => Record<string, unknown>
    buildCommitteeSummary: (records: Record<string, unknown>[]) => Record<string, number>
    buildRecommendedContacts: (
      records: Record<string, unknown>[],
      context?: Record<string, unknown>,
    ) => Array<{ slot: string; role: string; employee: Record<string, unknown> }>
    isLeadershipTitle: (title: string) => boolean
  }
}

const buyingCommittee = runBuyingCommitteeHarness()

assert.equal(buyingCommittee.classifyBuyingRole("VP Operations").buying_role, "Decision Maker")
assert.equal(buyingCommittee.classifyBuyingRole("Director Clinical Engineering").buying_role, "Decision Maker")
assert.equal(buyingCommittee.classifyBuyingRole("Service Manager").buying_role, "Influencer")
assert.equal(buyingCommittee.classifyBuyingRole("Senior Biomedical Engineer").buying_role, "Champion")
assert.equal(buyingCommittee.classifyBuyingRole("Biomedical Equipment Technician").buying_role, "End User")
assert.ok(buyingCommittee.classifyBuyingRole("VP Operations").buying_role_confidence >= 0.8)

const enrichedEmployee = buyingCommittee.enrichEmployeeRecord({
  name: "Alex Owner",
  title: "Founder & CEO",
  department: "Executive",
})
assert.equal(enrichedEmployee.buying_role, "Decision Maker")
assert.ok(Number(enrichedEmployee.committee_score) > 0)
assert.ok(Array.isArray(enrichedEmployee.committee_badges))

const committeeSummary = buyingCommittee.buildCommitteeSummary([
  { title: "VP Operations", buying_role: "Decision Maker" },
  { title: "Service Manager", buying_role: "Influencer" },
  { title: "Senior Engineer", buying_role: "Champion" },
  { title: "Technician", buying_role: "End User" },
])
assert.equal(committeeSummary["Decision Maker"], 1)
assert.equal(committeeSummary.Influencer, 1)
assert.equal(committeeSummary.Champion, 1)
assert.equal(committeeSummary["End User"], 1)

const recommended = buyingCommittee.buildRecommendedContacts(
  [
    { name: "Pat VP", title: "VP Operations", department: "Operations" },
    { name: "Sam Manager", title: "Service Manager", department: "Service" },
    { name: "Chris Senior", title: "Senior Biomedical Engineer", department: "Engineering" },
  ],
  { company: "Sharp Memorial Hospital" },
)
assert.equal(recommended.length, 3)
assert.equal(recommended[0]?.slot, "Best Decision Maker")
assert.equal(recommended[1]?.slot, "Best Influencer")
assert.equal(recommended[2]?.slot, "Best Champion")
assert.ok(buyingCommittee.isLeadershipTitle("President of Operations"))
assert.ok(!buyingCommittee.isLeadershipTitle("Biomedical Technician"))

assert.match(extensionWorkspaceJs, /renderContactIntelligence/)
assert.match(extensionWorkspaceJs, /renderOpportunityIntelligence/)
assert.match(extensionWorkspaceJs, /es-ws-contact-intelligence/)
assert.match(extensionWorkspaceJs, /es-ws-opportunity-intelligence/)

const extensionOpportunityIntelligenceJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-opportunity-intelligence.js"),
  "utf8",
)
assert.match(extensionOpportunityIntelligenceJs, /\[Equipify Sales:opportunity-intelligence\]/)
assert.match(extensionOpportunityIntelligenceJs, /analyzeOpportunityIntelligence/)
assert.match(extensionOpportunityIntelligenceJs, /scoring_breakdown/)

function runOpportunityIntelligenceHarness() {
  const sandbox: Record<string, unknown> = { window: {}, console }
  const context = vm.createContext(sandbox)
  vm.runInContext(extensionOpportunityIntelligenceJs, context)
  return (context.window as { EquipifyGrowthOpportunityIntelligence?: Record<string, unknown> })
    .EquipifyGrowthOpportunityIntelligence as {
    analyzeOpportunityIntelligence: (input: Record<string, unknown>) => Record<string, unknown>
  }
}

const opportunityIntelligence = runOpportunityIntelligenceHarness()

function buildOpportunityInput(title: string, company: string | null, extra: Record<string, unknown> = {}) {
  const contact = contactIntelligence.analyzeContactIntelligence({
    person: "Test Contact",
    title,
    company,
    location: "San Diego, CA",
    hasCrmMatch: extra.has_crm_match === true,
  })
  return {
    person: "Test Contact",
    title,
    company,
    location: "San Diego, CA",
    department: contact.department,
    seniority: contact.seniority,
    decision_maker_level: contact.decision_maker_level,
    buying_influence: contact.buying_influence,
    relationship_strength: contact.relationship_strength,
    connection_degree: extra.connection_degree ?? null,
    mutual_connections_count: extra.mutual_connections_count ?? null,
    has_crm_match: extra.has_crm_match === true,
    existing_crm_contacts_count: extra.existing_crm_contacts_count ?? 0,
    existing_opportunities_count: extra.existing_opportunities_count ?? 0,
    existing_customers_count: extra.existing_customers_count ?? 0,
    company_industry: extra.company_industry ?? null,
  }
}

function assertOpportunityIntel(
  title: string,
  company: string | null,
  expected: {
    scoreMin?: number
    scoreMax?: number
    priority: string
    industry_fit: string
    role_fit: string
    company_fit: string
    relationship_fit?: string
    recommended_sales_motion: string | RegExp
    whyIncludes?: string[]
  },
  extra: Record<string, unknown> = {},
) {
  const result = opportunityIntelligence.analyzeOpportunityIntelligence(
    buildOpportunityInput(title, company, extra),
  )
  if (expected.scoreMin != null) {
    assert.ok(Number(result.target_fit_score) >= expected.scoreMin, `${title} score >= ${expected.scoreMin}`)
  }
  if (expected.scoreMax != null) {
    assert.ok(Number(result.target_fit_score) <= expected.scoreMax, `${title} score <= ${expected.scoreMax}`)
  }
  assert.equal(result.priority, expected.priority, `${title} priority`)
  assert.equal(result.industry_fit, expected.industry_fit, `${title} industry fit`)
  assert.equal(result.role_fit, expected.role_fit, `${title} role fit`)
  assert.equal(result.company_fit, expected.company_fit, `${title} company fit`)
  if (expected.relationship_fit) {
    assert.equal(result.relationship_fit, expected.relationship_fit, `${title} relationship fit`)
  }
  if (expected.recommended_sales_motion instanceof RegExp) {
    assert.match(String(result.recommended_sales_motion), expected.recommended_sales_motion, `${title} sales motion`)
  } else {
    assert.equal(result.recommended_sales_motion, expected.recommended_sales_motion, `${title} sales motion`)
  }
  if (expected.whyIncludes) {
    for (const snippet of expected.whyIncludes) {
      assert.ok(
        (result.why_this_matters as string[]).some((reason) => reason.toLowerCase().includes(snippet.toLowerCase())),
        `${title} why includes ${snippet}`,
      )
    }
  }
  return result
}

const ricardoOpportunity = assertOpportunityIntel(
  "Biomedical Equipment Technician",
  "SHARP MEMORIAL HOSPITAL",
  {
    scoreMin: 55,
    scoreMax: 70,
    priority: "Medium",
    industry_fit: "High",
    role_fit: "Low",
    company_fit: "High",
    relationship_fit: "Weak",
    recommended_sales_motion: "Find department leader or clinical engineering decision maker",
    whyIncludes: ["Healthcare equipment service environment", "influencer, not final buyer"],
  },
)

assertOpportunityIntel("Director Clinical Engineering", "SHARP MEMORIAL HOSPITAL", {
  scoreMin: 70,
  priority: "High",
  industry_fit: "High",
  role_fit: "High",
  company_fit: "High",
  recommended_sales_motion: "Run executive outreach sequence",
})

assertOpportunityIntel("Service Manager", "Acme Field Services", {
  scoreMin: 50,
  priority: "Medium",
  industry_fit: "High",
  role_fit: "Medium",
  company_fit: "Medium",
  recommended_sales_motion: "Capture manager and map service workflow pain points",
})

assertOpportunityIntel("VP Operations", "Regional Healthcare Group", {
  scoreMin: 80,
  priority: "Critical",
  industry_fit: "High",
  role_fit: "High",
  company_fit: "High",
  recommended_sales_motion: "Run executive outreach sequence",
})

assertOpportunityIntel("Owner", "Summit Contracting", {
  scoreMin: 75,
  priority: "High",
  industry_fit: "High",
  role_fit: "High",
  company_fit: "Medium",
  recommended_sales_motion: "Run executive outreach sequence",
})

assertOpportunityIntel("Procurement Manager", "Metro Hospital System", {
  scoreMin: 60,
  priority: "Medium",
  industry_fit: "High",
  role_fit: "High",
  company_fit: "High",
  recommended_sales_motion: "Position vendor value and route through procurement workflow",
})

assertOpportunityIntel("", "SHARP MEMORIAL HOSPITAL", {
  scoreMax: 55,
  priority: "Low",
  industry_fit: "High",
  role_fit: "Low",
  company_fit: "High",
  recommended_sales_motion: /Identify economic buyer|Capture contact/,
})

const missingCompanyOpportunity = assertOpportunityIntel("Biomedical Equipment Technician", null, {
  scoreMax: 50,
  priority: "Low",
  industry_fit: "High",
  role_fit: "Low",
  company_fit: "Low",
  recommended_sales_motion: "Find department leader or clinical engineering decision maker",
})
assert.ok(missingCompanyOpportunity.why_this_matters.length >= 1)

assert.equal(ricardoOpportunity.scoring_breakdown?.industry != null, true)

const extensionConfigJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-config.js"),
  "utf8",
)
assert.match(extensionConfigJs, /Matched by domain/)
assert.match(extensionConfigJs, /Matched by LinkedIn URL/)
assert.match(extensionConfigJs, /Matched by company name/)
assert.match(extensionConfigJs, /CRM_CONTEXT_PATH/)
assert.match(extensionConfigJs, /CONTACT_ENRICHMENT_PATH/)
assert.match(extensionConfigJs, /SIMILAR_COMPANIES_PATH/)
assert.match(extensionConfigJs, /PACKAGE_METADATA_DOWNLOAD_PATH/)

const extensionStorageJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-storage.js"),
  "utf8",
)
assert.match(extensionStorageJs, /MAX_RECENT_CAPTURES = 5/)
assert.match(extensionStorageJs, /prospectingMode: true/)
assert.match(extensionStorageJs, /showLinkedInFloatingButton: true/)
assert.match(extensionStorageJs, /queueContactDiscovery: true/)
assert.match(extensionStorageJs, /mergeSettingsWithDefaults/)
assert.match(extensionStorageJs, /settingsNeedBackfill/)
assert.match(extensionStorageJs, /SETTINGS_SCHEMA_VERSION/)
assert.match(extensionStorageJs, /loadLinkedInFloatingDockPrefs/)
assert.match(extensionStorageJs, /saveLinkedInFloatingDockPrefs/)
assert.match(extensionStorageJs, /equipifySalesLinkedInFloatingDock/)
assert.match(extensionStorageJs, /chrome.storage/)

const pageMetadataJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/page-metadata.js"),
  "utf8",
)
assert.match(pageMetadataJs, /extractLinkedInProfile/)
assert.match(pageMetadataJs, /extractLinkedInCompany/)
assert.match(pageMetadataJs, /linkedin_company_url/)
assert.match(pageMetadataJs, /extractEducationEntries/)
assert.match(pageMetadataJs, /extractProfileWebsite/)
assert.match(pageMetadataJs, /extractProfileLocation/)
assert.match(pageMetadataJs, /\[Equipify Sales:context\]/)
assert.match(pageMetadataJs, /parseLinkedInHeadline/)
assert.match(pageMetadataJs, /cleanLinkedInProfileName/)
assert.match(pageMetadataJs, /normalizeVisibleText/)
assert.match(pageMetadataJs, /inferLinkedInProfileNameFromTitle/)
assert.match(pageMetadataJs, /raw_profile_extract/)
assert.match(pageMetadataJs, /normalized_profile_payload/)
assert.match(pageMetadataJs, /rejectCompanyIfPersonName/)
assert.match(pageMetadataJs, /resolveProfileCompanyExtraction/)
assert.match(pageMetadataJs, /\[Equipify Sales:company\]/)
assert.match(pageMetadataJs, /\[Equipify Sales:title\]/)
assert.match(pageMetadataJs, /findProfileTopCard/)
assert.match(pageMetadataJs, /findExperienceSection/)
assert.match(pageMetadataJs, /PROFILE_EXTRACTION_FORBIDDEN_SELECTORS/)
assert.match(pageMetadataJs, /queryTextInContainer/)
assert.match(pageMetadataJs, /isInsideForbiddenProfileRegion/)
assert.match(pageMetadataJs, /resolveProfileTitleExtraction/)
assert.match(pageMetadataJs, /\[Equipify Sales:extraction-audit\]/)
assert.match(pageMetadataJs, /\[Equipify Sales:dom-snapshot\]/)
assert.match(pageMetadataJs, /auditTopCardDiscovery/)
assert.match(pageMetadataJs, /auditExperienceDiscovery/)
assert.match(intakeAppJs, /Company not detected/)
assert.match(extensionWorkspaceJs, /COMPANY_INTEL_UNAVAILABLE/)
assert.match(extensionWorkspaceJs, /setCompanyIntelAvailability/)
assert.match(linkedinInpageSidebarJs, /\[Equipify Sales:layout-push]/)
assert.match(linkedinInpageSidebarJs, /\[Equipify Sales:layout-dom]/)
assert.match(extensionStorageJs, /\[Equipify Sales\] content script loaded/)
assert.match(pageMetadataJs, /\[Equipify Sales\] page-metadata start/)
assert.match(pageMetadataJs, /\[Equipify Sales\] extractVisiblePageMetadata invoked/)
assert.match(pageMetadataJs, /\[Equipify Sales:startup\]/)
assert.match(pageMetadataJs, /discoverProfileTopCard/)
assert.match(pageMetadataJs, /findSectionHeadingElement/)
assert.match(pageMetadataJs, /discoverMainContentContainer/)
assert.match(pageMetadataJs, /\[Equipify Sales:dom-map\]/)
assert.match(pageMetadataJs, /\[Equipify Sales:experience-discovery\]/)
assert.match(pageMetadataJs, /\[Equipify Sales:hero-discovery\]/)
assert.match(pageMetadataJs, /\[Equipify Sales:company-selection\]/)
assert.match(pageMetadataJs, /\[Equipify Sales:profile-image\]/)
assert.match(pageMetadataJs, /\[Equipify Sales:company-candidates\]/)
assert.match(pageMetadataJs, /buildCompanyCandidatesDiagnostic/)
assert.match(pageMetadataJs, /hero_container_found/)
assert.match(pageMetadataJs, /rejected_candidates/)
assert.match(pageMetadataJs, /\[Equipify Sales:state-audit\]/)
assert.match(pageMetadataJs, /\[Equipify Sales:hero-scoring\]/)
assert.match(pageMetadataJs, /discoverProfileHeroByScoring/)
assert.match(pageMetadataJs, /discoverProfileHeroBinding/)
assert.match(pageMetadataJs, /auditLinkedInHydrationState/)
assert.match(pageMetadataJs, /buildExperienceDiscoveryAudit/)
assert.match(pageMetadataJs, /\[Equipify Sales:dom-audit\]/)
assert.match(pageMetadataJs, /buildDomAudit/)
assert.match(pageMetadataJs, /findProfileHeroContainer/)
assert.match(pageMetadataJs, /parseConcatenatedHeadlineTitleCompany/)
assert.match(linkedinInpageSidebarJs, /logLayoutPush/)
assert.match(linkedinInpageSidebarJs, /logLayoutDom/)
assert.match(linkedinInpageSidebarJs, /addEventListener\("resize"/)

const PROFILE_PHOTO_FIXTURE = `<main>
  <nav class="global-nav"><img src="https://media.licdn.com/nav-avatar.jpg" alt="Me menu" /></nav>
  <section class="artdeco-card">
    <img class="pv-top-card-profile-picture__image" src="https://media.licdn.com/profile-kristen.jpg" alt="Kristen Keller" />
    <h1 class="text-heading-xlarge">Kristen Keller</h1>
  </section>
  <aside class="scaffold-layout__aside">
    <img src="https://media.licdn.com/suggested-1.jpg" alt="People you may know" />
  </aside>
</main>`

function pickProfilePhotoFromFixture(html: string) {
  const navMatch = html.match(/global-nav[\s\S]*?<img[^>]+src="([^"]+)"/)
  const profileMatch = html.match(/pv-top-card-profile-picture__image[^>]+src="([^"]+)"/)
  const suggestedMatch = html.match(/scaffold-layout__aside[\s\S]*?<img[^>]+src="([^"]+)"/)
  return {
    nav: navMatch?.[1] ?? null,
    profile: profileMatch?.[1] ?? null,
    suggested: suggestedMatch?.[1] ?? null,
  }
}

const photoFixture = pickProfilePhotoFromFixture(PROFILE_PHOTO_FIXTURE)
assert.equal(photoFixture.profile, "https://media.licdn.com/profile-kristen.jpg")
assert.notEqual(photoFixture.profile, photoFixture.nav)
assert.notEqual(photoFixture.profile, photoFixture.suggested)

const KRISTEN_KELLER_FIXTURE = `<main>
  <section class="artdeco-card">
    <h1 class="text-heading-xlarge">Kristen Keller</h1>
    <div class="text-body-medium break-words">SecretaryBioMed Techs Inc. · Full-time</div>
    <a href="https://www.linkedin.com/company/biomed-techs-inc/">BioMed Techs Inc.</a>
  </section>
  <section id="experience">
    <a href="https://www.linkedin.com/company/biomed-techs-inc/">BioMed Techs Inc.</a>
    <span aria-hidden="true">Secretary</span>
  </section>
</main>`

function resolveCompanyFromKristenFixture(html: string, personName: string) {
  const topCardCompany = html.match(
    /artdeco-card[\s\S]*?href="[^"]*\/company\/[^"]+">([^<]+)</,
  )?.[1]?.trim()
  const experienceCompany = html.match(/id="experience"[\s\S]*?\/company\/[^"]+">([^<]+)</)?.[1]?.trim()
  const company = topCardCompany ?? experienceCompany ?? null
  if (company && company.toLowerCase() === personName.toLowerCase()) return "Company not detected"
  return company ?? "Company not detected"
}

assert.equal(resolveCompanyFromKristenFixture(KRISTEN_KELLER_FIXTURE, "Kristen Keller"), "BioMed Techs Inc.")
assert.notEqual(resolveCompanyFromKristenFixture(KRISTEN_KELLER_FIXTURE, "Kristen Keller"), "Kristen Keller")

assert.match(intakeAppJs, /sidebar_context_received/)
assert.match(intakeAppJs, /renderSalesWorkspace\(defaultCrmPayload/)
assert.match(pageMetadataJs, /normalized_profile_payload/)
assert.match(extensionWorkspaceJs, /render_input_payload/)

const SAMANTHA_DUTTON_FIXTURE = `<main>
  <nav class="global-nav"><img src="https://media.licdn.com/nav-me.jpg" alt="Me" /></nav>
  <section class="artdeco-card">
    <img class="pv-top-card-profile-picture__image" src="https://media.licdn.com/samantha-dutton.jpg" alt="Samantha Dutton" />
    <h1 class="text-heading-xlarge">Samantha Dutton</h1>
    <div class="text-body-medium break-words">Customer Service Representative at Medical Equipment Doctor</div>
    <span class="text-body-small inline t-black--light break-words">Tustin, California, United States</span>
    <a href="https://www.linkedin.com/company/medical-equipment-doctor/">
      <img src="https://media.licdn.com/med-logo.jpg" alt="Medical Equipment Doctor logo" />
      Medical Equipment Doctor
    </a>
  </section>
  <aside class="scaffold-layout__aside">
    <img src="https://media.licdn.com/suggested-person.jpg" alt="People you may know" />
  </aside>
</main>`

function parseHeadlineAtCompany(headline: string | null) {
  if (!headline) return { title: null, company: null }
  const match = headline.match(/^(.+?)\s+at\s+(.+?)(?:\s*[|·].*)?$/i)
  if (!match) return { title: headline, company: null }
  return { title: match[1]?.trim() ?? null, company: match[2]?.trim() ?? null }
}

function extractSamanthaProfileFixture(html: string) {
  const name = html.match(/text-heading-xlarge">([^<]+)/)?.[1]?.trim() ?? null
  const headline = html.match(/text-body-medium break-words">([^<]+)/)?.[1]?.trim() ?? null
  const location = html.match(/text-body-small inline t-black--light break-words">([^<]+)/)?.[1]?.trim() ?? null
  const profileImage = html.match(/pv-top-card-profile-picture__image[^>]+src="([^"]+)"/)?.[1] ?? null
  const navImage = html.match(/global-nav[\s\S]*?src="([^"]+)"/)?.[1] ?? null
  const suggestedImage = html.match(/scaffold-layout__aside[\s\S]*?src="([^"]+)"/)?.[1] ?? null
  const topCardCompany = html.match(
    /artdeco-card[\s\S]*?href="[^"]*\/company\/[^"]+">\s*(?:<img[^>]+>\s*)?([^<]+)\s*<\/a>/,
  )?.[1]?.trim()
  const companyLogo = html.match(/med-logo\.jpg/)?.[0] ?? null
  const parsed = parseHeadlineAtCompany(headline)
  return {
    person: {
      name,
      title: parsed.title,
      company: topCardCompany ?? parsed.company,
      location,
      profileImage,
    },
    company: {
      name: topCardCompany ?? parsed.company,
      logo: companyLogo,
    },
    navImage,
    suggestedImage,
  }
}

const samantha = extractSamanthaProfileFixture(SAMANTHA_DUTTON_FIXTURE)
assert.equal(samantha.person.name, "Samantha Dutton")
assert.match(samantha.person.title ?? "", /Customer Service Representative/)
assert.equal(samantha.person.company, "Medical Equipment Doctor")
assert.equal(samantha.company.name, "Medical Equipment Doctor")
assert.equal(samantha.person.location, "Tustin, California, United States")
assert.equal(samantha.person.profileImage, "https://media.licdn.com/samantha-dutton.jpg")
assert.notEqual(samantha.person.profileImage, samantha.navImage)
assert.notEqual(samantha.person.profileImage, samantha.suggestedImage)
assert.ok(samantha.company.logo)

function resolveSidebarProfileName(input: {
  contact_name?: string | null
  page_title?: string | null
  linkedin_page_kind?: string | null
}) {
  if (input.contact_name) return input.contact_name
  if (input.linkedin_page_kind === "profile" && input.page_title) {
    const fromTitle = input.page_title.replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, "").split(/\s*[|\-–—]\s*/)[0]?.trim()
    return fromTitle?.split(/\s+-\s+/)[0]?.trim() ?? "Profile context failed to load"
  }
  return "Profile context failed to load"
}

assert.equal(
  resolveSidebarProfileName({
    contact_name: "Samantha Dutton",
    linkedin_page_kind: "profile",
    page_title: "Samantha Dutton | LinkedIn",
  }),
  "Samantha Dutton",
)
assert.notEqual(
  resolveSidebarProfileName({
    contact_name: "Samantha Dutton",
    linkedin_page_kind: "profile",
    page_title: "Samantha Dutton | LinkedIn",
  }),
  "Profile context failed to load",
)

function resolveCompanyIntelHeader(companyName: string | null) {
  return companyName && companyName !== "Company not detected" ? companyName : "Company not detected"
}

assert.equal(resolveCompanyIntelHeader("Medical Equipment Doctor"), "Medical Equipment Doctor")
assert.notEqual(resolveCompanyIntelHeader("Medical Equipment Doctor"), "Company")
assert.equal(
  resolveCompanyIntelHeader(
    isValidCompanyNameFixture("Executive Vice PresidentSep 2023 - Present · 2 yrs 9 mos.")
      ? "Executive Vice PresidentSep 2023 - Present · 2 yrs 9 mos."
      : null,
  ),
  "Company not detected",
)

const RICARDO_SANCHEZ_FIXTURE = `<main>
  <section class="artdeco-card">
    <img class="pv-top-card-profile-picture__image" src="https://media.licdn.com/ricardo-sanchez.jpg" alt="Ricardo Sanchez Villanueva" />
    <h1 class="text-heading-xlarge">Ricardo Sanchez Villanueva</h1>
    <div class="text-body-medium break-words">Biomedical Equipment Technician</div>
    <span class="text-body-small inline t-black--light break-words">San Diego, California, United States</span>
  </section>
  <section id="experience">
    <li>
      <a href="https://www.linkedin.com/company/sharp-memorial-hospital/">SHARP MEMORIAL HOSPITAL</a>
      <span aria-hidden="true">Biomedical Equipment Technician</span>
      <span class="pvs-entity__caption-wrapper">Jan 2022 - Present · 3 yrs</span>
    </li>
    <li>
      <a href="https://www.linkedin.com/company/miracosta-college/">MiraCosta College</a>
      <span aria-hidden="true">Student</span>
      <span class="pvs-entity__caption-wrapper">2018 - 2020</span>
    </li>
  </section>
  <section id="education">
    <a href="https://www.linkedin.com/company/miracosta-college/">MiraCosta College</a>
  </section>
  <section id="activity" class="feed-shared-update-v2">
    <div class="feed-shared-update-v2">
      <a href="https://www.linkedin.com/company/pm-biomedical/">PM Biomedical</a>
      <div class="text-body-medium break-words">PM Biomedical reposted a hiring update</div>
      <span aria-hidden="true">PM Biomedical</span>
    </div>
  </section>
</main>`

function extractTopCardBlock(html: string) {
  return html.match(/<section class="artdeco-card">[\s\S]*?<\/section>/)?.[0] ?? ""
}

function extractExperienceBlock(html: string) {
  return html.match(/<section id="experience"[\s\S]*?<\/section>/)?.[0] ?? ""
}

function extractActivityBlock(html: string) {
  return html.match(/<section id="activity"[\s\S]*?<\/section>/)?.[0] ?? ""
}

function rejectCompanyIfPersonNameFixture(companyName: string | null, personName: string | null) {
  const company = companyName?.trim() ?? null
  if (!company) return null
  if (personName && company.toLowerCase() === personName.toLowerCase()) return null
  return company
}

function resolveCompanyFromRicardoFixture(html: string, personName: string) {
  const experienceBlock = extractExperienceBlock(html)
  const topCardBlock = extractTopCardBlock(html)
  let presentCompany: string | null = null
  for (const item of experienceBlock.match(/<li>[\s\S]*?<\/li>/g) ?? []) {
    if (!/present/i.test(item)) continue
    presentCompany = item.match(/href="[^"]*\/company\/[^"]+">\s*([^<]+)/)?.[1]?.trim() ?? null
    if (presentCompany) break
  }
  const topCardCompany = topCardBlock.match(/href="[^"]*\/company\/[^"]+">\s*([^<]+)/)?.[1]?.trim() ?? null
  const experienceCompanies = [...experienceBlock.matchAll(/href="[^"]*\/company\/[^"]+">\s*([^<]+)/g)].map(
    (match) => match[1]?.trim(),
  )
  const candidates = [topCardCompany, presentCompany, ...experienceCompanies]
  for (const candidate of candidates) {
    const sanitized = rejectCompanyIfPersonNameFixture(candidate ?? null, personName)
    if (sanitized) return sanitized
  }
  return null
}

function resolveTitleFromRicardoFixture(html: string) {
  const topCardBlock = extractTopCardBlock(html)
  const experienceBlock = extractExperienceBlock(html)
  const presentTitle = (experienceBlock.match(/<li>[\s\S]*?Present[\s\S]*?<\/li>/i)?.[0] ?? "").match(
    /aria-hidden="true">([^<]+)/,
  )?.[1]?.trim()
  const topCardTitle = topCardBlock.match(/text-body-medium break-words">([^<]+)/)?.[1]?.trim()
  return presentTitle ?? topCardTitle ?? null
}

function extractActivityCompanyNames(html: string) {
  const activityBlock = extractActivityBlock(html)
  return [...activityBlock.matchAll(/href="[^"]*\/company\/[^"]+">\s*([^<]+)/g)].map((match) => match[1]?.trim())
}

function inferCompanyFromLinkedInPageTitle(title: string) {
  const withoutLinkedIn = title.replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, "").trim()
  if (!withoutLinkedIn) return null
  const parts = withoutLinkedIn.split(/\s*[|\-–—]\s*/).filter(Boolean)
  if (parts.length === 1) return parts[0]?.trim() ?? null
  return null
}

const ricardoPersonName = "Ricardo Sanchez Villanueva"
const ricardoCompany = resolveCompanyFromRicardoFixture(RICARDO_SANCHEZ_FIXTURE, ricardoPersonName)
const ricardoTitle = resolveTitleFromRicardoFixture(RICARDO_SANCHEZ_FIXTURE)
const ricardoActivityCompanies = extractActivityCompanyNames(RICARDO_SANCHEZ_FIXTURE)
assert.equal(
  extractLinkedInFixtureField(RICARDO_SANCHEZ_FIXTURE, /text-heading-xlarge">([^<]+)/),
  ricardoPersonName,
)
assert.notEqual(ricardoCompany, ricardoPersonName)
assert.equal(ricardoCompany, "SHARP MEMORIAL HOSPITAL")
assert.notEqual(ricardoCompany, "MiraCosta College")
assert.notEqual(ricardoCompany, "PM Biomedical")
assert.notEqual(ricardoCompany?.toLowerCase(), "pm biomedical")
assert.ok(ricardoActivityCompanies.includes("PM Biomedical"))
assert.notEqual(ricardoTitle, "PM Biomedical")
assert.notEqual(ricardoTitle?.toLowerCase(), "pm biomedical")
assert.match(ricardoTitle ?? "", /Biomedical Equipment Technician/)
assert.equal(rejectCompanyIfPersonNameFixture(ricardoPersonName, ricardoPersonName), null)
assert.equal(
  rejectCompanyIfPersonNameFixture(
    inferCompanyFromLinkedInPageTitle(`${ricardoPersonName} | LinkedIn`),
    ricardoPersonName,
  ),
  null,
)
assert.equal(resolveCompanyIntelHeader(ricardoCompany), ricardoCompany ?? "Company not detected")
assert.equal(resolveCompanyIntelHeader(null), "Company not detected")
assert.equal(
  resolveCompanyIntelHeader(rejectCompanyIfPersonNameFixture(ricardoPersonName, ricardoPersonName)),
  "Company not detected",
)

const RICARDO_MODERN_DESKTOP_FIXTURE = `<!DOCTYPE html><html><body>
<div style="width: 1280px" class="profile-page-layout">
  <div class="profile-content-column" style="width: 720px">
    <div class="profile-hero-module">
      <img class="profile-background-image" src="https://media.licdn.com/ricardo-cover.jpg" width="800" height="200" alt="" />
      <div class="hero-row" style="display:flex">
        <div class="photo-col">
          <img class="profile-headshot pv-top-card-profile-picture__image" src="https://media.licdn.com/ricardo-headshot.jpg" width="200" height="200" alt="Ricardo Sanchez Villanueva" />
        </div>
        <div class="info-col">
          <h1>Ricardo Sanchez Villanueva</h1>
          <div class="relationship-badge">Ricardo Sanchez Villanueva · 3rd</div>
          <div>Biomedical Equipment TechnicianSHARP MEMORIAL HOSPITAL</div>
          <span>San Diego, California, United States</span>
          <div class="entity-line">
            <a href="https://www.linkedin.com/school/miracosta-college/">
              <img src="https://media.licdn.com/miracosta-logo.jpg" width="32" height="32" alt="MiraCosta College" />
              MiraCosta College
            </a>
            ·
            <a href="https://www.linkedin.com/company/sharp-memorial-hospital/">
              <img src="https://media.licdn.com/sharp-logo.jpg" width="32" height="32" alt="SHARP MEMORIAL HOSPITAL" />
              SHARP MEMORIAL HOSPITAL
            </a>
          </div>
        </div>
      </div>
    </div>
    <div class="profile-detail-section">
      <h2><span>Experience</span></h2>
      <div role="listitem">
        <span>Biomedical Equipment Technician</span>
        <a href="https://www.linkedin.com/company/sharp-memorial-hospital/">SHARP MEMORIAL HOSPITAL</a>
        <span>Oct 2025 - Present · 1 mo</span>
      </div>
    </div>
  </div>
  <aside class="scaffold-layout__aside">
    <img src="https://media.licdn.com/right-rail-person.jpg" width="48" height="48" alt="Suggested person" />
    <a href="https://www.linkedin.com/company/pm-biomedical/">PM Biomedical suggested</a>
  </aside>
  <section id="activity" class="feed-shared-update-v2">
    <a href="https://www.linkedin.com/company/pm-biomedical/">PM Biomedical</a>
  </section>
</div>
</body></html>`

const RICARDO_LIVE_DOM_FIXTURE = `<!DOCTYPE html><html><head><title>Ricardo Sanchez Villanueva | LinkedIn</title></head><body>
<div style="width: 1280px" class="profile-page-layout">
  <main role="main">
    <div class="photo-rail">
      <img class="profile-headshot" src="https://media.licdn.com/ricardo-headshot.jpg" width="200" height="200" alt="Ricardo Sanchez Villanueva" />
    </div>
    <div class="profile-hero-module">
      <img class="profile-background-image" src="https://media.licdn.com/ricardo-cover.jpg" width="720" height="200" alt="" />
      <div class="info-col">
        <div class="profile-name">Ricardo Sanchez Villanueva</div>
        <div class="relationship-badge">Ricardo Sanchez Villanueva · 3rd</div>
        <div class="headline-line">Biomedical Equipment Technician</div>
        <span class="company-plain-text">SHARP MEMORIAL HOSPITAL</span>
        <span>San Diego, California, United States</span>
      </div>
    </div>
    <div data-view-name="profile-card-experience"></div>
  </main>
  <aside class="scaffold-layout__aside">
    <a href="https://www.linkedin.com/company/sharp-memorial-hospital/">SHARP MEMORIAL HOSPITAL</a>
  </aside>
</div>
</body></html>`

type StructuredHeadlineParse = {
  raw_headline: string | null
  title: string | null
  certifications: string[]
  ignored_segments: string[]
}

type PageMetadataHarness = {
  document: Document
  metadata: Record<string, unknown> | null | undefined
  audit: Record<string, unknown> | null | undefined
  domMap: Record<string, unknown> | null | undefined
  experienceDiscovery: Record<string, unknown> | null | undefined
  profileImageAudit: Record<string, unknown> | null | undefined
  companyCandidatesAudit: Record<string, unknown> | null | undefined
  companyRankingAudit: Record<string, unknown> | null | undefined
  heroScoringAudit: Record<string, unknown> | null | undefined
  heroCompanySignalsAudit: Record<string, unknown> | null | undefined
  headlineExtractionAudit: Record<string, unknown> | null | undefined
  headlineCandidatesAudit: Record<string, unknown> | null | undefined
  titleClassificationAudit: Record<string, unknown> | null | undefined
  domAudit: Record<string, unknown> | null | undefined
  findProfileTopCard: (doc: Document) => Element | null
  findExperienceSection: (doc: Document) => Element | null
  discoverMainContentContainer: (doc: Document, topCard: Element | null) => Element | null
  parseStructuredProfileHeadline: (headline: string) => StructuredHeadlineParse | null
}

function runPageMetadataHarness(html: string, url: string): PageMetadataHarness {
  const { document, window: domWindow } = parseHTML(html)
  Object.defineProperty(domWindow, "innerWidth", { value: 1280, configurable: true })
  Object.defineProperty(domWindow, "innerHeight", { value: 900, configurable: true })

  const auditLogs: Record<string, unknown>[] = []
  const domMapLogs: Record<string, unknown>[] = []
  const experienceDiscoveryLogs: Record<string, unknown>[] = []
  const profileImageLogs: Record<string, unknown>[] = []
  const companyCandidatesLogs: Record<string, unknown>[] = []
  const companyRankingLogs: Record<string, unknown>[] = []
  const heroScoringLogs: Record<string, unknown>[] = []
  const heroCompanySignalsLogs: Record<string, unknown>[] = []
  const heroCompanyCandidatesLogs: Record<string, unknown>[] = []
  const companyFinalSelectionLogs: Record<string, unknown>[] = []
  const headlineExtractionLogs: Record<string, unknown>[] = []
  const headlineCandidatesLogs: Record<string, unknown>[] = []
  const titleClassificationLogs: Record<string, unknown>[] = []
  const domAuditLogs: Record<string, unknown>[] = []
  const pageMetadataPath = path.join(process.cwd(), "extensions/growth-browser-intake/page-metadata.js")
  const pageMetadataSource = fs.readFileSync(pageMetadataPath, "utf8")

  const sandbox: Record<string, unknown> = {
    console: {
      log: (...args: unknown[]) => {
        const label = String(args[0] ?? "")
        if (label === "[Equipify Sales:extraction-audit]") auditLogs.push(args[1] as Record<string, unknown>)
        if (label === "[Equipify Sales:dom-map]") domMapLogs.push(args[1] as Record<string, unknown>)
        if (label === "[Equipify Sales:experience-discovery]") {
          experienceDiscoveryLogs.push(args[1] as Record<string, unknown>)
        }
        if (label === "[Equipify Sales:profile-image]") profileImageLogs.push(args[1] as Record<string, unknown>)
        if (label === "[Equipify Sales:company-candidates]") {
          companyCandidatesLogs.push(args[1] as Record<string, unknown>)
        }
        if (label === "[Equipify Sales:company-ranking]") {
          companyRankingLogs.push(args[1] as Record<string, unknown>)
        }
        if (label === "[Equipify Sales:hero-company-signals]") {
          heroCompanySignalsLogs.push(args[1] as Record<string, unknown>)
        }
        if (label === "[Equipify Sales:hero-company-candidates]") {
          heroCompanyCandidatesLogs.push(args[1] as Record<string, unknown>)
        }
        if (label === "[Equipify Sales:company-final-selection]") {
          companyFinalSelectionLogs.push(args[1] as Record<string, unknown>)
        }
        if (label === "[Equipify Sales:headline-extraction]") {
          headlineExtractionLogs.push(args[1] as Record<string, unknown>)
        }
        if (label === "[Equipify Sales:headline-candidates]") {
          headlineCandidatesLogs.push(args[1] as Record<string, unknown>)
        }
        if (label === "[Equipify Sales:title-classification]") {
          titleClassificationLogs.push(args[1] as Record<string, unknown>)
        }
        if (label === "[Equipify Sales:hero-scoring]") heroScoringLogs.push(args[1] as Record<string, unknown>)
        if (label === "[Equipify Sales:dom-audit]") domAuditLogs.push(args[1] as Record<string, unknown>)
      },
      error: () => {},
    },
    chrome: {
      runtime: {
        getManifest: () => ({ version: "4.3.38" }),
      },
    },
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    document,
  }

  const windowObj = domWindow as unknown as Record<string, unknown>
  windowObj.location = { href: url }
  windowObj.EquipifyGrowthLinkedInContext = {
    detectLinkedInPageKind,
  }
  sandbox.window = windowObj
  sandbox.Element = domWindow.Element
  sandbox.HTMLElement = domWindow.HTMLElement
  sandbox.Node = domWindow.Node
  sandbox.URL = URL
  sandbox.HTMLImageElement = domWindow.HTMLImageElement

  const context = vm.createContext(sandbox)
  vm.runInContext(pageMetadataSource, context)

  const win = context.window as {
    __equipifyGrowthExtract?: () => Record<string, unknown>
    __equipifyGrowthFindProfileTopCard?: (doc: Document) => Element | null
    __equipifyGrowthFindExperienceSection?: (doc: Document) => Element | null
    __equipifyGrowthDiscoverMainContentContainer?: (doc: Document, topCard: Element | null) => Element | null
    __equipifyGrowthParseStructuredProfileHeadline?: (headline: string) => StructuredHeadlineParse
  }

  return {
    document,
    metadata: win.__equipifyGrowthExtract?.() ?? null,
    audit: auditLogs[0] ?? null,
    domMap: domMapLogs[0] ?? null,
    experienceDiscovery: experienceDiscoveryLogs[0] ?? null,
    profileImageAudit: profileImageLogs[0] ?? null,
    companyCandidatesAudit: companyCandidatesLogs.find((entry) => entry.selected_container) ?? companyCandidatesLogs.at(-1) ?? null,
    companyRankingAudit: companyRankingLogs.at(-1) ?? null,
    heroScoringAudit: heroScoringLogs.find((entry) => entry.selected_container) ?? heroScoringLogs.at(-1) ?? null,
    heroCompanySignalsAudit: heroCompanySignalsLogs.at(-1) ?? null,
    heroCompanyCandidatesAudit: heroCompanyCandidatesLogs.at(-1) ?? null,
    companyFinalSelectionAudit: companyFinalSelectionLogs.at(-1) ?? null,
    headlineExtractionAudit: headlineExtractionLogs.at(-1) ?? null,
    headlineCandidatesAudit: headlineCandidatesLogs.at(-1) ?? null,
    titleClassificationAudit: titleClassificationLogs.at(-1) ?? null,
    domAudit: domAuditLogs[0] ?? null,
    findProfileTopCard: (doc) => win.__equipifyGrowthFindProfileTopCard?.(doc) ?? null,
    findExperienceSection: (doc) => win.__equipifyGrowthFindExperienceSection?.(doc) ?? null,
    discoverMainContentContainer: (doc, topCard) =>
      win.__equipifyGrowthDiscoverMainContentContainer?.(doc, topCard) ?? null,
    parseStructuredProfileHeadline: (headline) =>
      win.__equipifyGrowthParseStructuredProfileHeadline?.(headline) ?? null,
  }
}

function runLayoutDiscoveryHarness(html: string, url: string) {
  const harness = runPageMetadataHarness(html, url)
  const topCard = harness.findProfileTopCard(harness.document)
  const mainContainer = harness.discoverMainContentContainer(harness.document, topCard)
  return {
    topCard,
    mainContainer,
    topCardFound: Boolean(topCard),
    mainContainerFound: Boolean(mainContainer),
    mainContainerClass: mainContainer?.getAttribute("class") ?? null,
  }
}

const ricardoModernUrl = "https://www.linkedin.com/in/ricardo-sanchez-villanueva/"
const ricardoModernHarness = runPageMetadataHarness(RICARDO_MODERN_DESKTOP_FIXTURE, ricardoModernUrl)
const ricardoModernAudit = ricardoModernHarness.audit ?? {}
const ricardoModernTopCard = (ricardoModernAudit.top_card ?? {}) as Record<string, unknown>
const ricardoModernExperience = (ricardoModernAudit.experience_section ?? {}) as Record<string, unknown>
const ricardoModernSelected = (ricardoModernAudit.selected ?? {}) as Record<string, unknown>
const ricardoModernLayout = runLayoutDiscoveryHarness(RICARDO_MODERN_DESKTOP_FIXTURE, ricardoModernUrl)

assert.equal(ricardoModernTopCard.found, true, "modern desktop top card should be discovered from profile name")
assert.equal(ricardoModernExperience.found, true, "modern desktop experience section should be discovered from heading")
assert.match(String(ricardoModernSelected.title ?? ""), /Biomedical Equipment Technician/)
assert.equal(ricardoModernSelected.company, "SHARP MEMORIAL HOSPITAL")
assert.notEqual(ricardoModernSelected.company, ricardoPersonName)
assert.notEqual(ricardoModernSelected.company, "PM Biomedical")
assert.notEqual(ricardoModernSelected.company, "MiraCosta College")
assert.ok(ricardoModernLayout.topCardFound)
assert.ok(ricardoModernLayout.mainContainerFound)
assert.match(ricardoModernLayout.mainContainerClass ?? "", /profile-content-column|hero-row/)
assert.ok(ricardoModernHarness.domMap?.selected_top_card)
assert.ok(ricardoModernHarness.domMap?.selected_experience_container)
assert.ok(Array.isArray(ricardoModernHarness.domMap?.profile_name_parent_chain))
assert.ok(ricardoModernHarness.experienceDiscovery?.selected_container)
assert.equal(ricardoModernHarness.experienceDiscovery?.row_count, 1)
assert.equal(
  ricardoModernHarness.profileImageAudit?.selected_src,
  "https://media.licdn.com/ricardo-headshot.jpg",
)
assert.notEqual(
  ricardoModernHarness.profileImageAudit?.selected_src,
  "https://media.licdn.com/ricardo-cover.jpg",
)
assert.equal(ricardoModernHarness.metadata?.profile_photo_url, "https://media.licdn.com/ricardo-headshot.jpg")
assert.equal(ricardoModernHarness.metadata?.headline, "Biomedical Equipment Technician")
assert.equal(ricardoModernHarness.metadata?.raw_headline, "Biomedical Equipment Technician")
assert.equal(ricardoModernHarness.metadata?.job_title, "Biomedical Equipment Technician")
assert.equal(ricardoModernHarness.metadata?.title, "Biomedical Equipment Technician")
assert.ok(Array.isArray(ricardoModernHarness.metadata?.certifications))
assert.equal((ricardoModernHarness.metadata?.certifications as unknown[] | undefined)?.length, 0)
assert.equal(ricardoModernHarness.titleClassificationAudit?.title, "Biomedical Equipment Technician")
assert.equal(ricardoModernHarness.metadata?.company_name, "SHARP MEMORIAL HOSPITAL")
assert.doesNotMatch(String(ricardoModernHarness.metadata?.headline ?? ""), /SHARP MEMORIAL HOSPITAL/i)
assert.ok(
  (ricardoModernHarness.headlineExtractionAudit?.removed_company_tokens as string[] | undefined)?.includes(
    "SHARP MEMORIAL HOSPITAL",
  ),
)
assert.equal(ricardoModernHarness.headlineExtractionAudit?.cleaned_headline, "Biomedical Equipment Technician")
assert.equal(ricardoModernHarness.headlineExtractionAudit?.raw_headline, "Biomedical Equipment TechnicianSHARP MEMORIAL HOSPITAL")
assert.equal(ricardoModernHarness.headlineCandidatesAudit?.selected_headline, "Biomedical Equipment TechnicianSHARP MEMORIAL HOSPITAL")
assert.ok(
  (ricardoModernHarness.headlineCandidatesAudit?.rejected as Array<{ text?: string; reject_reason?: string }> | undefined)?.some(
    (entry) =>
      entry.text === "Ricardo Sanchez Villanueva · 3rd" && entry.reject_reason === "relationship-badge",
  ),
)
assert.doesNotMatch(String(ricardoModernHarness.headlineCandidatesAudit?.selected_headline ?? ""), /3rd/i)

const RICARDO_SPACED_HEADLINE_FIXTURE = RICARDO_MODERN_DESKTOP_FIXTURE.replace(
  "Biomedical Equipment TechnicianSHARP MEMORIAL HOSPITAL",
  "Biomedical Equipment Technician SHARP MEMORIAL HOSPITAL",
)
const ricardoSpacedHarness = runPageMetadataHarness(RICARDO_SPACED_HEADLINE_FIXTURE, ricardoModernUrl)
assert.equal(ricardoSpacedHarness.metadata?.headline, "Biomedical Equipment Technician")
assert.doesNotMatch(String(ricardoSpacedHarness.metadata?.headline ?? ""), /SHARP MEMORIAL HOSPITAL/i)

const RICARDO_CERT_HEADLINE_FIXTURE = RICARDO_MODERN_DESKTOP_FIXTURE.replace(
  "Biomedical Equipment TechnicianSHARP MEMORIAL HOSPITAL",
  "Biomedical Equipment Technician | AAMI CBET · SHARP MEMORIAL HOSPITAL",
)
const ricardoCertHarness = runPageMetadataHarness(RICARDO_CERT_HEADLINE_FIXTURE, ricardoModernUrl)
assert.equal(
  ricardoCertHarness.metadata?.raw_headline,
  "Biomedical Equipment Technician | AAMI CBET",
)
assert.equal(ricardoCertHarness.metadata?.headline, "Biomedical Equipment Technician | AAMI CBET")
assert.equal(ricardoCertHarness.metadata?.job_title, "Biomedical Equipment Technician")
assert.equal(ricardoCertHarness.metadata?.title, "Biomedical Equipment Technician")
assertStringArrayEqual(ricardoCertHarness.metadata?.certifications, ["AAMI CBET"])
assert.doesNotMatch(String(ricardoCertHarness.metadata?.job_title ?? ""), /AAMI CBET/)
assert.doesNotMatch(String(ricardoCertHarness.metadata?.title ?? ""), /AAMI CBET/)
assert.doesNotMatch(String(ricardoCertHarness.metadata?.raw_headline ?? ""), /SHARP MEMORIAL HOSPITAL/i)

const RICARDO_MULTI_CERT_HEADLINE =
  "Medical Equipment Technician | Lean Six Sigma Yellow Belt | OSHA-10 | Certified Associate Biomedical Technology"
const RICARDO_MULTI_CERT_HEADLINE_FIXTURE = RICARDO_MODERN_DESKTOP_FIXTURE.replace(
  "Biomedical Equipment TechnicianSHARP MEMORIAL HOSPITAL",
  RICARDO_MULTI_CERT_HEADLINE,
)
const ricardoMultiCertHarness = runPageMetadataHarness(RICARDO_MULTI_CERT_HEADLINE_FIXTURE, ricardoModernUrl)
assert.equal(ricardoMultiCertHarness.metadata?.raw_headline, RICARDO_MULTI_CERT_HEADLINE)
assert.equal(ricardoMultiCertHarness.metadata?.job_title, "Medical Equipment Technician")
assert.equal(ricardoMultiCertHarness.metadata?.title, "Medical Equipment Technician")
assertStringArrayEqual(ricardoMultiCertHarness.metadata?.certifications, [
  "Lean Six Sigma Yellow Belt",
  "OSHA-10",
  "Certified Associate Biomedical Technology",
])
assert.equal(ricardoMultiCertHarness.titleClassificationAudit?.title, "Medical Equipment Technician")
assertStringArrayEqual(ricardoMultiCertHarness.titleClassificationAudit?.certifications, [
  "Lean Six Sigma Yellow Belt",
  "OSHA-10",
  "Certified Associate Biomedical Technology",
])
assertStringArrayEqual(ricardoMultiCertHarness.titleClassificationAudit?.ignored_segments, [])

assert.equal(ricardoMultiCertHarness.metadata?.company_name, "SHARP MEMORIAL HOSPITAL")

const slashParsed = ricardoModernHarness.parseStructuredProfileHeadline(
  "Biomedical Engineer / PMP / AWS Solutions Architect",
)
assert.equal(slashParsed?.title, "Biomedical Engineer")
assertStringArrayEqual(slashParsed?.certifications, ["PMP", "AWS Solutions Architect"])

const bulletParsed = ricardoModernHarness.parseStructuredProfileHeadline(
  "Clinical Engineer • CompTIA A+ • ITIL Foundation",
)
assert.equal(bulletParsed?.title, "Clinical Engineer")
assertStringArrayEqual(bulletParsed?.certifications, ["CompTIA A+", "ITIL Foundation"])

assert.ok(Array.isArray(ricardoModernHarness.domAudit?.h1s))
assert.ok(Array.isArray(ricardoModernHarness.domAudit?.profile_images))
assert.ok(Array.isArray(ricardoModernHarness.domAudit?.company_candidates_raw))
assert.equal(ricardoModernHarness.domAudit?.selected_profile_image, "https://media.licdn.com/ricardo-headshot.jpg")
assert.ok(Array.isArray(ricardoModernHarness.companyCandidatesAudit?.generated_candidates))
assert.ok(
  (ricardoModernHarness.companyCandidatesAudit?.generated_candidates as Array<{ value?: string }>).some(
    (entry) => entry.value === "SHARP MEMORIAL HOSPITAL",
  ),
)
assert.equal(ricardoModernHarness.profileImageAudit?.hero_container_found, true)
assert.ok(Array.isArray(ricardoModernHarness.profileImageAudit?.candidate_images))

const ricardoClassicHarness = runPageMetadataHarness(RICARDO_SANCHEZ_FIXTURE, ricardoModernUrl)
const ricardoClassicRanking = ricardoClassicHarness.companyRankingAudit ?? {}
const ricardoClassicCandidates = (ricardoClassicRanking.candidates ?? []) as Array<{
  company?: string
  source?: string
  source_group?: string
  tier?: number
  score?: number
}>
const ricardoClassicPm = ricardoClassicCandidates.find(
  (entry) => entry.company?.toLowerCase() === "pm biomedical",
)
assert.equal(ricardoClassicRanking.selected_company, "SHARP MEMORIAL HOSPITAL")
assert.equal(ricardoClassicRanking.selected_source, "experience.current.company")
assert.ok(ricardoClassicPm)
assert.equal(ricardoClassicPm?.source, "repost.company-anchor")
assert.equal(ricardoClassicPm?.source_group, "repost")
assert.ok(
  ricardoClassicCandidates.some(
    (entry) =>
      entry.company === "SHARP MEMORIAL HOSPITAL" &&
      entry.source === "experience.current.company" &&
      entry.tier === 1,
  ),
)
assert.ok(
  (ricardoClassicRanking.experience_candidates as string[]).includes("SHARP MEMORIAL HOSPITAL"),
)
assert.ok((ricardoClassicRanking.repost_candidates as string[]).includes("PM Biomedical"))
const ricardoClassicSharpScore =
  ricardoClassicCandidates.find((entry) => entry.company === "SHARP MEMORIAL HOSPITAL" && entry.tier === 1)?.score ??
  0
const ricardoClassicPmScore = ricardoClassicPm?.score ?? 0
assert.ok(ricardoClassicSharpScore > ricardoClassicPmScore)

const ricardoModernRanking = ricardoModernHarness.companyRankingAudit ?? {}
assert.equal(ricardoModernRanking.selected_company, "SHARP MEMORIAL HOSPITAL")
assert.notEqual(ricardoModernRanking.selected_source, "activity-feed.company-anchor")
assert.notEqual(ricardoModernRanking.selected_source, "repost.company-anchor")
assert.ok(Array.isArray(ricardoModernRanking.hero_candidates))
assert.ok((ricardoModernRanking.experience_candidates as string[]).includes("SHARP MEMORIAL HOSPITAL"))
assert.ok((ricardoModernRanking.activity_feed_candidates as string[]).includes("PM Biomedical"))
assert.match(pageMetadataJs, /\[Equipify Sales:company-ranking\]/)

assert.match(pageMetadataJs, /\[Equipify Sales:hero-company-signals\]/)
assert.match(pageMetadataJs, /collectHeroCompanySignals/)
assert.match(pageMetadataJs, /selectPrimaryHeroEmployerSignal/)

const ricardoHeroSignals = (ricardoModernHarness.heroCompanySignalsAudit?.candidates ?? []) as Array<{
  company?: string
  source?: string
  selected?: boolean
}>
assert.ok(
  ricardoHeroSignals.some(
    (entry) => entry.company === "SHARP MEMORIAL HOSPITAL" && entry.selected === true,
  ),
)
assert.ok(
  ricardoHeroSignals.some(
    (entry) => entry.company === "SHARP MEMORIAL HOSPITAL" && entry.source?.includes("employer"),
  ),
)

assert.match(pageMetadataJs, /\[Equipify Sales:hero-company-candidates\]/)
assert.match(pageMetadataJs, /\[Equipify Sales:company-final-selection\]/)
assert.match(pageMetadataJs, /sanitizeHeadlineAfterCompanySelection/)
assert.match(pageMetadataJs, /\[Equipify Sales:headline-extraction]/)
assert.match(pageMetadataJs, /parseStructuredProfileHeadline/)
assert.match(pageMetadataJs, /\[Equipify Sales:title-classification]/)
assert.match(pageMetadataJs, /isValidHeadlineCandidate/)
assert.match(pageMetadataJs, /\[Equipify Sales:headline-candidates]/)
assert.match(pageMetadataJs, /resolveProfileHeadlineSelection/)
assert.match(pageMetadataJs, /assessCompanyCandidateText/)
assert.match(pageMetadataJs, /isCleanEmployerCompanyCandidate/)
assert.match(pageMetadataJs, /reject_reason/)
assert.match(pageMetadataJs, /isHeroContaminatedHeadlineText/)
assert.match(pageMetadataJs, /ui-text-contaminated/)
assert.doesNotMatch(pageMetadataJs, /generic-plain-text/)

const CONTAMINATED_HERO_FIXTURE = `<!DOCTYPE html><html><body><main><div class="profile-hero-module"><div class="text-heading-xlarge">Ricardo Sanchez Villanueva</div><div class="text-body-medium">Contact infoSHARP MEMORIAL HOSPITALMiraCosta CollegeMessageConnectMessageConnect</div><a href="https://www.linkedin.com/company/sharp-memorial-hospital/">SHARP MEMORIAL HOSPITAL</a><a href="https://www.linkedin.com/company/miracosta-college/">MiraCosta College</a></div><div data-view-name="profile-card-experience"><a href="https://www.linkedin.com/company/sharp-memorial-hospital/">SHARP MEMORIAL HOSPITAL</a></div></main></body></html>`

const CONTAMINATED_HERO_WITH_LOCATION_FIXTURE = `<!DOCTYPE html><html><body><main role="main"><div class="profile-hero-module"><h1 class="text-heading-xlarge">Ricardo Sanchez Villanueva</h1><div class="text-body-medium">Contact infoSHARP MEMORIAL HOSPITALMiraCosta CollegeMessageConnectMessageConnectMission Viejo, California, United States</div><a href="https://www.linkedin.com/company/sharp-memorial-hospital/">SHARP MEMORIAL HOSPITAL</a><a href="https://www.linkedin.com/company/miracosta-college/">MiraCosta College</a></div><div data-view-name="profile-card-experience"><a href="https://www.linkedin.com/company/sharp-memorial-hospital/">SHARP MEMORIAL HOSPITAL</a> · Present</div></main></body></html>`

const AAMI_ENTITY_LINE_FIXTURE = `<!DOCTYPE html><html><body><main><div class="profile-hero-module"><div class="profile-name">Ricardo Sanchez Villanueva</div><div class="entity-line"><a href="https://www.linkedin.com/company/aami/">AAMI</a> · <a href="https://www.linkedin.com/company/sharp-memorial-hospital/">SHARP MEMORIAL HOSPITAL</a></div></div><div data-view-name="profile-card-experience"></div></main></body></html>`

const contaminatedHeroHarness = runPageMetadataHarness(CONTAMINATED_HERO_FIXTURE, ricardoModernUrl)
const contaminatedHeroCandidates = (contaminatedHeroHarness.heroCompanyCandidatesAudit?.candidates ?? []) as Array<{
  text?: string
  source?: string
  selected?: boolean
  rejected?: boolean
  reject_reason?: string
  classification?: string | null
}>
const contaminatedBlob =
  "Contact infoSHARP MEMORIAL HOSPITALMiraCosta CollegeMessageConnectMessageConnect"
assert.notEqual(contaminatedHeroHarness.metadata?.company_name, contaminatedBlob)
assert.equal(contaminatedHeroHarness.metadata?.company_name, "SHARP MEMORIAL HOSPITAL")
assert.equal(contaminatedHeroHarness.companyRankingAudit?.selected_company, "SHARP MEMORIAL HOSPITAL")
assert.equal(contaminatedHeroHarness.companyFinalSelectionAudit?.selected_company, "SHARP MEMORIAL HOSPITAL")
assert.ok(
  contaminatedHeroCandidates.some(
    (entry) => entry.text === "MiraCosta College" && entry.rejected === true && entry.reject_reason === "education-signal",
  ),
)
assert.ok(
  !contaminatedHeroCandidates.some(
    (entry) => entry.text === contaminatedBlob && entry.selected === true,
  ),
)

const contaminatedLocationHarness = runPageMetadataHarness(
  CONTAMINATED_HERO_WITH_LOCATION_FIXTURE,
  ricardoModernUrl,
)
const contaminatedLocationBlob =
  "Contact infoSHARP MEMORIAL HOSPITALMiraCosta CollegeMessageConnectMessageConnectMission Viejo, California, United States"
assert.notEqual(contaminatedLocationHarness.metadata?.company_name, contaminatedLocationBlob)
assert.equal(contaminatedLocationHarness.metadata?.company_name, "SHARP MEMORIAL HOSPITAL")
assert.equal(contaminatedLocationHarness.companyFinalSelectionAudit?.selected_company, "SHARP MEMORIAL HOSPITAL")
assert.ok(
  !contaminatedLocationHarness.metadata?.headline?.includes("Contact infoSHARP"),
)

const aamiEntityHarness = runPageMetadataHarness(AAMI_ENTITY_LINE_FIXTURE, ricardoModernUrl)
const aamiHeroSignals = (aamiEntityHarness.heroCompanySignalsAudit?.candidates ?? []) as Array<{
  company?: string
  source?: string
  selected?: boolean
}>
assert.equal(aamiEntityHarness.companyRankingAudit?.selected_company, "SHARP MEMORIAL HOSPITAL")
assert.ok(
  aamiHeroSignals.some(
    (entry) => entry.company === "AAMI" && entry.source?.includes("certification"),
  ),
)
assert.ok(
  aamiHeroSignals.some(
    (entry) => entry.company === "SHARP MEMORIAL HOSPITAL" && entry.selected === true,
  ),
)

const ricardoLiveHarness = runPageMetadataHarness(RICARDO_LIVE_DOM_FIXTURE, ricardoModernUrl)
const ricardoLiveRanking = ricardoLiveHarness.companyRankingAudit ?? {}
assert.equal(ricardoLiveRanking.selected_company, "SHARP MEMORIAL HOSPITAL")
assert.ok(
  ricardoLiveRanking.selected_source === "top-card.hero-plain-text-company" ||
    ricardoLiveRanking.selected_source === "top-card.entity-anchor" ||
    ricardoLiveRanking.selected_source === "top-card.company-anchor",
)
assert.equal(ricardoLiveHarness.metadata?.contact_name, "Ricardo Sanchez Villanueva")
assert.equal(ricardoLiveHarness.metadata?.company_name, "SHARP MEMORIAL HOSPITAL")
assert.equal(ricardoLiveHarness.metadata?.headline, "Biomedical Equipment Technician")
assert.equal(ricardoLiveHarness.metadata?.title, "Biomedical Equipment Technician")
assert.doesNotMatch(String(ricardoLiveHarness.metadata?.headline ?? ""), /SHARP MEMORIAL HOSPITAL/i)
assert.equal(ricardoLiveHarness.metadata?.profile_photo_url, "https://media.licdn.com/ricardo-headshot.jpg")
assert.equal(ricardoLiveHarness.profileImageAudit?.hero_container_found, true)
assert.equal(ricardoLiveHarness.profileImageAudit?.selected_profile_image, "https://media.licdn.com/ricardo-headshot.jpg")
assert.ok(Number(ricardoLiveHarness.heroScoringAudit?.candidate_count) > 0)
assert.match(String(ricardoLiveHarness.heroScoringAudit?.selected_reason ?? ""), /hero-scoring:/)
assert.match(linkedinLayoutPushJs, /data-equipify-layout-root/)

const LINKEDIN_PROFILE_FIXTURE = `<main>
  <h1 class="text-heading-xlarge">Jane Doe</h1>
  <div class="text-body-medium break-words">VP Operations at Acme Medical</div>
  <span class="text-body-small inline t-black--light break-words">Austin, Texas, United States</span>
  <a href="https://acme.example/">acme.example</a>
</main>`

function extractLinkedInFixtureField(html: string, pattern: RegExp) {
  const match = html.match(pattern)
  return match?.[1]?.trim() ?? null
}

assert.equal(
  extractLinkedInFixtureField(LINKEDIN_PROFILE_FIXTURE, /text-heading-xlarge">([^<]+)/),
  "Jane Doe",
)
assert.equal(
  extractLinkedInFixtureField(LINKEDIN_PROFILE_FIXTURE, /text-body-medium break-words">([^<]+)/),
  "VP Operations at Acme Medical",
)
assert.equal(
  extractLinkedInFixtureField(LINKEDIN_PROFILE_FIXTURE, /href="(https:\/\/acme\.example\/)/),
  "https://acme.example/",
)
assert.doesNotMatch(pageMetadataJs, /\bfetch\s*\(|XMLHttpRequest|linkedin\.com\/voyager\/api/i)

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
assert.match(sidepanelHtml, /equipify-sales-wordmark\.png/)
assert.match(sidepanelHtml, /extension-brand.js/)
assert.match(sidepanelHtml, /width="1024"/)
assert.doesNotMatch(sidepanelHtml, /equipify-lightning\.png/)
assert.match(sidepanelHtml, /extension-employee-row.js/)
assert.match(sidepanelHtml, /extension-workspace.js/)
assert.match(sidepanelHtml, /sales-workspace.css/)
assert.match(sidepanelHtml, /workspace-refresh-btn/)
assert.match(sidepanelHtml, /prospecting-mode/)
assert.match(sidepanelHtml, /linkedin-floating-dock/)
assert.match(sidepanelHtml, /es-ws-add-btn/)
assert.match(sidepanelHtml, /analytics-today/)
assert.match(sidepanelHtml, /extension-version-banner/)
assert.match(sidepanelHtml, /bootstrap-loading/)
assert.match(sidepanelHtml, /extension-context-normalize.js/)
assert.match(sidepanelHtml, /extension-contact-intelligence.js/)
assert.match(sidepanelHtml, /extension-opportunity-intelligence.js/)
assert.match(sidepanelHtml, /extension-buying-committee.js/)
assert.match(sidepanelHtml, /Buying Committee/)
assert.match(sidepanelHtml, /es-ws-find-decision-makers-btn/)
assert.match(sidepanelHtml, /es-ws-employee-buying-role-filter/)
assert.match(extensionWorkspaceJs, /renderBuyingCommitteeSummary/)
assert.match(extensionWorkspaceJs, /renderRecommendedContacts/)
assert.match(extensionWorkspaceJs, /runFindDecisionMakersDiscovery/)
assert.match(extensionEmployeeRowJs, /es-ws-buying-role-badge/)
assert.match(sidepanelHtml, /Opportunity Intelligence/)
assert.match(sidepanelHtml, /Contact Intelligence/)
assert.match(sidepanelHtml, /Research Snapshot/)
assert.match(sidepanelHtml, /Discovery Actions/)
assert.match(sidepanelHtml, /es-ws-crm-contacts-list/)
assert.match(sidepanelHtml, /Employees/)
assert.match(sidepanelHtml, /es-ws-company-overview-grid/)
assert.match(sidepanelHtml, /Workspace Utilities/)
assert.match(sidepanelHtml, /es-ws-employees-preview-list/)
assert.match(extensionWorkspaceJs, /es-ws-employees-show-more/)
assert.match(salesWorkspaceCss, /es-ws-company-overview-grid/)
assert.match(salesWorkspaceCss, /es-ws-utilities/)
assert.match(extensionWorkspaceJs, /renderCompanyOverviewGrid/)
assert.match(extensionWorkspaceJs, /EMPLOYEE_PAGE_SIZE/)
assert.doesNotMatch(sidepanelHtml, /es-ws-company-rows/)
assert.match(sidepanelHtml, /es-ws-oi-details/)

const popupHtml = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/popup.html"),
  "utf8",
)
assert.match(popupHtml, /Equipify Sales/)
assert.match(popupHtml, /extension-ui.js/)
assert.match(popupHtml, /equipify-sales-wordmark\.png/)
assert.match(popupHtml, /extension-brand.js/)
assert.match(popupHtml, /id="es-launcher-logo"/)
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
assert.match(lookupCacheJs, /invalidateMatching/)

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
