/**
 * Offline checks for workspace transactional SMS gates.
 * Run: npx tsx scripts/test-transactional-sms-safety.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { DEFAULT_WORKSPACE_SMS_DTO } from "../lib/sms/workspace-sms-types"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const transactional = readFileSync(
  resolve(root, "lib/sms/queue-transactional-sms-notification.server.ts"),
  "utf8",
)

console.log("Transactional SMS safety (offline)\n")

assert.equal(DEFAULT_WORKSPACE_SMS_DTO.optInRequired, true, "default requires opt-in")

assert.match(transactional, /isTransactionalSmsAlertType/)
assert.match(transactional, /transactional_only_violation/)
assert.match(transactional, /suppression_lookup_failed/)
assert.doesNotMatch(transactional, /promotional/)

// optInRequired=false is an explicit workspace admin policy for transactional scope only.
assert.match(transactional, /if \(smsWorkspace\.optInRequired\)/)

console.log("OK: transactional SMS safety contracts passed.")
