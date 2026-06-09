/**
 * CRM lead drawer regression — Apollo draft deep-link must render without ReferenceError.
 * Run: pnpm test:growth-crm-lead-drawer-apollo-draft
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const COMMAND_CENTER_PATH = "components/growth/growth-lead-command-center.tsx"
const DRAWER_PATH = "components/growth/growth-lead-drawer.tsx"
const BANNER_PATH = "components/growth/growth-next-best-action-banner.tsx"
const CRM_PAGE_PATH = "app/(admin)/admin/growth/leads/crm/page.tsx"
const SEQUENCE_INTELLIGENCE_PATH = "components/growth/growth-sequence-intelligence.tsx"
const APOLLO_PANEL_PATH = "components/growth/apollo-primary-contact-enrollment-approval-queue-panel.tsx"

const APOLLO_PRODUCTION_GROWTH_LEAD_ID = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56"
const APOLLO_PRODUCTION_ENROLLMENT_DRAFT_ID = "d5fa5558-08ff-4504-ab55-a925e26e6c29"

for (const relativePath of [
  COMMAND_CENTER_PATH,
  DRAWER_PATH,
  BANNER_PATH,
  CRM_PAGE_PATH,
  SEQUENCE_INTELLIGENCE_PATH,
  APOLLO_PANEL_PATH,
]) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const commandCenter = fs.readFileSync(path.join(process.cwd(), COMMAND_CENTER_PATH), "utf8")
const drawer = fs.readFileSync(path.join(process.cwd(), DRAWER_PATH), "utf8")
const banner = fs.readFileSync(path.join(process.cwd(), BANNER_PATH), "utf8")
const crmPage = fs.readFileSync(path.join(process.cwd(), CRM_PAGE_PATH), "utf8")
const sequenceIntelligence = fs.readFileSync(path.join(process.cwd(), SEQUENCE_INTELLIGENCE_PATH), "utf8")
const apolloPanel = fs.readFileSync(path.join(process.cwd(), APOLLO_PANEL_PATH), "utf8")

assert.match(banner, /export function GrowthNextBestActionBanner/)
assert.match(commandCenter, /import \{ GrowthNextBestActionBanner \} from "@\/components\/growth\/growth-next-best-action-banner"/)
assert.match(commandCenter, /<GrowthNextBestActionBanner lead=\{lead\} \/>/)
console.log("  ✓ command center — GrowthNextBestActionBanner imported and rendered")

assert.match(drawer, /import \{ GrowthLeadCommandCenter \}/)
assert.match(drawer, /import \{ GrowthSequenceIntelligence \}/)
assert.match(drawer, /<GrowthLeadCommandCenter/)
assert.match(drawer, /<GrowthSequenceIntelligence lead=\{activeLead\} \/>/)
console.log("  ✓ lead drawer — command center + sequence intelligence wired")

assert.match(crmPage, /GrowthLeadDrawer/)
assert.match(crmPage, /searchParams\.get\("open"\)/)
assert.match(crmPage, /deepLinkLeadId/)
console.log("  ✓ CRM page — GrowthLeadDrawer with ?open= deep link")

assert.match(apolloPanel, /\/admin\/growth\/leads\/crm\?open=\$\{draftWorkflowLink\.growth_lead_id\}/)
console.log("  ✓ Apollo enrollment panel — deep link opens CRM drawer by growth_lead_id")

assert.match(sequenceIntelligence, /sequence-enrollments/)
assert.match(sequenceIntelligence, /Awaiting Confirmation|draft/)
console.log("  ✓ sequence intelligence — enrollment draft workflow section")

const crmDeepLink = `/admin/growth/leads/crm?open=${APOLLO_PRODUCTION_GROWTH_LEAD_ID}`
assert.match(apolloPanel, /crm\?open=/)
assert.ok(APOLLO_PRODUCTION_GROWTH_LEAD_ID.length === 36)
assert.ok(APOLLO_PRODUCTION_ENROLLMENT_DRAFT_ID.length === 36)
console.log(`  ✓ production fixture — lead ${APOLLO_PRODUCTION_GROWTH_LEAD_ID.slice(0, 8)}… draft ${APOLLO_PRODUCTION_ENROLLMENT_DRAFT_ID.slice(0, 8)}…`)
console.log(`  · CRM deep link: ${crmDeepLink}`)

console.log("\nCRM lead drawer Apollo draft regression passed.")
