/**
 * AVA-GROWTH-HOTFIX-1F-1B — Home summary resilience certification.
 * Run: pnpm test:ava-growth-hotfix-1f-1b-home-summary-resilience
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

export const AVA_GROWTH_HOTFIX_1F_1B_QA_MARKER = "ava-growth-hotfix-1f-1b-home-summary-resilience-v1" as const

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

async function withFixtureLoaderBudget<T>(input: {
  budgetMs: number
  fn: () => Promise<T>
  fallback: T
}): Promise<{ value: T; timedOut: boolean }> {
  let timedOut = false
  const value = await Promise.race([
    input.fn().catch(() => input.fallback),
    new Promise<T>((resolve) => {
      setTimeout(() => {
        timedOut = true
        resolve(input.fallback)
      }, input.budgetMs)
    }),
  ])
  return { value, timedOut }
}

async function runCertification(): Promise<void> {
  console.log(`[${AVA_GROWTH_HOTFIX_1F_1B_QA_MARKER}] Home summary resilience certification`)

  const hacService = readSource("lib/growth/aios/approvals/growth-human-approval-center-service.ts")
  assert.match(hacService, /skipPortfolioAuthorityHydration/)

  const homeLoader = readSource(
    "lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-loader.ts",
  )
  assert.match(homeLoader, /skipPortfolioAuthorityHydration:\s*true/)

  const summaryService = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  assert.match(summaryService, /GROWTH_HOME_APPROVAL_SNAPSHOT_LOADER_BUDGET_MS/)
  assert.match(summaryService, /GROWTH_HOME_PORTFOLIO_AUTHORITY_LOADER_BUDGET_MS/)
  assert.match(summaryService, /Promise\.all\(\[/)
  assert.match(summaryService, /executive_growth_intelligence/)
  assert.match(summaryService, /canonical_portfolio_authority/)

  const briefingDashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(briefingDashboard, /canonicalPortfolioAuthority/)

  const clientHook = readSource("components/growth/workspace/use-growth-workspace-dashboard.ts")
  assert.match(clientHook, /AbortController/)

  const budgetFallback = await withFixtureLoaderBudget({
    budgetMs: 50,
    fn: () => new Promise<string>(() => {}),
    fallback: null,
  })
  assert.equal(budgetFallback.value, null)
  assert.equal(budgetFallback.timedOut, true)

  const budgetSuccess = await withFixtureLoaderBudget({
    budgetMs: 500,
    fn: async () => "ok",
    fallback: null,
  })
  assert.equal(budgetSuccess.value, "ok")
  assert.equal(budgetSuccess.timedOut, false)

  console.log(`[${AVA_GROWTH_HOTFIX_1F_1B_QA_MARKER}] PASS`)
}

void runCertification()
