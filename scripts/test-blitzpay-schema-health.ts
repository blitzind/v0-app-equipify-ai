/**
 * BlitzPay schema health — PostgREST "missing schema" heuristics (no DB required).
 * Run: pnpm test:blitzpay-schema-health
 */
import assert from "node:assert/strict"
import {
  BLITZPAY_SCHEMA_DRIFT_PUBLIC_MESSAGE,
  looksLikePostgrestMissingSchemaError,
} from "../lib/blitzpay/blitzpay-schema-health-detect"

assert.equal(looksLikePostgrestMissingSchemaError('Could not find the table public.blitzpay_org_settings in the schema cache'), true)
assert.equal(looksLikePostgrestMissingSchemaError('column "blitzpay_last_onboarding_attempt_at" does not exist'), true)
assert.equal(looksLikePostgrestMissingSchemaError('relation "blitzpay_invoice_refunds" does not exist'), true)
assert.equal(looksLikePostgrestMissingSchemaError('duplicate key value violates unique constraint', "23505"), false)
assert.equal(looksLikePostgrestMissingSchemaError('invalid input syntax for uuid', "22P02"), false)
assert.equal(BLITZPAY_SCHEMA_DRIFT_PUBLIC_MESSAGE.includes("database"), true)

console.log("blitzpay schema health tests passed")
