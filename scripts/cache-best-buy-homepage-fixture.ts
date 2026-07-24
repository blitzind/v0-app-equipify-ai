/** One-time cache helper — not part of hotfix-2 proof runtime. */
import { mkdirSync, writeFileSync } from "node:fs"
import { fetchPublicHtmlDocument } from "../lib/growth/research-website-fetch"
import { stripHtmlToPlainText } from "../lib/growth/research-website-html"

async function main(): Promise<void> {
  process.env.GROWTH_RESEARCH_WEBSITE_ENABLED = "true"
  const result = await fetchPublicHtmlDocument("https://bestbuy.com")
  const text = stripHtmlToPlainText(result.body ?? "").trim()
  mkdirSync("scripts/fixtures", { recursive: true })
  writeFileSync("scripts/fixtures/fuzor-ci-gpt-direct-hotfix-2-best-buy-homepage.txt", text)
  console.log(JSON.stringify({ status: result.status, chars: text.length }))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
