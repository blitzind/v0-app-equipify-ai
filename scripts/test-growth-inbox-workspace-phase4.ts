import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { GROWTH_INBOX_WORKSPACE_PHASE4_QA_MARKER } from "../lib/growth/inbox/inbox-workspace-types"

const root = join(process.cwd())

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8")
}

function main() {
  assert.equal(GROWTH_INBOX_WORKSPACE_PHASE4_QA_MARKER, "growth-inbox-workspace-phase4")

  const leadContextSource = readSource("components/growth/inbox/growth-inbox-lead-context-provider.tsx")
  assert.doesNotMatch(leadContextSource, /revenue-execution\/command-center/)
  assert.match(leadContextSource, /refreshWorkflow/)
  assert.match(leadContextSource, /refreshRecommendations/)
  assert.match(leadContextSource, /sequenceExitCandidates/)

  const sharedDataSource = readSource("components/growth/inbox/growth-inbox-shared-data-provider.tsx")
  assert.match(sharedDataSource, /revenue-execution\/command-center/)
  assert.match(sharedDataSource, /findCommandCenterLead/)

  const workflowEmbedsSource = readSource("components/growth/inbox/growth-inbox-action-center-workflow-embeds.tsx")
  assert.match(workflowEmbedsSource, /useExternalData/)
  assert.match(workflowEmbedsSource, /showSequenceExit/)
  assert.match(workflowEmbedsSource, /externalExitCandidates/)

  const actionCenterSource = readSource("components/growth/inbox/growth-inbox-action-center-column.tsx")
  assert.match(actionCenterSource, /GrowthInboxActionCenterReplyDraftEmbed/)

  const smsDraftEmbedSource = readSource("components/growth/inbox/growth-inbox-action-center-sms-draft-embed.tsx")
  assert.match(smsDraftEmbedSource, /\/api\/platform\/growth\/sms\/send/)
  assert.match(smsDraftEmbedSource, /loadThreadDetail/)
  assert.match(smsDraftEmbedSource, /refreshThreads/)

  const supportingPanelsSource = readSource("components/growth/inbox/growth-inbox-v2-supporting-panels.tsx")
  assert.doesNotMatch(supportingPanelsSource, /GrowthReplyDraftingPanel/)

  const keyboardSource = readSource("components/growth/inbox/growth-inbox-keyboard-workflow.tsx")
  assert.match(keyboardSource, /navigationKey === "j"/)
  assert.match(keyboardSource, /if \(!selectedThreadId\) return/)

  const workspaceProviderSource = readSource("components/growth/inbox/growth-inbox-workspace-provider.tsx")
  assert.match(workspaceProviderSource, /GrowthInboxActionRefreshMode/)
  assert.match(workspaceProviderSource, /refreshThreads/)
  assert.match(workspaceProviderSource, /refreshAfterThreadMutation/)

  const v2PanelSource = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
  assert.match(v2PanelSource, /GrowthInboxSharedDataProvider/)
  assert.match(v2PanelSource, /GrowthInboxWorkspaceActionsMenu/)
  assert.doesNotMatch(v2PanelSource, /Create Thread<\/p>/)

  console.log("growth-inbox-workspace-phase4: all checks passed")
}

main()
