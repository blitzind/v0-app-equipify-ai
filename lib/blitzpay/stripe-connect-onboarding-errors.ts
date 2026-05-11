import Stripe from "stripe"
import { BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES } from "@/lib/blitzpay/connect-onboarding-client-messages"

/** Client-safe `error` field for BlitzPay Connect onboarding APIs. */
export type BlitzPayConnectOnboardingErrorCode = keyof typeof BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES

export type BlitzPayConnectOnboardingStage =
  | "stripe_client_init"
  | "accounts_create"
  | "accounts_retrieve"
  | "account_link_create"
  | "org_persist"

export type NormalizedConnectOnboardingFailure = {
  code: BlitzPayConnectOnboardingErrorCode
  /** Safe for JSON responses to browsers. */
  userMessage: string
  /** HTTP status for the API route. */
  httpStatus: number
}

export function userMessageForConnectOnboardingCode(code: BlitzPayConnectOnboardingErrorCode): string {
  return BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES[code]
}

function isStripeError(err: unknown): err is Stripe.errors.StripeError {
  return err instanceof Stripe.errors.StripeError
}

function messageLooksLikeConnectRestriction(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("temporarily restricted") ||
    m.includes("suspicious activity") ||
    m.includes("unable to create this type of connected account") ||
    m.includes("cannot create connected accounts") ||
    m.includes("restricted your ability to create")
  )
}

/**
 * Maps Stripe SDK errors (and a few non-Stripe config errors) to safe client codes + copy.
 * Raw Stripe fields must only appear in {@link logBlitzPayConnectOnboardingFailure}.
 */
export function normalizeConnectOnboardingStripeError(
  err: unknown,
  stage: BlitzPayConnectOnboardingStage,
): NormalizedConnectOnboardingFailure {
  if (isStripeError(err)) {
    if (err instanceof Stripe.errors.StripeRateLimitError || err.statusCode === 429) {
      return {
        code: "connect_rate_limited",
        userMessage: BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES.connect_rate_limited,
        httpStatus: 429,
      }
    }
    if (err instanceof Stripe.errors.StripeConnectionError) {
      return {
        code: "connect_unavailable",
        userMessage: BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES.connect_unavailable,
        httpStatus: 503,
      }
    }
    if (err instanceof Stripe.errors.StripeAuthenticationError) {
      return {
        code: "connect_configuration_error",
        userMessage: BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES.connect_configuration_error,
        httpStatus: 503,
      }
    }
    if (err instanceof Stripe.errors.StripePermissionError) {
      return {
        code: "connect_verification_required",
        userMessage: BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES.connect_verification_required,
        httpStatus: 403,
      }
    }
    if (messageLooksLikeConnectRestriction(err.message)) {
      return {
        code: "connect_temporarily_restricted",
        userMessage: BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES.connect_temporarily_restricted,
        httpStatus: 503,
      }
    }
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      if (messageLooksLikeConnectRestriction(err.message)) {
        return {
          code: "connect_temporarily_restricted",
          userMessage: BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES.connect_temporarily_restricted,
          httpStatus: 503,
        }
      }
      return {
        code: "connect_unknown_error",
        userMessage: BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES.connect_unknown_error,
        httpStatus: 502,
      }
    }
    if (err.statusCode != null && err.statusCode >= 500) {
      return {
        code: "connect_unavailable",
        userMessage: BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES.connect_unavailable,
        httpStatus: 503,
      }
    }
    return {
      code: "connect_unknown_error",
      userMessage: BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES.connect_unknown_error,
      httpStatus: 502,
    }
  }

  if (stage === "stripe_client_init") {
    return {
      code: "connect_configuration_error",
      userMessage: BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES.connect_configuration_error,
      httpStatus: 503,
    }
  }

  return {
    code: "connect_unknown_error",
    userMessage: BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES.connect_unknown_error,
    httpStatus: 502,
  }
}

export type BlitzPayConnectOnboardingFailureLog = {
  source: "blitzpay_connect_onboarding"
  stage: BlitzPayConnectOnboardingStage
  organizationId: string
  userId: string | null
  /** Normalized category (same as API `error` field). */
  category: BlitzPayConnectOnboardingErrorCode
  stripeType: string | null
  stripeCode: string | null
  stripeRequestId: string | null
  stripeStatusCode: number | null
  stripeMessage: string | null
  vercelEnv: string | undefined
  nodeEnv: string | undefined
  ts: string
}

export function buildBlitzPayConnectOnboardingFailureLog(args: {
  stage: BlitzPayConnectOnboardingStage
  organizationId: string
  userId: string | null
  normalizedCode: BlitzPayConnectOnboardingErrorCode
  err: unknown
}): BlitzPayConnectOnboardingFailureLog {
  const stripe = isStripeError(args.err) ? args.err : null
  return {
    source: "blitzpay_connect_onboarding",
    stage: args.stage,
    organizationId: args.organizationId,
    userId: args.userId,
    category: args.normalizedCode,
    stripeType: stripe?.type ?? null,
    stripeCode: stripe?.code ?? null,
    stripeRequestId: stripe?.requestId ?? null,
    stripeStatusCode: stripe?.statusCode ?? null,
    stripeMessage: stripe?.message ?? (args.err instanceof Error ? args.err.message : String(args.err)),
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
    ts: new Date().toISOString(),
  }
}

/** Structured server log — never send this object to the client. */
export function logBlitzPayConnectOnboardingFailure(log: BlitzPayConnectOnboardingFailureLog): void {
  console.error(JSON.stringify(log))
}
