/**
 * Pure helpers for BlitzPay / PostgREST schema drift detection (no `server-only` — safe for scripts).
 */

import { looksLikePostgrestMissingSchemaError as platformLooksLikePostgrestMissingSchemaError } from "@fuzor/observability"

export const BLITZPAY_SCHEMA_DRIFT_PUBLIC_MESSAGE =
  "BlitzPay needs a database update before this section can load."

export const looksLikePostgrestMissingSchemaError = platformLooksLikePostgrestMissingSchemaError
