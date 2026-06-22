/**
 * Personalized Videos — operator-facing copy & merge variable certification.
 * Run: pnpm test:growth-sendr-operator-copy
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_LEGACY_SENDR_PAGE_URL_MERGE_TOKEN,
  GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL,
  GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN,
} from "../lib/growth/sendr/growth-sendr-branding"
import {
  GROWTH_SENDR_PAGE_URL_MERGE_TOKEN,
  GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN as CONFIG_VIDEO_TOKEN,
} from "../lib/growth/sendr/growth-sendr-config"
import { applySendrPageUrlMergeFields } from "../lib/growth/sendr/growth-sendr-page-url-merge"
import { buildSendrPagePublicLink } from "../lib/growth/sendr/growth-sendr-slug-runtime"
import { DEFAULT_CONTENT_VARIABLE_SEED } from "../lib/growth/content/variable-registry"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoOperatorFacingSendrCopy(relativePath: string): void {
  const source = readSource(relativePath)
  assert.doesNotMatch(source, /\bSENDR\b/, `${relativePath} must not contain SENDR`)
  assert.doesNotMatch(source, /\bSendr\b/, `${relativePath} must not contain Sendr`)
  assert.doesNotMatch(source, /\{\{sendr_page_url\}\}/, `${relativePath} must not show legacy merge token in UI`)
}

function main(): void {
  console.log("\n=== Personalized Videos Operator Copy Certification ===\n")

  assert.equal(GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN, "{{video_page_url}}")
  assert.equal(CONFIG_VIDEO_TOKEN, "{{video_page_url}}")
  assert.equal(GROWTH_LEGACY_SENDR_PAGE_URL_MERGE_TOKEN, "{{sendr_page_url}}")
  assert.equal(GROWTH_SENDR_PAGE_URL_MERGE_TOKEN, "{{sendr_page_url}}")

  const tokenized = buildSendrPagePublicLink("acme-demo", "https://app.equipify.ai", {
    token: "demo.token",
  })
  assert.match(tokenized, /^https:\/\/app\.equipify\.ai\/videos\/acme-demo\?token=/)

  const legacyResolved = applySendrPageUrlMergeFields(
    `Hi {{first_name}}, ${GROWTH_SENDR_PAGE_URL_MERGE_TOKEN}`,
    tokenized,
  )
  assert.match(legacyResolved, /\/videos\/acme-demo/)
  assert.doesNotMatch(legacyResolved, /\{\{sendr_page_url\}\}/)

  const preferredResolved = applySendrPageUrlMergeFields(
    `Hi {{first_name}}, ${GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN}`,
    tokenized,
  )
  assert.equal(preferredResolved, legacyResolved)

  const dotKeyResolved = applySendrPageUrlMergeFields("Link: {{video.page_url}} and {{sendr.page_url}}", tokenized)
  assert.match(dotKeyResolved, /\/videos\/acme-demo/)
  assert.doesNotMatch(dotKeyResolved, /\{\{video\.page_url\}\}/)

  const videoVar = DEFAULT_CONTENT_VARIABLE_SEED.find((v) => v.variableKey === "video.page_url")
  assert.ok(videoVar)
  assert.equal(videoVar?.label, "Video Page URL")
  assert.match(videoVar?.exampleValue ?? "", /\/videos\//)

  const legacyVar = DEFAULT_CONTENT_VARIABLE_SEED.find((v) => v.variableKey === "sendr.page_url")
  assert.ok(legacyVar)
  assert.match(legacyVar?.label ?? "", /legacy/i)

  const operatorUiFiles = [
    "components/growth/growth-sequence-pattern-builder.tsx",
    "components/growth/sendr/growth-sendr-launch-page-step.tsx",
    "components/growth/audiences/growth-audience-enrollment-wizard.tsx",
    "components/growth/sendr/growth-sendr-launch-preview-step.tsx",
    "components/growth/videos/growth-video-page-create-panel.tsx",
    "components/growth/notifications/growth-notification-center.tsx",
    "app/(growth)/growth/share-pages/templates/page.tsx",
    "app/(admin)/admin/growth/share-pages/templates/page.tsx",
  ]
  for (const file of operatorUiFiles) {
    assertNoOperatorFacingSendrCopy(file)
  }

  const sequenceBuilder = readSource("components/growth/growth-sequence-pattern-builder.tsx")
  assert.match(sequenceBuilder, /GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN/)
  assert.match(sequenceBuilder, /Personalized video sequence bridge/)

  const merge = readSource("lib/growth/sendr/growth-sendr-page-url-merge.ts")
  assert.match(merge, /GROWTH_VIDEO_PAGE_URL_MERGE_TOKEN/)
  assert.match(merge, /GROWTH_SENDR_PAGE_URL_MERGE_TOKEN/)

  const legacyRedirect = readSource("app/sendr/[slug]/page.tsx")
  assert.match(legacyRedirect, /redirect\(/)
  assert.match(legacyRedirect, /GROWTH_PERSONALIZED_VIDEOS_PUBLIC_PATH/)

  console.log("  ✓ {{video_page_url}} preferred in operator UI")
  console.log("  ✓ {{sendr_page_url}} legacy resolution preserved")
  console.log("  ✓ Canonical /videos/[slug] public URLs")
  console.log("\nPersonalized Videos operator copy certification passed.\n")
}

main()
