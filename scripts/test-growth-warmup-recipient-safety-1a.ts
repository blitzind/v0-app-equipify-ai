/**
 * GS-GROWTH-WARMUP-EXECUTOR-1A — recipient safety regression.
 * Run: pnpm test:growth-warmup-recipient-safety-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_WARMUP_RECIPIENT_TYPES } from "../lib/growth/warmup/warmup-executor-types"

function runTests(): void {
  console.log("\n=== GS-GROWTH-WARMUP-RECIPIENT-SAFETY-1A ===\n")

  assert.equal(GROWTH_WARMUP_RECIPIENT_TYPES.length, 5)
  assert.ok(GROWTH_WARMUP_RECIPIENT_TYPES.includes("internal"))
  assert.ok(GROWTH_WARMUP_RECIPIENT_TYPES.includes("owned_inbox"))
  console.log("  ✓ Recipient types defined")

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270925120000_growth_warmup_executor_1a.sql"),
    "utf8",
  )
  assert.match(migration, /approved boolean not null default false/)
  assert.match(migration, /active boolean not null default true/)
  assert.match(migration, /max_emails_per_day/)
  assert.match(migration, /max_emails_per_week/)
  assert.match(migration, /warmup_recipients_email_unique/)
  console.log("  ✓ Schema enforces approval + caps + unique email")

  const selectorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/warmup/warmup-recipient-selector.ts"),
    "utf8",
  )
  assert.match(selectorSource, /r\.active && r\.approved/)
  assert.match(selectorSource, /max_emails_per_day/)
  assert.match(selectorSource, /max_emails_per_week/)
  console.log("  ✓ Selector requires active + approved + caps")

  const executorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/warmup/warmup-send-executor.ts"),
    "utf8",
  )
  assert.match(executorSource, /no_approved_recipients/)
  assert.match(executorSource, /approvedOnly: true/)
  assert.match(executorSource, /selection\.code/)
  console.log("  ✓ Executor skips when no approved recipients or caps reached")

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-warmup-executor-panel.tsx"),
    "utf8",
  )
  assert.match(uiSource, /agreed to receive warmup/)
  assert.match(uiSource, /internal\/owned inboxes/)
  console.log("  ✓ UI warning for approved recipients only")

  const recipientsApi = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/warmup/recipients/route.ts"),
    "utf8",
  )
  assert.match(recipientsApi, /approved/)
  console.log("  ✓ Recipients API supports approval flag")

  console.log("\nGS-GROWTH-WARMUP-RECIPIENT-SAFETY-1A passed.\n")
}

runTests()
