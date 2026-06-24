/**
 * GS-DNS-VERIFICATION-FIX-1A certification probe.
 * Run: GROWTH_LIVE_DNS_VERIFICATION=true node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-growth-live-dns-fix-1a.ts
 */
import assert from "node:assert/strict"
import { normalizeLiveDnsRawResponses, verifyDomainDnsLive } from "../lib/growth/deliverability/live-dns-verifier"

process.env.GROWTH_LIVE_DNS_VERIFICATION = "true"

type Expected = {
  spf: boolean
  dmarc: boolean
  dkim: boolean
  mx: boolean
}

const EXPECTED: Record<string, Expected> = {
  "equipify.ai": { spf: true, dmarc: true, dkim: false, mx: true },
  "equipifyai.com": { spf: true, dmarc: true, dkim: true, mx: true },
  "getequipify.com": { spf: true, dmarc: true, dkim: true, mx: true },
  "goequipify.com": { spf: true, dmarc: true, dkim: true, mx: true },
}

async function main(): Promise<void> {
  const results: Array<Record<string, unknown>> = []

  for (const [domain, expected] of Object.entries(EXPECTED)) {
    const result = await verifyDomainDnsLive({ domain })
    const raw = normalizeLiveDnsRawResponses(result.raw_dns_responses)

    assert.notDeepEqual(raw, {}, `${domain}: raw_dns_responses must not be empty`)
    assert.ok(Array.isArray(raw.root_txt), `${domain}: root_txt must be persisted`)
    assert.ok(Array.isArray(raw.dmarc_txt), `${domain}: dmarc_txt must be persisted`)
    assert.ok(Array.isArray(raw.mx), `${domain}: mx must be persisted`)
    assert.ok(raw.dkim && typeof raw.dkim === "object", `${domain}: dkim must be persisted`)
    assert.ok(Array.isArray(raw.resolver_used), `${domain}: resolver_used must be persisted`)
    assert.ok(Array.isArray(raw.probe_log), `${domain}: probe_log must be persisted`)

    assert.equal(result.check.spf_valid, expected.spf, `${domain} spf_valid`)
    assert.equal(result.check.dmarc_valid, expected.dmarc, `${domain} dmarc_valid`)
    assert.equal(result.check.dkim_valid, expected.dkim, `${domain} dkim_valid`)
    assert.equal(result.check.mx_valid, expected.mx, `${domain} mx_valid`)

    results.push({
      domain,
      spf_valid: result.check.spf_valid,
      dmarc_valid: result.check.dmarc_valid,
      dkim_valid: result.check.dkim_valid,
      mx_valid: result.check.mx_valid,
      verification_error: result.verification_error,
      resolver_used: raw.resolver_used,
      root_txt: raw.root_txt,
      dmarc_txt: raw.dmarc_txt,
      dkim_selector: (raw.dkim as Record<string, unknown>).selector ?? null,
      raw_keys: Object.keys(raw),
    })
  }

  console.log(JSON.stringify({ certification: "GS-DNS-VERIFICATION-FIX-1A", results }, null, 2))
  console.log("GS-DNS-VERIFICATION-FIX-1A certification passed")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
