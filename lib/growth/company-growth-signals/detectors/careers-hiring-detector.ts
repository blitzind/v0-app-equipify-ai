/** Careers + hiring signal detection from page content. Client-safe. */

import type {
  GrowthEvidenceSourceType,
  RawEvidenceSourceCandidate,
  RawGrowthSignalCandidate,
} from "@/lib/growth/company-growth-signals/company-growth-signal-types"

type HiringRule = {
  signal_type: RawGrowthSignalCandidate["signal_type"]
  patterns: RegExp[]
  label: string
}

const HIRING_RULES: HiringRule[] = [
  {
    signal_type: "hiring_technicians",
    label: "Technician hiring",
    patterns: [
      /\bhvac technician\b/i,
      /\bfield service technician\b/i,
      /\bmaintenance technician\b/i,
      /\binstallation technician\b/i,
      /\bbiomedical technician\b/i,
      /\bequipment technician\b/i,
    ],
  },
  {
    signal_type: "hiring_operations",
    label: "Operations hiring",
    patterns: [
      /\bservice manager\b/i,
      /\boperations manager\b/i,
      /\bdispatcher\b/i,
      /\bdispatch manager\b/i,
      /\bfield service engineer\b/i,
      /\boperations director\b/i,
    ],
  },
]

const CAREERS_PATH_HINTS = /\/careers|\/jobs|\/join-our-team|\/employment|greenhouse\.io|lever\.co|workday/i
const ATS_HINTS = /greenhouse\.io|lever\.co|icims\.com|workday\.com|paylocity\.com|bamboohr\.com/i

function excerpt(text: string, max = 240): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max)
}

export function detectCareersPageEvidence(input: {
  pageUrl: string
  html: string
  plainText: string
}): { evidence: RawEvidenceSourceCandidate[]; signals: RawGrowthSignalCandidate[] } {
  const evidence: RawEvidenceSourceCandidate[] = []
  const signals: RawGrowthSignalCandidate[] = []
  const haystack = `${input.html}\n${input.plainText}`

  if (!CAREERS_PATH_HINTS.test(input.pageUrl) && !/\bcareers\b|\bjoin our team\b|\bwe're hiring\b|\bopen positions\b/i.test(haystack)) {
    return { evidence, signals }
  }

  evidence.push({
    source_type: "careers_page",
    source_url: input.pageUrl,
    confidence_score: ATS_HINTS.test(haystack) ? 85 : 70,
    evidence_excerpt: excerpt(
      haystack.match(/(?:careers|jobs|open positions|join our team)[^.]{0,160}/i)?.[0] ?? input.plainText.slice(0, 160),
    ),
    metadata: { ats_detected: ATS_HINTS.test(haystack) },
  })

  for (const rule of HIRING_RULES) {
    for (const pattern of rule.patterns) {
      const match = haystack.match(pattern)
      if (!match) continue
      const contextStart = Math.max(0, (match.index ?? 0) - 40)
      signals.push({
        signal_type: rule.signal_type,
        confidence_score: ATS_HINTS.test(haystack) ? 82 : 72,
        source_type: "careers_page",
        source_url: input.pageUrl,
        evidence_excerpt: excerpt(haystack.slice(contextStart, contextStart + 200)),
        metadata: { hiring_role: rule.label },
      })
      break
    }
  }

  if (/\bnew location\b|\bnow hiring in\b|\bopening in\b/i.test(haystack)) {
    signals.push({
      signal_type: "new_location",
      confidence_score: 68,
      source_type: "careers_page",
      source_url: input.pageUrl,
      evidence_excerpt: excerpt(haystack.match(/(?:new location|now hiring in|opening in)[^.]{0,120}/i)?.[0] ?? ""),
    })
  }

  return { evidence, signals }
}

export const CAREERS_CRAWL_PATHS = ["/careers", "/jobs", "/join-our-team", "/employment"]
