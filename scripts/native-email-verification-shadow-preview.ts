/**
 * GE-EI-IMP-5C — offline native vs legacy verification shadow drift preview.
 *
 * Fixture mode (CI-safe):
 *   pnpm test:growth-native-email-verification-shadow-preview
 *
 * File mode:
 *   pnpm growth:native-email-verification-shadow-preview -- --shadow-file=./logs.json
 *
 * Stdin mode (NDJSON):
 *   cat logs.ndjson | pnpm growth:native-email-verification-shadow-preview -- --stdin
 */

import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"
import {
  buildNativeEmailVerificationShadowPreviewFixtures,
  buildNativeEmailVerificationShadowPreviewReport,
  GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_PREVIEW_QA_MARKER,
  parseNativeEmailVerificationShadowLogText,
  type NativeEmailVerificationShadowParseResult,
  type NativeEmailVerificationShadowPreviewReport,
} from "../lib/growth/contact-verification/native-email-verification-shadow-aggregation"

export {
  assertNativeEmailVerificationShadowPreviewHasNoPlaintextEmails,
  aggregateNativeEmailVerificationShadowLogs,
  buildNativeEmailVerificationComparisonTag,
  buildNativeEmailVerificationShadowPreviewFixtures,
  buildNativeEmailVerificationShadowPreviewReport,
  GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_PREVIEW_QA_MARKER,
  parseNativeEmailVerificationShadowLogText,
} from "../lib/growth/contact-verification/native-email-verification-shadow-aggregation"

export type NativeEmailVerificationShadowPreviewParsedArgs = {
  fixture: boolean
  shadowFilePath: string | null
  stdin: boolean
}

export function parseNativeEmailVerificationShadowPreviewArgs(
  argv: string[],
): NativeEmailVerificationShadowPreviewParsedArgs {
  let fixture = false
  let shadowFilePath: string | null = null
  let stdin = false

  for (const arg of argv) {
    if (arg === "--fixture") fixture = true
    if (arg === "--stdin") stdin = true
    if (arg.startsWith("--shadow-file=")) {
      shadowFilePath = arg.slice("--shadow-file=".length).trim() || null
    }
  }

  return { fixture, shadowFilePath, stdin }
}

export function loadNativeEmailVerificationShadowLogFile(
  filePath: string,
): NativeEmailVerificationShadowParseResult {
  if (!filePath.trim()) {
    return { entries: [], loaded: 0, ignored: 0, warnings: ["shadow_file_path_missing"] }
  }

  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) {
    return {
      entries: [],
      loaded: 0,
      ignored: 0,
      warnings: [`shadow_file_not_found:${path.basename(resolved)}`],
    }
  }

  try {
    const raw = fs.readFileSync(resolved, "utf8")
    return parseNativeEmailVerificationShadowLogText(raw)
  } catch (error) {
    return {
      entries: [],
      loaded: 0,
      ignored: 0,
      warnings: [
        `shadow_file_read_failed:${error instanceof Error ? error.message : "unknown"}`,
      ],
    }
  }
}

async function readStdinShadowLogs(): Promise<NativeEmailVerificationShadowParseResult> {
  const lines: string[] = []
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    lines.push(line)
  }

  return parseNativeEmailVerificationShadowLogText(lines.join("\n"))
}

export async function runNativeEmailVerificationShadowPreview(
  argv: string[],
): Promise<NativeEmailVerificationShadowPreviewReport> {
  const args = parseNativeEmailVerificationShadowPreviewArgs(argv)
  const extraWarnings: string[] = []

  let mode: NativeEmailVerificationShadowPreviewReport["mode"]
  let parseResult: NativeEmailVerificationShadowParseResult

  if (args.fixture) {
    mode = "fixture"
    const entries = buildNativeEmailVerificationShadowPreviewFixtures()
    parseResult = {
      entries,
      loaded: entries.length,
      ignored: 0,
      warnings: [],
    }
  } else if (args.shadowFilePath) {
    mode = "file"
    parseResult = loadNativeEmailVerificationShadowLogFile(args.shadowFilePath)
  } else if (args.stdin || !process.stdin.isTTY) {
    mode = "stdin"
    parseResult = await readStdinShadowLogs()
  } else {
    mode = "file"
    parseResult = { entries: [], loaded: 0, ignored: 0, warnings: [] }
    extraWarnings.push("no_input_source")
    extraWarnings.push("use_fixture_or_shadow_file_or_stdin")
  }

  if (parseResult.loaded === 0 && mode !== "fixture" && !extraWarnings.includes("no_input_source")) {
    extraWarnings.push("no_shadow_logs_loaded")
  }

  return buildNativeEmailVerificationShadowPreviewReport({
    mode,
    parseResult,
    extraWarnings,
  })
}

async function main(): Promise<void> {
  const output = await runNativeEmailVerificationShadowPreview(process.argv.slice(2))
  process.stdout.write(`${JSON.stringify(output)}\n`)
}

const isDirectExecution = Boolean(
  process.argv[1]?.endsWith("/native-email-verification-shadow-preview.ts") ||
    process.argv[1]?.endsWith("\\native-email-verification-shadow-preview.ts"),
)
if (isDirectExecution) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
