/**
 * GS-SENDR-8A — Production certification & final UX audit orchestrator.
 * Run: pnpm test:growth-sendr-8a-production-cert
 *
 * No commit/push/deploy. Aggregates automated certs + master context + branding audit.
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  growthSendrThemeCssVars,
  resolveGrowthSendrPageTheme,
} from "../lib/growth/sendr/growth-sendr-page-theme"

type CertResult = { id: string; step: string; status: "PASS" | "FAIL" | "SKIP"; detail?: string }

const MASTER_CONTEXT_PHASES = [
  "GS-SENDR-5B",
  "GS-SENDR-6A",
  "GS-SENDR-6B",
  "GS-SENDR-6C",
  "GS-SENDR-7B",
  "GS-SHARE-7B",
  "Floating AI Coach Safe Area",
  "Operator-Facing Copy Cleanup",
  "video_page_url",
] as const

const CERT_COMMANDS: Array<{ id: string; step: string; cmd: string }> = [
  { id: "mc-phases", step: "Step 1 — Master context phases", cmd: "" },
  { id: "floating-safe-area", step: "Step 5 — AIden safe area", cmd: "pnpm test:growth-floating-safe-area" },
  { id: "sendr-7b", step: "Step 4 — Theme QA (Sendr 7B)", cmd: "pnpm test:growth-sendr-7b-theme-ux" },
  { id: "share-7b", step: "Step 4 — Theme QA (Share 7B)", cmd: "pnpm test:growth-share-pages-7b-theme-ux" },
  { id: "builder-ux", step: "Step 5 — Builder UX", cmd: "pnpm test:growth-sendr-builder-ux" },
  { id: "presentation-ux", step: "Step 2 — Presentation UX", cmd: "pnpm test:growth-sendr-presentation-ux" },
  { id: "operator-copy", step: "Step 7 — Branding audit", cmd: "pnpm test:growth-sendr-operator-copy" },
  { id: "sequence-bridge", step: "Step 2 — Sequence bridge", cmd: "pnpm test:growth-sendr-sequence-bridge" },
  { id: "url-delivery", step: "Step 3 — Tokenized URLs", cmd: "pnpm test:growth-sendr-personalized-url-delivery" },
  { id: "branding-alignment", step: "Step 7 — Branding alignment", cmd: "pnpm test:growth-sendr-branding-alignment" },
  { id: "public-pages", step: "Step 3 — Public runtime", cmd: "pnpm test:growth-sendr-public-pages" },
  { id: "slug-runtime", step: "Step 3 — Slug runtime", cmd: "pnpm test:growth-sendr-slug-runtime" },
  { id: "public-personalization", step: "Step 3 — Tokenized runtime", cmd: "pnpm test:growth-sendr-public-personalization" },
  { id: "visitor-personalization", step: "Step 3 — Visitor personalization", cmd: "pnpm test:growth-sendr-visitor-personalization" },
  { id: "engagement-events", step: "Step 3 — Analytics events", cmd: "pnpm test:growth-sendr-engagement-events" },
  { id: "publish-flow", step: "Step 2 — Publish flow", cmd: "pnpm test:growth-sendr-publish-flow" },
  { id: "page-create", step: "Step 2 — Page create", cmd: "pnpm test:growth-sendr-page-create" },
  { id: "page-detail", step: "Step 2 — Page detail", cmd: "pnpm test:growth-sendr-page-detail" },
  { id: "booking-runtime", step: "Step 3 — Booking runtime", cmd: "pnpm test:growth-sendr-booking-runtime" },
  { id: "video-runtime", step: "Step 3/6 — Video runtime", cmd: "pnpm test:growth-sendr-video-runtime" },
  { id: "video-workflow", step: "Step 6 — Video workflow", cmd: "pnpm test:growth-sendr-video-workflow" },
  { id: "share-builder", step: "Step 2 — Share Pages builder", cmd: "pnpm test:growth-share-pages-builder" },
  { id: "share-pages", step: "Step 2 — Share Pages core", cmd: "pnpm test:growth-share-pages" },
  { id: "runtime-guardrails", step: "Step 8 — Runtime guardrails (5B)", cmd: "pnpm test:growth-runtime-guardrails" },
  { id: "hot-prospects", step: "Step 3 — Activity hot prospects", cmd: "pnpm test:growth-sendr-hot-prospects" },
  { id: "timeline-intel", step: "Step 3 — Timeline intelligence", cmd: "pnpm test:growth-sendr-timeline-intelligence" },
  { id: "legacy-redirect", step: "Step 3 — Legacy redirect", cmd: "" },
  { id: "theme-combos", step: "Step 4 — Theme combinations", cmd: "" },
  { id: "builder-breakpoints", step: "Step 5 — Builder breakpoints", cmd: "" },
  { id: "branding-grep", step: "Step 7 — Branding grep audit", cmd: "" },
]

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function runShell(cmd: string): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 10 * 1024 * 1024 })
    return { ok: true, output }
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    const output = [err.stdout ?? "", err.stderr ?? "", err.message ?? ""].filter(Boolean).join("\n")
    return { ok: false, output }
  }
}

function verifyMasterContextPhases(): CertResult {
  const manual = readSource("lib/admin/master-context.manual.before.md")
  const missing = MASTER_CONTEXT_PHASES.filter((phase) => !manual.includes(phase))
  if (missing.length > 0) {
    return { id: "mc-phases", step: "Step 1 — Master context phases", status: "FAIL", detail: `Missing: ${missing.join(", ")}` }
  }
  for (const file of [
    "lib/admin/master-context.manual.generated.ts",
    "lib/admin/master-context.generated.ts",
    "lib/admin/master-context.ts",
  ]) {
    if (!fs.existsSync(file)) {
      return { id: "mc-phases", step: "Step 1 — Master context phases", status: "FAIL", detail: `Missing ${file}` }
    }
  }
  return { id: "mc-phases", step: "Step 1 — Master context phases", status: "PASS" }
}

function verifyLegacyRedirect(): CertResult {
  const legacy = readSource("app/sendr/[slug]/page.tsx")
  assert.match(legacy, /redirect\(/)
  assert.match(legacy, /GROWTH_PERSONALIZED_VIDEOS_PUBLIC_PATH/)
  assert.match(legacy, /searchParams/)
  assert.match(legacy, /params\.set\(key, value\)/)
  return { id: "legacy-redirect", step: "Step 3 — Legacy redirect", status: "PASS" }
}

function verifyThemeCombinations(): CertResult {
  const combos = [
    { label: "dark header + light page", theme: { headerBackground: "#07111f", headerText: "#fff", pageBackground: "#f8fafc", pageText: "#0f172a", buttonBackground: "#f59e0b", buttonText: "#111827" } },
    { label: "dark header + dark page", theme: { headerBackground: "#07111f", headerText: "#fff", pageBackground: "#0f172a", pageText: "#e2e8f0", buttonBackground: "#f59e0b", buttonText: "#111827" } },
    { label: "light header + dark page", theme: { headerBackground: "#f8fafc", headerText: "#0f172a", pageBackground: "#0f172a", pageText: "#e2e8f0", buttonBackground: "#38bdf8", buttonText: "#0f172a" } },
    { label: "light header + light page", theme: { headerBackground: "#ffffff", headerText: "#0f172a", pageBackground: "#f1f5f9", pageText: "#334155", buttonBackground: "#2563eb", buttonText: "#ffffff" } },
  ]

  for (const combo of combos) {
    const resolved = resolveGrowthSendrPageTheme({ theme: combo.theme })
    const vars = growthSendrThemeCssVars(resolved)
    assert.ok(vars["--sendr-page-bg"], `${combo.label}: missing page bg var`)
    assert.ok(vars["--sendr-header-bg"], `${combo.label}: missing header bg var`)
    assert.ok(vars["--sendr-button-bg"], `${combo.label}: missing button bg var`)
  }
  return { id: "theme-combos", step: "Step 4 — Theme combinations", status: "PASS", detail: "4/4 combos resolve CSS vars" }
}

function verifyBuilderBreakpoints(): CertResult {
  const preview = readSource("components/growth/sendr/builder/growth-sendr-builder-live-preview.tsx")
  assert.match(preview, /desktop|tablet|mobile/i)
  assert.match(preview, /sticky|top-/i)

  const shell = readSource("components/growth/shell/growth-workspace-shell.tsx")
  assert.match(shell, /GROWTH_AIDEN_SAFE_AREA/)

  const publish = readSource("components/growth/sendr/builder/growth-sendr-builder-publish-panel.tsx")
  assert.match(publish, /Ready to send/)

  const shareBuilder = readSource("components/growth/share-pages/growth-share-page-builder.tsx")
  assert.match(shareBuilder, /GrowthSharePageBrandingFields|GrowthSharePageAiDraftPanel/)

  return {
    id: "builder-breakpoints",
    step: "Step 5 — Builder breakpoints",
    status: "PASS",
    detail: "Device toggles + safe area + publish panel present (manual 1440/1280/1024/768/mobile QA still recommended)",
  }
}

function auditBrandingGrep(): CertResult {
  const operatorUiRoots = ["components/growth", "app/(growth)", "app/(admin)/admin/growth"]
  const issues: string[] = []

  function scanDir(dir: string): void {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) scanDir(full)
      else if (/\.(tsx|ts)$/.test(entry.name)) {
        const src = fs.readFileSync(full, "utf8")
        if (/\bSENDR\b/.test(src)) issues.push(`${full}: SENDR`)
        if (/\bSendr\b/.test(src) && !full.includes("SendrPublic")) issues.push(`${full}: Sendr`)
        if (/\{\{sendr_page_url\}\}/.test(src)) issues.push(`${full}: {{sendr_page_url}} in UI`)
      }
    }
  }

  for (const root of operatorUiRoots) scanDir(root)

  if (issues.length > 0) {
    return { id: "branding-grep", step: "Step 7 — Branding grep audit", status: "FAIL", detail: issues.slice(0, 8).join("; ") }
  }
  return { id: "branding-grep", step: "Step 7 — Branding grep audit", status: "PASS", detail: "No operator/customer SENDR copy in growth UI roots" }
}

function main(): void {
  console.log("\n=== GS-SENDR-8A Production Certification & Final UX Audit ===\n")

  const results: CertResult[] = []

  results.push(verifyMasterContextPhases())
  results.push(verifyLegacyRedirect())
  results.push(verifyThemeCombinations())
  results.push(verifyBuilderBreakpoints())
  results.push(auditBrandingGrep())

  for (const cert of CERT_COMMANDS) {
    if (results.some((r) => r.id === cert.id)) continue
    if (!cert.cmd) continue
    process.stdout.write(`  → ${cert.id}… `)
    const { ok, output } = runShell(cert.cmd)
    if (ok) {
      console.log("PASS")
      results.push({ id: cert.id, step: cert.step, status: "PASS" })
    } else {
      console.log("FAIL")
      const tail = output.split("\n").slice(-6).join(" ").slice(0, 240)
      results.push({ id: cert.id, step: cert.step, status: "FAIL", detail: tail || "command failed" })
    }
  }

  const pass = results.filter((r) => r.status === "PASS").length
  const fail = results.filter((r) => r.status === "FAIL").length

  console.log("\n--- Pass/Fail Matrix ---")
  for (const r of results) {
    const line = `[${r.status}] ${r.id} — ${r.step}${r.detail ? ` (${r.detail})` : ""}`
    console.log(line)
  }

  console.log(`\nSummary: ${pass} PASS, ${fail} FAIL, ${results.length} total\n`)

  if (fail > 0) {
    console.error("GS-SENDR-8A certification completed with failures.\n")
    process.exit(1)
  }

  console.log("GS-SENDR-8A automated certification passed.\n")
  console.log("Manual QA still required: browser operator workflows, visual theme contrast, responsive breakpoints.\n")
}

main()
