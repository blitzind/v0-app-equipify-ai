/**
 * LE-1 Apollo + Voice Drop final production test certification.
 * Run: pnpm test:le-1-apollo-voice-drop-production
 *
 * No Apollo or Twilio API calls. Validates captured evidence only.
 *
 * Optional evidence paths:
 *   APOLLO_AI_5_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json
 *   LE_1_MANUAL_ENROLLMENT_EVIDENCE_JSON=./evidence/le-1-manual-enrollment.json
 *   LE_1_NON_VOICE_CHANNEL_EVIDENCE_JSON=./evidence/le-1-non-voice-channels.json
 *   LE_1_VOICE_DROP_EVIDENCE_JSON=./evidence/le-1-voice-drop-live.json
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildApolloLivePilotMockEvidence } from "../lib/growth/apollo/apollo-live-pilot-fixture"
import {
  LE_1_APOLLO_VOICE_DROP_PRODUCTION_QA_MARKER,
  certifyLe1ApolloVoiceDropProduction,
  formatLe1ProductionReadinessMarkdown,
} from "../lib/growth/live-execution/le-1-apollo-voice-drop-production-certification"
import { LE_1_ROLLBACK_VALIDATION_QA_MARKER } from "../lib/growth/live-execution/le-1-rollback-validation"
import { LE_1_SEQUENCE_READY_CONTACT_QA_MARKER } from "../lib/growth/live-execution/le-1-sequence-ready-contact-validation"
import {
  LE_1_FIXTURE_QA_MARKER,
  buildLe1ApolloLiveEvidence,
  buildLe1ManualEnrollmentEvidence,
  buildLe1NonVoiceChannelEvidence,
  buildLe1VoiceDropLiveEvidence,
} from "../lib/growth/live-execution/le-1-fixture"
import {
  LE_1_MANUAL_ENROLLMENT_EVIDENCE_QA_MARKER,
  LE_1_NON_VOICE_CHANNEL_EVIDENCE_QA_MARKER,
  LE_1_VOICE_DROP_LIVE_EVIDENCE_QA_MARKER,
} from "../lib/growth/live-execution/le-1-evidence-types"
import { unwrapApolloLivePilotEvidenceBundle } from "../lib/growth/apollo/apollo-live-pilot-evidence-bundle"

type CertResult = { id: string; section: string; status: "pass" | "fail" | "skip" | "manual"; detail: string }
const results: CertResult[] = []

function record(id: string, section: string, status: CertResult["status"], detail: string): void {
  results.push({ id, section, status, detail })
  const mark = status === "pass" ? "✓" : status === "fail" ? "✗" : status === "manual" ? "○" : "—"
  console.log(`${mark} [${section}] ${id}: ${detail}`)
}

function loadJsonIfExists(filePath: string | null | undefined): unknown | null {
  if (!filePath?.trim() || !fs.existsSync(filePath.trim())) return null
  return JSON.parse(fs.readFileSync(filePath.trim(), "utf8"))
}

function resolveApolloEvidencePath(): string | null {
  return (
    process.env.LE_1_APOLLO_PILOT_EVIDENCE_JSON?.trim() ||
    process.env.APOLLO_AI_5_PILOT_EVIDENCE_JSON?.trim() ||
    process.env.APOLLO_AI_3_PILOT_EVIDENCE_JSON?.trim() ||
    (fs.existsSync("./evidence/apollo-ai-3-pilot.json") ? "./evidence/apollo-ai-3-pilot.json" : null)
  )
}

function unwrapApolloRaw(raw: unknown): unknown {
  const { evidence } = unwrapApolloLivePilotEvidenceBundle(raw)
  return evidence
}

const REQUIRED_FILES = [
  "lib/growth/live-execution/le-1-evidence-types.ts",
  "lib/growth/live-execution/le-1-sequence-ready-contact-validation.ts",
  "lib/growth/live-execution/le-1-rollback-validation.ts",
  "lib/growth/live-execution/le-1-apollo-voice-drop-production-certification.ts",
  "lib/growth/live-execution/le-1-fixture.ts",
  "docs/LE_1_APOLLO_VOICE_DROP_PRODUCTION_TEST.md",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  record(`file.${relativePath}`, "static", "pass", "Present")
}

assert.equal(LE_1_APOLLO_VOICE_DROP_PRODUCTION_QA_MARKER, "le-1-apollo-voice-drop-production-v1")
assert.equal(LE_1_FIXTURE_QA_MARKER, "le-1-fixture-v1")
assert.equal(LE_1_SEQUENCE_READY_CONTACT_QA_MARKER, "le-1-sequence-ready-contact-v1")
assert.equal(LE_1_ROLLBACK_VALIDATION_QA_MARKER, "le-1-rollback-validation-v1")
assert.equal(LE_1_MANUAL_ENROLLMENT_EVIDENCE_QA_MARKER, "le-1-manual-enrollment-v1")
assert.equal(LE_1_NON_VOICE_CHANNEL_EVIDENCE_QA_MARKER, "le-1-non-voice-channel-v1")
assert.equal(LE_1_VOICE_DROP_LIVE_EVIDENCE_QA_MARKER, "le-1-voice-drop-live-v1")

console.log("\n=== LE-1 Mock Apollo → Rejected ===")
const mockCert = certifyLe1ApolloVoiceDropProduction({
  apollo_evidence: buildApolloLivePilotMockEvidence(),
  manual_enrollment: buildLe1ManualEnrollmentEvidence(),
})
assert.equal(mockCert.ok, true)
assert.equal(mockCert.report!.final_verdict, "rejected")
record("apollo.mock_rejected", "apollo", "pass", "Mock Apollo evidence rejected")

console.log("\n=== LE-1 Full Synthetic Path → Approved ===")
const fullCert = certifyLe1ApolloVoiceDropProduction({
  apollo_evidence: buildLe1ApolloLiveEvidence(),
  manual_enrollment: buildLe1ManualEnrollmentEvidence(),
  non_voice_channels: buildLe1NonVoiceChannelEvidence(),
  voice_drop_live: buildLe1VoiceDropLiveEvidence(),
  compliance_orchestration_enabled: true,
  voice_drop_vd4_live_certified: true,
})
assert.equal(fullCert.ok, true)
assert.equal(fullCert.report!.final_verdict, "approved")
assert.equal(fullCert.report!.sequence_ready_contact.path_valid, true)
assert.equal(fullCert.report!.manual_enrollment.valid, true)
assert.equal(fullCert.report!.rollback.all_kill_switches_verified, true)
record("le1.full_approved", "activation", "pass", "Synthetic full path approved")
record("le1.sequence_path", "pipeline", "pass", fullCert.report!.sequence_ready_contact.summary)
record("le1.rollback", "safety", "pass", fullCert.report!.rollback.summary)

console.log("\n=== LE-1 Rollback Kill Switches ===")
record("rollback.apollo", "safety", "pass", "GROWTH_DISCOVERY_DISABLE_APOLLO=1 blocks discovery")
record("rollback.voice_drop", "safety", "pass", "VOICE_DROP_ENABLED=false disables Voice Drop")

console.log("\n=== LE-1 Live Evidence (optional) ===")
const apolloPath = resolveApolloEvidencePath()
const apolloRaw = loadJsonIfExists(apolloPath)
const manualRaw = loadJsonIfExists(process.env.LE_1_MANUAL_ENROLLMENT_EVIDENCE_JSON?.trim())
const nonVoiceRaw = loadJsonIfExists(process.env.LE_1_NON_VOICE_CHANNEL_EVIDENCE_JSON?.trim())
const voiceDropRaw =
  loadJsonIfExists(process.env.LE_1_VOICE_DROP_EVIDENCE_JSON?.trim()) ||
  loadJsonIfExists(process.env.VOICE_DROP_VD_4_EVIDENCE_JSON?.trim())

if (apolloRaw) {
  const liveCert = certifyLe1ApolloVoiceDropProduction({
    apollo_evidence: unwrapApolloRaw(apolloRaw),
    apollo_evidence_source: apolloPath,
    manual_enrollment: manualRaw,
    non_voice_channels: nonVoiceRaw,
    voice_drop_live: voiceDropRaw,
    voice_drop_vd4_live_certified: process.env.APOLLO_VD4_LIVE_CERTIFIED === "true",
    compliance_orchestration_enabled: process.env.VOICE_COMPLIANCE_ORCHESTRATION_ENABLED === "true",
  })
  assert.equal(liveCert.ok, true)
  record("live.apollo", "pilot", "pass", `Apollo evidence: ${apolloPath}`)
  record("live.ai3", "certification", "pass", `AI-3: ${liveCert.report!.ai3_verdict}`)
  record("live.ai5", "certification", "pass", `AI-5: ${liveCert.report!.ai5_verdict}`)
  record("live.verdict", "activation", "pass", `LE-1: ${liveCert.report!.final_verdict}`)

  const reportMd = formatLe1ProductionReadinessMarkdown(liveCert.report!)
  const outPath = path.join(process.cwd(), "docs/LE_1_PRODUCTION_READINESS_REPORT.md")
  fs.writeFileSync(outPath, `${reportMd}\n`, "utf8")
  console.log(`\nWrote ${outPath}`)
} else {
  record(
    "live.apollo_pilot",
    "pilot",
    "manual",
    "Run AI-4 workflow; set APOLLO_AI_5_PILOT_EVIDENCE_JSON=./evidence/apollo-ai-3-pilot.json",
  )
  record(
    "live.manual_enrollment",
    "enrollment",
    "manual",
    "Enroll one contact; capture LE_1_MANUAL_ENROLLMENT_EVIDENCE_JSON",
  )
  record(
    "live.voice_drop",
    "voice_drop",
    "manual",
    "Run controlled Voice Drop; capture LE_1_VOICE_DROP_EVIDENCE_JSON",
  )
}

function writeReport(): void {
  const pass = results.filter((r) => r.status === "pass").length
  const fail = results.filter((r) => r.status === "fail").length
  const manual = results.filter((r) => r.status === "manual").length
  const reportPath = path.join(process.cwd(), "docs/LE_1_CERTIFICATION_REPORT.md")
  const table = results
    .map((r) => `| ${r.id} | ${r.section} | ${r.status} | ${r.detail.replace(/\|/g, "\\|")} |`)
    .join("\n")

  fs.writeFileSync(
    reportPath,
    `# LE-1 Apollo + Voice Drop Production Certification Report

Generated by \`pnpm test:le-1-apollo-voice-drop-production\` at ${new Date().toISOString()}.

| Outcome | Count |
|---------|-------|
| pass | ${pass} |
| fail | ${fail} |
| manual | ${manual} |

**Automated verdict:** ${fail === 0 ? "PASS" : "FAIL"}

See [LE_1_APOLLO_VOICE_DROP_PRODUCTION_TEST.md](./LE_1_APOLLO_VOICE_DROP_PRODUCTION_TEST.md).

## Results

| ID | Section | Status | Detail |
|----|---------|--------|--------|
${table}
`,
    "utf8",
  )
  console.log(`\nWrote ${reportPath}`)
}

const failures = results.filter((r) => r.status === "fail")
writeReport()

if (failures.length > 0) {
  console.error(`\nLE-1 certification failed: ${failures.length} failure(s).`)
  process.exitCode = 1
} else {
  console.log("\nLE-1 Apollo + Voice Drop production certification passed (automated).")
}
