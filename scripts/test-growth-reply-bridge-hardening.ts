/**
 * Phase 15.2D — Reply bridge hardening regression checks.
 * Run: pnpm test:growth-reply-bridge-hardening
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  const resolverSource = readSource("lib/growth/replies/reply-connection-resolver.ts")
  assert.match(resolverSource, /resolveReplyIngestionConnectionId/)
  assert.match(resolverSource, /ensureOAuthReplyIngestionConnection/)
  assert.match(readSource("lib/growth/replies/oauth-reply-ingestion-connection.ts"), /ensureOAuthReplyIngestionConnection/)
  assert.match(resolverSource, /resolveConnectionFromLeadDeliveryAttempts/)
  assert.match(resolverSource, /REPLY_INGESTION_CONNECTION_RESOLVER_QA_MARKER/)

  const pipelineSource = readSource("lib/growth/replies/reply-ingestion-pipeline.ts")
  assert.match(pipelineSource, /resolveReplyIngestionConnectionId/)
  assert.match(pipelineSource, /resumingIncomplete/)
  assert.doesNotMatch(pipelineSource, /async function resolveConnectionForLead/)

  const runnerSource = readSource("lib/growth/inbox-sync/inbox-sync-runner.ts")
  assert.match(runnerSource, /resolveReplyIngestionConnectionId/)
  assert.match(runnerSource, /connectionId: syncConnectionId/)
  assert.match(runnerSource, /ingestGrowthReplyFromInboxSync/)
  assert.match(runnerSource, /finalizeIngestedReplyIntelligence/)

  const reconcileSource = readSource("lib/growth/replies/reconcile-inbox-sync-reply.ts")
  assert.match(reconcileSource, /reconcileInboxSyncReplyGapForLead/)
  assert.match(reconcileSource, /assessHistoricalReplyBackfillPossible/)
  assert.match(reconcileSource, /finalizeIngestedReplyIntelligence/)

  const finalizeSource = readSource("lib/growth/replies/finalize-ingested-reply-intelligence.ts")
  assert.match(finalizeSource, /processReplyIntelligence/)

  const cronSource = readSource("app/api/cron/growth-inbox-sync/route.ts")
  assert.match(cronSource, /growth-inbox-sync/)
  assert.match(cronSource, /runInboxSyncForEnabledMailboxes/)

  const vercelConfig = readSource("vercel.json")
  assert.match(vercelConfig, /"path": "\/api\/cron\/growth-inbox-sync"/)
  assert.match(vercelConfig, /"\*\/15 \* \* \* \*"/)

  // Reply lifecycle chain present end-to-end
  const chain = [
    "lib/growth/inbox-sync/inbox-sync-runner.ts",
    "lib/growth/replies/reply-ingestion-pipeline.ts",
    "lib/growth/replies/finalize-ingested-reply-intelligence.ts",
    "lib/growth/reply-intelligence/process-reply-intelligence.ts",
  ]
  for (const file of chain) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `missing ${file}`)
  }

  const intelligenceSource = readSource("lib/growth/reply-intelligence/process-reply-intelligence.ts")
  assert.match(intelligenceSource, /emitReplyWaitingNotification/)
  assert.match(intelligenceSource, /emitReplyReceivedTimeline/)

  console.log("growth-reply-bridge-hardening: all checks passed")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
