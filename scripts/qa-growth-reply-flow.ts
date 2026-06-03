/**
 * Growth Engine reply-flow QA harness.
 *
 * Run full flow (reuse latest harness lead or create one):
 *   pnpm qa:growth-reply-flow
 *
 * Production (injects Vercel production env — preferred):
 *   vercel env run -e production -- pnpm qa:growth-reply-flow -- --fresh --to mike@fuzor.io --json
 *
 * Individual steps:
 *   pnpm qa:growth-reply-flow -- --step create --fresh
 *   pnpm qa:growth-reply-flow -- --step enroll --lead-id <uuid>
 *   pnpm qa:growth-reply-flow -- --step scheduler
 *   pnpm qa:growth-reply-flow -- --step approve --lead-id <uuid>
 *   pnpm qa:growth-reply-flow -- --step execute
 *   pnpm qa:growth-reply-flow -- --step inbox-sync
 *   pnpm qa:growth-reply-flow -- --step inspect --lead-id <uuid>
 *
 * Flags:
 *   --inspect-only     Alias for --step inspect
 *   --fresh            Always create a new QA lead
 *   --lead-id <uuid>   Target an existing lead
 *   --skip-execute     Run through approve + inspect only (no transport send)
 *   --pattern <key>    Sequence pattern key (default: email_then_call)
 *   --to <email>       Lead contact email (default: GROWTH_QA_REPLY_FLOW_TO or mike@fuzor.io)
 *   --json             Print structured JSON report
 */
import type { GrowthReplyFlowHarnessStep } from "../lib/growth/qa/reply-flow-harness-types"
import { assertGrowthProductionEnvReady } from "../lib/growth/qa/reply-flow-env-bootstrap"

function printUsage(): void {
  console.log(`Usage: pnpm qa:growth-reply-flow [-- options]

Options:
  --step <name>       all | create | enroll | scheduler | approve | execute | inbox-sync | inspect
  --inspect-only      Inspect latest / provided lead only
  --fresh             Create a new QA lead instead of reusing the latest harness lead
  --lead-id <uuid>    Existing lead id
  --skip-execute      Stop before transport execution
  --pattern <key>     Sequence pattern key (default: email_then_call)
  --to <email>        Lead contact email
  --company <name>    Company name prefix / exact match for reuse lookup
  --json              Output JSON report
  --help              Show this help

Environment:
  Loads (later overrides earlier): .env.local, .env.local.active, .env.production.local,
  .env.vercel.production, .vercel/.env.production.local
  Or use: vercel env run -e production -- pnpm qa:growth-reply-flow -- ...
`)
}

const VALID_STEPS = new Set<GrowthReplyFlowHarnessStep>([
  "all",
  "create",
  "enroll",
  "scheduler",
  "approve",
  "execute",
  "inbox-sync",
  "inspect",
])

function parseArgs(argv: string[]): {
  step: GrowthReplyFlowHarnessStep
  fresh: boolean
  leadId: string | null
  skipExecute: boolean
  patternKey: string | null
  contactEmail: string | null
  companyName: string | null
  json: boolean
  help: boolean
} {
  let step: GrowthReplyFlowHarnessStep = "all"
  let fresh = false
  let leadId: string | null = null
  let skipExecute = false
  let patternKey: string | null = null
  let contactEmail: string | null = null
  let companyName: string | null = null
  let json = false
  let help = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--help" || arg === "-h") {
      help = true
      continue
    }
    if (arg === "--inspect-only") {
      step = "inspect"
      continue
    }
    if (arg === "--fresh") {
      fresh = true
      continue
    }
    if (arg === "--skip-execute") {
      skipExecute = true
      continue
    }
    if (arg === "--json") {
      json = true
      continue
    }
    if (arg === "--step") {
      const value = argv[index + 1]?.trim()
      if (!value || !VALID_STEPS.has(value as GrowthReplyFlowHarnessStep)) {
        throw new Error(`Invalid --step value: ${value ?? "(missing)"}`)
      }
      step = value as GrowthReplyFlowHarnessStep
      index += 1
      continue
    }
    if (arg === "--lead-id") {
      leadId = argv[index + 1]?.trim() || null
      index += 1
      continue
    }
    if (arg === "--pattern") {
      patternKey = argv[index + 1]?.trim() || null
      index += 1
      continue
    }
    if (arg === "--to") {
      contactEmail = argv[index + 1]?.trim() || null
      index += 1
      continue
    }
    if (arg === "--company") {
      companyName = argv[index + 1]?.trim() || null
      index += 1
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return { step, fresh, leadId, skipExecute, patternKey, contactEmail, companyName, json, help }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2).filter((arg) => arg !== "--"))
  if (args.help) {
    printUsage()
    return
  }

  assertGrowthProductionEnvReady()

  const [{ createServiceRoleClient }, { formatGrowthReplyFlowReport, runGrowthReplyFlowHarness }] =
    await Promise.all([
      import("../lib/supabase/admin"),
      import("../lib/growth/qa/reply-flow-harness"),
    ])

  const admin = createServiceRoleClient()
  if (!admin) {
    console.error("Supabase service role client could not be created after env bootstrap.")
    process.exit(1)
  }

  const report = await runGrowthReplyFlowHarness(admin, {
    step: args.step,
    leadId: args.leadId,
    fresh: args.fresh,
    patternKey: args.patternKey ?? undefined,
    contactEmail: args.contactEmail,
    companyName: args.companyName,
    skipExecute: args.skipExecute,
  })

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(formatGrowthReplyFlowReport(report))
  }

  process.exit(report.overall === "PASS" ? 0 : 1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
