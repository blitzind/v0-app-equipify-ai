/**
 * Regression checks for email verification provider (Phase A2).
 * Run: pnpm test:growth-email-verification-provider
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  mapZeroBounceStatusToEmailStatus,
  reasonsForZeroBounceResult,
} from "../lib/growth/contact-verification/providers/zerobounce-mapper"
import { resolveZeroBounceValidateUrl } from "../lib/growth/contact-verification/providers/zerobounce-config"
import { isEmailReadyForLeadPromotion } from "../lib/growth/contact-verification/email-verification-types"

assert.equal(mapZeroBounceStatusToEmailStatus({ status: "valid" }), "verified")
assert.equal(mapZeroBounceStatusToEmailStatus({ status: "invalid" }), "invalid")
assert.equal(mapZeroBounceStatusToEmailStatus({ status: "catch-all" }), "risky")
assert.equal(mapZeroBounceStatusToEmailStatus({ status: "unknown" }), "unknown")
assert.equal(mapZeroBounceStatusToEmailStatus({ status: "spamtrap" }), "blocked")
assert.equal(mapZeroBounceStatusToEmailStatus({ status: "abuse" }), "blocked")
assert.equal(mapZeroBounceStatusToEmailStatus({ status: "do_not_mail" }), "blocked")

assert.ok(
  reasonsForZeroBounceResult({ status: "valid", sub_status: "none", mx_found: "true" }).some((r) =>
    r.includes("ZeroBounce"),
  ),
)

assert.equal(isEmailReadyForLeadPromotion({ email_status: "verified", verified_by_provider: true }), true)
assert.equal(isEmailReadyForLeadPromotion({ email_status: "verified", verified_by_provider: false }), false)
assert.equal(isEmailReadyForLeadPromotion({ email_status: "discovered", verified_by_provider: false }), false)
assert.equal(isEmailReadyForLeadPromotion({ email_status: "blocked", verified_by_provider: false }), false)

const typesSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/contact-discovery/company-contact-types.ts"),
  "utf8",
)
assert.match(typesSource, /"blocked"/)

const serviceSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/contact-verification/email-verification-service.ts"),
  "utf8",
)
assert.match(serviceSource, /verifyEmailWithNativeEngine/)
assert.doesNotMatch(serviceSource, /verifyEmailWithZeroBounce/)

const authoritativeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/contact-verification/native-verification-authoritative-service.ts"),
  "utf8",
)
assert.match(authoritativeSource, /assertEmailSendAllowed/)

const zbUrl = resolveZeroBounceValidateUrl("test@example.com", "test-key")
assert.match(zbUrl, /^https:\/\/api(-us|-eu)?\.zerobounce\.net\/v2\/validate/)
assert.ok(zbUrl.includes("email=test%40example.com"))
assert.ok(zbUrl.includes("api_key=test-key"))

const zbClient = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/contact-verification/providers/zerobounce-client.ts"),
  "utf8",
)
assert.match(zbClient, /AbortSignal\.timeout/)

const acquisitionSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/acquisition/promote-verified-contact-to-lead.ts"),
  "utf8",
)
assert.match(acquisitionSource, /not_provider_verified/)
assert.match(acquisitionSource, /email_blocked/)

const GROWTH_COMPANY_CONTACTS_EMAIL_BLOCKED_MIGRATION =
  "20270621121000_growth_engine_company_contacts_email_blocked.sql" as const

const migration = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${GROWTH_COMPANY_CONTACTS_EMAIL_BLOCKED_MIGRATION}`),
  "utf8",
)
assert.match(migration, /blocked/)

console.log("growth-email-verification-provider regression checks passed")
