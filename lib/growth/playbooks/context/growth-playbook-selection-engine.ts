/** GS-AI-PLAYBOOK-2B — Deterministic playbook selection engine (client-safe). */

import type {
  GrowthIndustryPlaybook,
  GrowthIndustryPlaybookBuyerPersona,
  GrowthIndustryPlaybookCapabilityMapping,
  GrowthIndustryPlaybookStoryline,
  GrowthIndustryPlaybookStructuredObjection,
} from "@/lib/growth/playbooks/industry-playbook-types"
import type {
  GrowthPlaybookContextInput,
  GrowthPlaybookRankedCta,
  GrowthPlaybookRankedStoryline,
  GrowthPlaybookSelectionTheme,
} from "@/lib/growth/playbooks/context/growth-playbook-context-types"

const THEME_KEYWORDS: Record<GrowthPlaybookSelectionTheme, RegExp> = {
  pm: /\b(pm|preventive maintenance|planned maintenance|maintenance schedule|pm due|pm compliance)\b/i,
  compliance: /\b(compliance|audit|recall|regulatory|inspection|accreditation|joint commission|fda|iso)\b/i,
  dispatch: /\b(dispatch|routing|schedule board|technician assignment|first[- ]time fix|truck roll)\b/i,
  scaling: /\b(hiring|technician|headcount|scale|growth|multi[- ]location|expand|capacity|backlog)\b/i,
  financial: /\b(revenue|margin|billing|invoice|warranty|cost|leakage|contract churn|unbilled)\b/i,
  growth: /\b(contract|agreement|recurring|retention|expansion|upsell|portfolio|fleet)\b/i,
  general: /^$/,
}

const STORYLINE_CATEGORY_PATTERNS: Record<GrowthPlaybookRankedStoryline["category"], RegExp> = {
  operational: /\b(dispatch|pm|technician|workflow|backlog|utilization|maintenance|service bottleneck|documentation)\b/i,
  financial: /\b(revenue|margin|billing|cost|leakage|warranty|invoice|profit|contract value)\b/i,
  growth: /\b(scale|growth|contract|expansion|hiring|capacity|retention|portfolio|multi[- ]location)\b/i,
}

const CTA_STYLE_PATTERNS: Record<GrowthPlaybookRankedCta["style"], RegExp> = {
  consultative: /\b(compare|review|worth|helpful|useful|open to|curious|explore|walk through)\b/i,
  workflow: /\b(workflow|process|how you|how your team|tracking|handling|managing)\b/i,
  demo: /\b(demo|show|walkthrough|brief overview|quick look|see how)\b/i,
  general: /.*/,
}

const PERSONA_TITLE_PATTERNS: Array<{ pattern: RegExp; personaTitles: string[]; reason: string }> = [
  {
    pattern: /\b(dispatch|scheduler|routing|service board)\b/i,
    personaTitles: ["Service Manager", "Dispatcher", "Dispatch Manager", "Field Service Manager", "Field Supervisor"],
    reason: "Dispatch-related signals detected",
  },
  {
    pattern: /\b(compliance|audit|recall|regulatory|inspection|htm|biomed|joint commission|fda)\b/i,
    personaTitles: [
      "Compliance Manager",
      "HTM Director",
      "Clinical Engineering Manager",
      "Biomed Shop Supervisor",
    ],
    reason: "Compliance-related signals detected",
  },
  {
    pattern: /\b(owner|president|ceo|founder|executive|vp|director|operations)\b/i,
    personaTitles: ["Owner", "Operations Director", "General Manager"],
    reason: "Executive or operations language detected",
  },
  {
    pattern: /\b(service manager|field service|service director)\b/i,
    personaTitles: ["Service Manager", "Field Service Manager"],
    reason: "Service leadership signals detected",
  },
]

