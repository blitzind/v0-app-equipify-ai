/**
 * GE-AIOS-CONVERSATION-INTELLIGENCE-2A — Elite SDR observation intelligence (client-safe).
 * Research → many observations → rank → select ONE → conversation → drafts.
 * No new persistence. Extends 1A/1B inside Sales Strategy Brief pipeline.
 */

import type { EquipifyIndustryKnowledge } from "@/lib/growth/business-profile/equipify-master-knowledge-types"
import type { ProspectKnowledgePack } from "@/lib/growth/research/company-evidence/prospect-knowledge-pack"
import type { GrowthOutreachEvidenceCitation } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"

export const GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2A_QA_MARKER =
  "ge-aios-conversation-intelligence-2a-elite-sdr-intelligence-v1" as const

const RAW_EVIDENCE_NOISE =
  /^(verified|unverified)\s+(description|product|service|signal|indicator|finding)\s*(\(\d+%\))?\s*:?\s*/i

function sanitizeRawEvidenceForProspect(raw: string): string {
  let text = raw.trim()
  text = text.replace(RAW_EVIDENCE_NOISE, "")
  text = text.replace(/\(\d+%\)/g, "")
  text = text.replace(/^(company summary|service indicator|source|pain point):\s*/i, "")
  text = text.replace(/\s*\/\s*verified product:/gi, ". ")
  text = text.replace(/\s+/g, " ").trim()
  if (text.length > 160) {
    const sentence = text.split(/(?<=[.!?])\s+/)[0] ?? text
    text = sentence.length > 40 ? sentence : `${text.slice(0, 157).trim()}…`
  }
  return text
}

export type GrowthOutreachObservationScores = {
  confidence: number
  businessImportance: number
  originality: number
  conversationPotential: number
  specificity: number
  evidenceStrength: number
  competitorObviousness: number
  prospectAlreadyKnows: number
  equipifyRelevance: number
  learningBoost: number
  total: number
}

export type GrowthOutreachObservationCandidate = {
  id: string
  themeKey: string
  source: string
  rawDetail: string
  internalNote: string
  /** Consultant-style observation — never obvious, never internal. */
  consultantObservation: string
  curiousAngle: string
  businessOutcome: string | null
  showToProspect: boolean
  scores: GrowthOutreachObservationScores
}

export type GrowthOutreachObservationSelection = {
  candidates: GrowthOutreachObservationCandidate[]
  selected: GrowthOutreachObservationCandidate | null
  runnerUp: GrowthOutreachObservationCandidate | null
  selectionRationale: string | null
  themeKey: string | null
}

export type GrowthOutreachLearningThemeWeight = {
  themeKey: string
  replyRatePct: number | null
  sends: number
}

const OBVIOUS_OBSERVATION_PATTERN =
  /\byou (repair|service|sell|provide|offer|support) (medical|equipment|imaging)\b/i

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.replace(/\s+/g, " ") : null
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function hashStable(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0
  return h
}

function corpusFromInput(input: {
  evidence: GrowthOutreachEvidenceCitation[]
  equipment: string[]
  companyName?: string | null
  website?: string | null
}): string {
  return [
    input.companyName ?? "",
    input.website ?? "",
    ...input.evidence.map((e) => e.detail),
    ...input.equipment,
  ]
    .join(" ")
    .toLowerCase()
}

type ObservationTemplate = {
  themeKey: string
  source: string
  match: (corpus: string, detail: string) => boolean
  consultantObservation: string
  curiousAngle: string
  businessOutcome: string
  base: Omit<GrowthOutreachObservationScores, "learningBoost" | "total">
}

