/** Email and phone channel classification from public website evidence. Client-safe. */

import type {
  WebsiteEmailClassification,
  WebsitePhoneClassification,
} from "@/lib/growth/contact-discovery/website-extraction-acquisition-types"
import { isDisposableEmailDomain } from "@/lib/growth/import/email-classifiers"
import { parseEmailDomain, parseEmailLocalPart } from "@/lib/growth/import/normalize"

const ROLE_LOCAL = new Set([
  "info",
  "contact",
  "hello",
  "office",
  "admin",
  "team",
  "help",
  "careers",
  "hr",
  "billing",
  "accounts",
  "reception",
])

const SUPPORT_LOCAL = new Set(["support", "help", "service", "customerservice", "customer"])
const SALES_LOCAL = new Set(["sales", "quotes", "quote", "estimates", "estimate"])
const DISPATCH_LOCAL = new Set(["dispatch", "scheduling", "schedule", "routing"])
const BILLING_LOCAL = new Set(["billing", "accounts", "accounting", "ap", "ar", "invoices"])

function phoneDigits(phone: string): string {
  const d = phone.replace(/\D/g, "")
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d
}

export function classifyWebsiteEmail(input: {
  email: string | null | undefined
  pageType?: string | null
  pageText?: string | null
  personName?: string | null
  title?: string | null
}): { classification: WebsiteEmailClassification; confidence: number; evidence: string[] } {
  const email = input.email?.trim().toLowerCase()
  if (!email || !email.includes("@")) {
    return { classification: "unknown", confidence: 0, evidence: [] }
  }

  const local = parseEmailLocalPart(email) ?? ""
  const domain = parseEmailDomain(email) ?? ""
  const evidence: string[] = []

  if (isDisposableEmailDomain(domain)) {
    return { classification: "invalid_disposable", confidence: 0.92, evidence: ["Disposable domain"] }
  }

  if (SUPPORT_LOCAL.has(local)) {
    return { classification: "support_email", confidence: 0.88, evidence: ["Support local-part"] }
  }
  if (SALES_LOCAL.has(local)) {
    return { classification: "sales_email", confidence: 0.88, evidence: ["Sales local-part"] }
  }
  if (DISPATCH_LOCAL.has(local)) {
    return { classification: "dispatch_email", confidence: 0.88, evidence: ["Dispatch local-part"] }
  }
  if (BILLING_LOCAL.has(local)) {
    return { classification: "billing_email", confidence: 0.86, evidence: ["Billing local-part"] }
  }
  if (ROLE_LOCAL.has(local)) {
    evidence.push("Generic role local-part")
    return { classification: local === "info" ? "generic_info_email" : "role_email", confidence: 0.82, evidence }
  }

  const title = (input.title ?? "").toLowerCase()
  if (
    /\b(owner|ceo|president|founder|principal)\b/.test(title) ||
    /\b(owner|ceo|president|founder)\b/.test(local)
  ) {
    evidence.push("Leadership title or local-part")
    return { classification: "owner_leadership_email", confidence: 0.78, evidence }
  }

  const pageText = (input.pageText ?? "").toLowerCase()
  if (pageText.includes("department") || pageText.includes("service department")) {
    evidence.push("Department context on page")
    return { classification: "department_email", confidence: 0.72, evidence }
  }

  if (input.personName && local.includes(".")) {
    const nameParts = input.personName.toLowerCase().split(/\s+/)
    if (nameParts.some((part) => part.length > 2 && local.includes(part))) {
      evidence.push("Email local-part matches person name")
      return { classification: "personal_email", confidence: 0.8, evidence }
    }
  }

  if (local.includes(".") && local.length > 4) {
    evidence.push("Name-shaped email local-part")
    return { classification: "personal_email", confidence: 0.68, evidence }
  }

  return { classification: "role_email", confidence: 0.55, evidence: ["Unclassified public email"] }
}

export function classifyWebsitePhone(input: {
  phone: string | null | undefined
  pageType?: string | null
  pageText?: string | null
  branchName?: string | null
}): { classification: WebsitePhoneClassification; confidence: number; evidence: string[] } {
  const phone = input.phone?.trim()
  if (!phone) return { classification: "unknown", confidence: 0, evidence: [] }

  const digits = phoneDigits(phone)
  const evidence: string[] = []
  const pageText = (input.pageText ?? "").toLowerCase()
  const pageType = (input.pageType ?? "").toLowerCase()

  if (digits.length === 10 && ["800", "888", "877", "866", "855", "844", "833"].includes(digits.slice(0, 3))) {
    return { classification: "toll_free", confidence: 0.9, evidence: ["Toll-free prefix"] }
  }

  if (pageText.includes("dispatch") || pageType.includes("dispatch")) {
    return { classification: "dispatch", confidence: 0.85, evidence: ["Dispatch context on page"] }
  }
  if (pageText.includes("service") || pageType.includes("service")) {
    return { classification: "service", confidence: 0.82, evidence: ["Service context on page"] }
  }
  if (pageText.includes("sales") || pageText.includes("quote")) {
    return { classification: "sales", confidence: 0.82, evidence: ["Sales context on page"] }
  }
  if (pageText.includes("support") || pageText.includes("help desk")) {
    return { classification: "support", confidence: 0.8, evidence: ["Support context on page"] }
  }

  if (input.branchName || pageType.includes("location") || pageType.includes("branch")) {
    evidence.push("Branch or location page context")
    return { classification: "branch_office", confidence: 0.75, evidence }
  }

  if (pageType.includes("contact") || pageText.includes("main office") || pageText.includes("headquarters")) {
    return { classification: "main_office", confidence: 0.78, evidence: ["Contact or HQ context"] }
  }

  if (digits.length === 10 && !digits.startsWith("8")) {
    evidence.push("Standard 10-digit line")
    return { classification: "mobile_possible", confidence: 0.45, evidence }
  }

  return { classification: "unknown", confidence: 0.4, evidence: ["Phone observed without department context"] }
}