function normalizeHaystack(input: GrowthPlaybookContextInput): string {
  return [
    ...(input.verifiedFacts ?? []),
    ...(input.leadSignals ?? []),
    ...(input.researchSignals ?? []),
    ...(input.hiringSignals ?? []),
    ...(input.websiteSignals ?? []),
    ...(input.evidenceLabels ?? []),
    input.decisionMakerTitle ?? "",
    input.companySize ?? "",
    input.regenerationFeedback?.customNotes ?? "",
  ]
    .join(" ")
    .toLowerCase()
}

function detectThemes(haystack: string): GrowthPlaybookSelectionTheme[] {
  const themes = (Object.keys(THEME_KEYWORDS) as GrowthPlaybookSelectionTheme[]).filter(
    (theme) => theme !== "general" && THEME_KEYWORDS[theme].test(haystack),
  )
  return themes.length > 0 ? themes : ["general"]
}

function themeBoost(text: string, themes: GrowthPlaybookSelectionTheme[]): number {
  let score = 0
  for (const theme of themes) {
    if (theme === "general") continue
    if (THEME_KEYWORDS[theme].test(text)) score += 12
  }
  return score
}

function scoreText(text: string, themes: GrowthPlaybookSelectionTheme[], index: number): number {
  return themeBoost(text, themes) + Math.max(0, 8 - index)
}

function rankStrings(items: string[], themes: GrowthPlaybookSelectionTheme[], limit: number): string[] {
  return [...items]
    .map((item, index) => ({ item, score: scoreText(item, themes, index) }))
    .sort((a, b) => b.score - a.score || a.item.localeCompare(b.item))
    .slice(0, limit)
    .map((entry) => entry.item)
}

function allPains(playbook: GrowthIndustryPlaybook): string[] {
  const operational = playbook.operationalPains ?? []
  const financial = playbook.financialPains ?? []
  if (operational.length || financial.length) return [...operational, ...financial]
  return playbook.pains
}

function allStorylines(playbook: GrowthIndustryPlaybook): GrowthIndustryPlaybookStoryline[] {
  if (playbook.storylines?.length) return playbook.storylines
  return playbook.videoStorylines
}

function classifyStoryline(storyline: GrowthIndustryPlaybookStoryline): GrowthPlaybookRankedStoryline["category"] {
  const haystack = `${storyline.title} ${storyline.hook} ${storyline.theme ?? ""}`
  if (STORYLINE_CATEGORY_PATTERNS.financial.test(haystack)) return "financial"
  if (STORYLINE_CATEGORY_PATTERNS.growth.test(haystack)) return "growth"
  return "operational"
}

function classifyCtaStyle(cta: string): GrowthPlaybookRankedCta["style"] {
  if (CTA_STYLE_PATTERNS.consultative.test(cta)) return "consultative"
  if (CTA_STYLE_PATTERNS.workflow.test(cta)) return "workflow"
  if (CTA_STYLE_PATTERNS.demo.test(cta)) return "demo"
  return "general"
}

