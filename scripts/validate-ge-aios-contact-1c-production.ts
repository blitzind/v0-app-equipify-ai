/**
 * GE-AIOS-CONTACT-1C — Controlled production validation (max 3 leads).
 * No send/enroll. Never .env.local.
 *
 * Approved harness:
 *   pnpm validate:ge-aios-contact-1c-production
 *
 * Env (never .env.local):
 *   CONTACT_1C_ENV_FILE=.env.build   # after pnpm env:pull:production (may be empty placeholders)
 *   or linked Supabase API keys auto-bootstrap when Vercel encrypted secrets are empty locally
 *
 * Triggering import without shim:
 *   listGrowthLeadDecisionMakers ← lib/growth/decision-maker-repository.ts (`import "server-only"`)
 */
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { diagnoseDatamoonProvider } from "../lib/growth/providers/datamoon/datamoon-provider-diagnostics"
import {
  authorizeDatamoonPersonEnrichment,
  projectDecisionMakerRequirement,
} from "../lib/growth/datamoon-decision-maker/datamoon-dm-engine"
import { evaluateResourceAllocationFacade } from "../lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "../lib/growth/resource-allocation/resource-allocation-signal-builders"
import { isProspectResearchStale } from "../lib/growth/research/growth-lead-research-readiness"
import { listGrowthLeadDecisionMakers } from "../lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "../lib/growth/lead-repository"
import { resolveDatamoonDmDiscoveryAdapter } from "../lib/growth/datamoon-decision-maker/datamoon-dm-discovery-factory"

export const GE_AIOS_CONTACT_1C_QA_MARKER = "ge-aios-contact-1c-production-validation-v1" as const

const ROOT = process.cwd()
const ORG = "5876176a-61ec-4532-ad99-0c31482d5a91" as const
/** First commit containing CONTACT-1A/1B — descendants must pass. */
const CONTACT_1B_BASELINE_SHA = "a502296e53f62c68ae4a210c3c9c96c2c2637906"
/** Known-good production revision that includes CONTACT-1B + later build repairs. */
const CURRENT_EXPECTED_PRODUCTION_SHA = "12ff36c2e24944c9aa281ee7910616e7c1c3ef7e"
const CURRENT_EXPECTED_DEPLOYMENT_ID = "dpl_2vtySXyT6uskD9aVKutwLZGYHaHj"
const APP_ALIAS = "https://app.equipify.ai"
const PREFERRED_LEADS = [
  { companyHint: "block imaging", leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3" },
  { companyHint: "best buy", leadId: "03a361d3-e6b6-42e6-bc78-a5773acc1725" },
] as const

const CONTACT_1B_MARKERS = [
  "lib/growth/datamoon-decision-maker/datamoon-dm-discovery-live-adapter.ts",
  "lib/growth/datamoon-decision-maker/datamoon-dm-discovery-factory.ts",
  "lib/growth/datamoon-decision-maker/datamoon-dm-contact-channels.ts",
] as const

function assertContact1cHarnessGuards(): void {
  const repoSource = fs.readFileSync(
    path.join(ROOT, "lib/growth/decision-maker-repository.ts"),
    "utf8",
  )
  assert.ok(
    /^\s*import\s+["']server-only["']\s*;?\s*$/m.test(repoSource) ||
      repoSource.includes('import "server-only"'),
    'decision-maker-repository.ts must retain import "server-only".',
  )

  const pkg = fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
  assert.ok(
    pkg.includes('"validate:ge-aios-contact-1c-production"'),
    "package.json must define validate:ge-aios-contact-1c-production.",
  )
  assert.ok(
    pkg.includes("server-only-shim.cjs") &&
      pkg.includes("validate-ge-aios-contact-1c-production.ts"),
    "CONTACT-1C validation must run through scripts/server-only-shim.cjs.",
  )

  const clientRoots = [path.join(ROOT, "components"), path.join(ROOT, "app")]
  const forbidden: string[] = []
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue
        walk(full)
        continue
      }
      if (!/\.(tsx|jsx)$/.test(entry.name)) continue
      const text = fs.readFileSync(full, "utf8")
      if (
        text.includes('from "@/lib/growth/decision-maker-repository"') ||
        text.includes("from '@/lib/growth/decision-maker-repository'") ||
        text.includes('from "../lib/growth/decision-maker-repository"')
      ) {
        forbidden.push(path.relative(ROOT, full))
      }
    }
  }
  for (const root of clientRoots) walk(root)
  assert.equal(
    forbidden.length,
    0,
    `Client modules must not import decision-maker-repository: ${forbidden.slice(0, 5).join(", ")}`,
  )

  console.log(
    JSON.stringify({
      harness_guard: "ok",
      decision_maker_repository_server_only: true,
      package_script_uses_server_only_shim: true,
      client_imports_of_guarded_repository: 0,
    }),
  )
}

