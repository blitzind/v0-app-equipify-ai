/**
 * FUZOR-ADOPTION-1C — Observability pure helper delegation parity.
 * Run: pnpm test:fuzor-adoption-1c-observability-helper-parity
 */
import assert from "node:assert/strict"

import {
  looksLikePostgrestMissingSchemaError as platformLooksLikePostgrestMissingSchemaError,
  formatPlatformSchemaHealthNotice,
  mergePlatformSchemaHealthSummaries,
  shouldShowPlatformSchemaHealthWarning,
  summarizePlatformSchemaProbeResults,
  type PlatformSchemaHealthSummary,
} from "@fuzor/observability"

import {
  looksLikePostgrestMissingSchemaError,
} from "../lib/blitzpay/blitzpay-schema-health-detect"

import {
  formatGrowthSchemaHealthNotice,
  mergeGrowthSchemaHealthSummaries,
  shouldShowGrowthSchemaHealthWarning,
  summarizeGrowthSchemaProbeResults,
  type GrowthSchemaHealthSummary,
} from "../lib/growth/schema-health/growth-schema-health-types"

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

function restoreEnv(): void {
  if (originalSupabaseUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
  }
}

function assertErrorDetectionParity(message: string, code?: string): void {
  assert.equal(
    looksLikePostgrestMissingSchemaError(message, code),
    platformLooksLikePostgrestMissingSchemaError(message, code),
    `error detection mismatch for message=${JSON.stringify(message)} code=${JSON.stringify(code)}`,
  )
}

function assertThrowsForInvalidMessage(input: unknown): void {
  assert.throws(
    () => looksLikePostgrestMissingSchemaError(input as string),
    /Cannot read properties of null|Cannot read properties of undefined|input\.toLowerCase is not a function|message\.toLowerCase is not a function/,
  )
  assert.throws(
    () => platformLooksLikePostgrestMissingSchemaError(input as string),
    /Cannot read properties of null|Cannot read properties of undefined|input\.toLowerCase is not a function|message\.toLowerCase is not a function/,
  )
}

function assertSummaryParity(
  equipify: GrowthSchemaHealthSummary,
  platform: PlatformSchemaHealthSummary,
  label: string,
): void {
  assert.deepEqual(equipify, platform, `summary mismatch: ${label}`)
}

console.log("[FUZOR-ADOPTION-1C] Observability pure helper delegation parity")

assert.strictEqual(
  looksLikePostgrestMissingSchemaError,
  platformLooksLikePostgrestMissingSchemaError,
)

assertErrorDetectionParity("relation missing", "42P01")
assertErrorDetectionParity("column missing", "42703")
assertErrorDetectionParity("schema cache miss", "PGRST205")
assertErrorDetectionParity("Could not find the table public.foo in the schema cache")
assertErrorDetectionParity('relation "growth_leads" does not exist')
assertErrorDetectionParity('column "lead_score" does not exist')
assertErrorDetectionParity("fetch failed", "ECONNRESET")
assertErrorDetectionParity("permission denied for schema growth", "42501")

const arbitraryError = new Error('relation "growth_leads" does not exist')
assertErrorDetectionParity(arbitraryError.message)

const plainObject = { code: "42P01", message: 'relation "growth_leads" does not exist' }
assertErrorDetectionParity(plainObject.message, plainObject.code)

assertErrorDetectionParity("plain string without schema signal")
assertThrowsForInvalidMessage(null)
assertThrowsForInvalidMessage(undefined)
assertThrowsForInvalidMessage(42)
assertThrowsForInvalidMessage([])

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example-project.supabase.co"

const objects = [
  { table: "growth_leads", columns: ["id"], label: "growth.leads" },
  { table: "growth_contacts", columns: ["id"], label: "growth.contacts" },
]

const noResultsEquipify = summarizeGrowthSchemaProbeResults({
  featureLabel: "Prospect Search",
  objects: [],
  outcomes: [],
})
const noResultsPlatform = summarizePlatformSchemaProbeResults({
  featureLabel: "Prospect Search",
  objects: [],
  outcomes: [],
})
assertSummaryParity(noResultsEquipify, noResultsPlatform, "no results")

