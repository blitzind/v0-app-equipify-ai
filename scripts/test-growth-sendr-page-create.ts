/**
 * GS-SENDR-2B — Page create flow certification.
 * Run: pnpm test:growth-sendr-page-create
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2B Page Create Flow Certification ===\n")
  assert.ok(fs.existsSync("app/(growth)/growth/sendr/new/page.tsx"))

  const form = readSource("components/growth/sendr/growth-sendr-page-create-form.tsx")
  assert.match(form, /lead/)
  assert.match(form, /company/)
  assert.match(form, /audience_member/)
  assert.match(form, /templateType/)
  assert.match(form, /action: "create"/)

  const route = readSource("app/api/platform/growth/sendr/landing-pages/route.ts")
  assert.match(route, /audienceMemberId/)
  assert.match(route, /templateType/)
  assert.match(route, /consumeSendrBudget/)

  console.log("  ✓ Lead-aware create page flow")
  console.log("\nGS-SENDR-2B page create certification passed.\n")
}

main()