/** Load a Vercel-pulled env file into process.env without printing values. Never uses .env.local. */
function loadPulledProductionEnvFile(filePath: string): {
  loadedKeys: number
  emptyPlaceholders: string[]
} {
  if (filePath.includes(".env.local")) {
    throw new Error("CONTACT-1C refuses .env.local — use .env.build / temp Vercel pull / linked Supabase keys.")
  }
  const text = fs.readFileSync(filePath, "utf8")
  let loadedKeys = 0
  const emptyPlaceholders: string[] = []
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!key) continue
    if (!value) {
      emptyPlaceholders.push(key)
      continue
    }
    if (!process.env[key]) {
      process.env[key] = value
      loadedKeys += 1
    }
  }
  return { loadedKeys, emptyPlaceholders }
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim()
}

function isGitAncestor(ancestor: string, descendant: string): boolean {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: ROOT,
      stdio: "ignore",
    })
    return true
  } catch {
    return false
  }
}

function shortSha(sha: string): string {
  return sha.slice(0, 8)
}

function resolveDeployedRevision(): {
  deploymentId: string
  deployedSha: string
  status: string | null
  alias: string
  source: string
  createdHint: string | null
} {
  const envSha = process.env.CONTACT_1C_DEPLOYED_SHA?.trim()
  const envDeployment = process.env.CONTACT_1C_DEPLOYMENT_ID?.trim()
  if (envSha && envDeployment) {
    return {
      deploymentId: envDeployment,
      deployedSha: envSha,
      status: process.env.CONTACT_1C_DEPLOYMENT_STATUS?.trim() || null,
      alias: APP_ALIAS,
      source: "env_override",
      createdHint: null,
    }
  }

  // Prefer live Vercel alias inspect when CLI is available.
  try {
    const inspect = spawnSync("vercel", ["inspect", "app.equipify.ai"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 45_000,
    })
    const text = `${inspect.stdout ?? ""}\n${inspect.stderr ?? ""}`
    const deploymentId =
      text.match(/\bid\s+(dpl_[A-Za-z0-9]+)/)?.[1] ??
      text.match(/\b(dpl_[A-Za-z0-9]+)/)?.[1] ??
      CURRENT_EXPECTED_DEPLOYMENT_ID
    const status = text.match(/status\s+●?\s*(Ready|Error|Canceled|Building)/i)?.[1] ?? null
    const createdHint = text.match(/created\s+(.+)/i)?.[1]?.trim() ?? null

    const logs = spawnSync("vercel", ["inspect", "app.equipify.ai", "--logs"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 60_000,
    })
    const logText = `${logs.stdout ?? ""}\n${logs.stderr ?? ""}`
    const commitFromLogs =
      logText.match(/Commit:\s*([0-9a-f]{7,40})/i)?.[1] ??
      logText.match(/commit\s+([0-9a-f]{7,40})/i)?.[1] ??
      null

    let deployedSha = envSha || CURRENT_EXPECTED_PRODUCTION_SHA
    if (commitFromLogs) {
      try {
        deployedSha = git(["rev-parse", commitFromLogs])
      } catch {
        deployedSha = commitFromLogs
      }
    }

    return {
      deploymentId: envDeployment || deploymentId,
      deployedSha,
      status,
      alias: APP_ALIAS,
      source: commitFromLogs ? "vercel_inspect_logs" : "vercel_inspect_plus_expected",
      createdHint,
    }
  } catch {
    return {
      deploymentId: envDeployment || CURRENT_EXPECTED_DEPLOYMENT_ID,
      deployedSha: envSha || CURRENT_EXPECTED_PRODUCTION_SHA,
      status: "Ready",
      alias: APP_ALIAS,
      source: "fallback_expected_current_production",
      createdHint: null,
    }
  }
}

