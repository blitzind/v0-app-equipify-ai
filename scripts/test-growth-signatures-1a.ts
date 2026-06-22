/**
 * GS-GROWTH-SIGNATURES-1A — signature template rendering tests.
 * Run: pnpm test:growth-signatures-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { appendSignatureToOutboundBody, GROWTH_OUTBOUND_SIGNATURE_INJECTION_POINTS } from "../lib/growth/signatures/signature-injection"
import { GROWTH_OUTBOUND_IDENTITY_CHAIN_QA_MARKER } from "../lib/growth/signatures/outbound-identity-contract"
import { renderSignatureTemplate } from "../lib/growth/signatures/signature-template-render"
import { GROWTH_SENDER_PROFILES_QA_MARKER } from "../lib/growth/signatures/signature-types"

const sample = {
  display_name: "Michael Short",
  title: "Founder",
  email: "mike@equipifyai.com",
  phone: "865-555-0100",
  website: "equipify.ai",
  linkedin_url: "linkedin.com/in/mshort",
}

function testSimpleTemplate() {
  const out = renderSignatureTemplate("simple", sample)
  assert.match(out.text, /Michael Short/)
  assert.match(out.text, /Founder/)
  assert.match(out.text, /865-555-0100/)
  assert.match(out.html, /Michael Short/)
}

function testBrandedTemplate() {
  const out = renderSignatureTemplate("branded", { ...sample, logo_url: "https://cdn.example/logo.png" })
  assert.match(out.html, /img/)
  assert.match(out.text, /Michael Short/)
}

function testMinimalTemplate() {
  const out = renderSignatureTemplate("minimal", sample)
  assert.match(out.text, /^— Michael/m)
  assert.match(out.html, /Michael/)
}

function testHtmlEscaping() {
  const out = renderSignatureTemplate("simple", {
    display_name: "<script>alert(1)</script>",
    title: "CEO",
  })
  assert.ok(!out.html.includes("<script>"))
  assert.match(out.html, /&lt;script&gt;/)
}

function testOutboundInjection() {
  const sig = renderSignatureTemplate("simple", sample)
  const result = appendSignatureToOutboundBody({
    htmlBody: "<p>Hello prospect</p>",
    textBody: "Hello prospect",
    signature: sig,
  })
  assert.equal(result.signatureInjected, true)
  assert.match(result.htmlBody, /Hello prospect/)
  assert.match(result.htmlBody, /Michael Short/)
  assert.match(result.textBody, /--\nMichael Short/)
}

function testInjectionPointsDocumented() {
  assert.ok(GROWTH_OUTBOUND_SIGNATURE_INJECTION_POINTS.length >= 3)
  const repoRoot = process.cwd()
  for (const rel of GROWTH_OUTBOUND_SIGNATURE_INJECTION_POINTS) {
    assert.ok(fs.existsSync(path.join(repoRoot, rel)), `missing injection point file: ${rel}`)
  }
}

function testWorkspaceLiftWiring() {
  const lift = fs.readFileSync(
    path.join(process.cwd(), "lib/settings/workspace-settings-growth-engine-lift.ts"),
    "utf8",
  )
  assert.match(lift, /email-signatures/)
  assert.match(lift, /GrowthEmailSignaturesPanel/)
  assert.equal(resolveLiftKind(lift), "lifted")
}

function resolveLiftKind(source: string): string {
  const match = source.match(/"email-signatures":\s*\{\s*kind:\s*"(\w+)"/)
  return match?.[1] ?? ""
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "simple template text and html", fn: testSimpleTemplate },
  { name: "branded template html", fn: testBrandedTemplate },
  { name: "minimal template", fn: testMinimalTemplate },
  { name: "html escaping", fn: testHtmlEscaping },
  { name: "outbound signature injection", fn: testOutboundInjection },
  { name: "injection points documented", fn: testInjectionPointsDocumented },
  { name: "workspace settings lift wiring", fn: testWorkspaceLiftWiring },
]

let failed = 0
for (const t of tests) {
  try {
    t.fn()
    console.log(`ok\t${t.name}`)
  } catch (e) {
    failed += 1
    console.error(`fail\t${t.name}`)
    console.error(e)
  }
}

if (failed > 0) process.exit(1)
console.log(`\n${GROWTH_SENDER_PROFILES_QA_MARKER} · ${GROWTH_OUTBOUND_IDENTITY_CHAIN_QA_MARKER}`)
console.log(`All ${tests.length} growth-signatures-1a tests passed.`)
