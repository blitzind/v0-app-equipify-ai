/** Persistent technology + competitor signal detection. Client-safe. */

import type {
  RawEvidenceSourceCandidate,
  RawGrowthSignalCandidate,
} from "@/lib/growth/company-growth-signals/company-growth-signal-types"

type TechRule = {
  name: string
  patterns: RegExp[]
  competitor?: boolean
  modern?: boolean
  legacy?: boolean
}

const TECH_RULES: TechRule[] = [
  { name: "ServiceTitan", patterns: [/servicetitan/i], competitor: true },
  { name: "Housecall Pro", patterns: [/housecallpro|housecall\.pro/i], competitor: true },
  { name: "Jobber", patterns: [/jobber/i], competitor: true },
  { name: "FieldPulse", patterns: [/fieldpulse/i], competitor: true },
  { name: "QuickBooks", patterns: [/quickbooks|intuit/i], modern: true },
  { name: "Salesforce", patterns: [/salesforce/i], modern: true },
  { name: "HubSpot", patterns: [/hubspot|hs-scripts|hsforms/i], modern: true },
  { name: "Zoho", patterns: [/zoho/i], modern: true },
  { name: "Microsoft Dynamics", patterns: [/dynamics\.com|microsoft dynamics/i], modern: true },
  { name: "Online booking", patterns: [/schedule\s*online|book\s*online|online\s*booking|acuityscheduling|calendly/i], modern: true },
  { name: "Customer portal", patterns: [/customer\s*portal|client\s*portal|pay\s*bill\s*online/i], modern: true },
  { name: "Payment portal", patterns: [/payment\s*portal|pay\s*online|stripe|squareup/i], modern: true },
]

function excerpt(text: string, max = 240): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max)
}

export function detectTechStackSignals(input: {
  pageUrl: string
  html: string
  plainText: string
}): { evidence: RawEvidenceSourceCandidate[]; signals: RawGrowthSignalCandidate[] } {
  const haystack = `${input.html}\n${input.plainText}`
  const evidence: RawEvidenceSourceCandidate[] = []
  const signals: RawGrowthSignalCandidate[] = []
  const detected: string[] = []

  for (const rule of TECH_RULES) {
    const hit = rule.patterns.find((pattern) => pattern.test(haystack))
    if (!hit) continue
    const match = haystack.match(hit)
    detected.push(rule.name)
    evidence.push({
      source_type: "tech_stack",
      source_url: input.pageUrl,
      confidence_score: 78,
      evidence_excerpt: excerpt(match?.[0] ?? rule.name),
      metadata: { technology: rule.name },
    })

    if (rule.competitor) {
      signals.push({
        signal_type: "competitor_detected",
        confidence_score: 80,
        source_type: "tech_stack",
        source_url: input.pageUrl,
        evidence_excerpt: `${rule.name} detected on website`,
        metadata: { competitor: rule.name, classification: "competitor_present" },
      })
    } else {
      signals.push({
        signal_type: "technology_change",
        confidence_score: 72,
        source_type: "tech_stack",
        source_url: input.pageUrl,
        evidence_excerpt: `${rule.name} indicator observed`,
        metadata: {
          technology: rule.name,
          classification: rule.modern ? "modern_stack" : rule.legacy ? "legacy_stack" : "upgrade_opportunity",
        },
      })
    }
  }

  if (detected.length >= 2) {
    signals.push({
      signal_type: "buying_intent",
      confidence_score: 65,
      source_type: "tech_stack",
      source_url: input.pageUrl,
      evidence_excerpt: `Multiple technology indicators: ${detected.slice(0, 3).join(", ")}`,
      metadata: { technologies: detected },
    })
  }

  return { evidence, signals }
}

export function classifyTechStackSummary(detectedCompetitors: string[]): {
  competitor_present: boolean
  modern_stack: boolean
  upgrade_opportunity: boolean
} {
  return {
    competitor_present: detectedCompetitors.length > 0,
    modern_stack: detectedCompetitors.length === 0,
    upgrade_opportunity: detectedCompetitors.some((name) =>
      ["ServiceTitan", "Housecall Pro", "Jobber", "FieldPulse"].includes(name),
    ),
  }
}
