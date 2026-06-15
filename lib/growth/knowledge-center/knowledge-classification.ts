/** Phase GS-3A — Deterministic knowledge classification (client-safe). */

import {
  KNOWLEDGE_CATEGORIES,
  type KnowledgeCategory,
  type KnowledgeClassification,
  type KnowledgeSourceType,
} from "@/lib/growth/knowledge-center/knowledge-document-types"

type ClassificationRule = {
  category: KnowledgeCategory
  patterns: RegExp[]
  weight: number
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    category: "faq",
    patterns: [/\bfaq\b/i, /\bfrequently asked\b/i, /\?/, /\bq:\s/i, /\ba:\s/i],
    weight: 12,
  },
  {
    category: "pricing",
    patterns: [/\bpricing\b/i, /\bprice sheet\b/i, /\brate card\b/i, /\bcost\b/i, /\bper seat\b/i],
    weight: 14,
  },
  {
    category: "competitor",
    patterns: [/\bcompetitor\b/i, /\bvs\.?\b/i, /\balternative\b/i, /\bservicetitan\b/i, /\bbattle card\b/i],
    weight: 14,
  },
  {
    category: "playbook",
    patterns: [/\bplaybook\b/i, /\bsales playbook\b/i, /\bmessaging framework\b/i, /\bpositioning\b/i],
    weight: 13,
  },
  {
    category: "case_study",
    patterns: [/\bcase study\b/i, /\bcustomer story\b/i, /\bresults\b/i, /\broi\b/i],
    weight: 12,
  },
  {
    category: "objection",
    patterns: [/\bobjection\b/i, /\bcounter\b/i, /\bpushback\b/i, /\btoo expensive\b/i],
    weight: 13,
  },
  {
    category: "training",
    patterns: [/\btraining\b/i, /\bonboarding\b/i, /\benabledment\b/i, /\benablement\b/i, /\bcoaching guide\b/i],
    weight: 12,
  },
  {
    category: "meeting",
    patterns: [/\bmeeting prep\b/i, /\bagenda\b/i, /\bdiscovery call\b/i, /\bdemo script\b/i],
    weight: 12,
  },
  {
    category: "call",
    patterns: [/\bcall coaching\b/i, /\bcall script\b/i, /\bvoicemail\b/i, /\bvoice drop\b/i],
    weight: 12,
  },
  {
    category: "product",
    patterns: [/\bproduct\b/i, /\bfeature\b/i, /\bcapability\b/i, /\bdocumentation\b/i, /\bplatform\b/i],
    weight: 10,
  },
]

function normalizeText(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase()
}

export function classifyKnowledgeDocument(input: {
  title: string
  content: string
  source_type: KnowledgeSourceType
  source_url?: string | null
  source_filename?: string | null
  tags?: string[]
}): KnowledgeClassification {
  const corpus = normalizeText([
    input.title,
    input.content,
    input.source_url,
    input.source_filename,
    ...(input.tags ?? []),
  ])

  if (input.source_type === "faq") {
    return {
      category: "faq",
      confidence: 95,
      reasons: ["FAQ source type"],
    }
  }

  const scores = new Map<KnowledgeCategory, { score: number; reasons: string[] }>()

  for (const rule of CLASSIFICATION_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(corpus)) {
        const existing = scores.get(rule.category) ?? { score: 0, reasons: [] }
        existing.score += rule.weight
        existing.reasons.push(`Matched ${rule.category} pattern`)
        scores.set(rule.category, existing)
      }
    }
  }

  if (input.source_type === "url" && /pricing|plans|quote/i.test(corpus)) {
    const pricing = scores.get("pricing") ?? { score: 0, reasons: [] }
    pricing.score += 8
    pricing.reasons.push("URL suggests pricing content")
    scores.set("pricing", pricing)
  }

  if (input.source_filename && /\.pdf$/i.test(input.source_filename)) {
    const playbook = scores.get("playbook") ?? { score: 0, reasons: [] }
    playbook.score += 4
    playbook.reasons.push("PDF filename heuristic")
    scores.set("playbook", playbook)
  }

  let best: KnowledgeCategory = "other"
  let bestScore = 0
  let reasons: string[] = []

  for (const [category, value] of scores) {
    if (value.score > bestScore) {
      best = category
      bestScore = value.score
      reasons = value.reasons
    }
  }

  if (bestScore === 0) {
    return {
      category: "other",
      confidence: 55,
      reasons: ["No strong category signals — defaulting to other"],
    }
  }

  const confidence = Math.min(98, Math.round(55 + bestScore * 2))
  return {
    category: KNOWLEDGE_CATEGORIES.includes(best) ? best : "other",
    confidence,
    reasons: reasons.slice(0, 4),
  }
}
