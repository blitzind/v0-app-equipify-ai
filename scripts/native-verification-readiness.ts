/**
 * GE-EI-IMP-5D — native verification readiness CLI.
 *
 * Fixture mode (CI-safe):
 *   pnpm test:growth-native-verification-evidence
 *
 * Shadow log file:
 *   pnpm growth:native-verification-readiness -- --shadow-file=./logs.json
 *
 * Preview report file:
 *   pnpm growth:native-verification-readiness -- --preview-file=./preview.json
 *
 * Stdin (NDJSON shadow logs):
 *   cat logs.ndjson | pnpm growth:native-verification-readiness -- --stdin
 */

import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"
import {
  buildNativeVerificationEvidenceFixtures,
  buildNativeVerificationEvidenceFromPreviewReport,
  buildNativeVerificationEvidenceSummary,
  GROWTH_NATIVE_VERIFICATION_EVIDENCE_QA_MARKER,
  type NativeVerificationEvidenceSummary,
} from "../lib/growth/contact-verification/native-verification-evidence"
import {
  GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_PREVIEW_QA_MARKER,
  parseNativeEmailVerificationShadowLogText,
  type NativeEmailVerificationShadowPreviewReport,
} from "../lib/growth/contact-verification/native-email-verification-shadow-aggregation"

export {
  aggregateNativeVerificationEvidence,
  assertNativeVerificationEvidenceHasNoPlaintextEmails,
  buildNativeVerificationEvidenceFixtures,
  buildNativeVerificationEvidenceFromPreviewReport,
  buildNativeVerificationEvidenceSummary,
  computeNativeVerificationReadinessScore,
  deriveNativeVerificationRecommendation,
  GROWTH_NATIVE_VERIFICATION_EVIDENCE_QA_MARKER,
} from "../lib/growth/contact-verification/native-verification-evidence"

export type NativeVerificationReadinessParsedArgs = {
  fixture: boolean
  shadowFilePath: string | null
  previewFilePath: string | null
  stdin: boolean
}

export function parseNativeVerificationReadinessArgs(
  argv: string[],
): NativeVerificationReadinessParsedArgs {
  let fixture = false
  let shadowFilePath: string | null = null
  let previewFilePath: string | null = null
  let stdin = false

  for (const arg of argv) {
    if (arg === "--fixture") fixture = true
    if (arg === "--stdin") stdin = true
    if (arg.startsWith("--shadow-file=")) {
      shadowFilePath = arg.slice("--shadow-file=".length).trim() || null
    }
    if (arg.startsWith("--preview-file=")) {
      previewFilePath = arg.slice("--preview-file=".length).trim() || null
    }
  }

  return { fixture, shadowFilePath, previewFilePath, stdin }
}

function isPreviewReport(value: unknown): value is NativeEmailVerificationShadowPreviewReport {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    record.qa_marker === GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_PREVIEW_QA_MARKER &&
    typeof record.summary === "object"
  )
}

export function loadNativeVerificationPreviewReport(
  filePath: string,
): { report: NativeEmailVerificationShadowPreviewReport | null; warnings: string[] } {
  if (!filePath.trim()) {
    return { report: null, warnings: ["preview_file_path_missing"] }
  }

  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) {
    return {
      report: null,
      warnings: [`preview_file_not_found:${path.basename(resolved)}`],
    }
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(resolved, "utf8")) as unknown
    if (!isPreviewReport(parsed)) {
      return { report: null, warnings: ["preview_file_unrecognized"] }
    }
    return { report: parsed, warnings: [] }
  } catch (error) {
    return {
      report: null,
      warnings: [
        `preview_file_read_failed:${error instanceof Error ? error.message : "unknown"}`,
      ],
    }
  }
}

async function readStdinText(): Promise<string> {
  const lines: string[] = []
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    lines.push(line)
  }
  return lines.join("\n")
}

export async function runNativeVerificationReadiness(
  argv: string[],
): Promise<NativeVerificationEvidenceSummary> {
  const args = parseNativeVerificationReadinessArgs(argv)

  if (args.fixture) {
    return buildNativeVerificationEvidenceSummary(buildNativeVerificationEvidenceFixtures())
  }

  if (args.previewFilePath) {
    const loaded = loadNativeVerificationPreviewReport(args.previewFilePath)
    if (!loaded.report) {
      return buildNativeVerificationEvidenceSummary([], { warnings: loaded.warnings })
    }
    const summary = buildNativeVerificationEvidenceFromPreviewReport(loaded.report)
    return {
      ...summary,
      warnings: [...new Set([...summary.warnings, ...loaded.warnings])].sort((a, b) =>
        a.localeCompare(b),
      ),
    }
  }

  let raw = ""
  const warnings: string[] = []

  if (args.shadowFilePath) {
    const resolved = path.resolve(args.shadowFilePath)
    if (!fs.existsSync(resolved)) {
      warnings.push(`shadow_file_not_found:${path.basename(resolved)}`)
    } else {
      try {
        raw = fs.readFileSync(resolved, "utf8")
      } catch (error) {
        warnings.push(
          `shadow_file_read_failed:${error instanceof Error ? error.message : "unknown"}`,
        )
      }
    }
  } else if (args.stdin || !process.stdin.isTTY) {
    raw = await readStdinText()
  } else {
    warnings.push("no_input_source")
    warnings.push("use_fixture_or_shadow_file_or_preview_file_or_stdin")
  }

  const parsed = parseNativeEmailVerificationShadowLogText(raw)
  return buildNativeVerificationEvidenceSummary(parsed.entries, {
    warnings: [...warnings, ...parsed.warnings],
  })
}

async function main(): Promise<void> {
  const output = await runNativeVerificationReadiness(process.argv.slice(2))
  process.stdout.write(`${JSON.stringify(output)}\n`)
}

const isDirectExecution = Boolean(
  process.argv[1]?.endsWith("/native-verification-readiness.ts") ||
    process.argv[1]?.endsWith("\\native-verification-readiness.ts"),
)
if (isDirectExecution) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
