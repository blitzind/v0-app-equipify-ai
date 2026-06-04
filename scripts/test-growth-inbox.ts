/**
 * Regression checks for Growth Inbox runtime stability + honest empty states.
 * Run: pnpm test:growth-inbox
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { formatLeadLabel, safeFormatLeadLabel } from "../lib/growth/lead-label"
import { sanitizeGrowthInboxApiErrorMessage } from "../lib/growth/inbox/inbox-api-errors"
import {
  GROWTH_INBOX_HONEST_EMPTY_STATE_QA_MARKER,
  GROWTH_INBOX_NO_RUNTIME_ERRORS_QA_MARKER,
  GROWTH_INBOX_RUNTIME_STABLE_QA_MARKER,
  buildGrowthInboxSetupEmptyState,
  resolveGrowthInboxSetupPhase,
  shouldShowGrowthInboxHonestEmptyState,
} from "../lib/growth/inbox/inbox-runtime-types"

assert.equal(GROWTH_INBOX_RUNTIME_STABLE_QA_MARKER, "growth-inbox-runtime-stable-v2")
assert.equal(GROWTH_INBOX_NO_RUNTIME_ERRORS_QA_MARKER, "growth-inbox-no-runtime-errors-v1")
assert.equal(GROWTH_INBOX_HONEST_EMPTY_STATE_QA_MARKER, "growth-inbox-honest-empty-state-v2")

assert.equal(formatLeadLabel(" Acme "), "Acme")
assert.equal(formatLeadLabel(""), "Lead")
assert.equal(safeFormatLeadLabel("Beta"), "Beta")
assert.equal(safeFormatLeadLabel(null, undefined, "Unknown"), "Unknown")
assert.equal(safeFormatLeadLabel("x", () => { throw new Error("boom") }), "x")

assert.match(
  sanitizeGrowthInboxApiErrorMessage(new Error("formatLeadLabel is not defined"), "fallback"),
  /server configuration issue/i,
)
assert.equal(sanitizeGrowthInboxApiErrorMessage(new Error("permission denied"), "fallback"), "permission denied")

assert.equal(
  resolveGrowthInboxSetupPhase({ threadCount: 0, syncRunCount: 0, mailboxConnectionCount: 0 }),
  "no_mailbox_providers",
)
assert.equal(
  resolveGrowthInboxSetupPhase({ threadCount: 0, syncRunCount: 0, mailboxConnectionCount: 2, syncSchemaReady: false }),
  "sync_not_configured",
)
assert.equal(
  resolveGrowthInboxSetupPhase({ threadCount: 0, syncRunCount: 0, mailboxConnectionCount: 2, syncSchemaReady: true }),
  "no_sync_runs",
)
assert.equal(resolveGrowthInboxSetupPhase({ threadCount: 2, syncRunCount: 0, mailboxConnectionCount: 0 }), "ready")

assert.equal(
  shouldShowGrowthInboxHonestEmptyState({ threadCount: 0, syncRunCount: 0, mailboxConnectionCount: 0 }),
  true,
)
assert.equal(
  buildGrowthInboxSetupEmptyState("no_mailbox_providers")?.title,
  "No mailbox providers connected",
)

const repoSource = fs.readFileSync(path.join(process.cwd(), "lib/growth/inbox/thread-repository.ts"), "utf8")
assert.match(repoSource, /from "@\/lib\/growth\/lead-label"/)
assert.match(repoSource, /formatLeadLabel/)

const conversationColumnSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/inbox/growth-inbox-conversation-column.tsx"),
  "utf8",
)
assert.match(conversationColumnSource, /GROWTH_INBOX_CHANNEL_LABELS/)
assert.match(conversationColumnSource, /from "@\/lib\/growth\/inbox\/inbox-channel-types"/)

const uiSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-unified-inbox-dashboard.tsx"),
  "utf8",
)
assert.match(uiSource, /GROWTH_INBOX_RUNTIME_STABLE_QA_MARKER/)
assert.match(uiSource, /GrowthInboxSetupEmptyState/)
assert.match(uiSource, /GrowthInboxExtendedPanels/)

const extendedPanels = fs.readFileSync(
  path.join(process.cwd(), "components/growth/inbox/growth-inbox-extended-panels.tsx"),
  "utf8",
)
assert.match(extendedPanels, /GrowthInboxWidgetErrorBoundary/)

const sharedUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/inbox/growth-inbox-shared-ui.ts"),
  "utf8",
)
assert.match(sharedUi, /safeFormatLeadLabel/)
assert.match(sharedUi, /sanitizeInboxUiErrorMessage/)

const boundarySource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-inbox-widget-error-boundary.tsx"),
  "utf8",
)
assert.match(boundarySource, /GrowthInboxWidgetErrorBoundary/)
assert.match(boundarySource, /GROWTH_INBOX_NO_RUNTIME_ERRORS_QA_MARKER/)

const repoMatches = fs
  .readdirSync(path.join(process.cwd(), "lib"), { recursive: true })
  .filter((file): file is string => typeof file === "string" && file.endsWith(".ts"))
  .flatMap((relativePath) => {
    if (relativePath === "growth/lead-label.ts") return []
    const source = fs.readFileSync(path.join(process.cwd(), "lib", relativePath), "utf8")
    if (!source.includes("formatLeadLabel(")) return []
    const hasImport =
      source.includes('from "@/lib/growth/lead-label"') ||
      source.includes('from "@/lib/growth/sequences/sequence-enrollment"') ||
      source.includes("export { formatLeadLabel }") ||
      source.includes("export function formatLeadLabel")
    return hasImport ? [] : [relativePath]
  })

assert.deepEqual(
  repoMatches,
  [],
  `formatLeadLabel used without import in: ${repoMatches.join(", ") || "(none)"}`,
)

console.log("growth-inbox: all checks passed")