function rankCtas(ctas: string[], themes: GrowthPlaybookSelectionTheme[]): GrowthPlaybookRankedCta[] {
  const ranked = [...ctas]
    .map((cta, index) => ({
      cta,
      style: classifyCtaStyle(cta),
      score: scoreText(cta, themes, index) + (classifyCtaStyle(cta) === "consultative" ? 4 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.cta.localeCompare(b.cta))

  const styleOrder: GrowthPlaybookRankedCta["style"][] = ["consultative", "workflow", "demo", "general"]
  const picked: GrowthPlaybookRankedCta[] = []
  const used = new Set<string>()

  for (const style of styleOrder) {
    const match = ranked.find((entry) => entry.style === style && !used.has(entry.cta))
    if (!match) continue
    used.add(match.cta)
    picked.push({
      cta: match.cta,
      style: match.style,
      rank: picked.length === 0 ? "primary" : picked.length === 1 ? "secondary" : "tertiary",
    })
    if (picked.length >= 3) break
  }

  for (const entry of ranked) {
    if (picked.length >= 3) break
    if (used.has(entry.cta)) continue
    used.add(entry.cta)
    picked.push({
      cta: entry.cta,
      style: entry.style,
      rank: picked.length === 0 ? "primary" : picked.length === 1 ? "secondary" : "tertiary",
    })
  }

  return picked
}

function rankStorylines(
  storylines: GrowthIndustryPlaybookStoryline[],
  themes: GrowthPlaybookSelectionTheme[],
): GrowthPlaybookRankedStoryline[] {
  const scored = storylines.map((storyline, index) => ({
    storyline,
    category: classifyStoryline(storyline),
    score:
      scoreText(`${storyline.title} ${storyline.hook}`, themes, index) +
      (storyline.theme ? themeBoost(storyline.theme, themes) : 0),
  }))

  const picked: GrowthPlaybookRankedStoryline[] = []
  const used = new Set<string>()

  for (const category of ["operational", "financial", "growth"] as const) {
    const match = scored
      .filter((entry) => entry.category === category)
      .sort((a, b) => b.score - a.score)[0]
    if (match && !used.has(match.storyline.title)) {
      used.add(match.storyline.title)
      picked.push({ storyline: match.storyline, category: match.category })
    }
  }

  for (const entry of scored.sort((a, b) => b.score - a.score)) {
    if (picked.length >= 3) break
    if (used.has(entry.storyline.title)) continue
    used.add(entry.storyline.title)
    picked.push({ storyline: entry.storyline, category: entry.category })
  }

  return picked.slice(0, 3)
}

function selectPersonas(
  personas: GrowthIndustryPlaybookBuyerPersona[],
  haystack: string,
  decisionMakerTitle: string | null | undefined,
): {
  primary: GrowthIndustryPlaybookBuyerPersona | null
  secondary: GrowthIndustryPlaybookBuyerPersona | null
  reason: string | null
} {
  if (personas.length === 0) {
    return { primary: null, secondary: null, reason: null }
  }

  const titleHaystack = `${haystack} ${decisionMakerTitle ?? ""}`.toLowerCase()

  for (const rule of PERSONA_TITLE_PATTERNS) {
    if (!rule.pattern.test(titleHaystack)) continue
    const primary =
      personas.find((persona) => rule.personaTitles.some((title) => persona.title.includes(title))) ?? personas[0]
    const secondary =
      personas.find((persona) => persona.title !== primary.title && rule.personaTitles.some((title) => persona.title.includes(title))) ??
      personas.find((persona) => persona.title !== primary.title) ??
      null
    return { primary, secondary, reason: rule.reason }
  }

  const primary = personas[0] ?? null
  const secondary = personas.find((persona) => persona.title !== primary?.title) ?? null
  return { primary, secondary, reason: "Default persona ordering" }
}

function applyRegenerationFeedbackAdjustments(
  themes: GrowthPlaybookSelectionTheme[],
  feedback: GrowthPlaybookContextInput["regenerationFeedback"],
): GrowthPlaybookSelectionTheme[] {
  if (!feedback) return themes
  if (feedback.category === "wrong_industry_assumptions") return ["general"]
  if (feedback.category === "too_generic") return [...new Set([...themes, "general"])]
  if (feedback.category === "not_enough_personalization") return themes.filter((theme) => theme !== "general")
  return themes
}

function selectObjections(
  playbook: GrowthIndustryPlaybook,
  themes: GrowthPlaybookSelectionTheme[],
): GrowthIndustryPlaybookStructuredObjection[] {
  const objections = playbook.structuredObjections ?? []
  if (objections.length === 0) {
    return playbook.objections.slice(0, 5).map((objection) => ({
      objection,
      recommendedResponse: "Totally fair — most teams we talk to are evaluating whether a change is worth the lift right now.",
      recommendedDiscoveryQuestion: "What would need to be true for a workflow review to be worthwhile?",
    }))
  }

  return [...objections]
    .map((entry, index) => ({
      entry,
      score: scoreText(`${entry.objection} ${entry.recommendedResponse}`, themes, index),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((row) => row.entry)
}

function selectCapabilities(
  playbook: GrowthIndustryPlaybook,
  themes: GrowthPlaybookSelectionTheme[],
  limit: number,
): GrowthIndustryPlaybookCapabilityMapping[] {
  return [...playbook.capabilityMappings]
    .map((entry, index) => ({
      entry,
      score: scoreText(`${entry.capability} ${entry.painSignal} ${entry.equipifyModule}`, themes, index),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.entry)
}

function selectSignals(playbook: GrowthIndustryPlaybook, themes: GrowthPlaybookSelectionTheme[], limit: number): string[] {
  const success = playbook.successSignals ?? []
  const warning = playbook.warningSignals ?? []
  const combined = [...success, ...warning]
  if (combined.length === 0) return []
  return rankStrings(combined, themes, limit)
}

export function selectGrowthPlaybookContext(input: GrowthPlaybookContextInput): {
  activeThemes: GrowthPlaybookSelectionTheme[]
  selectedPains: string[]
  selectedDiscoveryQuestions: string[]
  selectedCtas: string[]
  selectedStorylines: GrowthIndustryPlaybookStoryline[]
  selectedCapabilities: GrowthIndustryPlaybookCapabilityMapping[]
  selectedObjections: GrowthIndustryPlaybookStructuredObjection[]
  selectedBuyerPersonas: GrowthIndustryPlaybookBuyerPersona[]
  selectedSignals: string[]
  selectedVocabulary: string[]
  selectedTriggers: string[]
  primaryPersona: GrowthIndustryPlaybookBuyerPersona | null
  secondaryPersona: GrowthIndustryPlaybookBuyerPersona | null
  rankedCtas: GrowthPlaybookRankedCta[]
  rankedStorylines: GrowthPlaybookRankedStoryline[]
  selectionDiagnostics: {
    signalHaystackTerms: string[]
    matchedThemes: GrowthPlaybookSelectionTheme[]
    personaSelectionReason: string | null
  }
} {
  const haystack = normalizeHaystack(input)
  let themes = detectThemes(haystack)
  themes = applyRegenerationFeedbackAdjustments(themes, input.regenerationFeedback)

  const pains = rankStrings(allPains(input.playbook), themes, 3)
  const discoveryQuestions = rankStrings(input.playbook.discoveryQuestions, themes, 3)
  const rankedCtas = rankCtas(input.playbook.recommendedCtas, themes)
  const rankedStorylines = rankStorylines(allStorylines(input.playbook), themes)
  const selectedCapabilities = selectCapabilities(input.playbook, themes, 3)
  const selectedObjections = selectObjections(input.playbook, themes)
  const personas = input.playbook.buyerPersonas ?? []
  const personaSelection = selectPersonas(personas, haystack, input.decisionMakerTitle)
  const selectedBuyerPersonas = [personaSelection.primary, personaSelection.secondary].filter(
    (entry): entry is GrowthIndustryPlaybookBuyerPersona => Boolean(entry),
  )

  const vocabulary = input.playbook.industryVocabulary ?? []
  const triggers = input.playbook.industryTriggers ?? []
  const selectedVocabulary = rankStrings(vocabulary, themes, 8)
  const selectedTriggers = rankStrings(triggers, themes, 6)
  const selectedSignals = selectSignals(input.playbook, themes, 5)

  return {
    activeThemes: themes,
    selectedPains: pains,
    selectedDiscoveryQuestions: discoveryQuestions,
    selectedCtas: rankedCtas.map((entry) => entry.cta),
    selectedStorylines: rankedStorylines.map((entry) => entry.storyline),
    selectedCapabilities,
    selectedObjections,
    selectedBuyerPersonas,
    selectedSignals,
    selectedVocabulary,
    selectedTriggers,
    primaryPersona: personaSelection.primary,
    secondaryPersona: personaSelection.secondary,
    rankedCtas,
    rankedStorylines,
    selectionDiagnostics: {
      signalHaystackTerms: haystack.split(/\s+/).filter(Boolean).slice(0, 24),
      matchedThemes: themes,
      personaSelectionReason: personaSelection.reason,
    },
  }
}
