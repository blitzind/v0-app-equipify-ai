/**
 * GE-AVA-SEARCH-VALIDATION-FIX-1 — Empty-topic b2b draft coercion certification.
 * Run: pnpm test:ge-ava-search-validation-fix-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildDatamoonImportRequestFromAudienceDraft } from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder"
import {
  createDefaultAvaDatamoonAudienceDraft,
  createMinimalAvaDatamoonAudienceDraft,
} from "../lib/growth/ava-home/datamoon/ava-datamoon-sourcing-workbench-types"
import { validateDatamoonAudienceImportRequest } from "../lib/growth/lead-sources/datamoon/datamoon-audience-import-validation"

const PHASE = "GE-AVA-SEARCH-VALIDATION-FIX-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Empty-topic b2b draft coercion certification`)

  const builder = readSource("lib/growth/ava-home/datamoon/ava-datamoon-sourcing-draft-builder.ts")
  assert.match(builder, /requiresTopicIds && topics\.length === 0 \? "advanced_search"/)

  const emptyTopicB2bDraft = createMinimalAvaDatamoonAudienceDraft({
    audienceType: "b2b",
    topics: [],
    customTopic: null,
  })
  const coercedRequest = buildDatamoonImportRequestFromAudienceDraft(emptyTopicB2bDraft)
  assert.equal(coercedRequest.audience_type, "advanced_search")
  assert.equal(coercedRequest.topic_ids, undefined)
  assert.equal(validateDatamoonAudienceImportRequest(coercedRequest).ok, true)

  const b2bWithTopicsDraft = createMinimalAvaDatamoonAudienceDraft({
    audienceType: "b2b",
    topics: ["equipment maintenance software"],
    customTopic: null,
  })
  const b2bRequest = buildDatamoonImportRequestFromAudienceDraft(b2bWithTopicsDraft)
  assert.equal(b2bRequest.audience_type, "b2b")
  assert.deepEqual(b2bRequest.topic_ids, ["equipment maintenance software"])
  assert.equal(validateDatamoonAudienceImportRequest(b2bRequest).ok, true)

  const advancedDraft = createDefaultAvaDatamoonAudienceDraft({
    audienceType: "advanced_search",
    topics: ["equipment maintenance software"],
  })
  const advancedRequest = buildDatamoonImportRequestFromAudienceDraft(advancedDraft)
  assert.equal(advancedRequest.audience_type, "advanced_search")
  assert.equal(advancedRequest.topic_ids, undefined)
  assert.equal(validateDatamoonAudienceImportRequest(advancedRequest).ok, true)

  const customTopicB2bDraft = createMinimalAvaDatamoonAudienceDraft({
    audienceType: "b2b",
    topics: [],
    customTopic: "hvac services",
  })
  const customTopicRequest = buildDatamoonImportRequestFromAudienceDraft(customTopicB2bDraft)
  assert.equal(customTopicRequest.audience_type, "b2b")
  assert.deepEqual(customTopicRequest.topic_ids, ["hvac services"])

  console.log(`[${PHASE}] passed`)
}

void main()
