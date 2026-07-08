/**
 * GE-AIOS-8A-2 — Evidence Engine persistence + approved profile provider certification.
 * Run: pnpm test:ge-aios-8a-2-evidence-engine-persistence
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import type { BusinessProfileRecord } from "../lib/growth/business-profile/business-profile-types"
import {
  buildEvidenceEngineInputHash,
  EVIDENCE_ENGINE_EXTRACTION_VERSION,
  GROWTH_EVIDENCE_ENGINE_QA_MARKER,
  GROWTH_EVIDENCE_ENGINE_SCHEMA_MIGRATION,
  normalizeProviderCollection,
} from "../lib/growth/evidence-engine"
import {
  fetchCachedEvidenceEngineRunByInputHash,
  fetchEvidenceEngineEvidenceByFactKey,
  fetchLatestEvidenceEngineSnapshot,
  persistEvidenceEngineRunBundle,
} from "../lib/growth/evidence-engine/evidence-engine-repository"
import { collectApprovedProfileEvidence } from "../lib/growth/evidence-engine/providers/approved-profile-evidence-provider"
import { runEvidenceEngine } from "../lib/growth/evidence-engine/run-evidence-engine"

const PHASE = "GE-AIOS-8A-2" as const

const SAMPLE_ABOUT_HTML = `<!doctype html><html><head><title>Acme</title><meta name="description" content="Commercial HVAC maintenance across the Midwest." /></head><body><p>Facilities teams rely on Acme for proactive maintenance.</p></body></html>`

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

type Row = Record<string, unknown>

function createMockAdmin() {
  const tables: Record<string, Row[]> = {
    evidence_engine_runs: [],
    evidence_engine_evidence: [],
    evidence_engine_facts: [],
    evidence_engine_contradictions: [],
    evidence_engine_snapshots: [],
  }

  function matchRow(row: Row, filters: Array<{ column: string; value: unknown; op: string }>): boolean {
    return filters.every((filter) => {
      const cell = row[filter.column]
      if (filter.op === "eq") return cell === filter.value
      if (filter.op === "in") return Array.isArray(filter.value) && filter.value.includes(cell)
      return false
    })
  }

  function buildQuery(table: string) {
    const filters: Array<{ column: string; value: unknown; op: string }> = []
    let orderBy: { column: string; ascending: boolean } | null = null
    let limitCount: number | null = null
    let operation: "select" | "insert" | "update" = "select"
    let insertRow: Row | Row[] | null = null
    let updateRow: Row | null = null
    let selected = "*"

    const api = {
      select(columns: string) {
        selected = columns
        return api
      },
      insert(row: Row | Row[]) {
        operation = "insert"
        insertRow = row
        return api
      },
      update(row: Row) {
        operation = "update"
        updateRow = row
        return api
      },
      eq(column: string, value: unknown) {
        filters.push({ column, value, op: "eq" })
        return api
      },
      in(column: string, value: unknown[]) {
        filters.push({ column, value, op: "in" })
        return api
      },
      order(column: string, opts?: { ascending?: boolean }) {
        orderBy = { column, ascending: opts?.ascending !== false }
        return api
      },
      limit(count: number) {
        limitCount = count
        return api
      },
      async single() {
        const result = await api.maybeSingle()
        if (!result.data) {
          return { data: null, error: { message: "not found" } }
        }
        return { data: result.data, error: null }
      },
      async maybeSingle() {
        if (operation === "insert") {
          const rows = Array.isArray(insertRow) ? insertRow : [insertRow ?? {}]
          const inserted = rows.map((row) => ({
            id: (row.id as string | undefined) ?? randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...row,
          }))
          tables[table]!.push(...inserted)
          return { data: inserted[0] ?? null, error: null }
        }

        if (operation === "update") {
          const updated: Row[] = []
          for (const row of tables[table] ?? []) {
            if (matchRow(row, filters)) {
              Object.assign(row, updateRow, { updated_at: new Date().toISOString() })
              updated.push(row)
            }
          }
          return { data: updated[0] ?? null, error: null }
        }

        let rows = (tables[table] ?? []).filter((row) => matchRow(row, filters))
        if (orderBy) {
          rows = [...rows].sort((a, b) => {
            const left = a[orderBy!.column]
            const right = b[orderBy!.column]
            if (left === right) return 0
            if (left == null) return 1
            if (right == null) return -1
            return left > right ? (orderBy!.ascending ? 1 : -1) : orderBy!.ascending ? -1 : 1
          })
        }
        if (limitCount != null) rows = rows.slice(0, limitCount)
        return { data: rows[0] ?? null, error: null }
      },
      then(onFulfilled: (value: { data: Row[] | null; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) {
        void (async () => {
          if (operation === "insert") {
            const rows = Array.isArray(insertRow) ? insertRow : [insertRow ?? {}]
            const inserted = rows.map((row) => ({
              id: (row.id as string | undefined) ?? randomUUID(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...row,
            }))
            tables[table]!.push(...inserted)
            return onFulfilled({ data: inserted, error: null })
          }

          if (operation === "update") {
            const updated: Row[] = []
            for (const row of tables[table] ?? []) {
              if (matchRow(row, filters)) {
                Object.assign(row, updateRow, { updated_at: new Date().toISOString() })
                updated.push(row)
              }
            }
            return onFulfilled({ data: updated, error: null })
          }

          let rows = (tables[table] ?? []).filter((row) => matchRow(row, filters))
          if (orderBy) {
            rows = [...rows].sort((a, b) => {
              const left = a[orderBy!.column]
              const right = b[orderBy!.column]
              if (left === right) return 0
              if (left == null) return 1
              if (right == null) return -1
              return left > right ? (orderBy!.ascending ? 1 : -1) : orderBy!.ascending ? -1 : 1
            })
          }
          if (limitCount != null) rows = rows.slice(0, limitCount)
          return onFulfilled({ data: rows, error: null })
        })().catch(onRejected)
      },
    }

    return api
  }

  return {
    tables,
    admin: {
      schema: () => ({
        from: (table: string) => buildQuery(table),
      }),
    },
  }
}

function mockApprovedProfile(organizationId: string): BusinessProfileRecord {
  const approvedAt = "2026-01-15T12:00:00.000Z"
  return {
    id: "profile-approved-1",
    organizationId,
    status: "approved",
    isActive: true,
    companyName: "Acme Field Services",
    website: "https://acme.example",
    input: {
      companyName: "Acme Field Services",
      website: "https://acme.example",
    },
    profile: {
      company: {
        companyName: "Acme Field Services",
        website: "https://acme.example",
        shortDescription: "Commercial HVAC maintenance and repair.",
        productsServices: ["Preventive maintenance", "Emergency repair"],
        businessModel: "B2B service contracts",
        primaryValueProposition: "Keep facilities HVAC online.",
      },
      idealCustomers: {
        targetIndustries: ["Commercial HVAC", "Facilities management"],
        companySizeRanges: ["11–50"],
        geography: ["Midwest United States"],
        buyerPersonas: ["Facilities Manager"],
        disqualifiers: ["Residential-only"],
      },
      problemsAndTriggers: {
        painPoints: ["Unplanned downtime"],
        buyingTriggers: ["Equipment failures"],
        competitorsAlternatives: ["In-house maintenance"],
        keywords: ["hvac maintenance"],
        negativeKeywords: ["residential"],
      },
      salesAndMarketing: {
        averageDealSize: "$24k ACV",
        salesCycleEstimate: "60 days",
        messagingAngles: ["Reduce downtime"],
        qualificationCriteria: ["Commercial facilities"],
      },
      confidence: {
        score: 0.9,
        assumptions: [],
        missingInformation: [],
      },
    },
    label: "Approved — Ava can use this to guide lead discovery and recommendations.",
    createdBy: null,
    approvedBy: "user-1",
    approvedAt,
    rejectedAt: null,
    createdAt: approvedAt,
    updatedAt: approvedAt,
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Evidence Engine persistence certification`)

  assert.equal(GROWTH_EVIDENCE_ENGINE_QA_MARKER, "ge-aios-8a-2-evidence-engine-v1")
  assert.equal(GROWTH_EVIDENCE_ENGINE_SCHEMA_MIGRATION, "20271002120000_growth_evidence_engine_ge_aios_8a_2.sql")

  const migration = readSource(`supabase/migrations/${GROWTH_EVIDENCE_ENGINE_SCHEMA_MIGRATION}`)
  for (const table of [
    "evidence_engine_runs",
    "evidence_engine_evidence",
    "evidence_engine_facts",
    "evidence_engine_contradictions",
    "evidence_engine_snapshots",
  ]) {
    assert.ok(migration.includes(table), `migration must create ${table}`)
  }
  assert.equal(migration.includes("create table if not exists growth.organization_business_profiles"), false)
  assert.equal(migration.includes("alter table growth.organization_business_profiles"), false)

  const approvedProfile = mockApprovedProfile("org-8a2")
  const approvedOutput = await collectApprovedProfileEvidence({
    admin: {} as import("@supabase/supabase-js").SupabaseClient,
    organizationId: approvedProfile.organizationId,
    loadApprovedProfile: async () => approvedProfile,
  })

  assert.ok(approvedOutput.raw_items.length > 0)
  assert.equal(approvedOutput.provider, "approved_profile")
  assert.ok(approvedOutput.raw_items.every((item) => item.decision_tier === "historical_customer"))
  assert.ok(approvedOutput.raw_items.every((item) => item.evidence_type === "approved_profile"))

  const normalizedApproved = normalizeProviderCollection(approvedOutput)
  for (const fact of normalizedApproved.facts) {
    assert.ok(fact.supporting_evidence_ids.length > 0)
  }

  const { admin } = createMockAdmin()
  const websiteCollection = normalizeProviderCollection({
    organization_id: "org-8a2",
    provider: "website",
    raw_items: (
      await import("../lib/growth/evidence-engine/providers/website-business-extractor")
    ).extractBusinessEvidenceFromHtml({
      html: SAMPLE_ABOUT_HTML,
      pageUrl: "https://acme.example",
      pageType: "homepage",
    }),
    warnings: [],
    diagnostics: {},
  })

  const mergedFacts = [...normalizedApproved.facts, ...websiteCollection.facts]
  const mergedEvidence = [...normalizedApproved.evidence, ...websiteCollection.evidence]

  const inputHash = buildEvidenceEngineInputHash({
    organizationId: "org-8a2",
    websiteUrl: "https://acme.example",
    providers: ["website", "approved_profile"],
    extractionVersion: EVIDENCE_ENGINE_EXTRACTION_VERSION,
    approvedProfileId: approvedProfile.id,
    approvedProfileUpdatedAt: approvedProfile.approvedAt,
  })

  const persisted = await persistEvidenceEngineRunBundle(admin as import("@supabase/supabase-js").SupabaseClient, {
    organization_id: "org-8a2",
    trigger: "initial",
    input_hash: inputHash,
    extraction_version: EVIDENCE_ENGINE_EXTRACTION_VERSION,
    website_url: "https://acme.example",
    providers: ["website", "approved_profile"],
    evidence: mergedEvidence,
    facts: mergedFacts,
    contradictions: [],
    warnings: [],
    diagnostics: { test: true },
  })

  assert.ok(persisted.run_id)
  assert.ok(persisted.snapshot_id)

  const snapshot = await fetchLatestEvidenceEngineSnapshot(
    admin as import("@supabase/supabase-js").SupabaseClient,
    "org-8a2",
  )
  assert.ok(snapshot)
  assert.equal(snapshot?.organization_id, "org-8a2")
  assert.ok(snapshot!.snapshot.facts.length > 0)
  assert.ok(snapshot!.snapshot.evidence.length > 0)

  const cachedRun = await fetchCachedEvidenceEngineRunByInputHash(
    admin as import("@supabase/supabase-js").SupabaseClient,
    { organization_id: "org-8a2", input_hash: inputHash },
  )
  assert.ok(cachedRun)
  assert.equal(cachedRun?.input_hash, inputHash)

  const factEvidence = await fetchEvidenceEngineEvidenceByFactKey(
    admin as import("@supabase/supabase-js").SupabaseClient,
    { organization_id: "org-8a2", fact_key: "company.description", run_id: persisted.run_id },
  )
  assert.ok(factEvidence.length > 0)

  let providerCallCount = 0
  const firstRun = await runEvidenceEngine({
    admin: admin as import("@supabase/supabase-js").SupabaseClient,
    organizationId: "org-8a2",
    trigger: "initial",
    websiteUrl: "https://acme.example",
    providers: ["website", "approved_profile"],
    persist: true,
    forceRefresh: true,
    deps: {
      collectWebsiteEvidence: async () => {
        providerCallCount += 1
        return {
          organization_id: "org-8a2",
          provider: "website",
          raw_items: (
            await import("../lib/growth/evidence-engine/providers/website-business-extractor")
          ).extractBusinessEvidenceFromHtml({
            html: SAMPLE_ABOUT_HTML,
            pageUrl: "https://acme.example",
            pageType: "homepage",
          }),
          warnings: [],
          diagnostics: {},
        }
      },
      collectApprovedProfileEvidence: async () => {
        providerCallCount += 1
        return approvedOutput
      },
      getActiveApprovedBusinessProfile: async () => approvedProfile,
      fetchCachedEvidenceEngineRunByInputHash,
      fetchLatestEvidenceEngineSnapshot,
      persistEvidenceEngineRunBundle,
    },
  })

  assert.equal(firstRun.persisted, true)
  assert.ok(firstRun.run_id)
  assert.ok(firstRun.snapshot_id)
  assert.equal(firstRun.cached, false)
  assert.ok(providerCallCount >= 2)

  providerCallCount = 0
  const cachedResult = await runEvidenceEngine({
    admin: admin as import("@supabase/supabase-js").SupabaseClient,
    organizationId: "org-8a2",
    trigger: "initial",
    websiteUrl: "https://acme.example",
    providers: ["website", "approved_profile"],
    persist: true,
    deps: {
      collectWebsiteEvidence: async () => {
        providerCallCount += 1
        throw new Error("should not re-crawl on cache hit")
      },
      collectApprovedProfileEvidence: async () => {
        providerCallCount += 1
        throw new Error("should not reload profile on cache hit")
      },
      getActiveApprovedBusinessProfile: async () => approvedProfile,
      fetchCachedEvidenceEngineRunByInputHash,
      fetchLatestEvidenceEngineSnapshot,
      persistEvidenceEngineRunBundle,
    },
  })

  assert.equal(cachedResult.cached, true)
  assert.equal(cachedResult.run_id, firstRun.run_id)
  assert.equal(cachedResult.snapshot_id, firstRun.snapshot_id)
  assert.equal(providerCallCount, 0)

  const forbiddenFragments = [
    "runProspectResearch",
    "runGrowthLeadResearch",
    "runAvaResearchQueueOrchestrator",
    "lead-inbox",
    "projectApprovedBusinessProfileToLeadDiscovery",
    "datamoon",
  ]

  for (const file of [
    "lib/growth/evidence-engine/run-evidence-engine.ts",
    "lib/growth/evidence-engine/providers/approved-profile-evidence-provider.ts",
    "lib/growth/evidence-engine/evidence-engine-repository.ts",
  ]) {
    const source = readSource(file)
    for (const fragment of forbiddenFragments) {
      assert.equal(source.includes(fragment), false, `${file} must not reference ${fragment}`)
    }
    assert.doesNotMatch(source, /\.update\([\s\S]*organization_business_profiles|organization_business_profiles[\s\S]*\.update\(/)
  }

  const approvedProviderSource = readSource(
    "lib/growth/evidence-engine/providers/approved-profile-evidence-provider.ts",
  )
  assert.equal(approvedProviderSource.includes(".update("), false)
  assert.equal(approvedProviderSource.includes(".insert("), false)

  console.log(`[${PHASE}] certification passed`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
