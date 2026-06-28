/**
 * GE-EI-IMP-4F — offline Email Learning parity orchestrator.
 *
 * Fixture mode (CI-safe):
 *   pnpm test:growth-email-learning-parity-preview
 *
 * Live reconstruction mode:
 *   pnpm growth:email-learning-parity-preview -- --limit=500
 *
 * Shadow fixture comparison:
 *   pnpm growth:email-learning-parity-preview -- --shadow-fixture ./path/to/shadow-logs.json
 */

import fs from "node:fs"
import path from "node:path"
import {
  buildEmailLearningParityReport,
  type EmailLearningParityReport,
} from "../lib/growth/contact-verification/email-learning-parity"
import {
  emailLearningObservationFromOutboundSend,
  emailLearningObservationFromProviderWebhook,
  emailLearningObservationFromReplyIntelligence,
} from "../lib/growth/contact-verification/email-learning"
import {
  emailLearningObservationToShadowLogEntry,
  GROWTH_EMAIL_LEARNING_SHADOW_QA_MARKER,
  type EmailLearningShadowLogEntry,
} from "../lib/growth/contact-verification/email-learning-shadow"
import {
  runEmailLearningPreviewDiagnostics,
  type EmailLearningPreviewSourceKey,
} from "./reconstruct-email-learning-preview"

export const GROWTH_EMAIL_LEARNING_PARITY_PREVIEW_QA_MARKER =
  "growth-email-learning-parity-preview-v1" as const

const DEFAULT_LIMIT = 250
const MAX_LIMIT = 5000
const FIXTURE_TS = "2026-06-19T12:00:00.000Z"

const PLAINTEXT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

const EVENT_SOURCE_HINTS: Record<string, string> = {
  sent: "outbound_send",
  delivered: "provider_webhook",
  opened: "provider_webhook",
  clicked: "provider_webhook",
  replied: "reply_intelligence",
  positive_reply: "reply_intelligence",
  negative_reply: "reply_intelligence",
  meeting_booked: "reply_intelligence",
  bounce_hard: "compliance",
  bounce_soft: "compliance",
  complaint: "compliance",
  unsubscribe: "compliance",
  manual_verified: "manual_verification",
  manual_rejected: "manual_verification",
}

export type EmailLearningParityPreviewParsedArgs = {
  fixture: boolean
  limit: number
  shadowFixturePath: string | null
}

export type EmailLearningParityPreviewReconstructionSummary = {
  observations_created: number
  duplicates_removed: number
  invalid_records_skipped: number
  unsupported_events_skipped: number
  domains_discovered: number
  sources: Record<
    EmailLearningPreviewSourceKey,
    { rows: number; observations: number; skipped: number }
  >
  skipped_sources: string[]
}

export type EmailLearningParityPreviewOutput = {
  qa_marker: typeof GROWTH_EMAIL_LEARNING_PARITY_PREVIEW_QA_MARKER
  mode: "fixture" | "live"
  limit: number
  reconstruction_summary: EmailLearningParityPreviewReconstructionSummary
  parity_report: EmailLearningParityReport
  shadow_logs_loaded: number
  shadow_logs_ignored: number
  warnings: string[]
}

export type EmailLearningShadowLogParseResult = {
  entries: EmailLearningShadowLogEntry[]
  loaded: number
  ignored: number
  warnings: string[]
}

export function parseEmailLearningParityPreviewArgs(argv: string[]): EmailLearningParityPreviewParsedArgs {
  let fixture = false
  let limit = DEFAULT_LIMIT
  let shadowFixturePath: string | null = null

  for (const arg of argv) {
    if (arg === "--fixture") fixture = true
    if (arg.startsWith("--limit=")) {
      const parsed = Number.parseInt(arg.slice("--limit=".length), 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.min(parsed, MAX_LIMIT)
      }
    }
    if (arg.startsWith("--shadow-fixture=")) {
      shadowFixturePath = arg.slice("--shadow-fixture=".length).trim() || null
    }
  }

  return { fixture, limit, shadowFixturePath }
}

