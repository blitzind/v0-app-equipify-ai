/**
 * AVA-HOME-AI-TEAMMATE-500-HOTFIX-1A — certification (static + optional production profile).
 * Run: pnpm test:ava-home-ai-teammate-500-hotfix-1a
 * Production profile: pnpm test:ava-home-ai-teammate-500-hotfix-1a:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

export const AVA_HOME_AI_TEAMMATE_500_HOTFIX_1A_QA_MARKER =
  "ava-home-ai-teammate-500-hotfix-1a-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(AVA_HOME_AI_TEAMMATE_500_HOTFIX_1A_QA_MARKER, "ava-home-ai-teammate-500-hotfix-1a-v1")

  const route = readSource("app/api/growth/workspace/settings/ai-teammate/route.ts")
  const service = readSource("lib/growth/settings/growth-ai-teammate-identity-service.ts")
  const repository = readSource("lib/growth/settings/growth-ai-teammate-identity-repository.ts")
  const compat = readSource("lib/growth/settings/growth-workspace-settings-column-compat.ts")
  const client = readSource("lib/growth/settings/growth-ai-teammate-identity-client.ts")
  const provider = readSource("components/growth/ai-teammate/ai-teammate-identity-provider.tsx")
  const dashboardBody = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
  const summaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")

  assert.match(compat, /isGrowthOrganizationAiTeammateActivationColumnMissingError/)
  assert.match(compat, /autonomous_activated_at/)

  assert.match(repository, /loadGrowthAiTeammateIdentityRecord/)
  assert.match(repository, /ORG_SELECT_BASE/)
  assert.match(repository, /probeOrganizationAiTeammateActivationColumns/)
  assert.doesNotMatch(repository, /loadMailboxCredentials/)
  assert.doesNotMatch(repository, /credentials-crypto/)
  assert.doesNotMatch(repository, /outbound-sender/)

  assert.match(service, /loadGrowthAiTeammateIdentityRecord/)
  assert.match(service, /isGrowthOrganizationAiTeammateActivationColumnMissingError/)
  assert.doesNotMatch(service, /loadPlatformPersonaIdentity/)

  assert.match(route, /loadAiTeammateIdentity/)
  assert.doesNotMatch(route, /mailbox/)
  assert.doesNotMatch(route, /outbound/)
  assert.doesNotMatch(route, /GROWTH_PROVIDER_CREDENTIALS_PEPPER/)

  assert.match(client, /loadError/)
  assert.match(provider, /loadError/)
  assert.match(provider, /setError\(loadError\)/)

  assert.match(dashboardBody, /GrowthHomeExecutiveBriefingDashboard/)
  assert.doesNotMatch(dashboardBody, /We couldn't load this screen/)

  assert.doesNotMatch(summaryService, /loadMailboxCredentials/)
  assert.doesNotMatch(summaryService, /ensureMailboxReadyForOutboundSend/)
  assert.doesNotMatch(summaryService, /resolveOrAssignOutboundSenderAffinity/)
  assert.doesNotMatch(summaryService, /credentials-crypto/)

  const mailboxReadiness = readSource("lib/growth/mailboxes/mailbox-pre-send-readiness.ts")
  assert.match(mailboxReadiness, /ensureMailboxEligibleForSenderAssignment/)
  assert.match(mailboxReadiness, /ensureMailboxReadyForOutboundSend/)

  console.log("ava-home-ai-teammate-500-hotfix-1a: ok")
}

main()
