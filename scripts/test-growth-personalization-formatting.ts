/**
 * Hotfix certification — Personalization draft paragraph formatting.
 * Run: pnpm test:growth-personalization-formatting
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  formatPersonalizationDraftBodyForDisplay,
  formatPersonalizationDraftBodyParagraphsForDisplay,
  PERSONALIZATION_DRAFT_MAX_PARAGRAPH_CHARS,
  PERSONALIZATION_DRAFT_MAX_SENTENCES_PER_PARAGRAPH,
  PERSONALIZATION_DRAFT_MOBILE_MAX_CHARS,
} from "@/lib/growth/personalization/growth-personalization-draft-formatting"

const SENTENCE_SPLIT = /(?<=[.!?])\s+/

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function runExistingLineBreaksCert(): void {
  const raw =
    "Opening paragraph stays intact.\n\nSecond block should remain separate.\n\nWould it be worth a quick conversation?"
  const paragraphs = formatPersonalizationDraftBodyParagraphsForDisplay(raw)

  assert.ok(paragraphs.length >= 3)
  assert.match(paragraphs[0]!, /Opening paragraph stays intact/)
  assert.match(paragraphs[1]!, /Second block should remain separate/)
  assert.match(paragraphs[paragraphs.length - 1]!, /Would it be worth/)
  console.log("✓ existing line breaks preserved")
}

function runLongParagraphSplitCert(): void {
  const raw =
    "Hi Nicole, Many biomedical equipment service organizations struggle with PM due dates because legacy systems fragment ownership across facilities, vendors, and compliance teams, which makes it hard to see what is overdue. I noticed you're the President of Sterling Biomedical and thought this might be relevant. Equipify helps teams centralize regulated PM scheduling so operators can trust the next due date. Additionally, teams use it to reduce audit prep time and keep technicians aligned on priority work. However, the rollout only works when leadership commits to one source of truth."
  const paragraphs = formatPersonalizationDraftBodyParagraphsForDisplay(raw)

  assert.ok(paragraphs.length >= 4)
  assert.ok(
    paragraphs.every(
      (paragraph) =>
        paragraph.length <= PERSONALIZATION_DRAFT_MAX_PARAGRAPH_CHARS + 40 ||
        paragraph.split(SENTENCE_SPLIT).filter(Boolean).length <= PERSONALIZATION_DRAFT_MAX_SENTENCES_PER_PARAGRAPH,
    ),
  )
  console.log("✓ long AI paragraphs split for readability")
}

function runCtaIsolationCert(): void {
  const raw =
    "Equipify helps teams centralize regulated PM scheduling. Would it be worth a quick conversation? Happy to send over examples."
  const paragraphs = formatPersonalizationDraftBodyParagraphsForDisplay(raw)

  assert.equal(paragraphs.length, 3)
  assert.match(paragraphs[0]!, /centralize regulated PM scheduling/)
  assert.match(paragraphs[1]!, /\?$/)
  assert.match(paragraphs[2]!, /Happy to send over examples/)
  console.log("✓ CTA sentences isolated")
}

function runBulletsPreservedCert(): void {
  const raw =
    "A few examples:\n\n• Centralized PM scheduling\n- Audit-ready reporting\n1. Technician alignment\n2. Executive visibility\n\nOpen to a 15-minute workflow review?"
  const paragraphs = formatPersonalizationDraftBodyParagraphsForDisplay(raw)

  assert.ok(paragraphs.some((paragraph) => paragraph.startsWith("• Centralized PM scheduling")))
  assert.ok(paragraphs.some((paragraph) => paragraph.startsWith("- Audit-ready reporting")))
  assert.ok(paragraphs.some((paragraph) => paragraph.startsWith("1. Technician alignment")))
  assert.ok(paragraphs.some((paragraph) => paragraph.startsWith("2. Executive visibility")))
  assert.ok(paragraphs.some((paragraph) => /Open to a 15-minute workflow review\?/.test(paragraph)))
  console.log("✓ bullet-style lines preserved")
}

function runNicoleOutreachCert(): void {
  const body =
    "Hi Nicole, many biomedical equipment service organizations often find that PM due dates for patient-connected devices are tracked in spreadsheets that are disconnected from work orders. We noticed that you are the President and Founder of Sterling Biomedical. Equipify helps teams centralize regulated PM scheduling through Maintenance Plans + Equipment. Is service visibility a bottleneck for you right now?"

  const paragraphs = formatPersonalizationDraftBodyParagraphsForDisplay(body)

  assert.equal(paragraphs.length, 4)
  assert.match(paragraphs[0]!, /^Hi Nicole, many biomedical/)
  assert.match(paragraphs[1]!, /^We noticed that you are the President/)
  assert.match(paragraphs[2]!, /^Equipify helps teams centralize/)
  assert.match(paragraphs[3]!, /^Is service visibility a bottleneck/)
  console.log("✓ Nicole outreach fixture — four email paragraphs")
}

function runMichaelStoryCert(): void {
  const body = `Thanks for connecting, Michael. I noticed your team works with hospitals and surgery centers.

Many organizations we speak with struggle to keep preventive maintenance, documentation, and service history organized across technicians and locations.

Because of this, they spend a lot of time chasing information and preparing for audits.

Would it be worth a quick conversation next week?`

  const paragraphs = formatPersonalizationDraftBodyParagraphsForDisplay(body)

  assert.equal(paragraphs.length, 4)
  assert.match(paragraphs[0]!, /Thanks for connecting, Michael/)
  assert.match(paragraphs[1]!, /Many organizations we speak with/)
  assert.match(paragraphs[2]!, /Because of this,/)
  assert.match(paragraphs[3]!, /Would it be worth a quick conversation next week\?/)
  console.log("✓ Michael story — four readable email paragraphs")
}

function runEmbeddedBodySourceCert(): void {
  const previewCard = readSource("components/growth/personalization/embedded/growth-personalization-preview-card.tsx")
  assert.match(previewCard, /summary\.body/)
  assert.doesNotMatch(previewCard, /formatPersonalizationDraftBodyForDisplay/)

  const summaryBuilder = readSource("lib/growth/personalization/embedded/growth-personalization-summary-builder.ts")
  assert.match(summaryBuilder, /body: normalizeSummaryBody/)
  console.log("✓ embedded previews use full body for paragraph formatting")
}

function runRendererSourceCert(): void {
  const previewComponent = readSource("components/growth/personalization/growth-personalization-draft-body-preview.tsx")
  assert.match(previewComponent, /formatPersonalizationDraftBodyParagraphsForDisplay/)
  assert.match(previewComponent, /paragraphs\.map/)
  assert.match(previewComponent, /space-y-5/)
  assert.match(previewComponent, /leading-7/)
  assert.match(previewComponent, /whitespace-pre-wrap/)
  assert.doesNotMatch(previewComponent, /console\.log/)
  assert.doesNotMatch(previewComponent, /formatPersonalizationDraftBodyForDisplay/)

  const draftEditor = readSource("components/growth/personalization/growth-personalization-draft-editor.tsx")
  assert.match(draftEditor, /GrowthPersonalizationDraftBodyPreview/)
  assert.match(draftEditor, /body=\{originalAiDraft\.body\}/)
  assert.match(draftEditor, /body=\{editBody\}/)
  assert.doesNotMatch(draftEditor, /formatPersonalizationDraftBodyForDisplay/)

  const personalizationComponents = [
    "components/growth/personalization/growth-personalization-draft-editor.tsx",
    "components/growth/personalization/embedded/growth-personalization-preview-card.tsx",
    "components/growth/personalization/growth-personalization-version-history.tsx",
  ]
  for (const file of personalizationComponents) {
    assert.doesNotMatch(readSource(file), /<p[^>]*>\{[^}]*body[^}]*\}/)
  }
  console.log("✓ preview renderer maps paragraph arrays — no joined string fallback")
}

function runMobileRenderingCert(): void {
  const raw =
    "Hi Nicole, Many biomedical equipment service organizations struggle with PM due dates. I noticed you're the President of Sterling Biomedical. Equipify helps teams centralize regulated PM scheduling. Would next Tuesday work?"
  const paragraphs = formatPersonalizationDraftBodyParagraphsForDisplay(raw)

  assert.ok(paragraphs.length >= 3)
  assert.ok(
    paragraphs.every(
      (paragraph) =>
        paragraph.startsWith("•") ||
        paragraph.startsWith("-") ||
        /^\d+\./.test(paragraph) ||
        paragraph.length <= PERSONALIZATION_DRAFT_MOBILE_MAX_CHARS + 20 ||
        paragraph.endsWith("?"),
    ),
  )
  console.log("✓ mobile-friendly paragraph sizing")
}

function runNoMutationCert(): void {
  const storedBody =
    "Hi Nicole, Many teams struggle with PM due dates. Equipify centralizes regulated scheduling. Would a quick walkthrough help?"
  const original = storedBody
  const formatted = formatPersonalizationDraftBodyForDisplay(storedBody)

  assert.notEqual(formatted, "")
  assert.equal(storedBody, original)
  assert.ok(formatted.includes("\n\n"))
  console.log("✓ display-only transformation — stored body unchanged")
}

function runTransitionBreakCert(): void {
  const raw =
    "Equipify helps teams centralize regulated PM scheduling. However, rollout only works when leadership commits to one source of truth. As a result, teams see fewer missed due dates."
  const paragraphs = formatPersonalizationDraftBodyParagraphsForDisplay(raw)

  assert.ok(paragraphs.some((paragraph) => paragraph.startsWith("However,")))
  assert.ok(paragraphs.some((paragraph) => paragraph.startsWith("As a result,")))
  console.log("✓ transition phrases start new paragraphs")
}

function main(): void {
  console.log("\n=== Personalization Draft Paragraph Formatting Certification ===\n")

  runExistingLineBreaksCert()
  runNicoleOutreachCert()
  runMichaelStoryCert()
  runLongParagraphSplitCert()
  runCtaIsolationCert()
  runBulletsPreservedCert()
  runMobileRenderingCert()
  runEmbeddedBodySourceCert()
  runRendererSourceCert()
  runNoMutationCert()
  runTransitionBreakCert()

  console.log("\nPersonalization draft paragraph formatting certification passed.\n")
}

main()