const OBSERVATION_TEMPLATES: ObservationTemplate[] = [
  {
    themeKey: "refurb_oem_imaging_mix",
    source: "Service mix",
    match: (c) => /refurb|oem|refurbished/.test(c) && /imaging|mri|ct/.test(c),
    consultantObservation:
      "You appear to support both refurbished and OEM imaging systems — that usually creates a different parts and dispatch rhythm than OEM-only shops.",
    curiousAngle:
      "whether keeping parts availability aligned across field teams has gotten harder as refurbished inventory has grown",
    businessOutcome: "parts availability and depot turnaround across mixed inventory",
    base: {
      confidence: 0.82,
      businessImportance: 0.9,
      originality: 0.92,
      conversationPotential: 0.9,
      specificity: 0.9,
      evidenceStrength: 0.85,
      competitorObviousness: 0.15,
      prospectAlreadyKnows: 0.35,
      equipifyRelevance: 0.88,
    },
  },
  {
    themeKey: "imaging_depot_field_rhythm",
    source: "Operations model",
    match: (c) => /depot|field service|refurbish|lifecycle/.test(c) && /imaging|mri|ct/.test(c),
    consultantObservation:
      "Refurb + field imaging ops across provider sites is a specific rhythm — not every imaging shop runs depot and field on the same operating model.",
    curiousAngle:
      "whether coordinating depot turnaround with field uptime has become the harder problem as volume shifts",
    businessOutcome: "imaging uptime and depot turnaround predictability",
    base: {
      confidence: 0.88,
      businessImportance: 0.92,
      originality: 0.88,
      conversationPotential: 0.92,
      specificity: 0.88,
      evidenceStrength: 0.9,
      competitorObviousness: 0.2,
      prospectAlreadyKnows: 0.4,
      equipifyRelevance: 0.9,
    },
  },
  {
    themeKey: "installed_base_growth",
    source: "Scale signals",
    match: (c) => /installed base|nationwide|multi.?site|global|healthcare provider/.test(c),
    consultantObservation:
      "Operating at scale across multiple provider sites usually means handoffs — not headcount — become the constraint first.",
    curiousAngle:
      "at what point scheduling became less of the challenge than keeping everyone working from the same information",
    businessOutcome: "workflow consistency across sites without adding admin drag",
    base: {
      confidence: 0.78,
      businessImportance: 0.85,
      originality: 0.8,
      conversationPotential: 0.85,
      specificity: 0.75,
      evidenceStrength: 0.75,
      competitorObviousness: 0.35,
      prospectAlreadyKnows: 0.55,
      equipifyRelevance: 0.82,
    },
  },
  {
    themeKey: "technician_hiring_strain",
    source: "Careers",
    match: (c) => /hiring|technician|biomedical|engineer|career|job opening/.test(c),
    consultantObservation:
      "Hiring skilled field and depot capacity while volume shifts — that combo often exposes dispatch strain before teams catch up.",
    curiousAngle:
      "whether technician utilization is keeping pace with hiring, or dispatch is absorbing the gap",
    businessOutcome: "technician utilization without dispatch chaos",
    base: {
      confidence: 0.72,
      businessImportance: 0.8,
      originality: 0.78,
      conversationPotential: 0.8,
      specificity: 0.7,
      evidenceStrength: 0.7,
      competitorObviousness: 0.45,
      prospectAlreadyKnows: 0.5,
      equipifyRelevance: 0.78,
    },
  },
  {
    themeKey: "customer_portal_visibility",
    source: "Customer experience",
    match: (c) => /customer portal|service request|ticket|status page/.test(c),
    consultantObservation:
      "A customer-facing service portal usually means internal status has to stay accurate — that's harder than it sounds at scale.",
    curiousAngle:
      "whether customer visibility is still accurate by the time field work is done, or if there's quiet delay after the visit",
    businessOutcome: "customer visibility without administrative rework",
    base: {
      confidence: 0.7,
      businessImportance: 0.78,
      originality: 0.82,
      conversationPotential: 0.78,
      specificity: 0.8,
      evidenceStrength: 0.68,
      competitorObviousness: 0.25,
      prospectAlreadyKnows: 0.45,
      equipifyRelevance: 0.75,
    },
  },
  {
    themeKey: "dispatch_to_cash_friction",
    source: "Operations",
    match: (c) => /dispatch|work order|billing|invoice|quote/.test(c),
    consultantObservation:
      "Dispatched service shops often look smooth on the board — the friction shows up between job completion and billing readiness.",
    curiousAngle:
      "where work still creates quiet delay between field completion and billing readiness",
    businessOutcome: "dispatch-to-cash visibility without admin drag",
    base: {
      confidence: 0.68,
      businessImportance: 0.82,
      originality: 0.75,
      conversationPotential: 0.82,
      specificity: 0.65,
      evidenceStrength: 0.65,
      competitorObviousness: 0.4,
      prospectAlreadyKnows: 0.6,
      equipifyRelevance: 0.85,
    },
  },
  {
    themeKey: "pm_compliance_pressure",
    source: "Maintenance",
    match: (c) => /preventive|pm schedule|maintenance plan|calibration/.test(c),
    consultantObservation:
      "PM-heavy operations tend to break down when due dates live in one system and work orders live in another.",
    curiousAngle:
      "whether PM compliance is still predictable, or if due-date drift is creating last-minute fire drills",
    businessOutcome: "PM compliance without duplicate scheduling work",
    base: {
      confidence: 0.74,
      businessImportance: 0.8,
      originality: 0.8,
      conversationPotential: 0.8,
      specificity: 0.72,
      evidenceStrength: 0.72,
      competitorObviousness: 0.3,
      prospectAlreadyKnows: 0.5,
      equipifyRelevance: 0.8,
    },
  },
  {
    themeKey: "first_time_fix_pressure",
    source: "Service quality",
    match: (c) => /first.?time fix|callback|repeat visit|truck roll/.test(c),
    consultantObservation:
      "Callback pressure usually traces back to job context — not technician skill — arriving incomplete in the field.",
    curiousAngle:
      "whether incomplete job packets are driving repeat visits more than capacity constraints",
    businessOutcome: "first-time fix rate and technician productivity",
    base: {
      confidence: 0.66,
      businessImportance: 0.78,
      originality: 0.85,
      conversationPotential: 0.78,
      specificity: 0.78,
      evidenceStrength: 0.62,
      competitorObviousness: 0.2,
      prospectAlreadyKnows: 0.4,
      equipifyRelevance: 0.76,
    },
  },
]

