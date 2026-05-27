import { createHash } from "node:crypto"
import type { GrowthBounceType } from "@/lib/growth/compliance/compliance-types"

export function hashComplianceEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !normalized.includes("@")) return ""
  const pepper = process.env.GROWTH_COMPLIANCE_EMAIL_PEPPER?.trim() || "growth_compliance_email_pepper_dev_only"
  return createHash("sha256").update(pepper).update("|growth-compliance-email|").update(normalized).digest("hex").slice(0, 40)
}

export function maskEmailHash(emailHash: string): string {
  if (!emailHash) return "—"
  return `${emailHash.slice(0, 8)}…${emailHash.slice(-4)}`
}

export type BounceClassificationInput = {
  providerCode?: string | null
  providerReason?: string | null
  bounceTypeHint?: string | null
}

export type BounceClassificationResult = {
  bounceType: GrowthBounceType
  retryAllowed: boolean
  shouldSuppress: boolean
  summary: string
}

const HARD_PATTERNS = [
  /mailbox unavailable/i,
  /user unknown/i,
  /recipient invalid/i,
  /domain invalid/i,
  /does not exist/i,
  /no such user/i,
  /invalid recipient/i,
  /550/i,
  /551/i,
  /553/i,
  /hard/i,
]

const SOFT_PATTERNS = [
  /temporary/i,
  /rate limit/i,
  /mailbox full/i,
  /try again/i,
  /421/i,
  /450/i,
  /452/i,
  /soft/i,
  /transient/i,
]

const SPAM_PATTERNS = [/complaint/i, /spam/i, /abuse/i, /blocked/i, /blacklist/i]

export function classifyBounce(input: BounceClassificationInput): BounceClassificationResult {
  const text = [input.bounceTypeHint, input.providerCode, input.providerReason].filter(Boolean).join(" ")

  if (SPAM_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      bounceType: "spam",
      retryAllowed: false,
      shouldSuppress: true,
      summary: "Spam or abuse signal detected.",
    }
  }

  if (HARD_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      bounceType: "hard",
      retryAllowed: false,
      shouldSuppress: true,
      summary: "Hard bounce — recipient unavailable or invalid.",
    }
  }

  if (/blocked/i.test(text)) {
    return {
      bounceType: "blocked",
      retryAllowed: false,
      shouldSuppress: true,
      summary: "Recipient blocked delivery.",
    }
  }

  if (SOFT_PATTERNS.some((pattern) => pattern.test(text))) {
    const transient = /transient/i.test(text)
    return {
      bounceType: transient ? "transient" : "soft",
      retryAllowed: true,
      shouldSuppress: false,
      summary: transient ? "Transient delivery failure." : "Soft bounce — retry eligible.",
    }
  }

  const hint = input.bounceTypeHint?.trim().toLowerCase()
  if (hint === "hard" || hint === "spam" || hint === "blocked") {
    return classifyBounce({ ...input, bounceTypeHint: null, providerReason: hint })
  }

  return {
    bounceType: "soft",
    retryAllowed: true,
    shouldSuppress: false,
    summary: "Unclassified bounce — treated as soft.",
  }
}

export function isHardBounceType(bounceType: GrowthBounceType): boolean {
  return bounceType === "hard" || bounceType === "blocked" || bounceType === "spam"
}