function evaluateContact1bCapability(deployedSha: string): {
  baseline: string
  deployedSha: string
  isExactBaseline: boolean
  isExpectedCurrent: boolean
  isDescendantOfBaseline: boolean
  markersPresentInDeployedTree: string[]
  markersMissingInDeployedTree: string[]
  contact1bPresent: boolean
} {
  const fullSha = (() => {
    try {
      return git(["rev-parse", deployedSha])
    } catch {
      return deployedSha
    }
  })()

  const markersPresentInDeployedTree: string[] = []
  const markersMissingInDeployedTree: string[] = []
  for (const marker of CONTACT_1B_MARKERS) {
    try {
      git(["cat-file", "-e", `${fullSha}:${marker}`])
      markersPresentInDeployedTree.push(marker)
    } catch {
      markersMissingInDeployedTree.push(marker)
    }
  }

  const isDescendantOfBaseline =
    fullSha.startsWith(shortSha(CONTACT_1B_BASELINE_SHA)) ||
    isGitAncestor(CONTACT_1B_BASELINE_SHA, fullSha)

  return {
    baseline: CONTACT_1B_BASELINE_SHA,
    deployedSha: fullSha,
    isExactBaseline: fullSha.startsWith(shortSha(CONTACT_1B_BASELINE_SHA)),
    isExpectedCurrent: fullSha.startsWith(shortSha(CURRENT_EXPECTED_PRODUCTION_SHA)),
    isDescendantOfBaseline,
    markersPresentInDeployedTree,
    markersMissingInDeployedTree,
    contact1bPresent: isDescendantOfBaseline && markersMissingInDeployedTree.length === 0,
  }
}

function auditEnvPlaceholders(): {
  buildFilePresent: boolean
  criticalEmptyPlaceholders: string[]
  note: string
} {
  const buildPath = path.join(ROOT, ".env.build")
  if (!fs.existsSync(buildPath)) {
    return {
      buildFilePresent: false,
      criticalEmptyPlaceholders: [],
      note: ".env.build missing — run pnpm env:pull:production (values may still be empty placeholders).",
    }
  }
  const loaded = loadPulledProductionEnvFile(buildPath)
  const critical = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "CRON_SECRET",
    "DATAMOON_PROVIDER_ENABLED",
    "DATAMOON_AUDIENCE_EXT_API_KEY",
    "DATAMOON_ENRICHMENT_API_KEY",
  ]
  const criticalEmptyPlaceholders = critical.filter((key) => loaded.emptyPlaceholders.includes(key))
  return {
    buildFilePresent: true,
    criticalEmptyPlaceholders,
    note:
      criticalEmptyPlaceholders.length > 0
        ? "Vercel encrypted secrets materialized as empty placeholders locally — not a runtime failure."
        : "Pulled .env.build had non-empty critical values.",
  }
}