function templateCandidate(
  template: ObservationTemplate,
  rawDetail: string,
  learningBoost: number,
  idSuffix: string,
): GrowthOutreachObservationCandidate {
  const learning = clamp01(learningBoost)
  const penalty =
    (template.base.competitorObviousness + template.base.prospectAlreadyKnows) * 0.08
  const total = clamp01(
    template.base.confidence * 0.14 +
      template.base.businessImportance * 0.16 +
      template.base.originality * 0.14 +
      template.base.conversationPotential * 0.14 +
      template.base.specificity * 0.14 +
      template.base.evidenceStrength * 0.12 +
      template.base.equipifyRelevance * 0.1 +
      learning * 0.06 -
      penalty,
  )
  return {
    id: `obs:${template.themeKey}:${idSuffix}`,
    themeKey: template.themeKey,
    source: template.source,
    rawDetail,
    internalNote: rawDetail,
    consultantObservation: template.consultantObservation,
    curiousAngle: template.curiousAngle,
    businessOutcome: template.businessOutcome,
    showToProspect: !OBVIOUS_OBSERVATION_PATTERN.test(template.consultantObservation),
    scores: {
      ...template.base,
      learningBoost: learning,
      total,
    },
  }
}

function candidateFromEvidenceLine(
  row: GrowthOutreachEvidenceCitation,
  corpus: string,
  learningWeights: Map<string, number>,
  index: number,
): GrowthOutreachObservationCandidate[] {
  const detail = sanitizeRawEvidenceForProspect(row.detail)
  if (detail.length < 12) return []
  const out: GrowthOutreachObservationCandidate[] = []
  for (const template of OBSERVATION_TEMPLATES) {
    if (!template.match(corpus, detail)) continue
    const boost = learningWeights.get(template.themeKey) ?? 0
    out.push(templateCandidate(template, detail, boost, `${index}:${template.themeKey}`))
  }
  return out
}