const allDetectedEquipify = summarizeGrowthSchemaProbeResults({
  featureLabel: "Prospect Search",
  objects,
  outcomes: ["detected", "detected"],
})
const allDetectedPlatform = summarizePlatformSchemaProbeResults({
  featureLabel: "Prospect Search",
  objects,
  outcomes: ["detected", "detected"],
})
assertSummaryParity(allDetectedEquipify, allDetectedPlatform, "all detected")

const oneMissingEquipify = summarizeGrowthSchemaProbeResults({
  featureLabel: "Prospect Search",
  objects,
  outcomes: ["detected", "missing"],
})
const oneMissingPlatform = summarizePlatformSchemaProbeResults({
  featureLabel: "Prospect Search",
  objects,
  outcomes: ["detected", "missing"],
})
assertSummaryParity(oneMissingEquipify, oneMissingPlatform, "one missing")

const duplicateMissingEquipify = summarizeGrowthSchemaProbeResults({
  featureLabel: "Prospect Search",
  objects: [objects[0]!, objects[0]!],
  outcomes: ["missing", "missing"],
})
const duplicateMissingPlatform = summarizePlatformSchemaProbeResults({
  featureLabel: "Prospect Search",
  objects: [objects[0]!, objects[0]!],
  outcomes: ["missing", "missing"],
})
assertSummaryParity(duplicateMissingEquipify, duplicateMissingPlatform, "duplicate missing")

const uncertainEquipify = summarizeGrowthSchemaProbeResults({
  featureLabel: "Prospect Search",
  objects: [objects[0]!],
  outcomes: ["uncertain"],
})
const uncertainPlatform = summarizePlatformSchemaProbeResults({
  featureLabel: "Prospect Search",
  objects: [objects[0]!],
  outcomes: ["uncertain"],
})
assertSummaryParity(uncertainEquipify, uncertainPlatform, "uncertain")

const missingPlusUncertainEquipify = summarizeGrowthSchemaProbeResults({
  featureLabel: "Prospect Search",
  objects,
  outcomes: ["missing", "uncertain"],
})
const missingPlusUncertainPlatform = summarizePlatformSchemaProbeResults({
  featureLabel: "Prospect Search",
  objects,
  outcomes: ["missing", "uncertain"],
})
assertSummaryParity(missingPlusUncertainEquipify, missingPlusUncertainPlatform, "missing plus uncertain")

const mergedEquipify = mergeGrowthSchemaHealthSummaries([
  oneMissingEquipify,
  uncertainEquipify,
  {
    ready: false,
    verified: false,
    uncertain: false,
    missing_objects: ["growth.accounts"],
    warning_message: "Secondary warning",
    env_hint: "Secondary env hint",
  },
])
const mergedPlatform = mergePlatformSchemaHealthSummaries([
  oneMissingPlatform,
  uncertainPlatform,
  {
    ready: false,
    verified: false,
    uncertain: false,
    missing_objects: ["growth.accounts"],
    warning_message: "Secondary warning",
    env_hint: "Secondary env hint",
  },
])
assertSummaryParity(mergedEquipify, mergedPlatform, "merged summaries")
assert.equal(mergedEquipify.warning_message, oneMissingEquipify.warning_message)
assert.equal(mergedEquipify.env_hint, oneMissingEquipify.env_hint)

assert.equal(shouldShowGrowthSchemaHealthWarning(oneMissingEquipify), true)
assert.equal(shouldShowPlatformSchemaHealthWarning(oneMissingPlatform), true)
assert.equal(
  shouldShowGrowthSchemaHealthWarning(oneMissingEquipify),
  shouldShowPlatformSchemaHealthWarning(oneMissingPlatform),
)
assert.equal(shouldShowGrowthSchemaHealthWarning(allDetectedEquipify), false)
assert.equal(formatGrowthSchemaHealthNotice(allDetectedEquipify), null)
assert.equal(
  formatGrowthSchemaHealthNotice(oneMissingEquipify),
  formatPlatformSchemaHealthNotice(oneMissingPlatform),
)

restoreEnv()

console.log("[FUZOR-ADOPTION-1C] PASS")