function syntheticShadowObservationId(input: {
  event_type: string
  domain: string | null
  source: string
}): string {
  let hash = 2166136261
  const key = `${input.event_type}|${input.domain ?? "_"}|${input.source}`
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `shadow-fixture-${(hash >>> 0).toString(16).padStart(8, "0")}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeShadowLogRecord(raw: unknown): EmailLearningShadowLogEntry | null {
  if (!isRecord(raw)) return null
  if (raw.shadow !== "email_learning_observation") return null

  const eventType = typeof raw.event_type === "string" ? raw.event_type.trim() : ""
  if (!eventType) return null

  const source =
    typeof raw.source === "string" && raw.source.trim()
      ? raw.source.trim()
      : (EVENT_SOURCE_HINTS[eventType] ?? "unknown")
  const domain = typeof raw.domain === "string" ? raw.domain : null
  const observationId =
    typeof raw.observation_id === "string" && raw.observation_id.trim()
      ? raw.observation_id.trim()
      : syntheticShadowObservationId({ event_type: eventType, domain, source })

  return {
    qa_marker: GROWTH_EMAIL_LEARNING_SHADOW_QA_MARKER,
    shadow: "email_learning_observation",
    source,
    event_type: eventType,
    domain,
    observation_id: observationId,
    email_present: raw.email_present === true,
    organization_id_present: raw.organization_id_present === true,
    campaign_id_present: raw.campaign_id_present === true,
    sequence_id_present: raw.sequence_id_present === true,
    contact_id_present: raw.contact_id_present === true,
    provider: typeof raw.provider === "string" ? raw.provider : null,
    context: isRecord(raw.context) ? raw.context : undefined,
  }
}

function parseJsonShadowRecords(raw: unknown): EmailLearningShadowLogEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeShadowLogRecord).filter((row): row is EmailLearningShadowLogEntry => Boolean(row))
}

export function parseEmailLearningShadowLogFixture(raw: string): EmailLearningShadowLogParseResult {
  const warnings: string[] = []
  const trimmed = raw.trim()
  if (!trimmed) {
    return { entries: [], loaded: 0, ignored: 0, warnings: ["shadow_fixture_empty"] }
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) {
      const entries = parseJsonShadowRecords(parsed)
      return {
        entries,
        loaded: entries.length,
        ignored: Math.max(0, parsed.length - entries.length),
        warnings,
      }
    }
  } catch {
    // Fall through to NDJSON parsing.
  }

  const entries: EmailLearningShadowLogEntry[] = []
  let ignored = 0
  for (const line of trimmed.split(/\r?\n/)) {
    const candidate = line.trim()
    if (!candidate) continue
    try {
      const parsed = JSON.parse(candidate) as unknown
      const normalized = normalizeShadowLogRecord(parsed)
      if (normalized) entries.push(normalized)
      else ignored += 1
    } catch {
      ignored += 1
    }
  }

  if (entries.length === 0 && ignored > 0) {
    warnings.push("shadow_fixture_unrecognized")
  }

  return { entries, loaded: entries.length, ignored, warnings }
}

export function loadEmailLearningShadowLogFixture(filePath: string): EmailLearningShadowLogParseResult {
  if (!filePath.trim()) {
    return { entries: [], loaded: 0, ignored: 0, warnings: ["shadow_fixture_path_missing"] }
  }

  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) {
    return {
      entries: [],
      loaded: 0,
      ignored: 0,
      warnings: [`shadow_fixture_not_found:${path.basename(resolved)}`],
    }
  }

  try {
    const raw = fs.readFileSync(resolved, "utf8")
    const parsed = parseEmailLearningShadowLogFixture(raw)
    return parsed
  } catch (error) {
    return {
      entries: [],
      loaded: 0,
      ignored: 0,
      warnings: [
        `shadow_fixture_read_failed:${error instanceof Error ? error.message : "unknown"}`,
      ],
    }
  }
}

function buildBuiltinFixtureShadowLogs(): EmailLearningShadowLogEntry[] {
  const sent = emailLearningObservationFromOutboundSend({
    email: "jane.doe@acme.com",
    provider: "google",
    deliveryAttemptId: "fixture-attempt-1",
    sentAt: FIXTURE_TS,
    contactId: "lead-1",
  })
  const opened = emailLearningObservationFromProviderWebhook({
    email: "jane.doe@acme.com",
    normalizedEventType: "opened",
    provider: "google",
    providerEventId: "fixture-provider-1",
    occurredAt: FIXTURE_TS,
    contactId: "lead-1",
  })
  const delivered = emailLearningObservationFromProviderWebhook({
    email: "bob.smith@acme.com",
    normalizedEventType: "delivered",
    provider: "google",
    providerEventId: "fixture-provider-2",
    occurredAt: FIXTURE_TS,
  })
  const reply = emailLearningObservationFromReplyIntelligence({
    email: "jane.doe@acme.com",
    intent: "meeting_request",
    classification: "interested",
    replyId: "fixture-reply-1",
    receivedAt: FIXTURE_TS,
    contactId: "lead-1",
  })

  const observations = [sent, opened, delivered, reply]
    .filter((row) => row.ok && row.observation)
    .map((row) => row.observation!)

  return observations.map((observation) => emailLearningObservationToShadowLogEntry(observation))
}

function buildReconstructionSummary(
  preview: Awaited<ReturnType<typeof runEmailLearningPreviewDiagnostics>>["preview"],
): EmailLearningParityPreviewReconstructionSummary {
  return {
    observations_created: preview.summary.observations_created,
    duplicates_removed: preview.summary.duplicates_removed,
    invalid_records_skipped: preview.summary.invalid_records_skipped,
    unsupported_events_skipped: preview.summary.unsupported_events_skipped,
    domains_discovered: preview.summary.domains_discovered,
    sources: preview.sources,
    skipped_sources: preview.skipped_sources,
  }
}

export function assertEmailLearningParityPreviewOutputHasNoPlaintextEmails(output: unknown): boolean {
  const text = JSON.stringify(output)
  return !PLAINTEXT_EMAIL_PATTERN.test(text)
}

export async function runEmailLearningParityPreview(
  argv: string[],
): Promise<EmailLearningParityPreviewOutput> {
  const args = parseEmailLearningParityPreviewArgs(argv)
  const previewArgv = args.fixture ? ["--fixture", `--limit=${args.limit}`] : [`--limit=${args.limit}`]
  const diagnostics = await runEmailLearningPreviewDiagnostics(previewArgv)
  const warnings = [...diagnostics.preview.warnings]

  let shadowParse: EmailLearningShadowLogParseResult
  if (args.shadowFixturePath) {
    shadowParse = loadEmailLearningShadowLogFixture(args.shadowFixturePath)
    warnings.push(...shadowParse.warnings)
  } else if (args.fixture) {
    const entries = buildBuiltinFixtureShadowLogs()
    shadowParse = {
      entries,
      loaded: entries.length,
      ignored: 0,
      warnings: [],
    }
  } else {
    shadowParse = { entries: [], loaded: 0, ignored: 0, warnings: [] }
    warnings.push("reconstruction_only")
  }

  const parityReport = buildEmailLearningParityReport({
    reconstructed: diagnostics.observations,
    shadow: shadowParse.entries,
    context: {
      mode: diagnostics.preview.mode,
      shadow_fixture: args.shadowFixturePath,
    },
  })

  if (shadowParse.loaded === 0 && !args.fixture && !args.shadowFixturePath) {
    warnings.push("no_shadow_logs_loaded")
  }

  return {
    qa_marker: GROWTH_EMAIL_LEARNING_PARITY_PREVIEW_QA_MARKER,
    mode: diagnostics.preview.mode,
    limit: args.limit,
    reconstruction_summary: buildReconstructionSummary(diagnostics.preview),
    parity_report: parityReport,
    shadow_logs_loaded: shadowParse.loaded,
    shadow_logs_ignored: shadowParse.ignored,
    warnings: [...new Set(warnings)].sort((a, b) => a.localeCompare(b)),
  }
}

async function main(): Promise<void> {
  const output = await runEmailLearningParityPreview(process.argv.slice(2))
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

const isDirectExecution = Boolean(
  process.argv[1]?.endsWith("/email-learning-parity-preview.ts") ||
    process.argv[1]?.endsWith("\\email-learning-parity-preview.ts"),
)
if (isDirectExecution) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
