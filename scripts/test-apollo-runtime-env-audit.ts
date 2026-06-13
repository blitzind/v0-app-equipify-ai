/**
 * Phase 14.3E — Apollo runtime env audit unit checks.
 */
import assert from "node:assert/strict"
import {
  buildApolloRuntimeEnvAuditReport,
  parseVercelEnvLsProductionKeys,
} from "../lib/growth/apollo/apollo-runtime-env-audit"

const sampleLs = `
 APOLLO_API_KEY                                             Encrypted           Production
 GROWTH_APOLLO_ENRICH_EMAILS                                Encrypted           Production
 GROWTH_APOLLO_ENRICH_EMAILS_ACK                            Encrypted           Production
`

assert.deepEqual(parseVercelEnvLsProductionKeys(sampleLs).sort(), [
  "APOLLO_API_KEY",
  "GROWTH_APOLLO_ENRICH_EMAILS",
  "GROWTH_APOLLO_ENRICH_EMAILS_ACK",
])

const audit = buildApolloRuntimeEnvAuditReport({
  env: {
    GROWTH_APOLLO_ENRICH_EMAILS: "false",
    VERCEL_ENV: "development",
  } as NodeJS.ProcessEnv,
  vercel_env_ls_output: sampleLs,
})

assert.equal(audit.cli_context.enrich_emails_enabled, false)
assert.equal(audit.vercel_platform.keys_listed_on_production.includes("APOLLO_API_KEY"), true)

console.log("Apollo runtime env audit checks passed.")
