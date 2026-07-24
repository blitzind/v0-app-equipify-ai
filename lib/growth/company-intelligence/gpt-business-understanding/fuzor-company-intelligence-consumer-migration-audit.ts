/**
 * FUZOR-COMPANY-INTELLIGENCE-2A — Consumer migration audit.
 * Classifies systems that currently perform business interpretation.
 */

export type FuzorCiMigrationAction =
  | "KEEP"
  | "SIMPLIFY"
  | "REMOVE"
  | "MIGRATE_TO_COMPANY_INTELLIGENCE"

export type FuzorCiConsumerMigrationItem = {
  system: string
  action: FuzorCiMigrationAction
  justification: string
}

export const FUZOR_COMPANY_INTELLIGENCE_CONSUMER_MIGRATION_AUDIT: FuzorCiConsumerMigrationItem[] = [
  {
    system: "Website / page crawl + companyEvidence_v22 extraction",
    action: "KEEP",
    justification:
      "Layer 1 raw evidence gathering. Retains provenance and original excerpts; does not conclude business meaning.",
  },
  {
    system: "DataMoon import / lead metadata",
    action: "KEEP",
    justification: "External evidence connector. Facts only; feed into Company Intelligence evidence packet.",
  },
  {
    system: "industry-classifier.ts",
    action: "REMOVE",
    justification: "Deterministic industry labeling is Layer 2 interpretation. GPT Company Intelligence replaces it.",
  },
  {
    system: "website-maturity-score.ts",
    action: "REMOVE",
    justification: "Website UX scoring is not business understanding and misleads downstream employees.",
  },
  {
    system: "pain-signal-detector.ts",
    action: "REMOVE",
    justification: "Synthetic operational challenges from page heuristics. GPT operationalChallenges replaces this.",
  },
  {
    system: "research-summary-builder.ts",
    action: "REMOVE",
    justification: "Score-sentence summaries duplicate Layer 2. Executive summary comes from Company Intelligence.",
  },
  {
    system: "pitch-angle-generator.ts / recommendedNextAction",
    action: "MIGRATE_TO_COMPANY_INTELLIGENCE",
    justification:
      "Sales judgment belongs in Ava (Layer 3), consuming Company Intelligence + Equipify profile — not research.",
  },
  {
    system: "company-evidence-mission-comparison.ts",
    action: "REMOVE",
    justification: "Equipify-mission scoring inside company evidence mixes seller reasoning into understanding.",
  },
  {
    system: "company-evidence-quality-score.ts",
    action: "SIMPLIFY",
    justification:
      "Numeric confidence may remain as collection health for crawlers, but must not substitute for understanding.",
  },
  {
    system: "7.6A company_intelligence_snapshots (deterministic facts)",
    action: "KEEP",
    justification:
      "Layer 1/fact promotion store. Remains for verified field facts; GPT understanding lives in fuzor versions table.",
  },
  {
    system: "Ava direct outreach (AVA-SIMPLE-OUTREACH)",
    action: "MIGRATE_TO_COMPANY_INTELLIGENCE",
    justification:
      "Should consume loadCompanyIntelligence() + Equipify profile instead of re-assembling research scores.",
  },
  {
    system: "Daily Brief / Executive Briefing",
    action: "MIGRATE_TO_COMPANY_INTELLIGENCE",
    justification: "Company narrative should come from canonical understanding, not maturity/pain chips.",
  },
  {
    system: "Package Review",
    action: "MIGRATE_TO_COMPANY_INTELLIGENCE",
    justification: "Operator package context should cite Company Intelligence rather than reinterpreting websites.",
  },
  {
    system: "Lead Workspace / Operator Assist",
    action: "MIGRATE_TO_COMPANY_INTELLIGENCE",
    justification: "One company card for all surfaces — shared understanding prevents divergent descriptions.",
  },
  {
    system: "Discovery / ranking",
    action: "SIMPLIFY",
    justification:
      "Keep retrieval/ranking machinery; replace industry/maturity features with CI operational-model signals later.",
  },
  {
    system: "Future Ivy (investment)",
    action: "MIGRATE_TO_COMPANY_INTELLIGENCE",
    justification: "Ivy = Company Intelligence + investment knowledge. Must not crawl independently.",
  },
  {
    system: "Future AI employees",
    action: "MIGRATE_TO_COMPANY_INTELLIGENCE",
    justification: "Canonical pattern: consume CI via consumeCompanyIntelligenceForAiEmployee().",
  },
  {
    system: "Home",
    action: "KEEP",
    justification: "Out of scope for this milestone; later migration when Home surfaces company narrative.",
  },
]

export function estimateDuplicatedInterpretationReductionPercent(): number {
  // Heuristic from audit: most research interpreters + mission/qualification + pitch generators
  // become removable from understanding paths once CI is authoritative (~75%).
  const removable = FUZOR_COMPANY_INTELLIGENCE_CONSUMER_MIGRATION_AUDIT.filter(
    (i) => i.action === "REMOVE" || i.action === "MIGRATE_TO_COMPANY_INTELLIGENCE",
  ).length
  const total = FUZOR_COMPANY_INTELLIGENCE_CONSUMER_MIGRATION_AUDIT.length
  return Math.round((removable / total) * 100)
}
