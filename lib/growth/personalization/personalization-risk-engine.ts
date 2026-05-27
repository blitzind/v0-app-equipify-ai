import {
  highestRiskLevel,
  type GrowthPersonalizationRiskLevel,
} from "@/lib/growth/personalization/personalization-types"
import type { PersonalizationEvidenceCandidate } from "@/lib/growth/personalization/personalization-evidence-engine"

const COMPLIANCE_PHRASES = [
  "guaranteed",
  "100%",
  "risk-free",
  "act now",
  "limited time",
  "free money",
  "unsubscribe bypass",
]

const AGGRESSIVE_PHRASES = ["you must", "urgent action", "immediate action required", "last chance", "before it's too late"]

const FAKE_FAMILIARITY_PHRASES = [
  "congrats on",
  "i loved your",
  "impressive growth",
  "incredible team",
  "great job on",
  "as we discussed",
  "following up on our call",
]

export type PersonalizationRiskFinding = {
  riskType: string
  severity: GrowthPersonalizationRiskLevel
  title: string
  description: string
}

function includesPhrase(text: string, phrases: string[]): string | null {
  const normalized = text.toLowerCase()
  for (const phrase of phrases) {
    if (normalized.includes(phrase)) return phrase
  }
  return null
}

export function detectPersonalizationRisks(input: {
  subject: string
  body: string
  companyName: string
  evidence: PersonalizationEvidenceCandidate[]
}): PersonalizationRiskFinding[] {
  const combined = `${input.subject}\n${input.body}`
  const findings: PersonalizationRiskFinding[] = []
  const evidenceText = input.evidence.map((entry) => entry.evidenceSnippet.toLowerCase()).join(" ")

  const compliance = includesPhrase(combined, COMPLIANCE_PHRASES)
  if (compliance) {
    findings.push({
      riskType: "compliance_sensitive_phrasing",
      severity: "high",
      title: "Compliance-sensitive phrasing",
      description: `Detected phrase: ${compliance}`,
    })
  }

  const aggressive = includesPhrase(combined, AGGRESSIVE_PHRASES)
  if (aggressive) {
    findings.push({
      riskType: "overly_aggressive_language",
      severity: "medium",
      title: "Overly aggressive language",
      description: `Detected phrase: ${aggressive}`,
    })
  }

  const familiarity = includesPhrase(combined, FAKE_FAMILIARITY_PHRASES)
  if (familiarity && !/meeting|call|discussed|conversation/i.test(evidenceText)) {
    findings.push({
      riskType: "fake_familiarity",
      severity: "high",
      title: "Fake familiarity",
      description: `Claim not supported by evidence: ${familiarity}`,
    })
  }

  const metricMatches = combined.match(/\b\d{1,3}%|\$[\d,]+|\b\d{2,}\s*(employees|users|customers)\b/gi) ?? []
  for (const metric of metricMatches) {
    if (!evidenceText.includes(metric.toLowerCase())) {
      findings.push({
        riskType: "unsupported_metrics",
        severity: "critical",
        title: "Unsupported metric",
        description: `Metric not found in evidence: ${metric}`,
      })
    }
  }

  const companyMentioned = combined.toLowerCase().includes(input.companyName.toLowerCase())
  if (!companyMentioned) {
    findings.push({
      riskType: "unsupported_company_reference",
      severity: "medium",
      title: "Missing company reference",
      description: "Generated copy does not reference the target company.",
    })
  }

  if (input.evidence.length === 0) {
    findings.push({
      riskType: "unsupported_personalization",
      severity: "critical",
      title: "No supporting evidence",
      description: "Generation has no evidence-backed claims.",
    })
  }

  return findings
}

export function aggregatePersonalizationRiskLevel(findings: PersonalizationRiskFinding[]): GrowthPersonalizationRiskLevel {
  if (findings.length === 0) return "low"
  return highestRiskLevel(findings.map((finding) => finding.severity))
}

export function shouldBlockPersonalization(findings: PersonalizationRiskFinding[]): boolean {
  return findings.some((finding) => finding.severity === "critical")
}