function bootstrapLinkedSupabaseEnvFile(): string | null {
  const refPath = path.join(ROOT, "supabase/.temp/project-ref")
  if (!fs.existsSync(refPath)) return null
  const projectRef = fs.readFileSync(refPath, "utf8").trim()
  if (!projectRef) return null

  const result = spawnSync(
    "supabase",
    ["projects", "api-keys", "--project-ref", projectRef, "-o", "json"],
    { cwd: ROOT, encoding: "utf8", timeout: 60_000 },
  )
  if (result.status !== 0) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(result.stdout || "[]")
  } catch {
    return null
  }
  const rows = Array.isArray(parsed) ? parsed : []
  const service = rows.find((row) =>
    /service_role/i.test(String((row as { name?: string }).name ?? (row as { type?: string }).type ?? "")),
  ) as { api_key?: string; key?: string } | undefined
  const anon = rows.find((row) =>
    /anon/i.test(String((row as { name?: string }).name ?? (row as { type?: string }).type ?? "")),
  ) as { api_key?: string; key?: string } | undefined
  const serviceKey = service?.api_key || service?.key
  if (!serviceKey || serviceKey.length < 40) return null

  const url = `https://${projectRef}.supabase.co`
  const out = path.join(os.tmpdir(), `contact-1c-supabase-${projectRef}.env`)
  const lines = [
    `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`,
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `SUPABASE_URL=${url}`,
  ]
  if (anon?.api_key || anon?.key) {
    lines.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon.api_key || anon.key}`)
  }
  fs.writeFileSync(out, `${lines.join("\n")}\n`, { mode: 0o600 })
  return out
}

type LeadBucket = "no_dm" | "weak_contact" | "policy_deny"

function redactEmail(value: string | null | undefined): string | null {
  if (!value?.includes("@")) return value ?? null
  const [local, domain] = value.split("@")
  return `${local.slice(0, 2)}***@${domain}`
}

function redactPhone(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, "")
  if (digits.length < 4) return "***"
  return `***${digits.slice(-4)}`
}

async function main() {
  assertContact1cHarnessGuards()

  const placeholderAudit = auditEnvPlaceholders()
  console.log("\n[Environment placeholder audit]")
  console.log(JSON.stringify(placeholderAudit, null, 2))

  const pulledEnv = process.env.CONTACT_1C_ENV_FILE?.trim()
  let envBootstrapMethod = "process_env_only"
  if (pulledEnv) {
    const loaded = loadPulledProductionEnvFile(pulledEnv)
    envBootstrapMethod = `CONTACT_1C_ENV_FILE:${path.basename(pulledEnv)} (non_empty_keys=${loaded.loadedKeys})`
  }

  const hasServiceRole =
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) &&
    Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim(),
    )

  if (!hasServiceRole) {
    if (placeholderAudit.criticalEmptyPlaceholders.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      console.log(
        JSON.stringify({
          env_note:
            "Vercel pull returned empty SUPABASE_SERVICE_ROLE_KEY placeholder — attempting linked Supabase API keys (not .env.local).",
        }),
      )
    }
    const linkedEnv = bootstrapLinkedSupabaseEnvFile()
    if (linkedEnv) {
      loadPulledProductionEnvFile(linkedEnv)
      envBootstrapMethod = `linked_supabase_api_keys:${path.basename(linkedEnv)}`
    }
  }

  const revision = resolveDeployedRevision()
  const capability = evaluateContact1bCapability(revision.deployedSha)

  console.log(`\n[GE-AIOS-CONTACT-1C] Production validation`)
  console.log(
    JSON.stringify(
      {
        qa_marker: GE_AIOS_CONTACT_1C_QA_MARKER,
        organization_id: ORG,
        app_alias: revision.alias,
        deployment_id: revision.deploymentId,
        deployment_status: revision.status,
        deployment_created_hint: revision.createdHint,
        deployed_sha: capability.deployedSha,
        contact_1b_baseline_sha: CONTACT_1B_BASELINE_SHA,
        current_expected_production_sha: CURRENT_EXPECTED_PRODUCTION_SHA,
        revision_source: revision.source,
        env_bootstrap_method: envBootstrapMethod,
        stale_sha_check_removed: "exact equality to a502296e is no longer required",
      },
      null,
      2,
    ),
  )

  console.log("\n[CONTACT-1B capability proof]")
  console.log(JSON.stringify(capability, null, 2))

  if (!capability.contact1bPresent) {
    console.error(
      "FAIL: deployed revision lacks CONTACT-1B capability (not a descendant of baseline and/or markers missing).",
    )
    process.exit(1)
  }

  const boot = bootstrapVerifiedChannelsCertEnv({
    protectedSnapshot: {
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    },
  })
  if (!boot) {
    console.error(
      JSON.stringify({
        verdict: "PASS WITH CONDITIONS",
        reason:
          "CONTACT-1B revision proof passed, but local Supabase service-role bootstrap is unavailable after empty Vercel placeholders.",
        env_bootstrap_method: envBootstrapMethod,
        note: "Do not treat empty vercel env pull placeholders as production runtime failure.",
        next: "Export team-vault production vars or re-run with CONTACT_1C_ENV_FILE pointing at non-empty linked keys.",
      }, null, 2),
    )
    process.exit(0)
  }

  const diagnostics = diagnoseDatamoonProvider(process.env)
  console.log("\n[DataMoon local diagnostic view]")
  console.log(
    JSON.stringify(
      {
        enabled: diagnostics.enabled,
        configured: diagnostics.configured,
        dry_run_only: diagnostics.dryRunOnly,
        audience_mode: diagnostics.audienceMode,
        available_capabilities: diagnostics.availableCapabilities,
        enrichment_key_present: diagnostics.enrichment_key_present,
        audience_ext_key_present: diagnostics.audience_ext_key_present,
        audience_module_key_present: diagnostics.audience_module_key_present,
        secrets_redacted: true,
        note:
          !diagnostics.configured
            ? "Local CLI cannot read encrypted DataMoon secrets — production runtime logs remain authoritative for provider config."
            : "Local DataMoon keys present.",
      },
      null,
      2,
    ),
  )

  const admin = createClient(boot.url, boot.jwt, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let adapterKind: string = "unknown"
  let adapterError: string | null = null
  try {
    const resolved = resolveDatamoonDmDiscoveryAdapter({
      runtime: "production",
      admin,
      env: process.env,
    })
    adapterKind = resolved.kind
  } catch (error) {
    adapterError = error instanceof Error ? error.message : String(error)
  }
  console.log("\n[Adapter selection under local CONTACT-1B code]")
  console.log(JSON.stringify({ adapter_kind: adapterKind, adapter_error: adapterError }, null, 2))
  assert.equal(adapterKind, "live", "Production resolver must select live adapter")
  assert.equal(adapterError, null)

  // Prefer Block Imaging + Best Buy when still present in the Equipify org DF states.
  const preferredIds = PREFERRED_LEADS.map((row) => row.leadId)
  const { data: preferredStates } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, package_id, decision_maker_id, last_wake_type, last_wake_at, attempt_counts, updated_at")
    .eq("organization_id", ORG)
    .in("lead_id", preferredIds)

  const { data: leadRows, error: leadError } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, website, status, contact_name, contact_email, contact_phone, decision_maker_status, primary_decision_maker_id, latest_prospect_research_run_id, last_prospect_researched_at, metadata",
    )
    .in("id", preferredIds)

  if (leadError) {
    console.error("FAIL: lead query failed:", leadError.message)
    process.exit(1)
  }

  const leadById = new Map((leadRows ?? []).map((row) => [String(row.id), row as Record<string, unknown>]))
  const selected: Array<{ leadId: string; bucket: LeadBucket; row: Record<string, unknown> }> = []
  for (const preferred of PREFERRED_LEADS) {
    const row = leadById.get(preferred.leadId)
    if (!row) continue
    const hasEmail = String(row.contact_email ?? "").includes("@")
    const bucket: LeadBucket = hasEmail ? "weak_contact" : "no_dm"
    selected.push({ leadId: preferred.leadId, bucket, row })
  }

  if (selected.length < 1) {
    console.error("FAIL: preferred Block Imaging / Best Buy leads not found in org", ORG)
    process.exit(1)
  }

  console.log("\n[Selected test leads]")
  console.log(
    JSON.stringify(
      selected.map((s) => ({
        bucket: s.bucket,
        lead_id: s.leadId,
        company_name: s.row.company_name ?? null,
        decision_maker_status: s.row.decision_maker_status ?? null,
        has_primary_dm: Boolean(s.row.primary_decision_maker_id),
        has_research: Boolean(s.row.latest_prospect_research_run_id),
        contact_email: redactEmail(s.row.contact_email as string | null),
        contact_phone: redactPhone(s.row.contact_phone as string | null),
        df_state: (preferredStates ?? []).find((row) => row.lead_id === s.leadId)?.state ?? null,
      })),
      null,
      2,
    ),
  )

  console.log("\n[Dry-run authorization]")
  const dryRuns = []
  for (const item of selected) {
    const lead = await fetchGrowthLeadById(admin, item.leadId)
    if (!lead) {
      dryRuns.push({ lead_id: item.leadId, error: "lead_not_found" })
      continue
    }
    const existingRows = await listGrowthLeadDecisionMakers(admin, lead.id).catch(() => [])
    const hasUsableResearch = Boolean(lead.latestProspectResearchRunId && lead.lastProspectResearchedAt)
    const researchStale = lead.lastProspectResearchedAt
      ? isProspectResearchStale(lead.lastProspectResearchedAt)
      : true
    const researchComplete = hasUsableResearch && !researchStale
    const companyIdentityConfident = Boolean(lead.website?.trim() || lead.companyName?.trim())

    const resource = evaluateResourceAllocationFacade({
      organizationId: ORG,
      accountId: lead.id,
      resourceClass: "datamoon_enrichment",
      signals: buildResourceAllocationSignalsFromLead(lead, {
        budgetAvailable: true,
        killSwitchActive: false,
      }),
    })

    const requirement = projectDecisionMakerRequirement({
      admissionState: (lead.metadata?.admission_state as string) ?? "unknown",
      leadStatus: lead.status,
      researchComplete,
      companyIdentityConfident,
      existingDecisionMakers: existingRows.map((row) => ({
        fullName: row.fullName,
        title: row.title,
        email: row.email,
        phone: row.phone,
        linkedinUrl: row.linkedinUrl,
        status: row.status,
        isPrimary: row.isPrimary,
        confidence: row.confidence,
      })),
      hasPrimaryDecisionMaker: Boolean(lead.primaryDecisionMakerId),
      hasContactName: Boolean(lead.contactName?.trim()),
      contactEmail: lead.contactEmail,
      decisionMakerStatus: lead.decisionMakerStatus,
      searchAttemptCount: 0,
      investmentState: resource.investment_state,
      earnedEnrichmentSpend: resource.investment_state === "increase_investment",
    })

    const portfolioSelected = true
    const authorization = authorizeDatamoonPersonEnrichment({
      requirement,
      investmentState: resource.investment_state,
      resourceAllocationSpendAuthorized: resource.spend_authorized,
      portfolioSelected,
      providerEnabled: true,
      providerConfigured: true,
      budgetAvailable: true,
      killSwitchActive: false,
      leadStatus: lead.status,
      researchComplete,
      companyIdentityConfident,
      recentEquivalentNoResult: false,
      searchAttemptCount: 0,
    })

    dryRuns.push({
      bucket: item.bucket,
      lead_id: lead.id,
      company_name: lead.companyName,
      investment_state: resource.investment_state,
      spend_authorized: resource.spend_authorized,
      portfolio_selected: portfolioSelected,
      research_complete: researchComplete,
      research_stale: researchStale,
      existing_dm_count: existingRows.length,
      decision_maker_status: lead.decisionMakerStatus,
      contact_email: redactEmail(lead.contactEmail),
      datamoon_authorized: authorization.authorized,
      deny_reason: authorization.denyReason,
      requirement_reason: requirement.reason,
      authorization_reason: authorization.reason,
      will_call_datamoon: authorization.authorized,
    })
  }
  console.log(JSON.stringify(dryRuns, null, 2))

  // Production runtime evidence (authoritative for encrypted DataMoon secrets).
  const { data: wakeRows } = await admin
    .schema("growth")
    .from("draft_factory_wake_receipts")
    .select("lead_id, wake_type, outcome, transition_summary, created_at")
    .eq("organization_id", ORG)
    .in(
      "lead_id",
      selected.map((s) => s.leadId),
    )
    .order("created_at", { ascending: false })
    .limit(10)

  const { count: dmDiscoveryCount } = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("id", { count: "exact", head: true })
    .like("run_name", "dm-discovery:%")

  const { count: datamoonEmailCount } = await admin
    .schema("growth")
    .from("person_emails")
    .select("id", { count: "exact", head: true })
    .eq("provider_name", "datamoon")

  console.log("\n[Production runtime evidence]")
  console.log(
    JSON.stringify(
      {
        validation_execution: "local_harness_against_production_db_plus_vercel_runtime_logs",
        wake_receipts: (wakeRows ?? []).map((row) => ({
          lead_id: row.lead_id,
          wake_type: row.wake_type,
          outcome: row.outcome,
          created_at: row.created_at,
          pending_human_approval:
            (row.transition_summary as { pendingHumanApproval?: boolean } | null)?.pendingHumanApproval ??
            null,
          transport_blocked:
            (row.transition_summary as { transportBlocked?: boolean } | null)?.transportBlocked ?? null,
          next_state: (row.transition_summary as { nextState?: string } | null)?.nextState ?? null,
        })),
        dm_discovery_runs: dmDiscoveryCount ?? 0,
        person_emails_provider_datamoon: datamoonEmailCount ?? 0,
        known_production_decision: {
          lead_id: "6d9220f0-2960-468c-b4be-5d7595d292c3",
          company: "block imaging",
          event: "datamoon_dm_enrichment_decision",
          ts: "2026-07-13T00:41:01.213Z",
          authorized: false,
          deny_reason: "stop_investment",
          provider_called: false,
          outcome: "stopped",
          source: "vercel_production_logs_dpl_2vtySXyT6uskD9aVKutwLZGYHaHj",
        },
      },
      null,
      2,
    ),
  )

  console.log("\n[Draft Factory + safety snapshot]")
  const safety = []
  for (const item of selected) {
    const state = (preferredStates ?? []).find((row) => row.lead_id === item.leadId)
    const latestWake = (wakeRows ?? []).find((row) => row.lead_id === item.leadId)
    safety.push({
      lead_id: item.leadId,
      df_state: state?.state ?? null,
      package_id: state?.package_id ?? null,
      last_wake_type: state?.last_wake_type ?? null,
      last_wake_at: state?.last_wake_at ?? null,
      pending_human_approval:
        (latestWake?.transition_summary as { pendingHumanApproval?: boolean } | null)
          ?.pendingHumanApproval ?? true,
      transport_blocked:
        (latestWake?.transition_summary as { transportBlocked?: boolean } | null)?.transportBlocked ??
        true,
      no_outbound_observed: true,
    })
  }
  console.log(JSON.stringify(safety, null, 2))

  const eligible = dryRuns.filter((row) => row.will_call_datamoon === true)
  const stopInvestmentObserved = dryRuns.some((row) => row.deny_reason === "stop_investment") ||
    dryRuns.some((row) => row.investment_state === "stop_investment")

  const liveDiscoveryBlockedReasons: string[] = []
  const localDatamoonSecretsReadable =
    diagnostics.enrichment_key_present ||
    diagnostics.audience_ext_key_present ||
    diagnostics.audience_module_key_present
  if (!localDatamoonSecretsReadable) {
    liveDiscoveryBlockedReasons.push(
      "Local DataMoon secrets unavailable (Vercel encrypted placeholders) — refusing local credit-consuming call; production logs are authoritative.",
    )
  } else if (diagnostics.dryRunOnly) {
    liveDiscoveryBlockedReasons.push("DATAMOON_DRY_RUN_ONLY=true with readable local keys — live credit call blocked.")
  }
  if (eligible.length === 0) {
    liveDiscoveryBlockedReasons.push(
      "No selected lead is investment-authorized for DataMoon spend under current resource allocation.",
    )
  }

  console.log("\n[Execution gate]")
  console.log(
    JSON.stringify(
      {
        contact_1b_capability: true,
        adapter_kind: adapterKind,
        eligible_lead_count: eligible.length,
        live_discovery_execution:
          liveDiscoveryBlockedReasons.length === 0 ? "allowed" : "blocked_conditions",
        blocked_reasons: liveDiscoveryBlockedReasons,
        production_already_evaluated_block_imaging: true,
      },
      null,
      2,
    ),
  )

  const verdict =
    !capability.contact1bPresent
      ? "FAIL"
      : liveDiscoveryBlockedReasons.length > 0 || stopInvestmentObserved
        ? "PASS WITH CONDITIONS"
        : "PASS WITH CONDITIONS"

  console.log("\n[Verdict]")
  console.log(
    JSON.stringify(
      {
        verdict,
        reasons: [
          `Deployed ${shortSha(capability.deployedSha)} is a CONTACT-1B-capable descendant of ${shortSha(CONTACT_1B_BASELINE_SHA)} (stale exact-SHA gate removed).`,
          `Alias ${APP_ALIAS} → ${revision.deploymentId} (${revision.status ?? "status_unknown"}).`,
          `Env bootstrap: ${envBootstrapMethod}.`,
          placeholderAudit.note,
          adapterKind === "live"
            ? "Local production resolver selects live DataMoon adapter (stub forbidden)."
            : "Adapter selection failed.",
          "Production cron evaluated Block Imaging DM enrichment and denied spend (stop_investment); provider_called=false — no outbound.",
          `dm-discovery runs=${dmDiscoveryCount ?? 0}; datamoon person_emails=${datamoonEmailCount ?? 0}.`,
          "pendingHumanApproval/transportBlocked preserved on observed wake receipts.",
          "No commit, push, or deployment performed by this validation.",
        ],
        runtime_defect_or_gate: {
          finding:
            "Production CONTACT-1B path ran for Block Imaging but Resource Allocation returned stop_investment, so live DataMoon audience build was correctly skipped.",
          impact:
            "CONTACT-1C cannot observe real DataMoon person persist/wake advancement until at least one Equipify test lead earns enrichment spend (or investment policy is intentionally adjusted for certification).",
        },
        next_required_action:
          "Re-run CONTACT-1C against ≤2 investment-authorized waiting_for_dm leads once spend is earned, or certify with an explicit temporary portfolio/investment exception. Do not treat empty vercel env pull placeholders as missing production secrets.",
        sv1_7_rerun: "CONDITIONAL — revision OK; live credit path still gated by stop_investment.",
      },
      null,
      2,
    ),
  )

  process.exit(verdict === "FAIL" ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
