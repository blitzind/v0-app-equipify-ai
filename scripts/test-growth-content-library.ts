/**
 * Regression checks for Template + Snippet System (Phase 2S).
 * Run: pnpm test:growth-content-library
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  canApproveTemplate,
  canSubmitTemplateForReview,
  validateSnippetForApproval,
  validateTemplateForSubmission,
} from "../lib/growth/content/content-approval"
import { renderContentTemplate } from "../lib/growth/content/content-renderer"
import {
  extractContentMergeFields,
  isBlockedContentVariable,
  validateContentMergeFields,
} from "../lib/growth/content/merge-field-validator"
import {
  buildAllowedVariableKeySet,
  buildVariableFallbackMap,
  DEFAULT_CONTENT_VARIABLE_SEED,
} from "../lib/growth/content/variable-registry"
import {
  GROWTH_CONTENT_PRIVACY_NOTE,
  GROWTH_CONTENT_SNIPPET_CATEGORIES,
  GROWTH_CONTENT_STATUSES,
  GROWTH_CONTENT_TEMPLATE_TYPES,
  GROWTH_TEMPLATE_SNIPPET_SYSTEM_QA_MARKER,
  mergeFieldSyntax,
} from "../lib/growth/content/content-types"

const GROWTH_TEMPLATE_SNIPPET_SYSTEM_SCHEMA_MIGRATION =
  "20270424120000_growth_template_snippet_system.sql" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_TEMPLATE_SNIPPET_SYSTEM_QA_MARKER, "growth-template-snippet-system-v1")
  assert.match(GROWTH_CONTENT_PRIVACY_NOTE, /require approval before live send/i)
  assert.match(GROWTH_CONTENT_PRIVACY_NOTE, /no autonomous sending/i)
  assert.match(GROWTH_CONTENT_PRIVACY_NOTE, /no unsafe merge fields/i)
  assert.equal(GROWTH_CONTENT_TEMPLATE_TYPES.length, 7)
  assert.equal(GROWTH_CONTENT_SNIPPET_CATEGORIES.length, 10)
  assert.equal(GROWTH_CONTENT_STATUSES.length, 5)
  assert.equal(DEFAULT_CONTENT_VARIABLE_SEED.length, 9)

  const migration = readSource(`supabase/migrations/${GROWTH_TEMPLATE_SNIPPET_SYSTEM_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.content_templates/)
  assert.match(migration, /growth\.content_template_versions/)
  assert.match(migration, /growth\.content_snippets/)
  assert.match(migration, /growth\.content_snippet_versions/)
  assert.match(migration, /growth\.content_variable_registry/)
  assert.match(migration, /growth\.content_approval_events/)
  assert.match(migration, /sequence_email/)
  assert.match(migration, /compliance_footer/)
  assert.match(migration, /content_template_approved/)
  assert.match(migration, /lead\.company_name/)
  assert.match(migration, /service role only/)

  assert.equal(canSubmitTemplateForReview("draft"), true)
  assert.equal(canApproveTemplate("pending_review"), true)
  assert.equal(canSubmitTemplateForReview("approved"), false)

  assert.equal(isBlockedContentVariable("provider_secret"), true)
  assert.equal(isBlockedContentVariable("raw_token"), true)
  assert.equal(isBlockedContentVariable("lead.company_name"), false)

  const allowedKeys = buildAllowedVariableKeySet(
    DEFAULT_CONTENT_VARIABLE_SEED.map((v, idx) => ({ ...v, id: String(idx) })),
  )
  const body = "Hi {{lead.contact_name}} from {{lead.company_name}} — {{unsubscribe.link}}"
  const validation = validateContentMergeFields({ text: body, allowedKeys })
  assert.equal(validation.valid, true)
  assert.deepEqual(extractContentMergeFields(body), ["lead.contact_name", "lead.company_name", "unsubscribe.link"])

  const blocked = validateContentMergeFields({
    text: "Secret: {{provider_secret}}",
    allowedKeys,
  })
  assert.equal(blocked.valid, false)
  assert.ok(blocked.blockedVariables.includes("provider_secret"))

  const submitCheck = validateTemplateForSubmission({ subject: "Hi", body, allowedKeys })
  assert.equal(submitCheck.ok, true)

  const missingFooter = validateTemplateForSubmission({
    subject: "Hi",
    body: "No footer here",
    allowedKeys,
  })
  assert.equal(missingFooter.ok, false)

  const snippetCheck = validateSnippetForApproval({ content: body, allowedKeys })
  assert.equal(snippetCheck.ok, true)

  const variables = DEFAULT_CONTENT_VARIABLE_SEED.map((v, idx) => ({ ...v, id: String(idx) }))
  const rendered = renderContentTemplate({
    subject: "Hello {{lead.contact_name}}",
    body,
    variables,
    values: { "lead.contact_name": "Alex" },
    complianceFooterRequired: true,
  })
  assert.match(rendered.body, /Alex/)
  assert.ok(rendered.warnings.length >= 0)
  assert.equal(rendered.blockedVariables.length, 0)

  const missing = renderContentTemplate({
    subject: "Hi {{lead.contact_name}}",
    body: "For {{lead.company_name}}",
    variables,
    values: {},
    useExampleValues: false,
  })
  assert.ok(missing.missingVariables.length >= 1)
  assert.match(missing.body, /\[company\]|Acme/)

  assert.equal(mergeFieldSyntax("lead.company_name"), "{{lead.company_name}}")
  assert.ok(buildVariableFallbackMap(variables)["lead.company_name"])

  const routesSource = readSource("app/api/platform/growth/content/templates/route.ts")
  assert.match(routesSource, /requireGrowthEnginePlatformAccess/)
  assert.match(routesSource, /isGrowthContentLibrarySchemaReady/)

  const approveSource = readSource("app/api/platform/growth/content/templates/[id]/approve/route.ts")
  assert.match(approveSource, /humanApprovalConfirmed/)
  assert.match(approveSource, /human_approval_required/)

  const navSource = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
  assert.match(navSource, /content-library/)
  assert.match(navSource, /Content Library/)

  const sequenceSource = readSource("lib/growth/sequences/execution/sequence-send-builder.ts")
  assert.match(sequenceSource, /resolveApprovedTemplateContent/)
  assert.match(sequenceSource, /contentTemplateVersionId/)

  const jobRunnerSource = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
  assert.match(jobRunnerSource, /content_template_version_id/)

  const replySource = readSource("lib/growth/replies/reply-prompt.ts")
  assert.match(replySource, /Content Library/)

  const experimentSource = readSource("lib/growth/experiments/experiment-types.ts")
  assert.match(experimentSource, /contentTemplateVersionId/)

  console.log("growth content library checks passed")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