function candidatesFromKnowledgePack(
  pack: ProspectKnowledgePack,
  corpus: string,
  learningWeights: Map<string, number>,
): GrowthOutreachObservationCandidate[] {
  const out: GrowthOutreachObservationCandidate[] = []
  const rows = [...pack.observed_facts, ...pack.derived_inferences]
  for (const [index, row] of rows.entries()) {
    const excerpt = clean(
      typeof row.evidenceExcerpt === "string"
        ? row.evidenceExcerpt
        : Array.isArray(row.value)
          ? row.value.join(", ")
          : typeof row.value === "string"
            ? row.value
            : null,
    )
    if (!excerpt) continue
    const detail = sanitizeRawEvidenceForProspect(excerpt)
    for (const template of OBSERVATION_TEMPLATES) {
      if (!template.match(corpus, detail) && !template.match(corpus, row.field)) continue
      const confBoost = row.confidence != null ? row.confidence * 0.05 : 0
      const boost = (learningWeights.get(template.themeKey) ?? 0) + confBoost
      out.push(templateCandidate(template, detail, boost, `pkp:${index}:${row.field}`))
    }
  }
  return out
}

function candidatesFromEquipment(
  equipment: string[],
  corpus: string,
  learningWeights: Map<string, number>,
): GrowthOutreachObservationCandidate[] {
  const out: GrowthOutreachObservationCandidate[] = []
  for (const [index, item] of equipment.entries()) {
    const detail = item.trim()
    if (!detail) continue
    const lower = `${corpus} ${detail}`.toLowerCase()
    if (/mri|ct|imaging/.test(lower)) {
      const boost = learningWeights.get("imaging_depot_field_rhythm") ?? 0
      out.push(
        templateCandidate(
          OBSERVATION_TEMPLATES.find((t) => t.themeKey === "imaging_depot_field_rhythm")!,
          detail,
          boost,
          `equip:${index}`,
        ),
      )
    }
    if (/refurb|oem/.test(lower)) {
      const boost = learningWeights.get("refurb_oem_imaging_mix") ?? 0
      out.push(
        templateCandidate(
          OBSERVATION_TEMPLATES.find((t) => t.themeKey === "refurb_oem_imaging_mix")!,
          detail,
          boost,
          `equip:${index}:mix`,
        ),
      )
    }
  }
  return out
}

export function buildLearningWeightMap(
  weights: GrowthOutreachLearningThemeWeight[] | null | undefined,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of weights ?? []) {
    if (row.sends < 3 || row.replyRatePct == null) continue
    map.set(row.themeKey, clamp01(row.replyRatePct / 100))
  }
  return map
}

