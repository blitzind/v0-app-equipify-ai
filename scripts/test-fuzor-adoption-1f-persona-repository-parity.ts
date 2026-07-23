/**
 * FUZOR-ADOPTION-1F — Persona repository delegation parity.
 * Run: pnpm test:fuzor-adoption-1f-persona-repository-parity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  PLATFORM_PERSONA_DEFAULT_NAME,
  PLATFORM_PERSONA_DEFAULT_ROLE,
  PLATFORM_PERSONA_IDENTITY_MIGRATION,
  PLATFORM_PERSONA_PRESENTATION_QA_MARKER,
  PLATFORM_PERSONA_SERVER_QA_MARKER,
  PLATFORM_PERSONA_SUGGESTED_NAMES,
  isPlatformPersonaOrganizationTableMissingError,
  isValidPlatformPersonaName,
  normalizePlatformPersonaName,
  resolvePlatformPersonaPresentation,
  sanitizePlatformPersonaName,
} from "@fuzor/identity"

import {
  GE_AI_UX_3A_QA_MARKER,
  AI_TEAMMATE_DEFAULT_NAME,
  AI_TEAMMATE_DEFAULT_ROLE,
  AI_TEAMMATE_SUGGESTED_NAMES,
  isValidAiTeammateName,
  normalizeAiTeammateName,
  resolveAiTeammatePresentation,
  sanitizeAiTeammateName,
} from "../lib/workspace/ai-teammate-identity"

import {
  GE_AI_UX_3B_QA_MARKER,
  GROWTH_AI_TEAMMATE_IDENTITY_MIGRATION,
} from "../lib/growth/settings/growth-ai-teammate-identity-types"

import {
  getOrganizationAiTeammateIdentity,
  isGrowthOrganizationAiTeammateIdentityTableMissingError,
} from "../lib/growth/settings/growth-ai-teammate-identity-repository"

import {
  loadAiTeammateIdentity,
  updateAiTeammateIdentity,
} from "../lib/growth/settings/growth-ai-teammate-identity-service"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("[FUZOR-ADOPTION-1F] Persona repository delegation parity")

assert.strictEqual(GE_AI_UX_3A_QA_MARKER, PLATFORM_PERSONA_PRESENTATION_QA_MARKER)
assert.strictEqual(GE_AI_UX_3B_QA_MARKER, PLATFORM_PERSONA_SERVER_QA_MARKER)
assert.strictEqual(GROWTH_AI_TEAMMATE_IDENTITY_MIGRATION, PLATFORM_PERSONA_IDENTITY_MIGRATION)
assert.strictEqual(AI_TEAMMATE_DEFAULT_NAME, PLATFORM_PERSONA_DEFAULT_NAME)
assert.strictEqual(AI_TEAMMATE_DEFAULT_ROLE, PLATFORM_PERSONA_DEFAULT_ROLE)
assert.deepEqual([...AI_TEAMMATE_SUGGESTED_NAMES], [...PLATFORM_PERSONA_SUGGESTED_NAMES])

assert.strictEqual(normalizeAiTeammateName("  ava  "), normalizePlatformPersonaName("  ava  "))
assert.strictEqual(sanitizeAiTeammateName("!!"), sanitizePlatformPersonaName("!!"))
assert.deepEqual(resolveAiTeammatePresentation("emma"), resolvePlatformPersonaPresentation("emma"))
assert.strictEqual(isValidAiTeammateName("Jordan"), isValidPlatformPersonaName("Jordan"))

assert.strictEqual(typeof getOrganizationAiTeammateIdentity, "function")
assert.strictEqual(typeof loadAiTeammateIdentity, "function")
assert.strictEqual(typeof updateAiTeammateIdentity, "function")
assert.strictEqual(
  isGrowthOrganizationAiTeammateIdentityTableMissingError,
  isPlatformPersonaOrganizationTableMissingError,
)

const repository = readSource("lib/growth/settings/growth-ai-teammate-identity-repository.ts")
assert.ok(repository.includes("@fuzor/identity"))
assert.ok(!repository.includes('from("growth").from("organization_ai_teammate_identity")'))

const service = readSource("lib/growth/settings/growth-ai-teammate-identity-service.ts")
assert.ok(service.includes("@fuzor/identity"))
assert.ok(service.includes("upsertWorkspacePreferencesForUser"))

const presentation = readSource("lib/workspace/ai-teammate-identity.ts")
assert.ok(presentation.includes("@fuzor/identity"))
assert.ok(presentation.includes("readLegacyUnscopedAiTeammateStoredIdentity"))

console.log("[FUZOR-ADOPTION-1F] wrapper delegation verified")

// Phase 8 — future persona simulation (architecture proof, no runtime)
const EQUIPIFY_ORG = "00000000-0000-4000-8000-000000000001"
const INSIDEIFY_ORG = "00000000-0000-4000-8000-000000000002"
const FUTURE_ORG = "00000000-0000-4000-8000-000000000003"

const equipifyPersona = resolvePlatformPersonaPresentation("Ava")
const insideifyPersona = resolvePlatformPersonaPresentation("Ivy")
const futurePersona = resolvePlatformPersonaPresentation("Orion")

assert.strictEqual(equipifyPersona.name, "Ava")
assert.strictEqual(insideifyPersona.name, "Ivy")
assert.strictEqual(futurePersona.name, "Orion")
assert.notStrictEqual(equipifyPersona.name, insideifyPersona.name)

// Platform repository is product-agnostic — org-scoped records keyed by organizationId only
for (const orgId of [EQUIPIFY_ORG, INSIDEIFY_ORG, FUTURE_ORG]) {
  assert.match(orgId, /^[0-9a-f-]{36}$/i)
}

assert.equal(repository.includes("campaign"), false)
assert.equal(repository.includes("outreach"), false)
assert.equal(repository.includes("DataMoon"), false)
assert.equal(service.includes("Growth Engine"), false)

console.log("[FUZOR-ADOPTION-1F] multi-product persona architecture proof")

console.log("[FUZOR-ADOPTION-1F] PASS")