/** Discover 20–40 consultant-grade observation candidates from existing research inputs. */
export function discoverObservationCandidates(input: {
  evidence: GrowthOutreachEvidenceCitation[]
  equipment: string[]
  companyName?: string | null
  website?: string | null
  prospectKnowledgePack?: ProspectKnowledgePack | null
  learningWeights?: GrowthOutreachLearningThemeWeight[] | null
}): GrowthOutreachObservationCandidate[] {
  const corpus = corpusFromInput(input)
  const learningMap = buildLearningWeightMap(input.learningWeights)
  const seen = new Set<string>()
  const candidates: GrowthOutreachObservationCandidate[] = []

  const push = (rows: GrowthOutreachObservationCandidate[]) => {
    for (const row of rows) {
      const key = `${row.themeKey}:${row.consultantObservation.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      candidates.push(row)
    }
  }

  for (const [index, row] of input.evidence.entries()) {
    push(candidateFromEvidenceLine(row, corpus, learningMap, index))
  }
  push(candidatesFromEquipment(input.equipment, corpus, learningMap))
  if (input.prospectKnowledgePack) {
    push(candidatesFromKnowledgePack(input.prospectKnowledgePack, corpus, learningMap))
  }

  // Re-score corpus-only templates once (ensures breadth even with thin evidence)
  for (const template of OBSERVATION_TEMPLATES) {
    if (!template.match(corpus, "")) continue
    const boost = learningMap.get(template.themeKey) ?? 0
    push([templateCandidate(template, corpus.slice(0, 120), boost, `corpus:${template.themeKey}`)])
  }

  return candidates
    .filter((row) => row.showToProspect)
    .sort((a, b) => b.scores.total - a.scores.total)
    .slice(0, 40)
}

export function selectPrimaryObservation(
  candidates: GrowthOutreachObservationCandidate[],
): GrowthOutreachObservationSelection {
  const ranked = [...candidates].sort((a, b) => b.scores.total - a.scores.total)
  const selected = ranked[0] ?? null
  const runnerUp = ranked[1] ?? null
  const selectionRationale = selected
    ? `Selected "${selected.themeKey}" (score ${selected.scores.total.toFixed(2)}) — ${selected.source}: high originality (${selected.scores.originality.toFixed(2)}) and conversation potential (${selected.scores.conversationPotential.toFixed(2)}).`
    : null

  return {
    candidates: ranked,
    selected,
    runnerUp,
    selectionRationale,
    themeKey: selected?.themeKey ?? null,
  }
}

export function buildEliteSdrObservationSelection(input: {
  evidence: GrowthOutreachEvidenceCitation[]
  equipment: string[]
  companyName?: string | null
  website?: string | null
  prospectKnowledgePack?: ProspectKnowledgePack | null
  learningWeights?: GrowthOutreachLearningThemeWeight[] | null
  matchedIndustry?: EquipifyIndustryKnowledge | null
}): GrowthOutreachObservationSelection {
  const candidates = discoverObservationCandidates(input)
  return selectPrimaryObservation(candidates)
}

export function consultantOpeningLine(input: {
  observation: GrowthOutreachObservationCandidate
  seed: string
}): string {
  const observation = input.observation.consultantObservation.trim()
  const firstSentence = observation.split(/(?<=[.!?])\s+/)[0]?.trim() ?? observation
  const options = [observation, firstSentence]
  return options[hashStable(input.seed) % options.length] ?? observation
}

export function buildConsultantQuestion(input: {
  observation: GrowthOutreachObservationCandidate
  seed: string
}): string {
  const angle = input.observation.curiousAngle.replace(/^whether\s+/i, "").replace(/\.$/, "")
  const cap = `${angle.charAt(0).toUpperCase()}${angle.slice(1)}`
  const options = [
    `${cap}?`,
    `${cap} — still a live issue?`,
    `Worth comparing notes on ${angle}?`,
  ]

  if (/\bhas (become|gotten)\b/i.test(angle)) {
    const hasForm = angle.replace(/\bhas (become|gotten)\b/i, "$1")
    options.splice(1, 0, `Has ${hasForm}?`)
  } else if (/^(at what point|where)\b/i.test(angle)) {
    options.splice(1, 0, `${cap} — showing up day to day?`)
  } else if (/^[a-z]+ing\b/i.test(angle)) {
    options.splice(1, 0, `Is ${angle} showing up day to day?`)
  } else {
    options.splice(1, 0, `Does ${angle} show up day to day?`)
  }

  return options[hashStable(`${input.seed}:q`) % options.length] ?? options[0]
}

export function passesConsultantTest(text: string): boolean {
  if (/\b(we help|i help companies|our platform|quick 15 minutes|following up)\b/i.test(text)) {
    return false
  }
  if (/\b(streamline|leverage|comprehensive solution|game.?changer)\b/i.test(text)) {
    return false
  }
  if (/\b(something i kept coming back to|one thing that stood out|i noticed|made me wonder|stood out|caught my eye)\b/i.test(text)) {
    return false
  }
  return true
}
